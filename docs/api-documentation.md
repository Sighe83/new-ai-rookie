# API Documentation

## Overview

This API supports an AI tutoring platform built with Next.js and Supabase. All endpoints use server-side cookie authentication and follow RESTful conventions with the consolidated database schema.

## Authentication

All API routes require authentication via Supabase SSR cookies. The standard pattern is:

```typescript
import { createServerSideClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSideClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... route logic
}
```

## Sessions API

### GET /api/expert-sessions

**Purpose**: List and filter learning sessions.

**Query Parameters**:
- `my_sessions=true` - Filter to authenticated expert's sessions only
- `expert_id=<uuid>` - Filter by specific expert
- `level=<BEGINNER|INTERMEDIATE|ADVANCED>` - Filter by session level
- `topic_tags=<tag1,tag2>` - Filter by topic tags (comma-separated)
- `min_duration=<minutes>` - Minimum session duration
- `max_duration=<minutes>` - Maximum session duration  
- `min_price=<cents>` - Minimum price in cents
- `max_price=<cents>` - Maximum price in cents
- `search=<query>` - Search in title and description
- `has_availability_only=true` - Only sessions with available slots

**Response**:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "expert_id": "uuid", 
      "title": "Python Basics",
      "short_description": "Learn Python fundamentals",
      "topic_tags": ["python", "programming"],
      "duration_minutes": 60,
      "price_cents": 50000,
      "currency": "DKK",
      "level": "BEGINNER",
      "prerequisites": "None",
      "materials_url": "https://...",
      "is_active": true,
      "expert_display_name": "John Doe",
      "expert_bio": "Senior developer...",
      "expert_rating": 4.8,
      "has_availability": true
    }
  ],
  "filters_applied": {...}
}
```

### POST /api/expert-sessions

**Purpose**: Create a new learning session (experts only).

**Request Body**:
```json
{
  "title": "Python Basics",
  "short_description": "Learn Python fundamentals in this comprehensive session",
  "topic_tags": ["python", "programming", "basics"],
  "duration_minutes": 60,
  "price_amount": 50000,
  "currency": "DKK",
  "level": "BEGINNER",
  "prerequisites": "Basic computer knowledge",
  "materials_url": "https://example.com/materials"
}
```

**Validation Rules**:
- `title`: Min 3 characters
- `short_description`: Min 10 characters  
- `topic_tags`: 1-10 tags, max 50 chars each
- `duration_minutes`: Multiple of 15, between 15-480
- `price_amount`: Positive number in cents
- `currency`: DKK, USD, or EUR
- Minimum hourly rate: 50 DKK/hour for DKK currency

**Response**:
```json
{
  "message": "Session created successfully",
  "session": {
    "id": "uuid",
    "expert_id": "uuid",
    "title": "Python Basics",
    // ... full session object
  }
}
```

## Bookings API

### POST /api/bookings/create-with-payment

**Purpose**: Create a booking with payment processing (learners only).

**Request Body**:
```json
{
  "slot_id": "uuid",
  "notes": "Looking forward to learning Python!"
}
```

**Business Logic**:
1. Validates learner profile exists
2. Locks and validates slot availability
3. Checks for duplicate bookings
4. Creates booking record atomically
5. Updates slot availability counters
6. Returns payment information for Stripe

**Response**:
```json
{
  "booking_id": "uuid",
  "amount_cents": 50000,
  "currency": "DKK", 
  "expert_id": "uuid",
  "session_id": "uuid"
}
```

### GET /api/bookings/[id]

**Purpose**: Get detailed booking information.

**Authorization**: Booking must belong to authenticated user (as learner or expert).

**Response**:
```json
{
  "id": "uuid",
  "learner_id": "uuid",
  "expert_id": "uuid", 
  "session_id": "uuid",
  "slot_id": "uuid",
  "start_at": "2024-01-15T14:00:00Z",
  "end_at": "2024-01-15T15:00:00Z",
  "status": "pending",
  "payment_status": "authorized",
  "amount_authorized": 50000,
  "currency": "DKK",
  "learner_notes": "Looking forward to this!",
  "expert_notes": null,
  "session_title": "Python Basics",
  "session_description": "Learn Python fundamentals...",
  "duration_minutes": 60,
  "expert_name": "John Doe",
  "expert_bio": "Senior developer...",
  "learner_name": "Jane Smith",
  "slot_start_time": "2024-01-15T14:00:00Z",
  "slot_end_time": "2024-01-15T15:00:00Z"
}
```

## Experts API

### GET /api/experts

**Purpose**: List expert profiles with their sessions.

**Query Parameters**:
- `include_sessions=true` - Include expert's active sessions
- `verified_only=true` - Only verified experts

**Response**:
```json
{
  "experts": [
    {
      "id": "uuid",
      "user_profile_id": "uuid",
      "bio": "Senior software developer with 10 years...",
      "expertise_areas": ["Python", "JavaScript", "React"],
      "hourly_rate_cents": 75000,
      "currency": "DKK", 
      "rating": 4.8,
      "total_sessions": 150,
      "is_available": true,
      "verification_status": "verified",
      "display_name": "John Doe",
      "first_name": "John",
      "last_name": "Doe",
      "avatar_url": "https://...",
      "sessions": [...]
    }
  ]
}
```

### POST /api/experts (Protected - Admin only)

**Purpose**: Create expert profile for a user.

**Request Body**:
```json
{
  "user_id": "uuid",
  "bio": "Expert bio",
  "expertise_areas": ["Python", "AI"],
  "hourly_rate_cents": 75000,
  "currency": "DKK"
}
```

## Payment API

### POST /api/payment/create-intent

**Purpose**: Create Stripe PaymentIntent for a booking.

**Request Body**:
```json
{
  "bookingId": "uuid",
  "amount": 50000,
  "currency": "dkk"
}
```

**Business Logic**:
1. Validates booking belongs to authenticated user
2. Ensures payment hasn't been processed
3. Creates Stripe PaymentIntent with manual capture
4. Updates booking with payment details
5. Returns client secret for frontend

**Response**:
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

## Webhooks

### POST /api/webhooks/stripe

**Purpose**: Handle Stripe webhook events for payment processing.

**Security**: Validates webhook signature using `STRIPE_WEBHOOK_SECRET`.

**Supported Events**:
- `payment_intent.succeeded` → Updates payment_status to 'authorized'
- `payment_intent.payment_failed` → Updates payment_status to 'failed'
- `payment_intent.canceled` → Updates payment_status to 'cancelled', releases slot
- `payment_intent.processing` → Updates payment_status to 'processing'
- `charge.succeeded` → Updates payment_status to 'captured'
- `charge.refunded` → Updates payment_status to 'refunded'

**Idempotency**: Uses `is_webhook_processed()` and `record_webhook_processing()` functions to prevent duplicate processing.

## CRON Jobs

### POST /api/cron/cleanup-bookings

**Purpose**: Automated cleanup of expired and old bookings.

**Authorization**: Requires `CRON_SECRET` in Authorization header.

**Cleanup Actions**:
1. **Expired Bookings** (30+ minutes pending):
   - Cancel Stripe PaymentIntent
   - Update status to 'cancelled'
   - Release associated slot
   
2. **Old Bookings** (90+ days completed):
   - Archive by removing sensitive data
   - Clear Stripe references
   - Clear personal notes

3. **Orphaned Slots**:
   - Uses `cleanup_orphaned_slots()` function
   - Fixes availability inconsistencies

**Response**:
```json
{
  "success": true,
  "cleanedBookings": 5,
  "stripeErrors": 0,
  "processedExpiredBookings": 12,
  "archivedOldBookings": 3
}
```

## Error Handling

### Standard Error Responses

**401 Unauthorized**:
```json
{ "error": "Unauthorized" }
```

**403 Forbidden**:
```json
{ "error": "Only experts can create sessions" }
```

**404 Not Found**:
```json
{ "error": "Booking not found or unauthorized" }
```

**400 Bad Request**:
```json
{ "error": "Title must be at least 3 characters" }
```

**500 Internal Server Error**:
```json
{ "error": "Internal server error" }
```

## Data Formats

### Timestamps
All timestamps use ISO 8601 format with timezone: `2024-01-15T14:00:00Z`

### Monetary Amounts
All amounts stored and transmitted in cents (smallest currency unit):
- 50000 cents = 500 DKK
- 7500 cents = 75 USD

### Arrays
PostgreSQL arrays serialized as JSON arrays:
```json
{
  "topic_tags": ["python", "programming", "basics"],
  "expertise_areas": ["Python", "JavaScript", "AI"]
}
```

## Database Functions Integration

### create_session()
Used in `POST /api/expert-sessions` for atomic session creation with proper expert ID mapping.

### create_booking_with_payment()
Used in `POST /api/bookings/create-with-payment` for atomic booking creation with slot reservation.

### booking_details View
Used in `GET /api/bookings/[id]` to eliminate complex joins and provide complete booking information.

## Rate Limiting

Currently no rate limiting implemented. Consider adding for production:
- Session creation: 10 per hour per expert
- Booking creation: 5 per minute per learner
- API discovery: 100 per minute per user

## Monitoring

Key metrics to track:
- Booking creation success rate
- Payment processing success rate
- Session creation patterns
- Expert availability utilization
- Webhook processing latency

## Testing

API routes can be tested with:
```bash
# Session creation
curl -X POST http://localhost:3000/api/expert-sessions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Session","short_description":"Test description",...}'

# Booking creation  
curl -X POST http://localhost:3000/api/bookings/create-with-payment \
  -H "Content-Type: application/json" \
  -d '{"slot_id":"uuid","notes":"Test booking"}'
```

Remember to include proper authentication cookies in production requests.