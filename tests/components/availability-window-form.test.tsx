/**
 * Unit tests for AvailabilityWindowForm component
 * Tests the timezone handling fix and form validation
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvailabilityWindowForm } from '@/components/AvailabilityWindowForm'

// Mock the timezone to ensure consistent testing
const mockTimezone = 'America/New_York'
const originalDateTimeFormat = Intl.DateTimeFormat

beforeEach(() => {
  // Mock Intl.DateTimeFormat to return consistent timezone
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
    const formatter = new originalDateTimeFormat(locale, options)
    formatter.resolvedOptions = () => ({
      ...formatter.resolvedOptions(),
      timeZone: mockTimezone
    })
    return formatter
  })
})

describe('AvailabilityWindowForm - Timezone Handling Fix', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('should correctly convert local time to UTC ISO string', async () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Fill out the form
    const dateInput = screen.getByLabelText(/Date/i)
    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    await user.type(dateInput, '2024-03-15')
    await user.selectOptions(startTimeSelect, '10:00')
    await user.selectOptions(endTimeSelect, '11:00')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        start_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        end_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        notes: undefined
      })
    })

    // Verify the ISO strings are valid dates
    const call = mockOnSubmit.mock.calls[0][0]
    const startDate = new Date(call.start_at)
    const endDate = new Date(call.end_at)

    expect(startDate.getTime()).toBeLessThan(endDate.getTime())
    expect(isNaN(startDate.getTime())).toBe(false)
    expect(isNaN(endDate.getTime())).toBe(false)
  })

  it('should handle invalid date/time gracefully', async () => {
    // Mock console.error to suppress expected error logs
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Fill out form with invalid date that would cause Date constructor to fail
    const dateInput = screen.getByLabelText(/Date/i)
    
    // Simulate an invalid date scenario by directly manipulating the date input
    fireEvent.change(dateInput, { target: { value: 'invalid-date' } })

    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    await user.selectOptions(startTimeSelect, '10:00')
    await user.selectOptions(endTimeSelect, '11:00')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    // Should not call onSubmit due to validation error
    expect(mockOnSubmit).not.toHaveBeenCalled()

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Date is required/i)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  })

  it('should display correct timezone information', () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    // Select times to trigger timezone display
    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    fireEvent.change(startTimeSelect, { target: { value: '10:00' } })
    fireEvent.change(endTimeSelect, { target: { value: '11:00' } })

    // Should display the mocked timezone
    expect(screen.getByText(mockTimezone)).toBeInTheDocument()
  })

  it('should validate minimum duration correctly', async () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Fill out form with times too close together
    const dateInput = screen.getByLabelText(/Date/i)
    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    await user.type(dateInput, '2024-03-15')
    await user.selectOptions(startTimeSelect, '10:00')
    await user.selectOptions(endTimeSelect, '10:00') // Same time = 0 duration

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/End time must be after start time/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate maximum duration correctly', async () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Fill out form with duration longer than 8 hours
    const dateInput = screen.getByLabelText(/Date/i)
    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    await user.type(dateInput, '2024-03-15')
    await user.selectOptions(startTimeSelect, '06:00')
    await user.selectOptions(endTimeSelect, '22:00') // 16 hours duration

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Maximum duration is 8 hours/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate lead time for today\'s date', async () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Get today's date in YYYY-MM-DD format
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]

    // Get current time and add less than 1 hour
    const currentHour = today.getHours()
    const pastTime = `${String(currentHour).padStart(2, '0')}:00`

    const dateInput = screen.getByLabelText(/Date/i)
    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    await user.type(dateInput, todayString)
    await user.selectOptions(startTimeSelect, pastTime)
    await user.selectOptions(endTimeSelect, `${String(currentHour + 1).padStart(2, '0')}:00`)

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    // Should show validation error for lead time
    await waitFor(() => {
      expect(screen.getByText(/Start time must be at least 1 hour from now/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should allow valid future availability windows', async () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Create a date well in the future
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7) // One week from now
    const futureDateString = futureDate.toISOString().split('T')[0]

    const dateInput = screen.getByLabelText(/Date/i)
    const startTimeSelect = screen.getByLabelText(/Start Time/i)
    const endTimeSelect = screen.getByLabelText(/End Time/i)

    await user.type(dateInput, futureDateString)
    await user.selectOptions(startTimeSelect, '10:00')
    await user.selectOptions(endTimeSelect, '11:00')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        start_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        end_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        notes: undefined
      })
    })
  })

  it('should reset form after successful submission', async () => {
    render(<AvailabilityWindowForm onSubmit={mockOnSubmit} />)

    const user = userEvent.setup()

    // Fill out the form
    const dateInput = screen.getByLabelText(/Date/i) as HTMLInputElement
    const startTimeSelect = screen.getByLabelText(/Start Time/i) as HTMLSelectElement
    const endTimeSelect = screen.getByLabelText(/End Time/i) as HTMLSelectElement
    const notesInput = screen.getByLabelText(/Notes/i) as HTMLInputElement

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    const futureDateString = futureDate.toISOString().split('T')[0]

    await user.type(dateInput, futureDateString)
    await user.selectOptions(startTimeSelect, '10:00')
    await user.selectOptions(endTimeSelect, '11:00')
    await user.type(notesInput, 'Test notes')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Create Availability Window/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })

    // Form should be reset
    await waitFor(() => {
      expect(dateInput.value).toBe('')
      expect(startTimeSelect.value).toBe('')
      expect(endTimeSelect.value).toBe('')
      expect(notesInput.value).toBe('')
    })
  })
})
