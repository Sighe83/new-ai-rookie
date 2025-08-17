# Database Schema Documentation

## Overview

This database supports an AI tutoring platform where experts offer learning sessions and learners can book and pay for them. The schema follows SOLID principles with a consolidated, normalized design that eliminates duplicate tables and competing systems.

## Core Tables

### user_profiles
**Purpose**: Single source of truth for all users in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | Links to Supabase auth.users |
| role | TEXT | User role: 'learner', 'expert', 'admin' |
| display_name | TEXT | User's display name |
| first_name | TEXT | User's first name |
| last_name | TEXT | User's last name |
| avatar_url | TEXT | Profile picture URL |
| timezone | TEXT | User's timezone |
| created_at | TIMESTAMPTZ | Account creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- One-to-one with Supabase auth.users
- One-to-one with expert_profiles (for experts)
- One-to-one with learner_profiles (for learners)

### expert_profiles
**Purpose**: Expert-specific profile data and statistics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_profile_id | UUID (FK) | Links to user_profiles.id |
| bio | TEXT | Expert's biography |
| expertise_areas | TEXT[] | Array of expertise topics |
| hourly_rate_cents | INTEGER | Hourly rate in cents (consistent pricing) |
| currency | TEXT | Currency for rates (DKK, USD, EUR) |
| rating | DECIMAL | Average rating from learners |
| total_sessions | INTEGER | Total sessions completed |
| total_earnings_cents | INTEGER | Total earnings in cents |
| is_available | BOOLEAN | Whether expert accepts new bookings |
| verification_status | TEXT | 'pending', 'verified', 'rejected' |
| created_at | TIMESTAMPTZ | Profile creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- One-to-one with user_profiles
- One-to-many with sessions
- One-to-many with availability_windows
- One-to-many with bookings (as expert)

### learner_profiles
**Purpose**: Learner-specific profile data and progress tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_profile_id | UUID (FK) | Links to user_profiles.id |
| learning_goals | TEXT[] | Array of learning objectives |
| interests | TEXT[] | Array of interest areas |
| experience_level | TEXT | 'BEGINNER', 'INTERMEDIATE', 'ADVANCED' |
| preferred_session_duration | INTEGER | Preferred duration in minutes |
| total_sessions_booked | INTEGER | Total sessions booked |
| total_spent_cents | INTEGER | Total amount spent in cents |
| created_at | TIMESTAMPTZ | Profile creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- One-to-one with user_profiles
- One-to-many with bookings (as learner)

### sessions
**Purpose**: Learning sessions offered by experts (consolidated from expert_sessions).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| expert_id | UUID (FK) | Links to expert_profiles.id |
| title | TEXT | Session title |
| description | TEXT | Full session description |
| short_description | TEXT | Brief description (max 500 chars) |
| topic_tags | TEXT[] | Array of topic tags for categorization |
| duration_minutes | INTEGER | Session duration (multiples of 15) |
| price_cents | INTEGER | Session price in cents |
| currency | TEXT | Session currency (DKK, USD, EUR) |
| level | TEXT | 'BEGINNER', 'INTERMEDIATE', 'ADVANCED' |
| prerequisites | TEXT | Prerequisites for the session |
| materials_url | TEXT | URL to session materials |
| max_participants | INTEGER | Maximum participants (default 1) |
| is_active | BOOLEAN | Whether session accepts bookings |
| created_at | TIMESTAMPTZ | Session creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- Many-to-one with expert_profiles
- One-to-many with bookable_slots
- One-to-many with bookings

### availability_windows
**Purpose**: Time windows when experts are available for automatic slot generation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| expert_id | UUID (FK) | Links to expert_profiles.id |
| day_of_week | INTEGER | Day of week (0=Sunday, 6=Saturday) |
| start_time | TIME | Start time of availability |
| end_time | TIME | End time of availability |
| timezone | TEXT | Timezone for the window |
| is_active | BOOLEAN | Whether window is currently active |
| created_at | TIMESTAMPTZ | Window creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- Many-to-one with expert_profiles
- One-to-many with bookable_slots

### bookable_slots
**Purpose**: Available time slots that can be booked (replaces old slots table).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| session_id | UUID (FK) | Links to sessions.id |
| availability_window_id | UUID (FK) | Links to availability_windows.id |
| start_time | TIMESTAMPTZ | Slot start time |
| end_time | TIMESTAMPTZ | Slot end time |
| is_available | BOOLEAN | Whether slot can be booked |
| current_bookings | INTEGER | Current number of bookings |
| max_bookings | INTEGER | Maximum bookings allowed |
| created_at | TIMESTAMPTZ | Slot creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- Many-to-one with sessions
- Many-to-one with availability_windows
- One-to-many with bookings

### bookings
**Purpose**: Consolidated booking records with payment and scheduling info.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| learner_id | UUID (FK) | Links to learner_profiles.id |
| expert_id | UUID (FK) | Links to expert_profiles.id |
| session_id | UUID (FK) | Links to sessions.id |
| slot_id | UUID (FK) | Links to bookable_slots.id |
| start_at | TIMESTAMPTZ | Booking start time |
| end_at | TIMESTAMPTZ | Booking end time |
| status | TEXT | 'pending', 'confirmed', 'completed', 'cancelled', 'declined' |
| payment_status | TEXT | 'pending', 'processing', 'authorized', 'captured', 'failed', 'cancelled', 'refunded' |
| amount_authorized | INTEGER | Authorized amount in cents |
| amount_captured | INTEGER | Captured amount in cents |
| amount_refunded | INTEGER | Refunded amount in cents |
| currency | TEXT | Payment currency |
| stripe_payment_intent_id | TEXT | Stripe PaymentIntent ID |
| learner_notes | TEXT | Notes from learner |
| expert_notes | TEXT | Notes from expert |
| cancelled_by | TEXT | Who cancelled: 'learner', 'expert', 'system' |
| cancellation_reason | TEXT | Reason for cancellation |
| cancelled_at | TIMESTAMPTZ | Cancellation timestamp |
| created_at | TIMESTAMPTZ | Booking creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Relationships**:
- Many-to-one with learner_profiles
- Many-to-one with expert_profiles
- Many-to-one with sessions
- Many-to-one with bookable_slots

## Views

### booking_details
**Purpose**: Consolidated view for API consumption - joins all booking-related data.

This view combines data from bookings, sessions, expert_profiles, learner_profiles, user_profiles, and bookable_slots to provide a complete booking picture without complex joins in API routes.

**Key Fields**:
- All booking fields
- session_title, session_description, duration_minutes
- expert_name, expert_bio, learner_name
- slot_start_time, slot_end_time

## Business Logic Functions

### create_session()
**Purpose**: Creates a new learning session with proper validation.

```sql
CREATE OR REPLACE FUNCTION create_session(
  p_expert_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_duration_minutes INTEGER,
  p_price_cents INTEGER,
  p_currency TEXT DEFAULT 'DKK'
) RETURNS UUID
```

**Functionality**:
- Validates expert exists
- Creates session with proper expert_id mapping
- Generates short_description automatically
- Returns session ID for further updates

### create_booking_with_payment()
**Purpose**: Atomic booking creation with slot reservation and payment tracking.

```sql
CREATE OR REPLACE FUNCTION create_booking_with_payment(
  p_learner_user_id UUID,
  p_slot_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (booking_id UUID, amount_cents INTEGER, currency TEXT, expert_id UUID, session_id UUID)
```

**Functionality**:
- Validates learner exists
- Locks slot and checks availability
- Prevents double-booking
- Creates booking record
- Updates slot availability counters
- Returns payment information for Stripe integration

## Indexes

Performance-critical indexes for common query patterns:

```sql
-- Booking relationships
CREATE INDEX idx_bookings_learner_id ON bookings(learner_id);
CREATE INDEX idx_bookings_expert_id ON bookings(expert_id);
CREATE INDEX idx_bookings_session_id ON bookings(session_id);
CREATE INDEX idx_bookings_slot_id ON bookings(slot_id);

-- Booking status queries
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);

-- Slot availability queries
CREATE INDEX idx_bookable_slots_available ON bookable_slots(is_available) WHERE is_available = true;
CREATE INDEX idx_bookable_slots_time_range ON bookable_slots(start_time, end_time);

-- Session discovery
CREATE INDEX idx_sessions_expert_id ON sessions(expert_id);
CREATE INDEX idx_sessions_active ON sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_sessions_topic_tags ON sessions USING GIN(topic_tags);
```

## Row Level Security (RLS)

All tables have RLS enabled with policies that:
- Allow users to read/modify their own data
- Allow experts to manage their sessions and availability
- Allow learners to book sessions and view their bookings
- Prevent unauthorized access across user boundaries

## Migration History

### Consolidation Process
The current schema is the result of a major consolidation effort that:

1. **Eliminated Duplicates**: Removed duplicate tables (expert_sessions → sessions, slots → bookable_slots)
2. **Unified Pricing**: Standardized all pricing to cents-based storage
3. **Simplified Relationships**: Created clean foreign key relationships
4. **Business Logic**: Moved complex operations to database functions
5. **API Optimization**: Created views for common query patterns

### Key Changes
- `expert_sessions` table consolidated into `sessions`
- `slots` table replaced with `bookable_slots`
- `payments` table eliminated (integrated into bookings)
- All pricing fields converted to `*_cents` format
- Complex API joins replaced with `booking_details` view

## Data Consistency Rules

1. **Pricing**: All monetary amounts stored in cents for precision
2. **Timestamps**: All times stored as TIMESTAMPTZ for timezone awareness
3. **Enums**: Consistent enum values across status fields
4. **Foreign Keys**: All relationships enforced with proper constraints
5. **Business Logic**: Critical operations handled by database functions to ensure atomicity

## API Integration Patterns

### Sessions Management
```typescript
// Create session
const { data: sessionId } = await supabase.rpc('create_session', {
  p_expert_user_id: user.id,
  p_title: 'Python Basics',
  p_description: 'Learn Python fundamentals',
  p_duration_minutes: 60,
  p_price_cents: 50000,  // 500 DKK
  p_currency: 'DKK'
});
```

### Booking Creation
```typescript
// Create booking with payment
const { data: bookingResult } = await supabase.rpc('create_booking_with_payment', {
  p_learner_user_id: user.id,
  p_slot_id: 'slot-uuid',
  p_notes: 'Looking forward to learning!'
});
```

### Booking Queries
```typescript
// Get booking details
const { data: booking } = await supabase
  .from('booking_details')
  .select('*')
  .eq('id', bookingId)
  .single();
```

This schema design supports a scalable, maintainable AI tutoring platform with clean separation of concerns and optimized performance for common operations.