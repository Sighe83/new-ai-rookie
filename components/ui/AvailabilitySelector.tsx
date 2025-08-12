import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { BaseComponentProps } from '@/types/design-system'

export interface AvailabilitySlot {
  time: string
  available: boolean
}

export interface AvailabilitySelectorProps extends BaseComponentProps {
  slots: AvailabilitySlot[]
  onSelect?: (time: string) => void
  divProps?: HTMLAttributes<HTMLDivElement>
}

export const AvailabilitySelector = forwardRef<HTMLDivElement, AvailabilitySelectorProps>(
  ({ className, slots, onSelect, divProps }, ref) => (
    <div
      ref={ref}
      className={cn('grid grid-cols-2 gap-3 text-center', className)}
      {...divProps}
    >
      {slots.map((slot, idx) => (
        <div
          key={idx}
          className={cn(
            'p-3 rounded-lg',
            slot.available
              ? 'border border-green-200 text-success-text bg-success-bg cursor-pointer hover:border-green-400 transition'
              : 'border border-border text-gray-400 bg-gray-100 cursor-not-allowed'
          )}
          tabIndex={slot.available ? 0 : -1}
          aria-disabled={!slot.available}
          onClick={() => slot.available && onSelect?.(slot.time)}
        >
          {slot.time}
        </div>
      ))}
    </div>
  )
)

AvailabilitySelector.displayName = 'AvailabilitySelector'
