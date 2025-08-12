-- Create user profiles table for learners and experts
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('learner', 'expert', 'admin')),
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create learner-specific data table
CREATE TABLE IF NOT EXISTS public.learner_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  learning_goals TEXT,
  preferred_topics TEXT[],
  sessions_completed INTEGER DEFAULT 0,
  total_learning_hours DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expert-specific data table
CREATE TABLE IF NOT EXISTS public.expert_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  bio TEXT,
  title TEXT,
  company TEXT,
  years_of_experience INTEGER,
  expertise_areas TEXT[],
  hourly_rate DECIMAL(10,2),
  linkedin_url TEXT,
  github_url TEXT,
  website_url TEXT,
  is_available BOOLEAN DEFAULT true,
  rating DECIMAL(3,2) DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_hours DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_learner_profiles_level ON public.learner_profiles(level);
CREATE INDEX idx_expert_profiles_available ON public.expert_profiles(is_available);
CREATE INDEX idx_expert_profiles_rating ON public.expert_profiles(rating);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can create profiles
CREATE POLICY "Admins can create profiles" ON public.user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for learner_profiles
-- Learners can view their own profile
CREATE POLICY "Learners can view own profile" ON public.learner_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = user_profile_id AND user_id = auth.uid()
    )
  );

-- Learners can update their own profile
CREATE POLICY "Learners can update own profile" ON public.learner_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = user_profile_id AND user_id = auth.uid()
    )
  );

-- Admins can manage all learner profiles
CREATE POLICY "Admins can manage learner profiles" ON public.learner_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for expert_profiles
-- Experts can view their own profile
CREATE POLICY "Experts can view own profile" ON public.expert_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = user_profile_id AND user_id = auth.uid()
    )
  );

-- Experts can update their own profile
CREATE POLICY "Experts can update own profile" ON public.expert_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = user_profile_id AND user_id = auth.uid()
    )
  );

-- Learners can view available expert profiles
CREATE POLICY "Learners can view available experts" ON public.expert_profiles
  FOR SELECT USING (is_available = true);

-- Admins can manage all expert profiles
CREATE POLICY "Admins can manage expert profiles" ON public.expert_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to automatically create user_profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'learner'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  
  -- If it's a learner, create learner profile
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'learner') = 'learner' THEN
    INSERT INTO public.learner_profiles (user_profile_id)
    SELECT id FROM public.user_profiles WHERE user_id = NEW.id;
  END IF;
  
  -- If it's an expert, create expert profile
  IF NEW.raw_user_meta_data->>'role' = 'expert' THEN
    INSERT INTO public.expert_profiles (user_profile_id)
    SELECT id FROM public.user_profiles WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_learner_profiles_updated_at
  BEFORE UPDATE ON public.learner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_expert_profiles_updated_at
  BEFORE UPDATE ON public.expert_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert admin user
-- Note: You'll need to create the admin user through Supabase Auth first
-- Then update their role to 'admin' using this query:
-- UPDATE public.user_profiles SET role = 'admin' WHERE email = 'daniel.elkaer@gmail.com';