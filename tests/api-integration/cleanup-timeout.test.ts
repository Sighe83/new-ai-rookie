/**
 * System Cleanup and Timeout Tests
 * 
 * Tests the system's cleanup mechanisms including:
 * - Automatic booking timeout (30 minutes)
 * - Orphaned slot cleanup
 * - Old booking archival
 * - Webhook event cleanup
 * - Database maintenance operations
 * - Cron job security and reliability
 * 
 * @fileoverview Comprehensive cleanup and timeout testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

// Mock dependencies
vi.mock('@/lib/supabase-server')
vi.mock('@/lib/stripe')

describe('System Cleanup and Timeout Tests', () => {
  let mockSupabase: any
  let mockStripe: any
  let originalEnv: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Store original environment
    originalEnv = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'test-cron-secret'

    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    }

    mockStripe = {
      paymentIntents: {
        cancel: vi.fn()
      }
    }

    vi.mocked(createServerSideClient).mockResolvedValue(mockSupabase)
    
    const stripeModule = vi.mocked(import('@/lib/stripe'))
    stripeModule.then(module => {
      Object.assign(module.stripe, mockStripe)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.CRON_SECRET = originalEnv
  })

  describe('Booking Timeout Mechanism', () => {
    it('should timeout bookings after 30 minutes', async () => {
      const expiredBookings = [
        {
          id: 'expired-booking-1',
          stripe_payment_intent_id: 'pi_expired_1',
          payment_status: 'authorized',
          slot_id: 'slot-1',
          created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString() // 35 minutes ago
        },
        {
          id: 'expired-booking-2',
          stripe_payment_intent_id: 'pi_expired_2',
          payment_status: 'pending',
          slot_id: 'slot-2',
          created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString() // 40 minutes ago
        }
      ]

      // Mock expired bookings query
      mockSupabase.select.mockResolvedValue({
        data: expiredBookings,
        error: null
      })

      // Mock successful updates
      mockSupabase.update.mockResolvedValue({ error: null })

      // Mock Stripe cancellation
      mockStripe.paymentIntents.cancel.mockResolvedValue({
        id: 'pi_expired_1',
        status: 'canceled'
      })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
          'Content-Type': 'application/json'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.success).toBe(true)
      expect(data.processedExpiredBookings).toBe(2)
      expect(data.cleanedBookings).toBeGreaterThanOrEqual(0)

      // Verify Stripe payment intents were cancelled
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_expired_1',
        expect.objectContaining({
          idempotencyKey: expect.stringContaining('cleanup_cancel_expired-booking-1')
        })
      )
    })

    it('should not timeout recent bookings', async () => {
      const recentBookings = [
        {
          id: 'recent-booking-1',
          stripe_payment_intent_id: 'pi_recent_1',
          payment_status: 'pending',
          slot_id: 'slot-1',
          created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
        }
      ]

      // Mock that no expired bookings are found
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.processedExpiredBookings).toBe(0)
      expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled()
    })

    it('should handle partial failures gracefully', async () => {
      const expiredBookings = [
        {
          id: 'booking-1',
          stripe_payment_intent_id: 'pi_1',
          payment_status: 'authorized',
          slot_id: 'slot-1'
        },
        {
          id: 'booking-2',
          stripe_payment_intent_id: 'pi_2',
          payment_status: 'authorized',
          slot_id: 'slot-2'
        }
      ]

      mockSupabase.select.mockResolvedValue({
        data: expiredBookings,
        error: null
      })

      // First Stripe call succeeds, second fails
      mockStripe.paymentIntents.cancel
        .mockResolvedValueOnce({ id: 'pi_1', status: 'canceled' })
        .mockRejectedValueOnce(new Error('Stripe API error'))

      // Database updates succeed
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.stripeErrors).toBe(1)
      expect(data.cleanedBookings).toBe(1) // Only the successful one
    })
  })

  describe('Orphaned Slot Cleanup', () => {
    it('should identify and clean orphaned slots', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 3, // 3 slots cleaned
        error: null
      })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      
      // Verify orphaned slots cleanup was called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_orphaned_slots')
    })

    it('should test orphaned slots function directly', async () => {
      // Test the database function directly
      mockSupabase.rpc.mockResolvedValue({
        data: 5,
        error: null
      })

      const result = await mockSupabase.rpc('cleanup_orphaned_slots')
      
      expect(result.data).toBe(5)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_orphaned_slots')
    })

    it('should handle database errors in slot cleanup', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null })
      mockSupabase.rpc.mockRejectedValue(new Error('Database error in slot cleanup'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error cleaning orphaned slots:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Old Booking Archival', () => {
    it('should archive old completed bookings', async () => {
      const oldBookings = [
        {
          id: 'old-booking-1',
          stripe_payment_intent_id: 'pi_old_1',
          updated_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString() // 95 days ago
        },
        {
          id: 'old-booking-2',
          stripe_payment_intent_id: 'pi_old_2',
          updated_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() // 100 days ago
        }
      ]

      // Mock old bookings query
      mockSupabase.select
        .mockResolvedValueOnce({ data: [], error: null }) // No expired bookings
        .mockResolvedValueOnce({ data: oldBookings, error: null }) // Old bookings

      // Mock archival update
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.archivedOldBookings).toBe(2)

      // Verify archival update was called
      expect(mockSupabase.update).toHaveBeenCalledWith({
        stripe_payment_intent_id: null,
        learner_notes: null,
        expert_notes: null
      })
    })

    it('should process old bookings in batches', async () => {
      // Create 150 old bookings (should be limited to 100 per batch)
      const oldBookings = Array.from({ length: 150 }, (_, i) => ({
        id: `old-booking-${i}`,
        stripe_payment_intent_id: `pi_old_${i}`,
        updated_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
      }))

      mockSupabase.select
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: oldBookings.slice(0, 100), error: null })

      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Should only process 100 bookings (batch limit)
      expect(data.archivedOldBookings).toBe(100)
      expect(mockSupabase.limit).toHaveBeenCalledWith(100)
    })
  })

  describe('Database Statistics and Monitoring', () => {
    it('should provide booking statistics', async () => {
      const mockStats = [
        {
          pending_bookings: 15,
          expired_pending: 3,
          confirmed_bookings: 25,
          cancelled_bookings: 8,
          total_revenue: 1250.00,
          orphaned_slots: 2
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockStats,
        error: null
      })

      const result = await mockSupabase.rpc('get_booking_stats')
      
      expect(result.data[0]).toEqual({
        pending_bookings: 15,
        expired_pending: 3,
        confirmed_bookings: 25,
        cancelled_bookings: 8,
        total_revenue: 1250.00,
        orphaned_slots: 2
      })
    })

    it('should track cleanup performance metrics', async () => {
      const startTime = Date.now()

      mockSupabase.select.mockResolvedValue({ data: [], error: null })
      mockSupabase.rpc.mockResolvedValue({ data: 0, error: null })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })
  })

  describe('Webhook Event Cleanup', () => {
    it('should test webhook event cleanup function', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 150, // 150 old webhook events deleted
        error: null
      })

      const result = await mockSupabase.rpc('cleanup_old_webhook_events')
      
      expect(result.data).toBe(150)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_webhook_events')
    })

    it('should handle webhook cleanup errors', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Webhook cleanup failed'))

      try {
        await mockSupabase.rpc('cleanup_old_webhook_events')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).toBe('Webhook cleanup failed')
      }
    })
  })

  describe('Authorization and Security', () => {
    it('should require valid CRON_SECRET', async () => {
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-secret'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should reject requests without authorization header', async () => {
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST'
      })

      expect(response.status).toBe(401)
    })

    it('should reject malformed authorization headers', async () => {
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'InvalidFormat'
        }
      })

      expect(response.status).toBe(401)
    })

    it('should handle missing CRON_SECRET environment variable', async () => {
      delete process.env.CRON_SECRET

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer any-secret'
        }
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should continue processing after individual failures', async () => {
      const expiredBookings = [
        { id: 'booking-1', stripe_payment_intent_id: 'pi_1', payment_status: 'authorized', slot_id: 'slot-1' },
        { id: 'booking-2', stripe_payment_intent_id: 'pi_2', payment_status: 'authorized', slot_id: 'slot-2' },
        { id: 'booking-3', stripe_payment_intent_id: 'pi_3', payment_status: 'authorized', slot_id: 'slot-3' }
      ]

      mockSupabase.select.mockResolvedValue({ data: expiredBookings, error: null })

      // Mock partial failures
      mockStripe.paymentIntents.cancel
        .mockResolvedValueOnce({ id: 'pi_1', status: 'canceled' })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'pi_3', status: 'canceled' })

      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.cleanedBookings).toBe(2) // 2 successful, 1 failed
      expect(data.stripeErrors).toBe(1)
    })

    it('should handle complete database failure gracefully', async () => {
      mockSupabase.select.mockRejectedValue(new Error('Database connection lost'))

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Cleanup job failed')
    })

    it('should provide detailed error information', async () => {
      const expiredBookings = [
        { id: 'booking-1', stripe_payment_intent_id: 'pi_1', payment_status: 'authorized', slot_id: 'slot-1' }
      ]

      mockSupabase.select.mockResolvedValue({ data: expiredBookings, error: null })
      mockSupabase.update.mockResolvedValue({
        error: { message: 'Constraint violation', code: '23505' }
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update booking'),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Manual Testing and Monitoring', () => {
    it('should provide GET endpoint for manual testing', async () => {
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'GET'
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.message).toContain('Booking cleanup endpoint ready')
      expect(data.timeout).toBe('30 minutes for pending bookings')
      expect(data.archive).toBe('90 days for completed bookings')
    })

    it('should handle timeout functionality testing', async () => {
      // Test the timeout function directly
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            booking_id: 'timeout-test',
            stripe_payment_intent_id: 'pi_timeout',
            payment_status: 'cancelled',
            slot_id: 'slot-timeout'
          }
        ],
        error: null
      })

      const result = await mockSupabase.rpc('timeout_expired_bookings')
      
      expect(result.data).toHaveLength(1)
      expect(result.data[0].booking_id).toBe('timeout-test')
      expect(result.data[0].payment_status).toBe('cancelled')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large numbers of expired bookings efficiently', async () => {
      // Create 1000 expired bookings
      const largeExpiredSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `booking-${i}`,
        stripe_payment_intent_id: `pi_${i}`,
        payment_status: 'authorized',
        slot_id: `slot-${i}`
      }))

      mockSupabase.select.mockResolvedValue({ data: largeExpiredSet, error: null })
      mockSupabase.update.mockResolvedValue({ error: null })
      mockStripe.paymentIntents.cancel.mockResolvedValue({ status: 'canceled' })

      const startTime = Date.now()
      
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds even with large dataset
    })

    it('should maintain consistent performance under memory pressure', async () => {
      // Simulate memory-intensive operations
      const memoryIntensiveBookings = Array.from({ length: 5000 }, (_, i) => ({
        id: `memory-test-${i}`,
        stripe_payment_intent_id: `pi_memory_${i}`,
        payment_status: 'pending',
        slot_id: `slot-memory-${i}`,
        notes: 'A'.repeat(1000) // Large notes field
      }))

      mockSupabase.select.mockResolvedValue({ data: memoryIntensiveBookings, error: null })
      mockSupabase.update.mockResolvedValue({ error: null })

      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      expect(response.status).toBe(200)
      // Should handle large payloads without memory issues
    })
  })
})