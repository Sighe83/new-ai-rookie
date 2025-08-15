/**
 * Webhook Processing and Stripe Integration Tests
 * 
 * Tests the webhook processing system including:
 * - Stripe webhook signature verification
 * - Event idempotency handling
 * - Payment status updates
 * - Error handling and recovery
 * - Security validations
 * - Event ordering and state consistency
 * 
 * @fileoverview Comprehensive webhook and Stripe integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

// Mock dependencies
vi.mock('@/lib/supabase-server')
vi.mock('@/lib/stripe')

describe('Webhook Processing and Stripe Integration Tests', () => {
  let mockSupabase: any
  let mockStripe: any
  let testBookingId: string
  let testPaymentIntentId: string

  beforeEach(() => {
    vi.clearAllMocks()
    
    testBookingId = 'webhook-test-booking-' + Date.now()
    testPaymentIntentId = 'pi_webhook_test_' + Date.now()

    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis()
    }

    mockStripe = {
      webhooks: {
        constructEvent: vi.fn()
      },
      paymentIntents: {
        capture: vi.fn(),
        cancel: vi.fn()
      },
      refunds: {
        create: vi.fn()
      }
    }

    vi.mocked(createServerSideClient).mockResolvedValue(mockSupabase)
    
    const stripeModule = await import('@/lib/stripe')
    Object.assign(stripeModule.stripe, mockStripe)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Webhook Security and Validation', () => {
    it('should verify webhook signature correctly', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false) // Not processed before

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        expect.any(String),
        'valid_signature',
        expect.any(String)
      )
    })

    it('should reject webhooks with invalid signatures', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const mockEvent = createMockStripeEvent('payment_intent.succeeded')
      const response = await simulateWebhookRequest(mockEvent, 'invalid_signature')
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid signature')
    })

    it('should reject webhooks without signature header', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded')
      
      const response = await fetch('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEvent)
        // Missing stripe-signature header
      })
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Missing stripe-signature header')
    })
  })

  describe('Event Idempotency', () => {
    it('should prevent duplicate event processing', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      
      // First call: not processed
      mockSupabase.rpc.mockResolvedValueOnce(false)
      mockSupabase.update.mockResolvedValue({ error: null })
      
      // Second call: already processed
      mockSupabase.rpc.mockResolvedValueOnce(true)

      // Process same event twice
      const response1 = await simulateWebhookRequest(mockEvent, 'valid_signature')
      const response2 = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      
      const data2 = await response2.json()
      expect(data2.duplicate).toBe(true)
      
      // Database update should only be called once
      expect(mockSupabase.update).toHaveBeenCalledTimes(1)
    })

    it('should record webhook processing attempts', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc
        .mockResolvedValueOnce(false) // is_webhook_processed
        .mockResolvedValueOnce(undefined) // record_webhook_processing
      
      mockSupabase.update.mockResolvedValue({ error: null })

      await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_webhook_processing', {
        p_stripe_event_id: mockEvent.id,
        p_event_type: 'payment_intent.succeeded',
        p_booking_id: testBookingId,
        p_success: true,
        p_error_message: null
      })
    })
  })

  describe('Payment Intent Events', () => {
    it('should handle payment_intent.succeeded event', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false) // Not processed
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'authorized',
        updated_at: expect.any(String)
      })
    })

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.payment_failed', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'failed',
        updated_at: expect.any(String)
      })
    })

    it('should handle payment_intent.canceled event', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.canceled', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc
        .mockResolvedValueOnce(false) // is_webhook_processed
        .mockResolvedValueOnce(undefined) // cleanup_orphaned_slots
      
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'cancelled',
        updated_at: expect.any(String)
      })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_orphaned_slots')
    })

    it('should handle payment_intent.processing event', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.processing', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'processing',
        updated_at: expect.any(String)
      })
    })
  })

  describe('Charge Events', () => {
    it('should handle charge.succeeded event', async () => {
      const mockEvent = createMockStripeEvent('charge.succeeded', {
        payment_intent: testPaymentIntentId,
        amount: 5000
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      
      // Mock booking lookup
      mockSupabase.single.mockResolvedValue({
        data: {
          id: testBookingId,
          payment_status: 'authorized'
        },
        error: null
      })
      
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'captured',
        amount_captured: 50.00,
        updated_at: expect.any(String)
      })
    })

    it('should handle charge.refunded event', async () => {
      const mockEvent = createMockStripeEvent('charge.refunded', {
        payment_intent: testPaymentIntentId,
        amount_refunded: 2500
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      
      mockSupabase.single.mockResolvedValue({
        data: { id: testBookingId },
        error: null
      })
      
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'refunded',
        amount_refunded: 25.00,
        updated_at: expect.any(String)
      })
    })

    it('should handle charge.dispute.created event', async () => {
      const mockEvent = createMockStripeEvent('charge.dispute.created', {
        charge: 'ch_test_charge',
        reason: 'fraudulent'
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dispute created'),
        expect.any(String)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      
      // Simulate database error
      mockSupabase.update.mockResolvedValue({
        error: { message: 'Database connection failed' }
      })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(500)
      
      // Should still record the webhook processing attempt with error
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_webhook_processing', {
        p_stripe_event_id: mockEvent.id,
        p_event_type: 'payment_intent.succeeded',
        p_booking_id: testBookingId,
        p_success: false,
        p_error_message: expect.stringContaining('Failed to update booking status')
      })
    })

    it('should handle missing booking gracefully', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: 'non-existent-booking' }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      // Should still process successfully (booking might not exist for valid reasons)
      expect(response.status).toBe(200)
    })

    it('should handle events with missing metadata', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: {} // No bookingId
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)

      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      
      expect(response.status).toBe(200)
      // Should handle gracefully even without booking ID
    })
  })

  describe('Event Ordering and State Consistency', () => {
    it('should handle out-of-order webhook events', async () => {
      const bookingId = 'order-test-booking'
      
      // Receive charge.succeeded before payment_intent.succeeded
      const chargeEvent = createMockStripeEvent('charge.succeeded', {
        payment_intent: testPaymentIntentId,
        amount: 5000
      })

      const paymentIntentEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId }
      })

      mockStripe.webhooks.constructEvent
        .mockReturnValueOnce(chargeEvent)
        .mockReturnValueOnce(paymentIntentEvent)

      mockSupabase.rpc.mockResolvedValue(false)
      
      // For charge event - booking not found yet
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Booking not found' }
      })
      
      // For payment intent event - booking exists
      mockSupabase.update.mockResolvedValue({ error: null })

      // Process events in wrong order
      const response1 = await simulateWebhookRequest(chargeEvent, 'valid_signature')
      const response2 = await simulateWebhookRequest(paymentIntentEvent, 'valid_signature')
      
      // Both should be handled gracefully
      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })

    it('should maintain payment status consistency', async () => {
      const events = [
        createMockStripeEvent('payment_intent.processing', {
          id: testPaymentIntentId,
          metadata: { bookingId: testBookingId }
        }),
        createMockStripeEvent('payment_intent.succeeded', {
          id: testPaymentIntentId,
          metadata: { bookingId: testBookingId }
        }),
        createMockStripeEvent('charge.succeeded', {
          payment_intent: testPaymentIntentId,
          amount: 5000
        })
      ]

      mockStripe.webhooks.constructEvent
        .mockReturnValueOnce(events[0])
        .mockReturnValueOnce(events[1])
        .mockReturnValueOnce(events[2])

      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })
      
      // For charge event
      mockSupabase.single.mockResolvedValue({
        data: { id: testBookingId, payment_status: 'authorized' },
        error: null
      })

      // Process events in sequence
      for (const event of events) {
        const response = await simulateWebhookRequest(event, 'valid_signature')
        expect(response.status).toBe(200)
      }

      // Verify status transitions
      const updateCalls = mockSupabase.update.mock.calls
      expect(updateCalls[0][0]).toEqual({ payment_status: 'processing', updated_at: expect.any(String) })
      expect(updateCalls[1][0]).toEqual({ payment_status: 'authorized', updated_at: expect.any(String) })
      expect(updateCalls[2][0]).toEqual({ payment_status: 'captured', amount_captured: 50.00, updated_at: expect.any(String) })
    })
  })

  describe('Webhook Performance', () => {
    it('should process webhooks within acceptable time limits', async () => {
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
        id: testPaymentIntentId,
        metadata: { bookingId: testBookingId }
      })

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })

      const startTime = Date.now()
      const response = await simulateWebhookRequest(mockEvent, 'valid_signature')
      const endTime = Date.now()
      
      expect(response.status).toBe(200)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle high volume of webhooks', async () => {
      const webhookPromises = Array.from({ length: 50 }, (_, i) => {
        const event = createMockStripeEvent('payment_intent.succeeded', {
          id: `pi_test_${i}`,
          metadata: { bookingId: `booking_${i}` }
        })
        
        mockStripe.webhooks.constructEvent.mockReturnValue(event)
        return simulateWebhookRequest(event, 'valid_signature')
      })

      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })

      const startTime = Date.now()
      const results = await Promise.all(webhookPromises)
      const endTime = Date.now()
      
      // All should succeed
      results.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000)
    })
  })

  // Helper functions
  function createMockStripeEvent(type: string, data: any = {}): Stripe.Event {
    return {
      id: `evt_test_${Date.now()}`,
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      type,
      data: {
        object: data
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: null,
        idempotency_key: null
      }
    } as Stripe.Event
  }

  async function simulateWebhookRequest(event: Stripe.Event, signature: string) {
    return fetch('/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature
      },
      body: JSON.stringify(event)
    })
  }
})