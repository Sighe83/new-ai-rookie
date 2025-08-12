-- Create AvailabilityWindow table for expert availability
CREATE TABLE IF NOT EXISTS public.availability_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_at > start_at),
  CONSTRAINT valid_duration CHECK (
    -- Minimum 15 minutes duration
    EXTRACT(EPOCH FROM (end_at - start_at)) >= 900
  ),
  CONSTRAINT aligned_start_time CHECK (
    -- Start time must be aligned to 15-minute boundaries
    EXTRACT(MINUTE FROM start_at) % 15 = 0 AND EXTRACT(SECOND FROM start_at) = 0
  ),
  CONSTRAINT aligned_end_time CHECK (
    -- End time must be aligned to 15-minute boundaries
    EXTRACT(MINUTE FROM end_at) % 15 = 0 AND EXTRACT(SECOND FROM end_at) = 0
  ),
  
  -- Foreign key to expert profiles
  FOREIGN KEY (expert_id) REFERENCES public.expert_profiles(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_availability_windows_expert_id ON public.availability_windows(expert_id);
CREATE INDEX idx_availability_windows_start_at ON public.availability_windows(start_at);
CREATE INDEX idx_availability_windows_end_at ON public.availability_windows(end_at);
CREATE INDEX idx_availability_windows_time_range ON public.availability_windows USING GIST (
  tstzrange(start_at, end_at, '[)')
);
CREATE INDEX idx_availability_windows_active ON public.availability_windows(expert_id, is_closed) 
  WHERE is_closed = false;

-- Enable Row Level Security
ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for availability_windows
-- Experts can manage their own availability windows
CREATE POLICY "Experts can manage own availability windows" ON public.availability_windows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE ep.id = expert_id AND up.user_id = auth.uid()
    )
  );

-- Learners can view open availability windows for available experts
CREATE POLICY "Learners can view open availability windows" ON public.availability_windows
  FOR SELECT USING (
    is_closed = false AND
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_id AND ep.is_available = true
    )
  );

-- Admins can manage all availability windows
CREATE POLICY "Admins can manage all availability windows" ON public.availability_windows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER handle_availability_windows_updated_at
  BEFORE UPDATE ON public.availability_windows
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to check for overlapping availability windows
CREATE OR REPLACE FUNCTION check_availability_window_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for overlapping windows for the same expert
  IF EXISTS (
    SELECT 1 FROM public.availability_windows
    WHERE expert_id = NEW.expert_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Availability window overlaps with existing window for this expert';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent overlapping windows
CREATE TRIGGER prevent_availability_window_overlap
  BEFORE INSERT OR UPDATE ON public.availability_windows
  FOR EACH ROW EXECUTE FUNCTION check_availability_window_overlap();

-- Function to validate availability window constraints
CREATE OR REPLACE FUNCTION validate_availability_window()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure start_at is in the future (at least 1 hour from now)
  IF NEW.start_at <= NOW() + INTERVAL '1 hour' THEN
    RAISE EXCEPTION 'Availability window must start at least 1 hour in the future';
  END IF;
  
  -- Ensure window is not too far in the future (max 180 days)
  IF NEW.start_at > NOW() + INTERVAL '180 days' THEN
    RAISE EXCEPTION 'Availability window cannot be more than 180 days in the future';
  END IF;
  
  -- Ensure maximum duration is not exceeded (8 hours)
  IF EXTRACT(EPOCH FROM (NEW.end_at - NEW.start_at)) > 28800 THEN
    RAISE EXCEPTION 'Availability window cannot exceed 8 hours';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate window constraints
CREATE TRIGGER validate_availability_window_trigger
  BEFORE INSERT OR UPDATE ON public.availability_windows
  FOR EACH ROW EXECUTE FUNCTION validate_availability_window();