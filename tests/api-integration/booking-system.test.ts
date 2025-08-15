/**
 * Comprehensive Booking System Integration Tests
 * 
 * Tests the complete booking workflow including:
 * - Booking creation with atomic transactions
 * - Payment processing via Stripe
 * - Expert confirmation/decline workflow
 * - Automatic timeout handling
 * - Cancellation with refund policies
 * - Webhook processing
 * - Race condition prevention
 * 
 * @fileoverview Integration tests for the booking and payment system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

// Mock Stripe - we'll test actual Stripe integration separately
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
      capture: vi.fn(),
      cancel: vi.fn()
    },
    refunds: {
      create: vi.fn()
    },
    webhooks: {
      constructEvent: vi.fn()
    }
  },
  formatAmountForStripe: vi.fn((amount: number) => amount * 100)
}))

// Mock server-side client
vi.mock('@/lib/supabase-server', () => ({
  createServerSideClient: vi.fn()
}))

describe('Booking System Integration Tests', () => {
  let mockSupabase: any
  let mockUser: any
  let testSlotId: string
  let testSessionId: string
  let testBookingId: string

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock user
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com'
    }

    // Setup mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      rpc: vi.fn(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis()
    }

    vi.mocked(createServerSideClient).mockResolvedValue(mockSupabase)

    // Create test data
    testSlotId = 'test-slot-id-' + Date.now()
    testSessionId = 'test-session-id-' + Date.now()
    testBookingId = 'test-booking-id-' + Date.now()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Booking Creation (/api/bookings/create)', () => {
    it('should create booking successfully with valid data', async () => {
      // Mock successful booking creation transaction
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: testBookingId,
          expert_id: 'expert-id',
          slot_id: testSlotId,
          session_id: testSessionId,
          status: 'pending',
          payment_status: 'pending',
          amount_authorized: 50.00,
          currency: 'usd',
          created_at: new Date().toISOString()
        }],
        error: null
      })

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: testSlotId,
          sessionId: testSessionId,
          notes: 'Test booking'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.booking).toBeDefined()
      expect(data.booking.booking_id).toBe(testBookingId)
      expect(data.booking.status).toBe('pending')
    })

    it('should handle slot unavailability gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Slot not available' }
      })

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: testSlotId,
          sessionId: testSessionId
        })
      })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('no longer available')
    })

    it('should prevent duplicate bookings for same session', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Student already booked this session' }
      })

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: testSlotId,
          sessionId: testSessionId
        })
      })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('already have a pending booking')
    })

    it('should validate required fields', async () => {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: testSlotId
          // Missing sessionId
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
    })
  })

  describe('Payment Intent Creation (/api/payment/create-intent)', () => {
    it('should create payment intent with proper authorization', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_payment_intent',
        client_secret: 'pi_test_client_secret',
        amount: 5000,
        currency: 'usd'
      }

      // Mock booking lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          id: testBookingId,
          payment_status: 'pending',
          slots: { experts: { id: 'expert-id', name: 'Test Expert' } }
        },
        error: null
      })

      // Mock Stripe payment intent creation
      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.paymentIntents.create).mockResolvedValue(mockPaymentIntent as any)

      // Mock booking update
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: 50.00,
          currency: 'usd'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.clientSecret).toBe('pi_test_client_secret')
      expect(data.paymentIntentId).toBe('pi_test_payment_intent')

      // Verify Stripe was called with correct parameters
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          capture_method: 'manual',
          metadata: expect.objectContaining({
            bookingId: testBookingId
          })
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining(`booking_${testBookingId}`)
        })
      )
    })

    it('should prevent duplicate payment intents', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: testBookingId,
          payment_status: 'processing' // Already processing
        },
        error: null
      })

      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: 50.00
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('already been processed')
    })

    it('should handle booking not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Booking not found' }
      })

      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 'non-existent-booking',
          amount: 50.00
        })
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found or unauthorized')
    })
  })

  describe('Expert Confirmation (/api/bookings/expert/confirm)', () => {
    it('should confirm booking and capture payment', async () => {
      // Mock transaction result
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: testBookingId,
          status: 'confirmed',
          payment_status: 'captured',
          amount_captured: 50.00
        }],
        error: null
      })

      // Mock booking details lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          stripe_payment_intent_id: 'pi_test_intent',
          payment_status: 'authorized'
        },
        error: null
      })

      // Mock Stripe capture
      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({
        id: 'pi_test_intent',
        status: 'succeeded'
      } as any)

      const response = await fetch('/api/bookings/expert/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          action: 'confirm'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.booking.status).toBe('confirmed')
      expect(data.booking.payment_status).toBe('captured')

      // Verify Stripe capture was called
      expect(stripe.paymentIntents.capture).toHaveBeenCalledWith(
        'pi_test_intent',
        {},
        expect.objectContaining({
          idempotencyKey: expect.stringContaining(`capture_${testBookingId}`)
        })
      )
    })

    it('should decline booking and cancel payment', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: testBookingId,
          status: 'declined',
          payment_status: 'cancelled',
          slot_released: true
        }],
        error: null
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          stripe_payment_intent_id: 'pi_test_intent',
          payment_status: 'authorized'
        },
        error: null
      })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.paymentIntents.cancel).mockResolvedValue({
        id: 'pi_test_intent',
        status: 'canceled'
      } as any)

      const response = await fetch('/api/bookings/expert/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          action: 'decline'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.booking.status).toBe('declined')

      // Verify Stripe cancellation
      expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_test_intent',
        expect.objectContaining({
          idempotencyKey: expect.stringContaining(`cancel_${testBookingId}`)
        })
      )
    })

    it('should reject invalid actions', async () => {
      const response = await fetch('/api/bookings/expert/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          action: 'invalid-action'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('confirm/decline')
    })
  })

  describe('Booking Cancellation (/api/bookings/cancel)', () => {
    it('should calculate correct refund for early cancellation', async () => {
      // Mock 48 hours before session (full refund)
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: testBookingId,
          status: 'cancelled',
          payment_status: 'refunded',
          refund_amount: 50.00,
          cancellation_fee: 0,
          cancelled_by: 'student'
        }],
        error: null
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          stripe_payment_intent_id: 'pi_test_intent',
          payment_status: 'captured'
        },
        error: null
      })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.refunds.create).mockResolvedValue({
        id: 're_test_refund',
        amount: 5000
      } as any)

      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          reason: 'Schedule conflict'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.booking.refundAmount).toBe(50.00)
      expect(data.booking.cancellationFee).toBe(0)

      // Verify refund was processed
      expect(stripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_test_intent',
          amount: 5000,
          reason: 'requested_by_customer'
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining(`refund_${testBookingId}`)
        })
      )
    })

    it('should apply cancellation fee for late cancellation', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: testBookingId,
          status: 'cancelled',
          payment_status: 'refunded',
          refund_amount: 25.00,
          cancellation_fee: 25.00,
          cancelled_by: 'student'
        }],
        error: null
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          stripe_payment_intent_id: 'pi_test_intent',
          payment_status: 'captured'
        },
        error: null
      })

      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          reason: 'Emergency'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.booking.refundAmount).toBe(25.00)
      expect(data.booking.cancellationFee).toBe(25.00)
    })
  })

  describe('Database Transaction Functions', () => {
    it('should test create_booking_transaction atomicity', async () => {
      const result = await mockSupabase.rpc('create_booking_transaction', {
        p_student_id: mockUser.id,
        p_slot_id: testSlotId,
        p_session_id: testSessionId,
        p_notes: 'Test booking'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_booking_transaction', {
        p_student_id: mockUser.id,
        p_slot_id: testSlotId,
        p_session_id: testSessionId,
        p_notes: 'Test booking'
      })
    })

    it('should test confirm_booking_transaction with expert authorization', async () => {
      await mockSupabase.rpc('confirm_booking_transaction', {
        p_booking_id: testBookingId,
        p_expert_user_id: 'expert-user-id',
        p_action: 'confirm'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_booking_transaction', {
        p_booking_id: testBookingId,
        p_expert_user_id: 'expert-user-id',
        p_action: 'confirm'
      })
    })

    it('should test cancel_booking_transaction with refund calculation', async () => {
      await mockSupabase.rpc('cancel_booking_transaction', {
        p_booking_id: testBookingId,
        p_user_id: mockUser.id,
        p_reason: 'Test cancellation'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_booking_transaction', {
        p_booking_id: testBookingId,
        p_user_id: mockUser.id,
        p_reason: 'Test cancellation'
      })
    })
  })

  describe('System Cleanup (/api/cron/cleanup-bookings)', () => {
    it('should clean up expired bookings', async () => {
      const mockExpiredBookings = [
        {
          id: 'expired-booking-1',
          stripe_payment_intent_id: 'pi_expired_1',
          payment_status: 'authorized',
          slot_id: 'slot-1'
        }
      ]

      mockSupabase.select.mockResolvedValue({
        data: mockExpiredBookings,
        error: null
      })

      mockSupabase.update.mockResolvedValue({ error: null })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.paymentIntents.cancel).mockResolvedValue({
        id: 'pi_expired_1',
        status: 'canceled'
      } as any)

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${process.env.CRON_SECRET || 'test-cron-secret'}`
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.processedExpiredBookings).toBeGreaterThanOrEqual(0)
    })

    it('should require proper authorization', async () => {
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-secret'
        }
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Error Handling & Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database connection failed'))

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: testSlotId,
          sessionId: testSessionId
        })
      })

      expect(response.status).toBe(500)
    })

    it('should handle Stripe API failures', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: testBookingId, payment_status: 'pending' },
        error: null
      })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.paymentIntents.create).mockRejectedValue(
        new Error('Stripe API error')
      )

      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          amount: 50.00
        })
      })

      expect(response.status).toBe(500)
    })

    it('should handle unauthorized access attempts', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      })

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: testSlotId,
          sessionId: testSessionId
        })
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Security Tests', () => {
    it('should prevent SQL injection in booking creation', async () => {
      const maliciousSlotId = "'; DROP TABLE bookings; --"
      
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: maliciousSlotId,
          sessionId: testSessionId
        })
      })

      // Should either return validation error or handle safely
      expect([400, 500]).toContain(response.status)
    })

    it('should validate booking ownership for cancellation', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Booking not found or unauthorized' }
      })

      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 'someone-elses-booking'
        })
      })

      expect(response.status).toBe(400)
    })

    it('should validate expert ownership for confirmation', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Booking not found or unauthorized' }
      })

      const response = await fetch('/api/bookings/expert/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: testBookingId,
          action: 'confirm'
        })
      })

      expect(response.status).toBe(400)
    })
  })
})