export type SessionLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type Currency = 'DKK' | 'USD' | 'EUR'

export interface ExpertSession {
  id: string
  expert_id: string
  title: string
  short_description: string
  topic_tags: string[]
  duration_minutes: number
  price_amount: number // in minor units (øre for DKK)
  currency: Currency
  level?: SessionLevel
  prerequisites?: string
  materials_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateExpertSessionRequest {
  title: string
  short_description: string
  topic_tags: string[]
  duration_minutes: number
  price_amount: number
  currency?: Currency
  level?: SessionLevel
  prerequisites?: string
  materials_url?: string
}

export interface UpdateExpertSessionRequest {
  title?: string
  short_description?: string
  topic_tags?: string[]
  duration_minutes?: number
  price_amount?: number
  currency?: Currency
  level?: SessionLevel
  prerequisites?: string
  materials_url?: string
  is_active?: boolean
}

export interface ExpertSessionWithAvailability extends ExpertSession {
  expert_display_name: string
  expert_bio?: string
  expert_rating: number
  expert_total_sessions: number
  has_availability: boolean
}

// Form data for creating/editing expert sessions
export interface ExpertSessionFormData {
  title: string
  short_description: string
  topic_tags: string[]
  duration_minutes: number
  price_amount: number
  currency: Currency
  level?: SessionLevel
  prerequisites?: string
  materials_url?: string
}

// Session filters for search/browse
export interface ExpertSessionFilters {
  expert_id?: string
  level?: SessionLevel
  topic_tags?: string[]
  min_duration?: number
  max_duration?: number
  min_price?: number
  max_price?: number
  search_query?: string
  has_availability_only?: boolean
}

// Pricing helper interface
export interface SessionPrice {
  amount: number
  currency: Currency
  formatted: string // e.g., "150 DKK", "$25"
  per_hour_formatted?: string // e.g., "300 DKK/hour"
}

// Validation constants
export const EXPERT_SESSION_CONSTRAINTS = {
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 500,
  MIN_DURATION_MINUTES: 15,
  MAX_DURATION_MINUTES: 480, // 8 hours
  DURATION_INCREMENT: 15,
  MIN_TOPIC_TAGS: 1,
  MAX_TOPIC_TAGS: 10,
  TOPIC_TAG_MAX_LENGTH: 50,
  MIN_PRICE_DKK_PER_HOUR: 5000, // 50 DKK/hour in øre
  SUPPORTED_CURRENCIES: ['DKK', 'USD', 'EUR'] as const,
  VALID_DURATIONS: [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 180, 240, 300, 360, 480] as const,
} as const

// Common topic tags (can be used for autocomplete/suggestions)
export const COMMON_TOPIC_TAGS = [
  'AI/ML',
  'Machine Learning',
  'Data Science',
  'Python',
  'JavaScript',
  'React',
  'Node.js',
  'TypeScript',
  'SQL',
  'Database Design',
  'API Development',
  'Frontend Development',
  'Backend Development',
  'DevOps',
  'Cloud Computing',
  'AWS',
  'Docker',
  'Kubernetes',
  'System Design',
  'Algorithms',
  'Data Structures',
  'Career Development',
  'Code Review',
  'Architecture',
  'Testing',
  'Performance Optimization',
  'Security',
  'Mobile Development',
  'Web Development',
  'Prompt Engineering',
  'ChatGPT',
  'LLMs',
  'Automation',
  'Agile',
  'Project Management',
] as const

// Session level descriptions
export const SESSION_LEVEL_DESCRIPTIONS: Record<SessionLevel, string> = {
  BEGINNER: 'Perfect for newcomers to the topic',
  INTERMEDIATE: 'Assumes basic familiarity with the topic',
  ADVANCED: 'Deep dive for experienced practitioners',
} as const

// Duration options for UI
export const DURATION_OPTIONS = EXPERT_SESSION_CONSTRAINTS.VALID_DURATIONS.map(minutes => ({
  value: minutes,
  label: minutes < 60 ? `${minutes} min` : `${minutes / 60}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`.trim(),
  hours: minutes / 60,
}))

// Validation result type
export interface SessionValidationResult {
  valid: boolean
  errors: string[]
}

// Helper functions for validation
export const validateExpertSession = (data: Partial<ExpertSessionFormData>): SessionValidationResult => {
  const errors: string[] = []
  
  if (!data.title || data.title.length < EXPERT_SESSION_CONSTRAINTS.TITLE_MIN_LENGTH) {
    errors.push(`Title must be at least ${EXPERT_SESSION_CONSTRAINTS.TITLE_MIN_LENGTH} characters`)
  }
  
  if (data.title && data.title.length > EXPERT_SESSION_CONSTRAINTS.TITLE_MAX_LENGTH) {
    errors.push(`Title cannot exceed ${EXPERT_SESSION_CONSTRAINTS.TITLE_MAX_LENGTH} characters`)
  }
  
  if (!data.short_description || data.short_description.length < EXPERT_SESSION_CONSTRAINTS.DESCRIPTION_MIN_LENGTH) {
    errors.push(`Description must be at least ${EXPERT_SESSION_CONSTRAINTS.DESCRIPTION_MIN_LENGTH} characters`)
  }
  
  if (data.short_description && data.short_description.length > EXPERT_SESSION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH) {
    errors.push(`Description cannot exceed ${EXPERT_SESSION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH} characters`)
  }
  
  if (!data.topic_tags || data.topic_tags.length < EXPERT_SESSION_CONSTRAINTS.MIN_TOPIC_TAGS) {
    errors.push(`At least ${EXPERT_SESSION_CONSTRAINTS.MIN_TOPIC_TAGS} topic tag is required`)
  }
  
  if (data.topic_tags && data.topic_tags.length > EXPERT_SESSION_CONSTRAINTS.MAX_TOPIC_TAGS) {
    errors.push(`Cannot have more than ${EXPERT_SESSION_CONSTRAINTS.MAX_TOPIC_TAGS} topic tags`)
  }
  
  if (data.topic_tags) {
    data.topic_tags.forEach((tag, index) => {
      if (!tag.trim()) {
        errors.push(`Topic tag ${index + 1} cannot be empty`)
      } else if (tag.length > EXPERT_SESSION_CONSTRAINTS.TOPIC_TAG_MAX_LENGTH) {
        errors.push(`Topic tag "${tag}" exceeds maximum length of ${EXPERT_SESSION_CONSTRAINTS.TOPIC_TAG_MAX_LENGTH} characters`)
      }
    })
  }
  
  if (!data.duration_minutes || !EXPERT_SESSION_CONSTRAINTS.VALID_DURATIONS.includes(data.duration_minutes as any)) {
    errors.push('Invalid duration selected')
  }
  
  if (!data.price_amount || data.price_amount < 0) {
    errors.push('Price must be a positive number')
  }
  
  if (data.price_amount && data.duration_minutes && data.currency === 'DKK') {
    const hourlyRate = (data.price_amount * 60) / data.duration_minutes
    if (hourlyRate < EXPERT_SESSION_CONSTRAINTS.MIN_PRICE_DKK_PER_HOUR) {
      errors.push(`Hourly rate too low (minimum 50 DKK/hour)`)
    }
  }
  
  if (data.materials_url && !data.materials_url.match(/^https?:\/\/.+/)) {
    errors.push('Materials URL must be a valid HTTP/HTTPS URL')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// Helper function to format price
export const formatSessionPrice = (amount: number, currency: Currency): string => {
  switch (currency) {
    case 'DKK':
      return `${Math.round(amount / 100)} DKK`
    case 'USD':
      return `$${Math.round(amount / 100)}`
    case 'EUR':
      return `€${Math.round(amount / 100)}`
    default:
      return `${amount / 100} ${currency}`
  }
}

// Helper function to calculate hourly rate
export const calculateHourlyRate = (priceAmount: number, durationMinutes: number, currency: Currency): string => {
  const hourlyAmount = (priceAmount * 60) / durationMinutes
  return formatSessionPrice(hourlyAmount, currency) + '/hour'
}

// Search/filter result type
export interface ExpertSessionSearchResult {
  sessions: ExpertSessionWithAvailability[]
  total: number
  filters_applied: ExpertSessionFilters
}

// Session summary for expert dashboard
export interface ExpertSessionSummary {
  expert_id: string
  total_sessions: number
  active_sessions: number
  inactive_sessions: number
  avg_price: number
  most_common_tags: string[]
  total_duration_hours: number
}