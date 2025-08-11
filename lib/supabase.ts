import { createClient, User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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