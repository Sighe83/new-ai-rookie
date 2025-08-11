import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { BaseComponentProps } from '@/types/design-system'

export interface NavigationProps extends HTMLAttributes<HTMLElement>, BaseComponentProps {
  items: Array<{ label: string; href?: string; active?: boolean; }>
  variant?: 'primary' | 'secondary'
}

const variantStyles = {
  primary: 'bg-blue-50',
  secondary: 'bg-violet-50',
}

export const Navigation = forwardRef<HTMLElement, NavigationProps>(
  ({ className, items, variant = 'primary', ...props }, ref) => (
    <nav
      ref={ref}
      className={cn('p-3 rounded-xl', variantStyles[variant], className)}
      {...props}
    >
      <ul className="flex items-center space-x-6">
        {items.map((item, idx) => (
          <li key={idx} className={cn(
            'font-bold',
            item.active
              ? variant === 'primary'
                ? 'text-primary'
                : 'text-violet-700'
              : 'text-text-light hover:text-primary'
          )}>
            {item.href ? <a href={item.href}>{item.label}</a> : item.label}
          </li>
        ))}
      </ul>
    </nav>
  )
)

Navigation.displayName = 'Navigation'
