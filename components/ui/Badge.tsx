
import type { HTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { BadgeVariant, BaseComponentProps } from '@/types/design-system'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, BaseComponentProps {
  variant?: BadgeVariant
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', ...props }, ref) => {
    const variants = {
      success: 'bg-success-bg text-success-text',
      warning: 'bg-warning-bg text-warning-text',
      neutral: 'bg-gray-100 text-gray-600',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }