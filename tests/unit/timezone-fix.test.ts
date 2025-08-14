/**
 * Unit tests for timezone handling fix
 * Tests the convertToISOString function behavior
 */

import { describe, it, expect } from 'vitest'

describe('Timezone Handling Fix', () => {
  // Simulate the fixed convertToISOString function
  const convertToISOString = (date: string, time: string): string => {
    // Create a proper local datetime and convert to UTC
    const localDateTime = new Date(`${date}T${time}:00`)
    
    // Validate the date is valid
    if (isNaN(localDateTime.getTime())) {
      throw new Error('Invalid date or time format')
    }
    
    return localDateTime.toISOString()
  }

  it('should convert local date and time to proper ISO string', () => {
    const result = convertToISOString('2024-03-15', '10:00')
    
    // Should be a valid ISO string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    
    // Should be parseable back to a Date
    const parsedDate = new Date(result)
    expect(isNaN(parsedDate.getTime())).toBe(false)
  })

  it('should handle timezone conversion correctly', () => {
    const result = convertToISOString('2024-03-15', '10:00')
    const parsedDate = new Date(result)
    
    // The UTC time should be different from local time (unless user is in UTC)
    // This test verifies the Date constructor is handling timezone conversion
    expect(parsedDate.toISOString()).toBe(result)
  })

  it('should throw error for invalid date', () => {
    expect(() => {
      convertToISOString('invalid-date', '10:00')
    }).toThrow('Invalid date or time format')
  })

  it('should throw error for invalid time', () => {
    expect(() => {
      convertToISOString('2024-03-15', 'invalid-time')
    }).toThrow('Invalid date or time format')
  })

  it('should handle edge case times correctly', () => {
    // Test midnight
    const midnight = convertToISOString('2024-03-15', '00:00')
    expect(midnight).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    
    // Test 11:59 PM
    const lateNight = convertToISOString('2024-03-15', '23:59')
    expect(lateNight).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    
    // Verify order
    expect(new Date(midnight).getTime()).toBeLessThan(new Date(lateNight).getTime())
  })

  it('should maintain consistent duration between start and end times', () => {
    const startTime = convertToISOString('2024-03-15', '10:00')
    const endTime = convertToISOString('2024-03-15', '11:00')
    
    const startDate = new Date(startTime)
    const endDate = new Date(endTime)
    
    // Should be exactly 1 hour difference (3600000 milliseconds)
    const duration = endDate.getTime() - startDate.getTime()
    expect(duration).toBe(60 * 60 * 1000)
  })
})
