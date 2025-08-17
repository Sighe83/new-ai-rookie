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