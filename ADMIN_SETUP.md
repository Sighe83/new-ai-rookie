# Admin Module Setup Guide

## Overview
The admin module allows managing experts and viewing system statistics. Only users with admin role can access this module.

## Database Schema

### User Tables
1. **user_profiles** - Core user information
   - `id` - UUID primary key
   - `user_id` - References auth.users
   - `email` - User email
   - `role` - User role (learner/expert/admin)
   - `first_name`, `last_name`, `display_name` - User details
   - `avatar_url` - Profile picture URL
   - `created_at`, `updated_at` - Timestamps

2. **learner_profiles** - Learner-specific data
   - `level` - Skill level (beginner/intermediate/advanced)
   - `learning_goals` - Text description
   - `preferred_topics` - Array of topics
   - `sessions_completed` - Number of completed sessions
   - `total_learning_hours` - Total hours learned

3. **expert_profiles** - Expert-specific data
   - `bio` - Expert biography
   - `title` - Professional title
   - `company` - Current company
   - `years_of_experience` - Years in field
   - `expertise_areas` - Array of expertise areas
   - `hourly_rate` - Hourly consultation rate
   - `linkedin_url`, `github_url`, `website_url` - Social links
   - `is_available` - Availability status
   - `rating` - Average rating
   - `total_sessions` - Number of sessions conducted
   - `total_hours` - Total hours taught

## Initial Admin Setup

### Step 1: Run Database Migrations
```bash
# Apply the migration to create tables
# Run this in Supabase SQL editor or through migration system
```

### Step 2: Create Admin User
1. Sign up normally with email: `daniel.elkaer@gmail.com` and password: `Mormor7594`
2. Confirm the email if required

### Step 3: Grant Admin Role
Run the following SQL in Supabase SQL editor:
```sql
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE email = 'daniel.elkaer@gmail.com';
```

### Step 4: Access Admin Dashboard
Navigate to `/admin` after logging in with the admin credentials.

## Admin Features

### Create Expert Accounts
- Fill in expert details including personal info, professional background, and expertise
- Set hourly rates and availability
- Add social media links

### Manage Experts
- View all expert profiles
- Edit expert information
- Delete expert accounts
- Toggle availability status

## Security

### Row Level Security (RLS)
- Only admins can create and manage expert accounts
- Learners can view available experts
- Experts can edit their own profiles
- All tables have RLS enabled

### Authentication Flow
1. User logs in via `/` (main page)
2. System checks user role in `user_profiles` table
3. Admins are redirected to `/admin`
4. Learners go to `/dashboard/learner`
5. Experts go to `/dashboard/expert`

## API Endpoints

The admin module doesn't use separate API endpoints but directly interacts with Supabase through the client library with RLS policies enforcing permissions.

## Troubleshooting

### Admin Access Issues
1. Verify the user exists in `auth.users` table
2. Check `user_profiles` table has role set to 'admin'
3. Clear browser cache and cookies
4. Check browser console for errors

### Expert Creation Fails
1. Ensure all required fields are filled
2. Check email is unique (not already registered)
3. Password must be at least 6 characters
4. Verify database connection

## Future Enhancements
- Bulk import of experts via CSV
- Email notifications for new expert accounts
- Analytics dashboard
- Expert approval workflow
- Session scheduling interface