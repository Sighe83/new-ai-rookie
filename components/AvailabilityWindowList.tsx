'use client'

import { useState } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import type { AvailabilityWindow } from '@/types/availability'

interface AvailabilityWindowListProps {
  windows: AvailabilityWindow[]
  onDelete?: (id: string) => Promise<void>
  onToggleStatus?: (id: string, isClosed: boolean) => Promise<void>
  isLoading?: boolean
}

export function AvailabilityWindowList({ 
  windows, 
  onDelete, 
  onToggleStatus, 
  isLoading = false 
}: AvailabilityWindowListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      })
    }
  }

  const calculateDuration = (startAt: string, endAt: string) => {
    const start = new Date(startAt)
    const end = new Date(endAt)
    const durationMs = end.getTime() - start.getTime()
    const durationMinutes = Math.floor(durationMs / (1000 * 60))
    
    if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60)
      const minutes = durationMinutes % 60
      return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
    }
    
    return `${durationMinutes}m`
  }

  const isInPast = (isoString: string) => {
    return new Date(isoString) < new Date()
  }

  const getStatusBadge = (window: AvailabilityWindow) => {
    if (window.is_closed) {
      return <Badge variant="destructive">Closed</Badge>
    }
    
    if (isInPast(window.start_at)) {
      return <Badge variant="neutral">Past</Badge>
    }
    
    return <Badge variant="success">Open</Badge>
  }

  const handleDelete = async (id: string) => {
    if (!onDelete) return
    
    setDeletingId(id)
    try {
      await onDelete(id)
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (id: string, currentIsClosed: boolean) => {
    if (!onToggleStatus) return
    
    setTogglingId(id)
    try {
      await onToggleStatus(id, !currentIsClosed)
    } catch (error) {
      console.error('Toggle status error:', error)
    } finally {
      setTogglingId(null)
    }
  }

  if (windows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-text-light">No availability windows created yet.</p>
          <p className="text-sm text-text-light mt-2">
            Create your first availability window to let learners book sessions with you.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Sort windows by start time
  const sortedWindows = [...windows].sort((a, b) => 
    new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )

  return (
    <div className="space-y-4">
      {sortedWindows.map((window) => {
        const startDateTime = formatDateTime(window.start_at)
        const endDateTime = formatDateTime(window.end_at)
        const duration = calculateDuration(window.start_at, window.end_at)
        const isPast = isInPast(window.start_at)
        const isDeleting = deletingId === window.id
        const isToggling = togglingId === window.id

        return (
          <Card key={window.id} className={isPast ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-lg">
                      {startDateTime.date}
                    </CardTitle>
                    {getStatusBadge(window)}
                  </div>
                  
                  <div className="space-y-1 text-sm text-text-light">
                    <p>
                      <strong>Time:</strong> {startDateTime.time} - {endDateTime.time}
                    </p>
                    <p>
                      <strong>Duration:</strong> {duration}
                    </p>
                    {window.notes && (
                      <p>
                        <strong>Notes:</strong> {window.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {!isPast && onToggleStatus && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleStatus(window.id, window.is_closed)}
                      loading={isToggling}
                      disabled={isLoading || isToggling}
                    >
                      {window.is_closed ? 'Reopen' : 'Close'}
                    </Button>
                  )}
                  
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(window.id)}
                      loading={isDeleting}
                      disabled={isLoading || isDeleting}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        )
      })}
    </div>
  )
}