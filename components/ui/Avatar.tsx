import { forwardRef, ImgHTMLAttributes } from 'react'
import Image from 'next/image'
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
  ({ className, size = 'md', width, height, src, ...props }, ref) => {
    const sizeValue = size === 'sm' ? 32 : size === 'md' ? 64 : 96
    const imageWidth = typeof width === 'number' ? width : sizeValue
    const imageHeight = typeof height === 'number' ? height : sizeValue
    
    if (!src || typeof src !== 'string') {
      return null
    }
    
    return (
      <Image
        ref={ref}
        src={src}
        className={cn(
          'rounded-full object-cover',
          sizes[size],
          className
        )}
        alt={props.alt || 'Avatar'}
        width={imageWidth}
        height={imageHeight}
        {...props}
      />
    )
  }
)

Avatar.displayName = 'Avatar'

export { Avatar }
