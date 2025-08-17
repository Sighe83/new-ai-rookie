# Type Definitions Documentation

## Overview

This document outlines the TypeScript type definitions used throughout the AI tutoring platform. All types are defined in `/lib/supabase.ts` and reflect the consolidated database schema.

## Core User Types

### UserRole
```typescript
export type UserRole = 'learner' | 'expert' | 'admin'
```
Defines the three primary user roles in the system.

### UserProfile
```typescript
export type UserProfile = {
  id: string
  user_id: string // Links to Supabase auth.users
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
```
**Purpose**: Single source of truth for all users in the system.

**Key Fields**:
- `user_id`: Foreign key to Supabase authentication
- `role`: Determines access permissions and UI flow
- `display_name`: Primary name shown in UI
- `is_active`: Account status flag

### LearnerProfile
```typescript
export type LearnerProfile = {
  id: string
  user_profile_id: string // Links to UserProfile.id
  level: 'beginner' | 'intermediate' | 'advanced'
  learning_goals?: string
  preferred_topics?: string[]
  sessions_completed: number
  total_learning_hours: number
  created_at: string
  updated_at: string
}
```
**Purpose**: Extended profile data for learners.

**Key Fields**:
- `level`: Self-reported skill level
- `preferred_topics`: Array of learning interests
- `sessions_completed`: Progress tracking metric

### ExpertProfile
```typescript
export type ExpertProfile = {
  id: string
  user_profile_id: string // Links to UserProfile.id
  bio?: string
  title?: string
  company?: string
  years_of_experience?: number
  expertise_areas?: string[]
  hourly_rate?: number // ⚠️ Deprecated - use hourly_rate_cents
  hourly_rate_cents: number // ✅ New pricing field in cents
  linkedin_url?: string
  github_url?: string
  website_url?: string
  is_available: boolean
  rating: number
  total_sessions: number
  total_hours_taught: number
  created_at: string
  updated_at: string
}
```
**Purpose**: Extended profile data for experts.

**Important Notes**:
- **Pricing Migration**: `hourly_rate` is deprecated, use `hourly_rate_cents`
- **Consistency**: All monetary amounts now stored in cents
- **Availability**: `is_available` controls booking acceptance

## Session Management Types

### Session
```typescript
export type Session = {
  id: string
  expert_id: string // Links to ExpertProfile.id
  title: string
  description?: string
  short_description: string
  topic_tags: string[]
  duration_minutes: number
  price_cents: number // ✅ Price in cents for consistency
  currency: 'DKK' | 'USD' | 'EUR'
  level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  prerequisites?: string
  materials_url?: string
  max_participants: number
  is_active: boolean
  created_at: string
  updated_at: string
}
```
**Purpose**: Learning sessions offered by experts (consolidated from expert_sessions).

**Key Changes**:
- **Consolidated**: Replaced `expert_sessions` table
- **Pricing**: Uses `price_cents` instead of `price_amount`
- **Duration**: Stored in minutes for consistency
- **Tags**: Array of topic tags for categorization

### BookableSlot
```typescript
export type BookableSlot = {
  id: string
  session_id: string // Links to Session.id
  availability_window_id: string // Links to availability_windows.id
  start_time: string // ISO 8601 timestamp
  end_time: string // ISO 8601 timestamp
  max_bookings: number
  current_bookings: number
  is_available: boolean
  auto_generated: boolean
  created_at: string
  updated_at: string
}
```
**Purpose**: Available time slots for booking (replaces old slots table).

**Key Features**:
- **Availability Tracking**: `current_bookings` vs `max_bookings`
- **Auto-generation**: Slots can be automatically created from availability windows
- **Timestamps**: All times in ISO 8601 format with timezone

## Booking and Payment Types

### Booking
```typescript
export type Booking = {
  id: string
  learner_id: string // Links to LearnerProfile.id
  expert_id: string // Links to ExpertProfile.id
  session_id: string // Links to Session.id
  slot_id: string // Links to BookableSlot.id
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  start_at: string // ISO 8601 timestamp
  end_at: string // ISO 8601 timestamp
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
```
**Purpose**: Consolidated booking records with payment and scheduling info.

**Status Flow**:
```
pending → confirmed → in_progress → completed
       ↘ cancelled
       ↘ no_show
```

**Payment Status Flow**:
```
pending → authorized → captured
        ↘ failed
        ↘ cancelled → refunded
```

**Key Features**:
- **Dual Status**: Separate booking and payment status tracking
- **Monetary Precision**: All amounts in cents
- **Audit Trail**: Tracks who cancelled and when
- **Stripe Integration**: Stores PaymentIntent ID for webhook processing

## Legacy Types (Backward Compatibility)

### Profile (Deprecated)
```typescript
export type Profile = {
  id: string
  email: string
  role: 'AI_ROOKIE' | 'AI_EXPERT'
  created_at: string
}
```
**Status**: ⚠️ Legacy type for backward compatibility only.
**Migration**: Use `UserProfile` with `UserRole` instead.

### AppUser (Deprecated)
```typescript
export type AppUser = User & {
  user_metadata?: {
    role?: 'AI_ROOKIE' | 'AI_EXPERT'
  }
}
```
**Status**: ⚠️ Legacy type for old auth pattern.
**Migration**: Use Supabase User type with database profile lookups.

## Type Usage Patterns

### API Response Types
When defining API responses, extend base types:

```typescript
// Session with expert information
type SessionWithExpert = Session & {
  expert_display_name: string
  expert_bio: string
  expert_rating: number
  has_availability: boolean
}

// Booking with detailed information
type BookingDetails = Booking & {
  session_title: string
  expert_name: string
  learner_name: string
  slot_start_time: string
  slot_end_time: string
}
```

### Database Query Types
For Supabase queries, use proper type assertions:

```typescript
const { data: sessions } = await supabase
  .from('sessions')
  .select('*')
  .returns<Session[]>()

const { data: booking } = await supabase
  .from('booking_details')
  .select('*')
  .eq('id', bookingId)
  .single()
  .returns<BookingDetails>()
```

### Form Validation Types
Create input types for forms:

```typescript
type CreateSessionRequest = {
  title: string
  short_description: string
  topic_tags: string[]
  duration_minutes: number
  price_amount: number // Will be converted to price_cents
  currency: Session['currency']
  level?: Session['level']
  prerequisites?: string
  materials_url?: string
}

type CreateBookingRequest = {
  slot_id: string
  notes?: string
}
```

## Type Safety Best Practices

### 1. Strict Null Checks
Always handle optional fields properly:

```typescript
function formatExpertName(profile: ExpertProfile): string {
  return profile.display_name ?? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Expert'
}
```

### 2. Enum Consistency
Use union types for status fields:

```typescript
const validBookingStatuses: Booking['status'][] = [
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
]

function isValidBookingStatus(status: string): status is Booking['status'] {
  return validBookingStatuses.includes(status as Booking['status'])
}
```

### 3. Monetary Amount Handling
Always work with cents internally:

```typescript
function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

function centsFromDKK(dkk: number): number {
  return Math.round(dkk * 100)
}
```

### 4. Timestamp Handling
Use proper date parsing:

```typescript
function isBookingUpcoming(booking: Booking): boolean {
  return new Date(booking.start_at) > new Date()
}

function formatBookingTime(booking: Booking): string {
  return new Date(booking.start_at).toLocaleString('da-DK', {
    timeZone: 'Europe/Copenhagen'
  })
}
```

## Migration Notes

### From Old Schema
When migrating from the old schema:

1. **expert_sessions → sessions**: Update all references
2. **slots → bookable_slots**: Update table name and relationship fields
3. **price_amount → price_cents**: Convert all pricing to cents
4. **hourly_rate → hourly_rate_cents**: Update expert pricing

### Breaking Changes
- All monetary amounts now in cents
- Session table name changed
- Booking relationships simplified
- Payment status tracking enhanced

### Backward Compatibility
Legacy types are maintained but deprecated. New code should use:
- `UserProfile` instead of `Profile`
- `Session` instead of `ExpertSession`
- `BookableSlot` instead of `Slot`
- Cents-based pricing throughout

## Type Import Patterns

```typescript
// ✅ Recommended imports
import { 
  UserProfile, 
  ExpertProfile, 
  Session, 
  Booking, 
  BookableSlot 
} from '@/lib/supabase'

// ✅ For API routes
import type { NextRequest, NextResponse } from 'next/server'
import type { Session } from '@/lib/supabase'

// ✅ For React components
import type { FC } from 'react'
import type { Booking } from '@/lib/supabase'

const BookingCard: FC<{ booking: Booking }> = ({ booking }) => {
  // Component implementation
}
```

This type system ensures type safety across the entire application while maintaining flexibility for future schema evolution.