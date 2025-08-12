-- Create Booking table for linking learners to expert sessions
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  learner_id UUID NOT NULL,
  expert_session_id UUID NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_confirmation', 'confirmed', 'completed', 'cancelled', 'refunded', 'no_show')),
  held_until TIMESTAMP WITH TIME ZONE NOT NULL, -- for temporary holds (~10 minutes)
  
  -- Payment data
  currency TEXT NOT NULL CHECK (currency IN ('DKK', 'USD', 'EUR')),
  amount_authorized INTEGER NOT NULL, -- in minor units (øre for DKK)
  stripe_payment_intent_id TEXT,
  
  -- Optional metadata
  learner_notes TEXT,
  expert_notes TEXT,
  cancellation_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_at > start_at),
  CONSTRAINT valid_hold_time CHECK (held_until > created_at),
  CONSTRAINT valid_amount CHECK (amount_authorized >= 0),
  CONSTRAINT valid_notes_length CHECK (char_length(learner_notes) <= 500),
  CONSTRAINT valid_expert_notes_length CHECK (char_length(expert_notes) <= 500),
  CONSTRAINT valid_cancellation_reason_length CHECK (char_length(cancellation_reason) <= 500),
  
  -- Foreign keys
  FOREIGN KEY (expert_id) REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (learner_id) REFERENCES public.learner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (expert_session_id) REFERENCES public.expert_sessions(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_bookings_expert_id ON public.bookings(expert_id);
CREATE INDEX idx_bookings_learner_id ON public.bookings(learner_id);
CREATE INDEX idx_bookings_expert_session_id ON public.bookings(expert_session_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_start_at ON public.bookings(start_at);
CREATE INDEX idx_bookings_held_until ON public.bookings(held_until) WHERE status = 'pending';
CREATE INDEX idx_bookings_stripe_payment_intent ON public.bookings(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Composite index for finding conflicts
CREATE INDEX idx_bookings_time_conflicts ON public.bookings(expert_id, start_at, end_at) 
  WHERE status IN ('pending', 'awaiting_confirmation', 'confirmed');

-- Enable Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookings
-- Experts can view and manage bookings for their sessions
CREATE POLICY "Experts can manage own bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE ep.id = expert_id AND up.user_id = auth.uid()
    )
  );

-- Learners can view and manage their own bookings
CREATE POLICY "Learners can manage own bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.learner_profiles lp
      JOIN public.user_profiles up ON lp.user_profile_id = up.id
      WHERE lp.id = learner_id AND up.user_id = auth.uid()
    )
  );

-- Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER handle_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to validate booking constraints
CREATE OR REPLACE FUNCTION validate_booking()
RETURNS TRIGGER AS $$
DECLARE
  session_duration INTEGER;
  window_exists BOOLEAN;
  has_conflict BOOLEAN;
BEGIN
  -- Get session duration
  SELECT duration_minutes INTO session_duration
  FROM public.expert_sessions
  WHERE id = NEW.expert_session_id;
  
  -- Validate time alignment (15-minute boundaries)
  IF EXTRACT(EPOCH FROM NEW.start_at)::INTEGER % 900 != 0 THEN
    RAISE EXCEPTION 'Booking start time must be aligned to 15-minute boundaries';
  END IF;
  
  IF EXTRACT(EPOCH FROM NEW.end_at)::INTEGER % 900 != 0 THEN
    RAISE EXCEPTION 'Booking end time must be aligned to 15-minute boundaries';
  END IF;
  
  -- Validate duration matches session
  IF EXTRACT(EPOCH FROM (NEW.end_at - NEW.start_at)) / 60 != session_duration THEN
    RAISE EXCEPTION 'Booking duration must match expert session duration';
  END IF;
  
  -- Check if booking is within an availability window
  SELECT EXISTS(
    SELECT 1 FROM public.availability_windows aw
    WHERE aw.expert_id = NEW.expert_id
      AND aw.is_closed = false
      AND NEW.start_at >= aw.start_at
      AND NEW.end_at <= aw.end_at
  ) INTO window_exists;
  
  IF NOT window_exists THEN
    RAISE EXCEPTION 'Booking must be within an open availability window';
  END IF;
  
  -- Check for conflicting bookings (only for active statuses)
  IF NEW.status IN ('pending', 'awaiting_confirmation', 'confirmed') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.bookings b
      WHERE b.id != COALESCE(NEW.id, gen_random_uuid()) -- Exclude self for updates
        AND b.expert_id = NEW.expert_id
        AND b.status IN ('pending', 'awaiting_confirmation', 'confirmed')
        AND (
          (NEW.start_at < b.end_at AND NEW.end_at > b.start_at) -- Overlap check
        )
    ) INTO has_conflict;
    
    IF has_conflict THEN
      RAISE EXCEPTION 'Booking conflicts with existing booking';
    END IF;
  END IF;
  
  -- Validate hold time for pending bookings
  IF NEW.status = 'pending' AND NEW.held_until <= NEW.created_at + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Hold time must be at least 5 minutes in the future';
  END IF;
  
  -- Validate lead time (at least 2 hours from now)
  IF NEW.start_at < NOW() + INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'Bookings must be made at least 2 hours in advance';
  END IF;
  
  -- Validate booking horizon (max 90 days)
  IF NEW.start_at > NOW() + INTERVAL '90 days' THEN
    RAISE EXCEPTION 'Bookings cannot be made more than 90 days in advance';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate booking constraints
CREATE TRIGGER validate_booking_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking();

-- Function to automatically expire held bookings
CREATE OR REPLACE FUNCTION expire_held_bookings()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.bookings
  SET 
    status = 'cancelled',
    cancellation_reason = 'Hold expired',
    updated_at = NOW()
  WHERE status = 'pending' 
    AND held_until < NOW()
    AND status != 'cancelled';
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bookings for an expert with session details
CREATE OR REPLACE FUNCTION get_expert_bookings(
  p_expert_id UUID,
  p_status TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expert_id UUID,
  learner_id UUID,
  expert_session_id UUID,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  held_until TIMESTAMP WITH TIME ZONE,
  currency TEXT,
  amount_authorized INTEGER,
  stripe_payment_intent_id TEXT,
  learner_notes TEXT,
  expert_notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  -- Session details
  session_title TEXT,
  session_description TEXT,
  session_duration_minutes INTEGER,
  -- Learner details
  learner_name TEXT,
  learner_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.expert_id,
    b.learner_id,
    b.expert_session_id,
    b.start_at,
    b.end_at,
    b.status,
    b.held_until,
    b.currency,
    b.amount_authorized,
    b.stripe_payment_intent_id,
    b.learner_notes,
    b.expert_notes,
    b.cancellation_reason,
    b.created_at,
    b.updated_at,
    -- Session details
    es.title as session_title,
    es.short_description as session_description,
    es.duration_minutes as session_duration_minutes,
    -- Learner details
    lup.display_name as learner_name,
    lup.email as learner_email
  FROM public.bookings b
  JOIN public.expert_sessions es ON b.expert_session_id = es.id
  JOIN public.learner_profiles lp ON b.learner_id = lp.id
  JOIN public.user_profiles lup ON lp.user_profile_id = lup.id
  WHERE 
    b.expert_id = p_expert_id
    AND (p_status IS NULL OR b.status = p_status)
    AND (p_start_date IS NULL OR DATE(b.start_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(b.start_at) <= p_end_date)
  ORDER BY b.start_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bookings for a learner with session and expert details
CREATE OR REPLACE FUNCTION get_learner_bookings(
  p_learner_id UUID,
  p_status TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expert_id UUID,
  learner_id UUID,
  expert_session_id UUID,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  held_until TIMESTAMP WITH TIME ZONE,
  currency TEXT,
  amount_authorized INTEGER,
  stripe_payment_intent_id TEXT,
  learner_notes TEXT,
  expert_notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  -- Session details
  session_title TEXT,
  session_description TEXT,
  session_duration_minutes INTEGER,
  -- Expert details
  expert_name TEXT,
  expert_bio TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.expert_id,
    b.learner_id,
    b.expert_session_id,
    b.start_at,
    b.end_at,
    b.status,
    b.held_until,
    b.currency,
    b.amount_authorized,
    b.stripe_payment_intent_id,
    b.learner_notes,
    b.expert_notes,
    b.cancellation_reason,
    b.created_at,
    b.updated_at,
    -- Session details
    es.title as session_title,
    es.short_description as session_description,
    es.duration_minutes as session_duration_minutes,
    -- Expert details
    eup.display_name as expert_name,
    ep.bio as expert_bio
  FROM public.bookings b
  JOIN public.expert_sessions es ON b.expert_session_id = es.id
  JOIN public.expert_profiles ep ON b.expert_id = ep.id
  JOIN public.user_profiles eup ON ep.user_profile_id = eup.id
  WHERE 
    b.learner_id = p_learner_id
    AND (p_status IS NULL OR b.status = p_status)
    AND (p_start_date IS NULL OR DATE(b.start_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(b.start_at) <= p_end_date)
  ORDER BY b.start_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION expire_held_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION get_expert_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION get_learner_bookings TO authenticated;