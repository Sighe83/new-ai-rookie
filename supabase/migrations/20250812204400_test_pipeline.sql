-- Test migration to verify CI/CD pipeline
-- This creates a simple table to test the migration system

CREATE TABLE IF NOT EXISTS public.pipeline_test (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_message TEXT NOT NULL DEFAULT 'Pipeline working!',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a test comment
COMMENT ON TABLE public.pipeline_test IS 'Test table created by CI/CD pipeline verification';