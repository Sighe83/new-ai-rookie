-- Create ExpertSession table for reusable session templates
CREATE TABLE IF NOT EXISTS public.expert_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  topic_tags TEXT[] DEFAULT '{}',
  duration_minutes INTEGER NOT NULL,
  price_amount INTEGER NOT NULL, -- in minor units (øre for DKK)
  currency TEXT NOT NULL DEFAULT 'DKK' CHECK (currency IN ('DKK', 'USD', 'EUR')),
  level TEXT CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  prerequisites TEXT,
  materials_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  CONSTRAINT valid_description_length CHECK (char_length(short_description) >= 10 AND char_length(short_description) <= 500),
  CONSTRAINT valid_duration CHECK (
    duration_minutes > 0 AND 
    duration_minutes % 15 = 0 AND 
    duration_minutes <= 480 -- max 8 hours
  ),
  CONSTRAINT valid_price CHECK (price_amount >= 0),
  CONSTRAINT valid_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT valid_materials_url CHECK (
    materials_url IS NULL OR 
    materials_url ~ '^https?://[^\s]+$'
  ),
  
  -- Foreign key to expert profiles
  FOREIGN KEY (expert_id) REFERENCES public.expert_profiles(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_expert_sessions_expert_id ON public.expert_sessions(expert_id);
CREATE INDEX idx_expert_sessions_active ON public.expert_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_expert_sessions_level ON public.expert_sessions(level) WHERE level IS NOT NULL;
CREATE INDEX idx_expert_sessions_duration ON public.expert_sessions(duration_minutes);
CREATE INDEX idx_expert_sessions_price ON public.expert_sessions(price_amount);
CREATE INDEX idx_expert_sessions_topic_tags ON public.expert_sessions USING GIN (topic_tags);

-- Full-text search index for title and description
CREATE INDEX idx_expert_sessions_search ON public.expert_sessions USING GIN (
  to_tsvector('english', title || ' ' || short_description)
);

-- Enable Row Level Security
ALTER TABLE public.expert_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expert_sessions
-- Experts can manage their own sessions
CREATE POLICY "Experts can manage own sessions" ON public.expert_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      JOIN public.user_profiles up ON ep.user_profile_id = up.id
      WHERE ep.id = expert_id AND up.user_id = auth.uid()
    )
  );

-- Learners can view active sessions from available experts
CREATE POLICY "Learners can view active sessions" ON public.expert_sessions
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.expert_profiles ep
      WHERE ep.id = expert_id AND ep.is_available = true
    )
  );

-- Admins can manage all sessions
CREATE POLICY "Admins can manage all sessions" ON public.expert_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER handle_expert_sessions_updated_at
  BEFORE UPDATE ON public.expert_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to validate session constraints
CREATE OR REPLACE FUNCTION validate_expert_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure at least one topic tag is provided
  IF array_length(NEW.topic_tags, 1) IS NULL OR array_length(NEW.topic_tags, 1) = 0 THEN
    RAISE EXCEPTION 'Expert session must have at least one topic tag';
  END IF;
  
  -- Validate topic tags (no empty strings, reasonable length)
  FOR i IN 1..array_length(NEW.topic_tags, 1) LOOP
    IF NEW.topic_tags[i] = '' OR char_length(NEW.topic_tags[i]) > 50 THEN
      RAISE EXCEPTION 'Topic tags must be between 1 and 50 characters';
    END IF;
  END LOOP;
  
  -- Ensure maximum of 10 topic tags
  IF array_length(NEW.topic_tags, 1) > 10 THEN
    RAISE EXCEPTION 'Expert session cannot have more than 10 topic tags';
  END IF;
  
  -- Validate price based on duration (minimum rate check)
  -- Minimum 50 DKK per hour (approximately 3000 øre per hour)
  IF NEW.currency = 'DKK' AND NEW.price_amount < (NEW.duration_minutes * 50) THEN
    RAISE EXCEPTION 'Price is too low for the session duration (minimum 50 DKK/hour)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate session constraints
CREATE TRIGGER validate_expert_session_trigger
  BEFORE INSERT OR UPDATE ON public.expert_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_expert_session();

-- Function to get expert sessions with availability
CREATE OR REPLACE FUNCTION get_expert_sessions_with_availability(
  p_expert_id UUID DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_topic_tags TEXT[] DEFAULT NULL,
  p_min_duration INTEGER DEFAULT NULL,
  p_max_duration INTEGER DEFAULT NULL,
  p_min_price INTEGER DEFAULT NULL,
  p_max_price INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expert_id UUID,
  title TEXT,
  short_description TEXT,
  topic_tags TEXT[],
  duration_minutes INTEGER,
  price_amount INTEGER,
  currency TEXT,
  level TEXT,
  prerequisites TEXT,
  materials_url TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  expert_display_name TEXT,
  expert_bio TEXT,
  expert_rating DECIMAL(3,2),
  expert_total_sessions INTEGER,
  has_availability BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    es.id,
    es.expert_id,
    es.title,
    es.short_description,
    es.topic_tags,
    es.duration_minutes,
    es.price_amount,
    es.currency,
    es.level,
    es.prerequisites,
    es.materials_url,
    es.is_active,
    es.created_at,
    es.updated_at,
    up.display_name as expert_display_name,
    ep.bio as expert_bio,
    ep.rating as expert_rating,
    ep.total_sessions as expert_total_sessions,
    EXISTS (
      SELECT 1 FROM public.availability_windows aw
      WHERE aw.expert_id = es.expert_id
        AND aw.is_closed = false
        AND aw.end_at > NOW()
        AND EXTRACT(EPOCH FROM (aw.end_at - aw.start_at)) >= (es.duration_minutes * 60)
    ) as has_availability
  FROM public.expert_sessions es
  JOIN public.expert_profiles ep ON es.expert_id = ep.id
  JOIN public.user_profiles up ON ep.user_profile_id = up.id
  WHERE 
    es.is_active = true
    AND ep.is_available = true
    AND (p_expert_id IS NULL OR es.expert_id = p_expert_id)
    AND (p_level IS NULL OR es.level = p_level)
    AND (p_topic_tags IS NULL OR es.topic_tags && p_topic_tags)
    AND (p_min_duration IS NULL OR es.duration_minutes >= p_min_duration)
    AND (p_max_duration IS NULL OR es.duration_minutes <= p_max_duration)
    AND (p_min_price IS NULL OR es.price_amount >= p_min_price)
    AND (p_max_price IS NULL OR es.price_amount <= p_max_price)
  ORDER BY 
    has_availability DESC,
    ep.rating DESC,
    es.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_expert_sessions_with_availability TO authenticated;