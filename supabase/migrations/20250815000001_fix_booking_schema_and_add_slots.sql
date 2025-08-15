-- Migration to fix booking schema and add missing components
-- This aligns the database schema with the implemented API code

-- First, create the slots table that the API expects
CREATE TABLE public.slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_session_id UUID NOT NULL REFERENCES public.expert_sessions(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  max_bookings INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_slot_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_booking_count CHECK (current_bookings <= max_bookings)
);

-- Enable RLS on slots
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for slots
CREATE POLICY "Experts can manage own slots" ON public.slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_sessions es
      JOIN public.expert_profiles ep ON es.expert_id = ep.id
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE es.id = expert_session_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view available slots" ON public.slots
  FOR SELECT USING (is_available = true);

CREATE POLICY "Admins can manage all slots" ON public.slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for slots
CREATE INDEX idx_slots_expert_session_id ON public.slots(expert_session_id);
CREATE INDEX idx_slots_time_range ON public.slots(start_time, end_time);
CREATE INDEX idx_slots_availability ON public.slots(is_available) WHERE is_available = true;

-- Add updated_at trigger for slots
CREATE TRIGGER handle_slots_updated_at
  BEFORE UPDATE ON public.slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Now fix the bookings table to match API expectations
-- First, add the missing columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'));
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount_captured DECIMAL(10,2);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount_refunded DECIMAL(10,2);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10,2);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('student', 'expert', 'system'));
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.expert_sessions(id);

-- Create a function to migrate data from learner_id to student_id
-- This assumes student_id should reference user_profiles directly (not learner_profiles)
CREATE OR REPLACE FUNCTION migrate_booking_student_ids()
RETURNS void AS $$
BEGIN
  -- Update student_id to reference user_profiles.id via learner_profiles
  UPDATE public.bookings
  SET student_id = (
    SELECT up.id
    FROM public.learner_profiles lp
    JOIN public.user_profiles up ON lp.user_profile_id = up.id
    WHERE lp.id = bookings.learner_id
  )
  WHERE student_id IS NULL AND learner_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_booking_student_ids();

-- Create a view that provides the API-expected interface
CREATE OR REPLACE VIEW public.profiles AS 
SELECT 
  up.id,
  up.user_id,
  up.email,
  up.role,
  COALESCE(up.display_name, up.first_name || ' ' || up.last_name) as full_name,
  up.first_name,
  up.last_name,
  up.avatar_url,
  CASE 
    WHEN up.role = 'expert' THEN ep.bio
    ELSE lp.learning_goals
  END as bio,
  up.created_at,
  up.updated_at
FROM public.user_profiles up
LEFT JOIN public.expert_profiles ep ON ep.user_profile_id = up.id
LEFT JOIN public.learner_profiles lp ON lp.user_profile_id = up.id;

-- Enable RLS on the profiles view
ALTER VIEW public.profiles SET (security_invoker = on);

-- Add indexes for the new booking columns
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON public.bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_by ON public.bookings(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON public.bookings(scheduled_at);

-- Update the booking validation function to handle new structure
CREATE OR REPLACE FUNCTION validate_booking_v2()
RETURNS TRIGGER AS $$
DECLARE
  session_duration INTEGER;
  slot_available BOOLEAN;
  has_conflict BOOLEAN;
BEGIN
  -- Skip validation for cancelled/completed bookings
  IF NEW.status IN ('cancelled', 'completed', 'refunded') THEN
    RETURN NEW;
  END IF;

  -- Validate slot availability if slot_id is provided
  IF NEW.slot_id IS NOT NULL THEN
    SELECT is_available INTO slot_available
    FROM public.slots
    WHERE id = NEW.slot_id;
    
    IF NOT slot_available THEN
      RAISE EXCEPTION 'Selected slot is no longer available';
    END IF;
  END IF;

  -- Validate payment status transitions
  IF TG_OP = 'UPDATE' THEN
    -- Ensure valid payment status transitions
    IF OLD.payment_status = 'captured' AND NEW.payment_status NOT IN ('captured', 'refunded') THEN
      RAISE EXCEPTION 'Cannot change payment status from captured to %', NEW.payment_status;
    END IF;
    
    IF OLD.payment_status = 'refunded' AND NEW.payment_status != 'refunded' THEN
      RAISE EXCEPTION 'Cannot change payment status from refunded';
    END IF;
  END IF;

  -- Validate booking status transitions  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status = 'pending' THEN
      RAISE EXCEPTION 'Cannot change confirmed booking back to pending';
    END IF;
  END IF;

  -- Set default scheduled_at from slot times if not provided
  IF NEW.scheduled_at IS NULL AND NEW.slot_id IS NOT NULL THEN
    SELECT start_time INTO NEW.scheduled_at
    FROM public.slots
    WHERE id = NEW.slot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the old booking validation trigger
DROP TRIGGER IF EXISTS validate_booking_trigger ON public.bookings;
CREATE TRIGGER validate_booking_v2_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking_v2();

-- Create function to handle booking timeouts
CREATE OR REPLACE FUNCTION cleanup_expired_bookings()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Cancel bookings that have been pending too long (30 minutes)
  UPDATE public.bookings
  SET 
    status = 'cancelled',
    payment_status = CASE 
      WHEN payment_status = 'authorized' THEN 'cancelled'
      ELSE payment_status
    END,
    cancelled_by = 'system',
    cancellation_reason = 'Booking expired - no expert confirmation',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '30 minutes'
    AND status != 'cancelled';
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Release slots for expired bookings
  UPDATE public.slots
  SET 
    is_available = true,
    current_bookings = GREATEST(0, current_bookings - 1),
    updated_at = NOW()
  WHERE id IN (
    SELECT slot_id 
    FROM public.bookings 
    WHERE status = 'cancelled' 
      AND cancelled_by = 'system' 
      AND cancelled_at >= NOW() - INTERVAL '5 minutes'
      AND slot_id IS NOT NULL
  );
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update slot availability when booking status changes
CREATE OR REPLACE FUNCTION handle_booking_slot_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle slot availability updates based on booking status changes
  IF TG_OP = 'INSERT' THEN
    -- New booking created - mark slot as unavailable if it was available
    IF NEW.slot_id IS NOT NULL AND NEW.status IN ('pending', 'confirmed') THEN
      UPDATE public.slots 
      SET 
        is_available = false,
        current_bookings = current_bookings + 1,
        updated_at = NOW()
      WHERE id = NEW.slot_id;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status changed - handle slot availability
    IF OLD.slot_id = NEW.slot_id THEN
      -- Same slot, check if status changed
      IF OLD.status IN ('pending', 'confirmed') AND NEW.status IN ('cancelled', 'completed') THEN
        -- Booking ended - release slot
        UPDATE public.slots 
        SET 
          is_available = true,
          current_bookings = GREATEST(0, current_bookings - 1),
          updated_at = NOW()
        WHERE id = NEW.slot_id;
        
      ELSIF OLD.status NOT IN ('pending', 'confirmed') AND NEW.status IN ('pending', 'confirmed') THEN
        -- Booking activated - reserve slot
        UPDATE public.slots 
        SET 
          is_available = false,
          current_bookings = current_bookings + 1,
          updated_at = NOW()
        WHERE id = NEW.slot_id;
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Booking deleted - release slot
    IF OLD.slot_id IS NOT NULL AND OLD.status IN ('pending', 'confirmed') THEN
      UPDATE public.slots 
      SET 
        is_available = true,
        current_bookings = GREATEST(0, current_bookings - 1),
        updated_at = NOW()
      WHERE id = OLD.slot_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for slot updates
CREATE TRIGGER handle_booking_slot_updates_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION handle_booking_slot_updates();

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_bookings TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Add some sample slots for existing expert sessions (optional - for testing)
-- This can be removed in production
INSERT INTO public.slots (expert_session_id, start_time, end_time, is_available)
SELECT 
  es.id as expert_session_id,
  NOW() + INTERVAL '1 day' + (INTERVAL '1 hour' * generate_series(9, 17)),
  NOW() + INTERVAL '1 day' + (INTERVAL '1 hour' * generate_series(9, 17)) + INTERVAL '1 hour',
  true
FROM public.expert_sessions es
WHERE es.is_active = true
LIMIT 5;