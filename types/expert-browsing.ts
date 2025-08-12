import { ExpertSession } from './expert-sessions'

export interface ExpertProfile {
  id: string
  expertise_areas: string[] | null
  bio: string | null
  hourly_rate: number | null
  rating: number | null
  total_sessions: number
  user_profiles: {
    user_id: string
    display_name: string | null
    avatar_url: string | null
  }
}

export interface ExpertWithSessions extends ExpertProfile {
  sessions: ExpertSession[]
}

export interface ExpertBrowsingResponse {
  experts: ExpertWithSessions[]
  total: number
}

// Helper function to get expert display name
export function getExpertDisplayName(expert: ExpertWithSessions): string {
  return expert.user_profiles.display_name || 'Anonymous Expert'
}

// Helper function to get expert avatar
export function getExpertAvatar(expert: ExpertWithSessions): string | null {
  return expert.user_profiles.avatar_url
}

// Helper function to get expert rating display
export function getExpertRatingDisplay(expert: ExpertWithSessions): string {
  if (!expert.rating) return 'No ratings yet'
  return `${expert.rating.toFixed(1)} ⭐`
}

// Helper function to format total sessions
export function getTotalSessionsDisplay(expert: ExpertWithSessions): string {
  const count = expert.total_sessions || 0
  return `${count} session${count !== 1 ? 's' : ''} completed`
}