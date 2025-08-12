import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { BaseComponentProps } from '@/types/design-system'

export interface DashboardLayoutProps extends BaseComponentProps {
  menu: React.ReactNode
  content: React.ReactNode
  divProps?: HTMLAttributes<HTMLDivElement>
}

export const DashboardLayout = forwardRef<HTMLDivElement, DashboardLayoutProps>(
  ({ className, menu, content, divProps }, ref) => (
    <div
      ref={ref}
      className={cn('bg-base rounded-xl border border-border overflow-hidden flex h-[400px]', className)}
      {...divProps}
    >
      <div className="w-1/4 bg-surface p-4 border-r border-border">{menu}</div>
      <div className="w-3/4 p-6">{content}</div>
    </div>
  )
)

DashboardLayout.displayName = 'DashboardLayout'
