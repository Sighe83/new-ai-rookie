import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { UserProfile } from './supabase'

export async function checkAdminAuth(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (error || !data) return false
    return data.role === 'admin'
  } catch (error) {
    console.error('Error checking admin auth:', error)
    return false
  }
}

export async function getAdminUser(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single()

    if (error || !data) return null
    return data as UserProfile
  } catch (error) {
    console.error('Error getting admin user:', error)
    return null
  }
}

// Create a service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, 
  { 
    auth: { 
      autoRefreshToken: false, 
      persistSession: false 
    } 
  }
)

export async function createExpertUser(
  email: string,
  password: string,
  expertData: {
    first_name?: string
    last_name?: string
    display_name?: string
    bio?: string
    title?: string
    company?: string
    years_of_experience?: number
    expertise_areas?: string[]
    hourly_rate?: number
    linkedin_url?: string
    github_url?: string
    website_url?: string
  }
) {
  try {
    // Create auth user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'expert',
        display_name: expertData.display_name || expertData.first_name || email.split('@')[0]
      }
    })

    if (authError || !authData.user) {
      throw authError || new Error('Failed to create user')
    }

    // Create user profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        email,
        role: 'expert',
        first_name: expertData.first_name,
        last_name: expertData.last_name,
        display_name: expertData.display_name || expertData.first_name || email.split('@')[0],
      })
      .select()
      .single()

    if (profileError || !profileData) {
      throw profileError || new Error('Failed to create user profile')
    }

    // Create expert profile
    const { data: expertProfile, error: expertError } = await supabaseAdmin
      .from('expert_profiles')
      .insert({
        user_profile_id: profileData.id,
        bio: expertData.bio,
        title: expertData.title,
        company: expertData.company,
        years_of_experience: expertData.years_of_experience,
        expertise_areas: expertData.expertise_areas,
        hourly_rate: expertData.hourly_rate,
        linkedin_url: expertData.linkedin_url,
        github_url: expertData.github_url,
        website_url: expertData.website_url,
        is_available: true
      })
      .select()
      .single()

    if (expertError) {
      throw expertError
    }

    return {
      user: authData.user,
      profile: profileData,
      expertProfile
    }
  } catch (error) {
    console.error('Error creating expert user:', error)
    throw error
  }
}