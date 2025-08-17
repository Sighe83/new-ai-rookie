# Design System Implementation

## Hygge Design System

This project uses the "Hygge" design system - a warm, welcoming, and accessible design language perfect for AI learning platforms.

### Design Tokens

**Colors:**
- Primary: `#4A55A2` (Deep friendly blue)
- Secondary: `#F5EFE6` (Warm beige) 
- Accent: `#A27B5C` (Burnt orange/brown)
- Success: `#F0FDF4` bg, `#166534` text
- Warning: `#FEFCE8` bg, `#854D0E` text  
- Error: `#DC2626` main, `#FEF2F2` bg, `#991B1B` text
- Surface: `#FBF9F6` (Creamy page background)
- Base: `#FFFFFF` (White for cards)
- Border: `#E7E5E4` (Soft border)
- Text: `#44403C` headings, `#57534E` body

**Typography:**
- Font: Nunito (400, 500, 600, 700, 800)
- Sizes: sm, md, lg with proper hierarchy

**Spacing & Layout:**
- Border radius: lg (0.75rem), xl (1rem), 2xl (1.5rem)
- Shadow: soft (0 6px 16px rgba(0, 0, 0, 0.06))

### Component Usage

**Import from UI library:**
```typescript
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge } from '@/components/ui'
```

**Button variants:**
- `variant="primary"` - Main actions (default)
- `variant="secondary"` - Secondary actions  
- `variant="destructive"` - Delete/remove actions
- `loading={true}` - Shows spinner

**Input with labels:**
- `label="Field Name"` - Automatic label linking
- `error="Error message"` - Error state styling

**Card composition:**
- Use Card + CardHeader/CardContent/CardFooter
- CardTitle for headings, CardDescription for subtitles

### Consistency Guidelines

1. **Always use the design system components** instead of custom styling
2. **Use semantic color names** (primary, secondary, error) not hex codes
3. **Follow component composition patterns** for complex UI
4. **Leverage TypeScript** for prop validation and autocomplete
5. **Test build** after changes: `npm run build`

### File Structure
```
components/
  ui/           # Design system components
    Button.tsx
    Input.tsx
    Card.tsx
    Badge.tsx
    index.ts    # Central exports
lib/
  utils.ts      # Utility functions (cn for className merging)
types/
  design-system.ts  # Type definitions
```

# Authentication Architecture

## Server-Side Cookie Authentication (Supabase SSR)

This project uses **server-side cookie authentication** with Supabase's SSR package for security and consistency.

### Authentication Pattern

**IMPORTANT:** Only use the approved authentication pattern. No other auth methods are permitted without permission.

```typescript
// API Route Authentication (REQUIRED PATTERN)
import { createServerSideClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSideClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Use supabase client with authenticated user context
}
```

```typescript
// Client-Side Authentication (REQUIRED PATTERN)
import { supabase } from '@/lib/supabase' // Uses createBrowserClient from @supabase/ssr

// Login
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// API calls automatically include cookies
const response = await fetch('/api/endpoint', {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
})
```

### Key Features

1. **Security**: HttpOnly cookies prevent XSS attacks
2. **Automatic**: Session management and refresh handled by middleware
3. **Consistent**: Single auth pattern across client and server
4. **SSR Support**: Works seamlessly with Server Components
5. **Synchronized**: Client and server auth state automatically synced via cookies

### Implementation Details

- **Middleware**: `/middleware.ts` handles automatic session refresh
- **Server Client**: `/lib/supabase-server.ts` provides authenticated Supabase client
- **Browser Client**: `/lib/supabase.ts` uses `createBrowserClient` from `@supabase/ssr`
- **No Bearer Tokens**: Authentication state managed via secure cookies
- **RLS Enabled**: Database-level security with Row Level Security

### Prohibited Patterns

❌ **Do NOT use these patterns without permission:**
- Bearer token authentication (`Authorization` headers)
- Manual JWT handling
- Custom authentication helpers
- Multiple auth patterns in the same codebase

### File Structure
```
middleware.ts           # Session refresh and cookie handling
lib/
  supabase-server.ts   # Server-side client factory
  supabase.ts          # Client-side client
app/api/               # All routes use createServerSideClient()
```

# Database Architecture

## Consolidated Schema (Post-Normalization)

This project uses a **consolidated, normalized database schema** following SOLID principles and eliminating duplicate tables and competing systems.

### Core Tables

1. **user_profiles** - Single source of truth for all users
   - `id`, `user_id` (Supabase Auth), `role`, `display_name`, profile data
   - Role-based access: `learner`, `expert`, `admin`

2. **expert_profiles** - Expert-specific data and statistics
   - Links to `user_profiles.id`
   - `hourly_rate_cents` - Consistent pricing in cents
   - `bio`, `rating`, `total_sessions`, availability settings

3. **learner_profiles** - Learner-specific data and progress
   - Links to `user_profiles.id` 
   - Learning preferences, progress tracking

4. **sessions** - Learning sessions offered by experts (consolidated from expert_sessions)
   - `expert_id` → `expert_profiles.id`
   - `price_cents` - All pricing in cents for consistency
   - `topic_tags[]`, `duration_minutes`, `level`, session details

5. **availability_windows** - Time windows when experts are available
   - `expert_id` → `expert_profiles.id`
   - Recurring availability patterns for automatic slot generation

6. **bookable_slots** - Available time slots for booking (replaces old slots table)
   - `session_id` → `sessions.id`
   - `availability_window_id` → `availability_windows.id`
   - `start_time`, `end_time`, availability tracking

7. **bookings** - Consolidated booking records with payment info
   - `learner_id` → `learner_profiles.id`
   - `expert_id` → `expert_profiles.id`
   - `session_id` → `sessions.id`
   - `slot_id` → `bookable_slots.id`
   - Payment status, amounts, Stripe integration

### Business Logic Functions

```sql
-- Create a new learning session
CREATE OR REPLACE FUNCTION create_session(
  p_expert_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_duration_minutes INTEGER,
  p_price_cents INTEGER,
  p_currency TEXT DEFAULT 'DKK'
) RETURNS UUID

-- Atomic booking creation with slot reservation
CREATE OR REPLACE FUNCTION create_booking_with_payment(
  p_learner_user_id UUID,
  p_slot_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (booking_id UUID, amount_cents INTEGER, currency TEXT, expert_id UUID, session_id UUID)
```

### Consolidated Views

```sql
-- booking_details view - Joins all booking-related data for API consumption
-- Eliminates complex joins in API routes
SELECT b.*, s.title, ep.bio, up_expert.display_name as expert_name, 
       up_learner.display_name as learner_name, bs.start_time, bs.end_time
FROM bookings b
JOIN sessions s ON b.session_id = s.id
JOIN expert_profiles ep ON b.expert_id = ep.id
-- ... additional joins
```

### Key Design Principles

1. **Single Source of Truth**: Eliminated duplicate tables (expert_sessions → sessions, slots → bookable_slots)
2. **Consistent Pricing**: All amounts stored in cents (`price_cents`, `hourly_rate_cents`)
3. **Clean Relationships**: Proper foreign keys, no circular dependencies
4. **Business Logic Encapsulation**: Complex operations in database functions
5. **Performance Optimized**: Strategic indexes on relationship and query columns

### Migration Strategy

- **Consolidated Schema**: `20250817000001_final_consolidated_schema.sql`
- **Data Preservation**: All existing data migrated during consolidation
- **API Compatibility**: 100% backward compatibility maintained through views and functions
- **Payment Integration**: Stripe payment tracking integrated into booking flow

### API Integration

All API routes updated to use consolidated schema:
- `/api/expert-sessions` → uses `sessions` table and `create_session()` function
- `/api/bookings/create-with-payment` → uses `create_booking_with_payment()` function  
- `/api/bookings/[id]` → uses `booking_details` view for simplified queries
- Payment webhooks → integrated with consolidated booking system