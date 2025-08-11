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