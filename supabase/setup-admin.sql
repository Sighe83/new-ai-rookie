-- Script to set up admin user
-- First, create the admin user through Supabase Dashboard or Auth API
-- Then run this script to update their role

-- Update user role to admin for daniel.elkaer@gmail.com
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE email = 'daniel.elkaer@gmail.com';

-- Verify the update
SELECT id, email, role, display_name 
FROM public.user_profiles 
WHERE email = 'daniel.elkaer@gmail.com';