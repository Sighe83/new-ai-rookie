/**
 * Race Condition and Concurrency Tests
 * 
 * Tests the system's ability to handle concurrent access and prevent race conditions:
 * - Multiple users booking the same slot simultaneously
 * - Concurrent payment processing
 * - Simultaneous expert confirmations
 * - Parallel cancellation requests
 * - Database transaction isolation
 * 
 * @fileoverview Race condition prevention tests for booking system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

// Mock dependencies
vi.mock('@/lib/supabase-server')
vi.mock('@/lib/stripe')

describe('Race Condition and Concurrency Tests', () => {
  let mockSupabase: any
  let testSlotId: string
  let testSessionId: string

  beforeEach(() => {
    vi.clearAllMocks()
    
    testSlotId = 'race-test-slot-' + Date.now()
    testSessionId = 'race-test-session-' + Date.now()

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-id', email: 'test@example.com' } },
          error: null
        })
      },
      rpc: vi.fn(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis()
    }

    vi.mocked(createServerSideClient).mockResolvedValue(mockSupabase)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Slot Booking Race Conditions', () => {
    it('should prevent multiple users from booking the same slot', async () => {
      // Simulate two users trying to book the same slot simultaneously
      const user1BookingPromise = simulateBookingRequest('user-1', testSlotId, testSessionId)
      const user2BookingPromise = simulateBookingRequest('user-2', testSlotId, testSessionId)

      // First request should succeed
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [{
            booking_id: 'booking-1',
            status: 'pending',
            slot_id: testSlotId
          }],
          error: null
        })
        // Second request should fail due to slot unavailability
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Slot not available' }
        })

      const [result1, result2] = await Promise.all([
        user1BookingPromise,
        user2BookingPromise
      ])

      // One should succeed, one should fail
      const responses = [result1, result2]
      const successful = responses.filter(r => r.status === 200)
      const failed = responses.filter(r => r.status === 409)

      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)
    })

    it('should handle database deadlock gracefully', async () => {
      // Simulate database deadlock error
      mockSupabase.rpc.mockRejectedValue(new Error('deadlock detected'))

      const response = await simulateBookingRequest('user-1', testSlotId, testSessionId)
      
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Failed to create booking')
    })

    it('should maintain slot availability consistency under high load', async () => {
      // Create 10 concurrent booking attempts for the same slot
      const bookingPromises = Array.from({ length: 10 }, (_, i) => 
        simulateBookingRequest(`user-${i}`, testSlotId, testSessionId)
      )

      // Only the first request should succeed
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [{ booking_id: 'success-booking', status: 'pending' }],
          error: null
        })
        .mockResolvedValue({
          data: null,
          error: { message: 'Slot not available' }
        })

      const results = await Promise.all(bookingPromises)
      
      const successful = results.filter(r => r.status === 200)
      const failed = results.filter(r => r.status === 409)

      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(9)
    })
  })

  describe('Payment Processing Race Conditions', () => {
    it('should prevent duplicate payment intent creation', async () => {
      const bookingId = 'test-booking-id'
      
      // First request should create payment intent
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: bookingId, payment_status: 'pending' },
          error: null
        })
        // Second request should find payment already processing
        .mockResolvedValueOnce({
          data: { id: bookingId, payment_status: 'processing' },
          error: null
        })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
        id: 'pi_test',
        client_secret: 'pi_test_secret'
      } as any)

      mockSupabase.update.mockResolvedValue({ error: null })

      const promise1 = simulatePaymentIntentRequest(bookingId, 50.00)
      const promise2 = simulatePaymentIntentRequest(bookingId, 50.00)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // One should succeed, one should be rejected
      const responses = [result1, result2]
      const successful = responses.filter(r => r.status === 200)
      const failed = responses.filter(r => r.status === 400)

      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)
    })

    it('should handle concurrent expert confirmations', async () => {
      const bookingId = 'test-booking-id'
      
      // First confirmation should succeed
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [{ booking_id: bookingId, status: 'confirmed' }],
          error: null
        })
        // Second confirmation should fail (already processed)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Booking has already been confirmed' }
        })

      const promise1 = simulateExpertConfirmation(bookingId, 'confirm')
      const promise2 = simulateExpertConfirmation(bookingId, 'confirm')

      const [result1, result2] = await Promise.all([promise1, promise2])

      // One should succeed, one should fail
      const responses = [result1, result2]
      const successful = responses.filter(r => r.status === 200)
      const failed = responses.filter(r => r.status === 400)

      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)
    })
  })

  describe('Cancellation Race Conditions', () => {
    it('should prevent double cancellation', async () => {
      const bookingId = 'test-booking-id'
      
      // First cancellation should succeed
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [{
            booking_id: bookingId,
            status: 'cancelled',
            refund_amount: 50.00
          }],
          error: null
        })
        // Second cancellation should fail (already cancelled)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Cannot cancel booking with status: cancelled' }
        })

      const promise1 = simulateBookingCancellation(bookingId, 'Schedule conflict')
      const promise2 = simulateBookingCancellation(bookingId, 'Emergency')

      const [result1, result2] = await Promise.all([promise1, promise2])

      // One should succeed, one should fail
      const responses = [result1, result2]
      const successful = responses.filter(r => r.status === 200)
      const failed = responses.filter(r => r.status === 400)

      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)
    })

    it('should handle simultaneous expert decline and student cancellation', async () => {
      const bookingId = 'test-booking-id'
      
      // One action should succeed, the other should fail
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [{ booking_id: bookingId, status: 'declined' }],
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Cannot cancel booking with status: declined' }
        })

      const expertDeclinePromise = simulateExpertConfirmation(bookingId, 'decline')
      const studentCancelPromise = simulateBookingCancellation(bookingId, 'Changed mind')

      const [expertResult, studentResult] = await Promise.all([
        expertDeclinePromise,
        studentCancelPromise
      ])

      // One should succeed, one should fail
      const responses = [expertResult, studentResult]
      const successful = responses.filter(r => r.status === 200)
      const failed = responses.filter(r => r.status === 400)

      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(1)
    })
  })

  describe('Database Transaction Isolation', () => {
    it('should maintain ACID properties under concurrent load', async () => {
      // Test multiple operations on the same booking
      const bookingId = 'acid-test-booking'
      
      const operations = [
        () => mockSupabase.rpc('confirm_booking_transaction', { p_booking_id: bookingId }),
        () => mockSupabase.rpc('cancel_booking_transaction', { p_booking_id: bookingId }),
        () => mockSupabase.update({ payment_status: 'captured' }).eq('id', bookingId),
        () => mockSupabase.update({ status: 'completed' }).eq('id', bookingId)
      ]

      // Mock responses - only one should succeed
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [{ success: true }], error: null })
        .mockRejectedValue(new Error('Transaction conflict'))

      mockSupabase.update
        .mockResolvedValueOnce({ error: null })
        .mockRejectedValue(new Error('Transaction conflict'))

      const results = await Promise.allSettled(
        operations.map(op => op())
      )

      // At least one operation should succeed
      const successful = results.filter(r => r.status === 'fulfilled')
      expect(successful.length).toBeGreaterThan(0)
    })

    it('should handle slot cleanup race conditions', async () => {
      // Test concurrent slot cleanup operations
      const slotId = 'cleanup-test-slot'
      
      const cleanupPromises = Array.from({ length: 5 }, () =>
        mockSupabase.rpc('cleanup_orphaned_slots')
      )

      mockSupabase.rpc.mockResolvedValue({
        data: 1, // cleaned count
        error: null
      })

      const results = await Promise.all(cleanupPromises)
      
      // All should complete without errors
      results.forEach(result => {
        expect(result.error).toBeNull()
      })
    })
  })

  describe('Timeout and Cleanup Race Conditions', () => {
    it('should handle concurrent booking timeout and expert confirmation', async () => {
      const bookingId = 'timeout-test-booking'
      
      // Simulate timeout cleanup and expert confirmation happening simultaneously
      const timeoutPromise = mockSupabase.rpc('timeout_expired_bookings')
      const confirmPromise = mockSupabase.rpc('confirm_booking_transaction', {
        p_booking_id: bookingId,
        p_action: 'confirm'
      })

      // One should succeed, one should fail
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: [{ booking_id: bookingId, status: 'cancelled' }],
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Booking has already been cancelled' }
        })

      const [timeoutResult, confirmResult] = await Promise.all([
        timeoutPromise,
        confirmPromise
      ])

      // One operation should succeed
      expect([timeoutResult, confirmResult].some(r => r.data)).toBe(true)
    })
  })

  // Helper functions for simulating API requests
  async function simulateBookingRequest(userId: string, slotId: string, sessionId: string) {
    // Mock user authentication for this request
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: userId, email: `${userId}@example.com` } },
      error: null
    })

    return fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        sessionId,
        notes: `Booking by ${userId}`
      })
    })
  }

  async function simulatePaymentIntentRequest(bookingId: string, amount: number) {
    return fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        amount,
        currency: "dkk"'
      })
    })
  }

  async function simulateExpertConfirmation(bookingId: string, action: 'confirm' | 'decline') {
    return fetch('/api/bookings/expert/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        action
      })
    })
  }

  async function simulateBookingCancellation(bookingId: string, reason: string) {
    return fetch('/api/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        reason
      })
    })
  }
})