-- Initial schema migration for new-ai-rookie
-- This creates all the core tables and functions for the AI learning platform

-- Function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User Profiles table
CREATE TABLE public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('learner', 'expert', 'admin')),
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Learner Profiles table
CREATE TABLE public.learner_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_profile_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  learning_goals TEXT,
  preferred_topics TEXT[],
  sessions_completed INTEGER DEFAULT 0,
  total_learning_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on learner_profiles
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learner_profiles
CREATE POLICY "Learners can manage own profile" ON public.learner_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = user_profile_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Experts and admins can view learner profiles" ON public.learner_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role IN ('expert', 'admin')
    )
  );

-- Expert Profiles table
CREATE TABLE public.expert_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_profile_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bio TEXT,
  title TEXT,
  company TEXT,
  years_of_experience INTEGER,
  expertise_areas TEXT[],
  hourly_rate NUMERIC,
  linkedin_url TEXT,
  github_url TEXT,
  website_url TEXT,
  is_available BOOLEAN DEFAULT true,
  rating NUMERIC DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on expert_profiles
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expert_profiles
CREATE POLICY "Experts can manage own profile" ON public.expert_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = user_profile_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view expert profiles" ON public.expert_profiles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage all expert profiles" ON public.expert_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Expert Sessions table
CREATE TABLE public.expert_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  short_description TEXT NOT NULL CHECK (char_length(short_description) >= 10 AND char_length(short_description) <= 500),
  topic_tags TEXT[] DEFAULT '{}',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND (duration_minutes % 15) = 0 AND duration_minutes <= 480),
  price_amount INTEGER NOT NULL CHECK (price_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'DKK' CHECK (currency IN ('DKK', 'USD', 'EUR')),
  level TEXT CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  prerequisites TEXT,
  materials_url TEXT CHECK (materials_url IS NULL OR materials_url ~ '^https?://[^\\s]+$'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on expert_sessions
ALTER TABLE public.expert_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expert_sessions
CREATE POLICY "Experts can manage own sessions" ON public.expert_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE ep.id = expert_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active sessions" ON public.expert_sessions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all sessions" ON public.expert_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Availability Windows table
CREATE TABLE public.availability_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

-- Enable RLS on availability_windows
ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for availability_windows
CREATE POLICY "Experts can manage own availability" ON public.availability_windows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE ep.id = expert_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view open availability" ON public.availability_windows
  FOR SELECT USING (is_closed = false);

CREATE POLICY "Admins can manage all availability" ON public.availability_windows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Bookings table
CREATE TABLE public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.learner_profiles(id) ON DELETE CASCADE,
  expert_session_id UUID NOT NULL REFERENCES public.expert_sessions(id) ON DELETE CASCADE,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_confirmation', 'confirmed', 'completed', 'cancelled', 'refunded', 'no_show')),
  held_until TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Payment data
  currency TEXT NOT NULL CHECK (currency IN ('DKK', 'USD', 'EUR')),
  amount_authorized INTEGER NOT NULL CHECK (amount_authorized >= 0),
  stripe_payment_intent_id TEXT,
  
  -- Optional metadata
  learner_notes TEXT CHECK (char_length(learner_notes) <= 500),
  expert_notes TEXT CHECK (char_length(expert_notes) <= 500),
  cancellation_reason TEXT CHECK (char_length(cancellation_reason) <= 500),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_at > start_at),
  CONSTRAINT valid_hold_time CHECK (held_until > created_at)
);

-- Create indexes for bookings
CREATE INDEX idx_bookings_expert_id ON public.bookings(expert_id);
CREATE INDEX idx_bookings_learner_id ON public.bookings(learner_id);
CREATE INDEX idx_bookings_expert_session_id ON public.bookings(expert_session_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_start_at ON public.bookings(start_at);
CREATE INDEX idx_bookings_held_until ON public.bookings(held_until) WHERE status = 'pending';
CREATE INDEX idx_bookings_stripe_payment_intent ON public.bookings(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_bookings_time_conflicts ON public.bookings(expert_id, start_at, end_at) 
  WHERE status IN ('pending', 'awaiting_confirmation', 'confirmed');

-- Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookings
CREATE POLICY "Experts can manage own bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE ep.id = expert_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Learners can manage own bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.learner_profiles lp
      JOIN public.user_profiles up ON lp.user_profile_id = up.id
      WHERE lp.id = learner_id AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create updated_at triggers
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_learner_profiles_updated_at
  BEFORE UPDATE ON public.learner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_expert_profiles_updated_at
  BEFORE UPDATE ON public.expert_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_expert_sessions_updated_at
  BEFORE UPDATE ON public.expert_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_availability_windows_updated_at
  BEFORE UPDATE ON public.availability_windows
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Booking validation function
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
      WHERE b.id != COALESCE(NEW.id, gen_random_uuid())
        AND b.expert_id = NEW.expert_id
        AND b.status IN ('pending', 'awaiting_confirmation', 'confirmed')
        AND (NEW.start_at < b.end_at AND NEW.end_at > b.start_at)
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION expire_held_bookings TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;