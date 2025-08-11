
import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { ButtonVariant, Size, BaseComponentProps } from '@/types/design-system'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, BaseComponentProps {
  variant?: ButtonVariant
  size?: Size
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
    
    const variants = {
      primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
      secondary: 'bg-secondary text-secondary-text hover:bg-secondary-hover focus:ring-secondary',
      destructive: 'bg-error-bg text-error-text hover:bg-red-200 focus:ring-error',
    }
    
    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-5 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }