export type BookingStatus = 
  | 'pending' 
  | 'awaiting_confirmation' 
  | 'confirmed' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded' 
  | 'no_show'

export type Currency = 'DKK' | 'USD' | 'EUR'

export interface Booking {
  id: string
  expert_id: string
  learner_id: string
  expert_session_id: string
  start_at: string // ISO string
  end_at: string   // ISO string
  status: BookingStatus
  held_until: string // ISO string
  currency: Currency
  amount_authorized: number // in minor units (øre for DKK)
  stripe_payment_intent_id?: string
  learner_notes?: string
  expert_notes?: string
  cancellation_reason?: string
  created_at: string
  updated_at: string
}

export interface BookingWithDetails extends Booking {
  // Session details
  session_title: string
  session_description: string
  session_duration_minutes: number
  // Person details (either learner or expert depending on context)
  person_name: string
  person_email?: string
  person_bio?: string
}

export interface ExpertBooking extends BookingWithDetails {
  // Learner details
  learner_name: string
  learner_email: string
}

export interface LearnerBooking extends BookingWithDetails {
  // Expert details
  expert_name: string
  expert_bio: string
}

export interface CreateBookingRequest {
  expert_session_id: string
  start_at: string // ISO string
  learner_notes?: string
}

export interface CreateBookingResponse {
  booking: Booking
  stripe_client_secret: string // For payment authorization
}

export interface ConfirmBookingRequest {
  booking_id: string
  action: 'confirm' | 'decline'
  expert_notes?: string
  cancellation_reason?: string
}

export interface BookingFilters {
  status?: BookingStatus
  start_date?: string // YYYY-MM-DD
  end_date?: string   // YYYY-MM-DD
  expert_id?: string
  learner_id?: string
}

export interface BookingSummary {
  total_bookings: number
  pending_bookings: number
  confirmed_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  total_revenue: number // in minor units
  currency: Currency
}

// Helper functions
export const formatBookingPrice = (amount: number, currency: Currency): string => {
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

export const getBookingStatusColor = (status: BookingStatus): 'primary' | 'success' | 'warning' | 'neutral' | 'destructive' => {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'awaiting_confirmation':
      return 'primary'
    case 'confirmed':
      return 'success'
    case 'completed':
      return 'success'
    case 'cancelled':
    case 'refunded':
    case 'no_show':
      return 'destructive'
    default:
      return 'neutral'
  }
}

export const getBookingStatusLabel = (status: BookingStatus): string => {
  switch (status) {
    case 'pending':
      return 'Payment Pending'
    case 'awaiting_confirmation':
      return 'Awaiting Confirmation'
    case 'confirmed':
      return 'Confirmed'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'refunded':
      return 'Refunded'
    case 'no_show':
      return 'No Show'
    default:
      return status
  }
}

export const isBookingActive = (status: BookingStatus): boolean => {
  return ['pending', 'awaiting_confirmation', 'confirmed'].includes(status)
}

export const isBookingEditable = (status: BookingStatus): boolean => {
  return ['pending', 'awaiting_confirmation'].includes(status)
}

export const isBookingCancellable = (status: BookingStatus): boolean => {
  return ['pending', 'awaiting_confirmation', 'confirmed'].includes(status)
}

// Validation
export const validateBookingTime = (startAt: string, durationMinutes: number): {
  valid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  const start = new Date(startAt)
  const now = new Date()
  
  // Check if start time is valid
  if (isNaN(start.getTime())) {
    errors.push('Invalid start time')
    return { valid: false, errors }
  }
  
  // Check 15-minute alignment
  const startMinutes = start.getMinutes()
  if (startMinutes % 15 !== 0) {
    errors.push('Start time must be aligned to 15-minute intervals')
  }
  
  // Check lead time (at least 2 hours)
  const leadTimeMs = start.getTime() - now.getTime()
  const leadTimeHours = leadTimeMs / (1000 * 60 * 60)
  if (leadTimeHours < 2) {
    errors.push('Booking must be made at least 2 hours in advance')
  }
  
  // Check booking horizon (max 90 days)
  const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  if (start > maxDate) {
    errors.push('Booking cannot be made more than 90 days in advance')
  }
  
  // Check duration alignment
  if (durationMinutes % 15 !== 0) {
    errors.push('Session duration must be a multiple of 15 minutes')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Constants
export const BOOKING_CONSTRAINTS = {
  MIN_LEAD_TIME_HOURS: 2,
  MAX_BOOKING_DAYS_AHEAD: 90,
  TIME_SLOT_INCREMENT_MINUTES: 15,
  DEFAULT_HOLD_MINUTES: 10,
  MAX_NOTES_LENGTH: 500,
} as const

export const BOOKING_STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: 'pending', label: 'Payment Pending' },
  { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'no_show', label: 'No Show' },
]