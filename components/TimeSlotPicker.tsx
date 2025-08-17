'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Badge } from '@/components/ui'
import { CalendarIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TimeSlot {
  start_at: string
  end_at: string
  is_available: boolean
  availability_window_id: string
  session_duration_minutes: number
}

interface TimeSlotPickerProps {
  sessionId: string
  sessionDuration: number
  onSlotSelected: (slot: TimeSlot) => void
  selectedSlot?: TimeSlot | null
}

export function TimeSlotPicker({
  sessionId,
  sessionDuration,
  onSlotSelected,
  selectedSlot
}: TimeSlotPickerProps) {
  const [loading, setLoading] = useState(true)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  })
  const [error, setError] = useState<string | null>(null)

  // Group time slots by date
  const slotsByDate = timeSlots.reduce((acc, slot) => {
    const date = new Date(slot.start_at).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {} as Record<string, TimeSlot[]>)

  // Get slots for selected date
  const selectedDateStr = selectedDate.toDateString()
  const slotsForSelectedDate = slotsByDate[selectedDateStr] || []

  // Available dates (dates that have at least one available slot)
  const availableDates = Object.keys(slotsByDate).filter(dateStr => 
    slotsByDate[dateStr].some(slot => slot.is_available)
  )

  useEffect(() => {
    loadTimeSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, selectedDate])

  const loadTimeSlots = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Calculate date range (selected date + 6 more days)
      const startDate = new Date(selectedDate)
      startDate.setHours(0, 0, 0, 0)
      
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
      
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]
      
      // Use cookie authentication (no Authorization header needed)
      const response = await fetch(
        `/api/expert-sessions/${sessionId}/time-slots?start_date=${startStr}&end_date=${endStr}`,
        {
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load time slots')
      }
      
      const data = await response.json()
      setTimeSlots(data.time_slots || [])
    } catch (err) {
      console.error('Error loading time slots:', err)
      setError(err instanceof Error ? err.message : 'Failed to load available times')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    
    // Don't go before tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    if (newDate >= tomorrow) {
      setSelectedDate(newDate)
    }
  }


  const selectSpecificDate = (date: Date) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    if (date >= tomorrow) {
      setSelectedDate(date)
    }
  }

  // Get the week view (7 days starting from selected date)
  const getWeekDates = () => {
    const startOfWeek = new Date(selectedDate)
    const dayOfWeek = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Start on Monday
    startOfWeek.setDate(diff)
    
    const weekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      weekDates.push(date)
    }
    return weekDates
  }

  const weekDates = getWeekDates()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  const isSlotSelected = (slot: TimeSlot) => {
    return selectedSlot?.start_at === slot.start_at && 
           selectedSlot?.end_at === slot.end_at
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2"></div>
          <p className="text-text-light">Loading available times...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-error">
          <p className="font-medium">Error loading times</p>
          <p className="text-sm mt-1">{error}</p>
          <Button 
            variant="secondary" 
            onClick={loadTimeSlots}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Select Date & Time
          </h3>
          <Badge variant="primary">
            {sessionDuration} minutes
          </Badge>
        </div>
        
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateWeek('prev')}
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Week
          </Button>
          
          <span className="text-sm text-text-light">
            Week of {formatDate(weekDates[0])}
          </span>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateWeek('next')}
          >
            Week
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Day Navigation */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDates.map((date, idx) => {
            const dateStr = date.toDateString()
            const isSelected = dateStr === selectedDateStr
            const isPast = date < tomorrow
            const hasSlots = availableDates.includes(dateStr)
            const availableCount = hasSlots ? slotsByDate[dateStr]?.filter(s => s.is_available).length || 0 : 0
            
            return (
              <button
                key={idx}
                onClick={() => !isPast && selectSpecificDate(date)}
                disabled={isPast}
                className={`
                  p-2 rounded-lg text-center transition-colors text-xs
                  ${isSelected 
                    ? 'bg-primary text-white' 
                    : hasSlots 
                      ? 'bg-success-bg text-success-text hover:bg-success-bg/80' 
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }
                  ${isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="font-medium">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-lg font-bold">
                  {date.getDate()}
                </div>
                {availableCount > 0 && (
                  <div className="text-xs mt-1">
                    {availableCount} slots
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Date Info */}
        <div className="text-center mb-4">
          <p className="text-lg font-medium text-text">
            {formatDate(selectedDate)}
          </p>
          <p className="text-sm text-text-light">
            {availableDates.includes(selectedDateStr) 
              ? `${slotsForSelectedDate.filter(s => s.is_available).length} slots available`
              : 'No slots available'}
          </p>
        </div>
      </Card>

      {/* Time Slots Grid */}
      <Card className="p-4">
        <h4 className="text-sm font-medium text-text-light mb-3 flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Available Times
        </h4>
        
        {slotsForSelectedDate.length === 0 ? (
          <p className="text-center text-text-light py-8">
            No time slots available for this date
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {slotsForSelectedDate.map((slot, idx) => (
              <Button
                key={idx}
                variant={isSlotSelected(slot) ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => slot.is_available && onSlotSelected(slot)}
                disabled={!slot.is_available}
                className={`
                  ${!slot.is_available ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isSlotSelected(slot) ? 'ring-2 ring-primary ring-offset-2' : ''}
                `}
              >
                {formatTime(slot.start_at)}
              </Button>
            ))}
          </div>
        )}
        
        {slotsForSelectedDate.length > 0 && (
          <div className="mt-4 flex items-center gap-4 text-xs text-text-light">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary rounded"></div>
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-secondary rounded"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-200 rounded"></div>
              <span>Unavailable</span>
            </div>
          </div>
        )}
      </Card>

      {/* Selected Slot Summary */}
      {selectedSlot && (
        <Card className="p-4 bg-success-bg border-success-text/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-success-text">Selected Time</p>
              <p className="text-text mt-1">
                {formatDate(new Date(selectedSlot.start_at))} at {formatTime(selectedSlot.start_at)}
              </p>
              <p className="text-sm text-text-light">
                Duration: {sessionDuration} minutes
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSlotSelected(selectedSlot)}
            >
              Change
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}