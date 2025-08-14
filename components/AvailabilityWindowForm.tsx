'use client'

import { useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Select } from '@/components/ui'
import type { AvailabilityWindowFormData, CreateAvailabilityWindowRequest } from '@/types/availability'

interface AvailabilityWindowFormProps {
  onSubmit: (data: CreateAvailabilityWindowRequest) => Promise<void>
  isLoading?: boolean
}

const TIME_SLOTS = [
  '06:00', '06:15', '06:30', '06:45',
  '07:00', '07:15', '07:30', '07:45',
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00', '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30', '18:45',
  '19:00', '19:15', '19:30', '19:45',
  '20:00', '20:15', '20:30', '20:45',
  '21:00', '21:15', '21:30', '21:45',
  '22:00'
]

export function AvailabilityWindowForm({ onSubmit, isLoading = false }: AvailabilityWindowFormProps) {
  const [formData, setFormData] = useState<AvailabilityWindowFormData>({
    date: '',
    start_time: '',
    end_time: '',
    notes: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Date validation
    if (!formData.date) {
      newErrors.date = 'Date is required'
    } else {
      const selectedDate = new Date(formData.date + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        newErrors.date = 'Date cannot be in the past'
      }

      const maxDate = new Date()
      maxDate.setDate(maxDate.getDate() + 180)
      if (selectedDate > maxDate) {
        newErrors.date = 'Date cannot be more than 180 days in the future'
      }
    }

    // Time validation
    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required'
    }

    if (!formData.end_time) {
      newErrors.end_time = 'End time is required'
    }

    if (formData.start_time && formData.end_time) {
      const startMinutes = timeToMinutes(formData.start_time)
      const endMinutes = timeToMinutes(formData.end_time)

      if (startMinutes >= endMinutes) {
        newErrors.end_time = 'End time must be after start time'
      }

      const durationMinutes = endMinutes - startMinutes
      if (durationMinutes < 15) {
        newErrors.end_time = 'Minimum duration is 15 minutes'
      }

      if (durationMinutes > 480) {
        newErrors.end_time = 'Maximum duration is 8 hours'
      }

      // Check lead time if date is today
      if (formData.date) {
        const selectedDate = new Date(formData.date)
        const today = new Date()
        
        if (selectedDate.toDateString() === today.toDateString()) {
          const startDateTime = new Date(`${formData.date}T${formData.start_time}:00`)
          const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)
          
          if (startDateTime < oneHourFromNow) {
            newErrors.start_time = 'Start time must be at least 1 hour from now'
          }
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  const convertToISOString = (date: string, time: string): string => {
    // Create a proper local datetime and convert to UTC
    const localDateTime = new Date(`${date}T${time}:00`)
    
    // Validate the date is valid
    if (isNaN(localDateTime.getTime())) {
      throw new Error('Invalid date or time format')
    }
    
    return localDateTime.toISOString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      const requestData: CreateAvailabilityWindowRequest = {
        start_at: convertToISOString(formData.date, formData.start_time),
        end_at: convertToISOString(formData.date, formData.end_time),
        notes: formData.notes || undefined
      }

      await onSubmit(requestData)
      // Reset form on success
      setFormData({
        date: '',
        start_time: '',
        end_time: '',
        notes: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
      setErrors({})
    } catch (error) {
      // Handle date conversion errors
      if (error instanceof Error && error.message.includes('Invalid date')) {
        setErrors({ date: 'Invalid date or time format' })
        return
      }
      
      // Error handling is done by parent component
      console.error('Form submission error:', error)
      throw error // Re-throw so parent can handle it
    }
  }

  // Generate available end times based on start time
  const getAvailableEndTimes = () => {
    if (!formData.start_time) return TIME_SLOTS
    
    const startMinutes = timeToMinutes(formData.start_time)
    return TIME_SLOTS.filter(time => {
      const timeMinutes = timeToMinutes(time)
      const duration = timeMinutes - startMinutes
      return duration >= 15 && duration <= 480 // 15 minutes to 8 hours
    })
  }

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Get maximum date (180 days from now)
  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 180)
    return maxDate.toISOString().split('T')[0]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Availability Window</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="date"
            label="Date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            error={errors.date}
            min={getMinDate()}
            max={getMaxDate()}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Start Time"
              value={formData.start_time}
              onChange={(e) => {
                const newStartTime = e.target.value
                setFormData(prev => ({
                  ...prev,
                  start_time: newStartTime,
                  // Clear end time if it's now invalid
                  end_time: prev.end_time && timeToMinutes(prev.end_time) <= timeToMinutes(newStartTime) 
                    ? '' 
                    : prev.end_time
                }))
              }}
              error={errors.start_time}
              required
            >
              <option value="">Select start time</option>
              {TIME_SLOTS.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </Select>

            <Select
              label="End Time"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              error={errors.end_time}
              required
              disabled={!formData.start_time}
            >
              <option value="">Select end time</option>
              {getAvailableEndTimes().map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Notes (Optional)"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Add any notes about this availability window..."
            maxLength={500}
          />

          {formData.start_time && formData.end_time && (
            <div className="p-4 bg-surface rounded-lg">
              <p className="text-sm text-text-light">
                <strong>Duration:</strong> {timeToMinutes(formData.end_time) - timeToMinutes(formData.start_time)} minutes
              </p>
              <p className="text-sm text-text-light">
                <strong>Timezone:</strong> {formData.timezone}
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              loading={isLoading}
              disabled={isLoading}
              className="flex-1"
            >
              Create Availability Window
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}