import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    
    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={inputId} 
            className={cn(
              'block text-sm font-bold mb-1',
              error ? 'text-error-text' : 'text-text-light'
            )}
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full px-4 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            error 
              ? 'bg-error-bg border border-red-300 text-error-text placeholder:text-red-500/70 focus:ring-error focus:border-error' 
              : 'bg-surface border border-border text-text',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-error-text text-sm mt-1">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }