import { forwardRef, ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { BaseComponentProps } from '@/types/design-system'

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement>, BaseComponentProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
}

const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  ({ className, size = 'md', ...props }, ref) => (
    <img
      ref={ref}
      className={cn(
        'rounded-full object-cover',
        sizes[size],
        className
      )}
      alt={props.alt || 'Avatar'}
      {...props}
    />
  )
)

Avatar.displayName = 'Avatar'

export { Avatar }
