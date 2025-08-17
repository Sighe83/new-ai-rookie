import { createBrowserClient, User } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'learner' | 'expert' | 'admin'

export type UserProfile = {
  id: string
  user_id: string
  email: string
  role: UserRole
  first_name?: string
  last_name?: string
  display_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export type LearnerProfile = {
  id: string
  user_profile_id: string
  level: 'beginner' | 'intermediate' | 'advanced'
  learning_goals?: string
  preferred_topics?: string[]
  sessions_completed: number
  total_learning_hours: number
  created_at: string
  updated_at: string
}

export type ExpertProfile = {
  id: string
  user_profile_id: string
  bio?: string
  title?: string
  company?: string
  years_of_experience?: number
  expertise_areas?: string[]
  hourly_rate?: number
  linkedin_url?: string
  github_url?: string
  website_url?: string
  is_available: boolean
  rating: number
  total_sessions: number
  total_hours: number
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  email: string
  role: 'AI_ROOKIE' | 'AI_EXPERT'
  created_at: string
}

export type AppUser = User & {
  user_metadata?: {
    role?: 'AI_ROOKIE' | 'AI_EXPERT'
  }
}