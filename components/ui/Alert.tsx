import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { BaseComponentProps } from '@/types/design-system'

export type AlertVariant = 'success' | 'warning' | 'error' | 'info'

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, BaseComponentProps {
  variant?: AlertVariant
  title?: string
}

const variantStyles: Record<AlertVariant, string> = {
  success: 'bg-success-bg text-success-text border-success-text',
  warning: 'bg-warning-bg text-warning-text border-warning-text',
  error: 'bg-error-bg text-error-text border-error-text',
  info: 'bg-blue-50 text-primary border-primary',
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'border-l-4 p-4 rounded-xl flex flex-col gap-1',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {title && <div className="font-bold mb-1" tabIndex={0}>{title}</div>}
      <div>{children}</div>
    </div>
  )
)

Alert.displayName = 'Alert'
