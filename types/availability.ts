export interface AvailabilityWindow {
  id: string
  expert_id: string
  start_at: string  // ISO 8601 timestamp
  end_at: string    // ISO 8601 timestamp
  is_closed: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface CreateAvailabilityWindowRequest {
  start_at: string  // ISO 8601 timestamp
  end_at: string    // ISO 8601 timestamp
  notes?: string
}

export interface UpdateAvailabilityWindowRequest {
  start_at?: string  // ISO 8601 timestamp
  end_at?: string    // ISO 8601 timestamp
  is_closed?: boolean
  notes?: string
}

export interface AvailabilityWindowWithValidation extends AvailabilityWindow {
  // Computed fields for UI
  duration_minutes: number
  is_past: boolean
  is_editable: boolean
}

// Time slot for booking UI
export interface TimeSlot {
  start_at: string  // ISO 8601 timestamp
  end_at: string    // ISO 8601 timestamp
  is_available: boolean
  availability_window_id: string
}

// Form data for creating availability windows
export interface AvailabilityWindowFormData {
  date: string      // YYYY-MM-DD format
  start_time: string // HH:MM format (24h)
  end_time: string   // HH:MM format (24h)
  notes?: string
  timezone: string   // e.g., "Europe/Copenhagen"
}

// Validation constants
export const AVAILABILITY_WINDOW_CONSTRAINTS = {
  MIN_DURATION_MINUTES: 15,
  MAX_DURATION_MINUTES: 480, // 8 hours
  MIN_LEAD_TIME_MINUTES: 60,  // 1 hour
  MAX_FUTURE_DAYS: 180,       // 6 months
  TIME_SLOT_INCREMENT: 15,    // 15-minute slots
} as const

// Helper type for time validation
export interface TimeValidationResult {
  valid: boolean
  errors: string[]
}

// Expert availability summary for dashboard
export interface ExpertAvailabilitySummary {
  expert_id: string
  total_windows: number
  active_windows: number
  hours_available: number
  next_available_date?: string
}