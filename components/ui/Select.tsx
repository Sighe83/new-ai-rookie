import { forwardRef, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { BaseComponentProps } from '@/types/design-system'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, BaseComponentProps {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block text-sm font-bold mb-1',
              error ? 'text-error-text' : 'text-text-light'
            )}
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'w-full px-4 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            error
              ? 'bg-error-bg border border-red-300 text-error-text placeholder:text-red-500/70 focus:ring-error focus:border-error'
              : 'bg-surface border border-border text-text',
            className
          )}
          aria-invalid={!!error}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-error-text text-sm mt-1">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }
