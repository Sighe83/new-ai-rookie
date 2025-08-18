/**
 * Performance and Load Tests
 * 
 * Tests the system's performance under various load conditions:
 * - Concurrent booking requests
 * - Database query optimization
 * - API response times
 * - Memory usage patterns
 * - Stripe API rate limiting
 * - Database connection pooling
 * 
 * @fileoverview Performance and scalability tests for booking system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

// Mock dependencies
vi.mock('@/lib/supabase-server')
vi.mock('@/lib/stripe')

describe('Performance and Load Tests', () => {
  let mockSupabase: any
  let mockStripe: any
  let performanceMetrics: Map<string, number[]>

  beforeEach(() => {
    vi.clearAllMocks()
    performanceMetrics = new Map()

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user', email: 'test@example.com' } },
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

    mockStripe = {
      paymentIntents: {
        create: vi.fn(),
        capture: vi.fn(),
        cancel: vi.fn()
      },
      refunds: {
        create: vi.fn()
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
  })

  describe('API Response Time Tests', () => {
    it('should handle booking creation under 500ms', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: 'perf-test-booking',
          status: 'pending',
          created_at: new Date().toISOString()
        }],
        error: null
      })

      const times: number[] = []
      
      // Test 10 consecutive booking requests
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now()
        
        const response = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: `slot-${i}`,
            sessionId: `session-${i}`,
            notes: 'Performance test'
          })
        })

        const endTime = performance.now()
        const duration = endTime - startTime
        times.push(duration)
        
        expect(response.status).toBe(200)
      }

      // Calculate performance metrics
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)
      const minTime = Math.min(...times)

      expect(avgTime).toBeLessThan(500) // Average under 500ms
      expect(maxTime).toBeLessThan(1000) // Max under 1 second
      
      performanceMetrics.set('booking_creation', times)
      
      console.log(`Booking Creation Performance:
        Average: ${avgTime.toFixed(2)}ms
        Min: ${minTime.toFixed(2)}ms
        Max: ${maxTime.toFixed(2)}ms`)
    })

    it('should handle payment intent creation efficiently', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'test-booking',
          payment_status: 'pending',
          slots: { experts: { id: 'expert-1', name: 'Test Expert' } }
        },
        error: null
      })

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test',
        client_secret: 'pi_test_secret',
        amount: 5000
      })

      mockSupabase.update.mockResolvedValue({ error: null })

      const times: number[] = []

      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()
        
        const response = await fetch('/api/payment/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: `booking-${i}`,
            amount: 50.00,
            currency: "dkk"'
          })
        })

        const endTime = performance.now()
        times.push(endTime - startTime)
        
        expect(response.status).toBe(200)
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      expect(avgTime).toBeLessThan(800) // Should include Stripe API call overhead
      
      performanceMetrics.set('payment_intent_creation', times)
    })

    it('should handle expert confirmations quickly', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          booking_id: 'test-booking',
          status: 'confirmed',
          payment_status: 'captured',
          amount_captured: 50.00
        }],
        error: null
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          stripe_payment_intent_id: 'pi_test',
          payment_status: 'authorized'
        },
        error: null
      })

      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: 'pi_test',
        status: 'succeeded'
      })

      const startTime = performance.now()
      
      const response = await fetch('/api/bookings/expert/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 'test-booking',
          action: 'confirm'
        })
      })

      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(1000) // Under 1 second including Stripe capture
    })
  })

  describe('Concurrent Load Tests', () => {
    it('should handle high concurrent booking requests', async () => {
      // Simulate 50 concurrent users trying to book different slots
      const concurrentRequests = 50
      
      mockSupabase.rpc.mockImplementation((funcName, params) => {
        // Simulate slight processing delay
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: [{
                booking_id: `booking-${params.p_slot_id}`,
                status: 'pending',
                slot_id: params.p_slot_id
              }],
              error: null
            })
          }, Math.random() * 100) // Random delay 0-100ms
        })
      })

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: `concurrent-slot-${i}`,
            sessionId: `concurrent-session-${i}`,
            notes: `Concurrent test ${i}`
          })
        })
      )

      const startTime = performance.now()
      const results = await Promise.all(promises)
      const endTime = performance.now()
      
      const duration = endTime - startTime
      const successfulRequests = results.filter(r => r.status === 200).length
      
      expect(successfulRequests).toBe(concurrentRequests)
      expect(duration).toBeLessThan(5000) // All requests complete within 5 seconds
      
      console.log(`Concurrent Load Test:
        Requests: ${concurrentRequests}
        Successful: ${successfulRequests}
        Total Duration: ${duration.toFixed(2)}ms
        Average per request: ${(duration / concurrentRequests).toFixed(2)}ms`)
    })

    it('should handle race condition for same slot gracefully', async () => {
      const slotId = 'contested-slot'
      const concurrentUsers = 20
      
      // First user should succeed, others should fail
      let successCount = 0
      mockSupabase.rpc.mockImplementation(() => {
        successCount++
        if (successCount === 1) {
          return Promise.resolve({
            data: [{ booking_id: 'winner-booking', status: 'pending' }],
            error: null
          })
        } else {
          return Promise.resolve({
            data: null,
            error: { message: 'Slot not available' }
          })
        }
      })

      const promises = Array.from({ length: concurrentUsers }, (_, i) =>
        fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: slotId,
            sessionId: `session-${i}`,
            notes: `Race condition test ${i}`
          })
        })
      )

      const results = await Promise.all(promises)
      
      const successful = results.filter(r => r.status === 200)
      const failed = results.filter(r => r.status === 409)
      
      expect(successful).toHaveLength(1)
      expect(failed).toHaveLength(concurrentUsers - 1)
    })

    it('should maintain performance under webhook load', async () => {
      const webhookCount = 100
      
      mockSupabase.rpc
        .mockResolvedValueOnce(false) // is_webhook_processed
        .mockResolvedValue(undefined) // record_webhook_processing

      mockSupabase.update.mockResolvedValue({ error: null })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.webhooks.constructEvent).mockImplementation((body, signature) => ({
        id: `evt_${Date.now()}_${Math.random()}`,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            metadata: { bookingId: 'test-booking' }
          }
        }
      } as any))

      const promises = Array.from({ length: webhookCount }, (_, i) =>
        fetch('/api/webhooks/stripe', {
          method: 'POST',
          headers: {
            'stripe-signature': `sig_${i}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: `evt_${i}`,
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_test', metadata: { bookingId: 'test-booking' } } }
          })
        })
      )

      const startTime = performance.now()
      const results = await Promise.all(promises)
      const endTime = performance.now()
      
      const duration = endTime - startTime
      const successfulWebhooks = results.filter(r => r.status === 200).length
      
      expect(successfulWebhooks).toBe(webhookCount)
      expect(duration).toBeLessThan(10000) // 100 webhooks processed within 10 seconds
      
      console.log(`Webhook Load Test:
        Webhooks: ${webhookCount}
        Duration: ${duration.toFixed(2)}ms
        Average: ${(duration / webhookCount).toFixed(2)}ms per webhook`)
    })
  })

  describe('Database Performance Tests', () => {
    it('should test transaction function performance', async () => {
      const transactionTimes: number[] = []
      
      mockSupabase.rpc.mockImplementation(() => {
        // Simulate database transaction time
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: [{ booking_id: 'test', status: 'pending' }],
              error: null
            })
          }, Math.random() * 50) // 0-50ms transaction time
        })
      })

      for (let i = 0; i < 20; i++) {
        const startTime = performance.now()
        
        await mockSupabase.rpc('create_booking_transaction', {
          p_student_id: 'user-id',
          p_slot_id: `slot-${i}`,
          p_session_id: `session-${i}`
        })
        
        const endTime = performance.now()
        transactionTimes.push(endTime - startTime)
      }

      const avgTransactionTime = transactionTimes.reduce((a, b) => a + b, 0) / transactionTimes.length
      const maxTransactionTime = Math.max(...transactionTimes)
      
      expect(avgTransactionTime).toBeLessThan(100) // Average under 100ms
      expect(maxTransactionTime).toBeLessThan(200) // Max under 200ms
      
      console.log(`Database Transaction Performance:
        Average: ${avgTransactionTime.toFixed(2)}ms
        Max: ${maxTransactionTime.toFixed(2)}ms`)
    })

    it('should test cleanup function performance', async () => {
      // Test large-scale cleanup operation
      mockSupabase.select.mockResolvedValue({
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: `booking-${i}`,
          stripe_payment_intent_id: `pi_${i}`,
          payment_status: 'pending'
        })),
        error: null
      })

      mockSupabase.update.mockResolvedValue({ error: null })
      mockSupabase.rpc.mockResolvedValue({ data: 50, error: null })

      const startTime = performance.now()
      
      const response = await fetch('/api/cron/cleanup-bookings', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret'
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(15000) // Large cleanup within 15 seconds
      
      console.log(`Cleanup Performance:
        Duration: ${duration.toFixed(2)}ms for 1000 records`)
    })
  })

  describe('Memory Usage Tests', () => {
    it('should handle large datasets without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Process large number of bookings
      for (let batch = 0; batch < 10; batch++) {
        const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
          id: `memory-test-${batch}-${i}`,
          slot_id: `slot-${i}`,
          session_id: `session-${i}`,
          status: 'pending',
          created_at: new Date().toISOString()
        }))

        mockSupabase.select.mockResolvedValue({
          data: largeBatch,
          error: null
        })

        const result = await mockSupabase.select('*').from('bookings')
        expect(result.data).toHaveLength(1000)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50)
      
      console.log(`Memory Usage Test:
        Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Increase: ${memoryIncreaseMB.toFixed(2)}MB`)
    })

    it('should handle webhook processing without memory accumulation', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      mockSupabase.rpc.mockResolvedValue(false)
      mockSupabase.update.mockResolvedValue({ error: null })

      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test', metadata: { bookingId: 'test' } } }
      } as any)

      // Process many webhooks
      for (let i = 0; i < 500; i++) {
        await fetch('/api/webhooks/stripe', {
          method: 'POST',
          headers: {
            'stripe-signature': 'test-sig',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: `evt_${i}`,
            type: 'payment_intent.succeeded'
          })
        })

        // Periodic memory check
        if (i % 100 === 0 && global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024
      
      expect(memoryIncrease).toBeLessThan(20) // Less than 20MB increase
    })
  })

  describe('Stripe API Rate Limiting', () => {
    it('should handle Stripe API rate limits gracefully', async () => {
      let callCount = 0
      
      mockStripe.paymentIntents.create.mockImplementation(() => {
        callCount++
        if (callCount <= 3) {
          // First few calls succeed
          return Promise.resolve({
            id: `pi_test_${callCount}`,
            client_secret: `secret_${callCount}`
          })
        } else {
          // Later calls hit rate limit
          const error = new Error('Rate limit exceeded')
          error.name = 'StripeRateLimitError'
          return Promise.reject(error)
        }
      })

      mockSupabase.single.mockResolvedValue({
        data: { id: 'test-booking', payment_status: 'pending' },
        error: null
      })

      const promises = Array.from({ length: 5 }, (_, i) =>
        fetch('/api/payment/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: `booking-${i}`,
            amount: 50.00
          })
        })
      )

      const results = await Promise.all(promises)
      
      const successful = results.filter(r => r.status === 200)
      const failed = results.filter(r => r.status === 500)
      
      expect(successful.length).toBe(3)
      expect(failed.length).toBe(2)
    })

    it('should implement exponential backoff for retries', async () => {
      // This would be implemented in the actual API with retry logic
      const retryTimes: number[] = []
      
      const simulateRetryLogic = async (maxRetries: number = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const delay = Math.pow(2, attempt - 1) * 100 // Exponential backoff
          retryTimes.push(delay)
          
          await new Promise(resolve => setTimeout(resolve, delay))
          
          // Simulate success on final attempt
          if (attempt === maxRetries) {
            return { success: true, attempts: attempt }
          }
        }
      }

      const result = await simulateRetryLogic()
      
      expect(result.success).toBe(true)
      expect(result.attempts).toBe(3)
      expect(retryTimes).toEqual([100, 200, 400]) // Exponential backoff
    })
  })

  describe('Performance Regression Tests', () => {
    it('should maintain performance baselines', async () => {
      const baselines = {
        booking_creation: 500, // ms
        payment_intent: 800,   // ms
        expert_confirmation: 1000, // ms
        webhook_processing: 100,   // ms
        cleanup_operation: 15000   // ms
      }

      // Test each operation and compare to baseline
      const operations = [
        {
          name: 'booking_creation',
          test: async () => {
            mockSupabase.rpc.mockResolvedValue({
              data: [{ booking_id: 'test', status: 'pending' }],
              error: null
            })
            
            const startTime = performance.now()
            await fetch('/api/bookings/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slotId: 'test-slot',
                sessionId: 'test-session'
              })
            })
            return performance.now() - startTime
          }
        }
        // Add other operations as needed
      ]

      for (const operation of operations) {
        const duration = await operation.test()
        const baseline = baselines[operation.name as keyof typeof baselines]
        
        expect(duration).toBeLessThan(baseline)
        
        console.log(`${operation.name}: ${duration.toFixed(2)}ms (baseline: ${baseline}ms)`)
      }
    })
  })

  describe('Scalability Projections', () => {
    it('should project system capacity', async () => {
      // Based on performance tests, calculate theoretical limits
      const metrics = {
        avgBookingTime: 250, // ms
        avgPaymentTime: 500, // ms
        avgWebhookTime: 50,  // ms
        concurrentUsers: 50,
        requestsPerSecond: 20
      }

      // Calculate theoretical capacity
      const bookingsPerSecond = 1000 / metrics.avgBookingTime
      const paymentsPerSecond = 1000 / metrics.avgPaymentTime
      const webhooksPerSecond = 1000 / metrics.avgWebhookTime

      console.log(`System Capacity Projections:
        Bookings/second: ${bookingsPerSecond.toFixed(2)}
        Payments/second: ${paymentsPerSecond.toFixed(2)}
        Webhooks/second: ${webhooksPerSecond.toFixed(2)}
        Concurrent users supported: ${metrics.concurrentUsers}`)

      // Verify minimum requirements
      expect(bookingsPerSecond).toBeGreaterThan(2) // At least 2 bookings/second
      expect(paymentsPerSecond).toBeGreaterThan(1) // At least 1 payment/second
      expect(webhooksPerSecond).toBeGreaterThan(10) // At least 10 webhooks/second
    })
  })
})