import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

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
  is_active: boolean
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
  hourly_rate?: number // Deprecated - use hourly_rate_cents
  hourly_rate_cents: number // New pricing field in cents
  linkedin_url?: string
  github_url?: string
  website_url?: string
  is_available: boolean
  rating: number
  total_sessions: number
  total_hours_taught: number // Renamed from total_hours
  created_at: string
  updated_at: string
}

// Consolidated types for new schema
export type Session = {
  id: string
  expert_id: string
  title: string
  description?: string
  short_description: string
  topic_tags: string[]
  duration_minutes: number
  price_cents: number // Price in cents for consistency
  currency: 'DKK' | 'USD' | 'EUR'
  level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  prerequisites?: string
  materials_url?: string
  max_participants: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BookableSlot = {
  id: string
  session_id: string
  availability_window_id: string
  start_time: string
  end_time: string
  max_bookings: number
  current_bookings: number
  is_available: boolean
  auto_generated: boolean
  created_at: string
  updated_at: string
}

export type Booking = {
  id: string
  learner_id: string
  expert_id: string
  session_id: string
  slot_id: string
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  start_at: string
  end_at: string
  payment_status: 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded'
  amount_authorized: number // Amount in cents
  currency: 'DKK' | 'USD' | 'EUR'
  stripe_payment_intent_id?: string
  learner_notes?: string
  expert_notes?: string
  cancellation_reason?: string
  cancelled_by?: 'learner' | 'expert' | 'system'
  cancelled_at?: string
  created_at: string
  updated_at: string
}

// Legacy types for backward compatibility
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