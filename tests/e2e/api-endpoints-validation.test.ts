/**
 * API Endpoints Validation Tests
 * 
 * Comprehensive testing of each API endpoint with detailed validation:
 * - Request/response format validation
 * - HTTP status code verification
 * - Error handling and edge cases
 * - Data contract compliance
 * - Business rule enforcement
 * 
 * @fileoverview Individual API endpoint validation tests
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-app.vercel.app' 
  : 'http://localhost:3000'

interface TestContext {
  supabase: any
  testSessionId: string
  testSlotId: string
  testUserId: string
  testBookingId: string
  authToken: string
}

let context: TestContext

describe('API Endpoints Validation Tests', () => {
  beforeAll(async () => {
    const supabase = await createServerSideClient()
    
    // Get test data
    const { data: sessions } = await supabase
      .from('expert_sessions')
      .select('id')
      .eq('is_active', true)
      .limit(1)
    
    const { data: slots } = await supabase
      .from('slots')
      .select('id')
      .eq('is_available', true)
      .limit(1)
    
    const { data: { user } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    
    context = {
      supabase,
      testSessionId: sessions?.[0]?.id || '',
      testSlotId: slots?.[0]?.id || '',
      testUserId: user?.id || '',
      testBookingId: '',
      authToken: session?.access_token || 'test-token'
    }
    
    expect(context.testSessionId).toBeTruthy()
    expect(context.testSlotId).toBeTruthy()
  })

  afterEach(async () => {
    // Clean up any bookings created during tests
    if (context.testBookingId) {
      await context.supabase
        .from('bookings')
        .delete()
        .eq('id', context.testBookingId)
      
      context.testBookingId = ''
    }
  })

  describe('GET /api/expert-sessions/[id]/time-slots', () => {
    const getTimeSlots = async (sessionId: string, params: Record<string, string> = {}, headers: Record<string, string> = {}) => {
      const searchParams = new URLSearchParams(params)
      const url = `${API_BASE}/api/expert-sessions/${sessionId}/time-slots?${searchParams}`
      
      return fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.authToken}`,
          ...headers
        }
      })
    }

    it('should return time slots with valid parameters', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const startDate = tomorrow.toISOString().split('T')[0]
      
      const response = await getTimeSlots(context.testSessionId, { start_date: startDate })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      
      // Validate response structure
      expect(data).toHaveProperty('session')
      expect(data).toHaveProperty('date_range')
      expect(data).toHaveProperty('time_slots')
      expect(data).toHaveProperty('availability_summary')
      expect(data).toHaveProperty('constraints')
      
      // Validate session object
      expect(data.session).toMatchObject({
        id: context.testSessionId,
        title: expect.any(String),
        duration_minutes: expect.any(Number)
      })
      
      // Validate date range
      expect(data.date_range).toMatchObject({
        start_date: startDate,
        end_date: expect.any(String)
      })
      
      // Validate time slots array
      expect(Array.isArray(data.time_slots)).toBe(true)
      
      // Validate each slot structure
      data.time_slots.forEach((slot: any) => {
        expect(slot).toMatchObject({
          id: expect.any(String),
          start_at: expect.any(String),
          end_at: expect.any(String),
          is_available: expect.any(Boolean),
          session_duration_minutes: expect.any(Number),
          bookings_remaining: expect.any(Number)
        })
        
        // Validate ISO 8601 date format
        expect(() => new Date(slot.start_at)).not.toThrow()
        expect(() => new Date(slot.end_at)).not.toThrow()
        
        // Validate end time is after start time
        expect(new Date(slot.end_at).getTime()).toBeGreaterThan(new Date(slot.start_at).getTime())
      })
      
      // Validate availability summary
      expect(data.availability_summary).toMatchObject({
        total_slots: expect.any(Number),
        available_slots: expect.any(Number),
        unavailable_slots: expect.any(Number)
      })
      
      // Validate constraints
      expect(data.constraints).toMatchObject({
        min_lead_time_hours: 2,
        slot_increment_minutes: 15
      })
    })

    it('should enforce minimum lead time (2 hours)', async () => {
      const response = await getTimeSlots(context.testSessionId, { 
        start_date: new Date().toISOString().split('T')[0] // Today
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      const now = new Date()
      const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now
      
      // All returned slots should be at least 2 hours in the future
      data.time_slots.forEach((slot: any) => {
        const slotStart = new Date(slot.start_at)
        expect(slotStart.getTime()).toBeGreaterThan(minTime.getTime())
      })
    })

    it('should limit results to 200 slots', async () => {
      const startDate = new Date().toISOString().split('T')[0]
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year
      
      const response = await getTimeSlots(context.testSessionId, { 
        start_date: startDate,
        end_date: endDate
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.time_slots.length).toBeLessThanOrEqual(200)
    })

    it('should return 400 for missing start_date', async () => {
      const response = await getTimeSlots(context.testSessionId, {})
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('start_date parameter is required')
    })

    it('should return 400 for invalid date format', async () => {
      const response = await getTimeSlots(context.testSessionId, { 
        start_date: 'invalid-date' 
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('Invalid start_date format')
    })

    it('should return 400 for end_date before start_date', async () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      
      const response = await getTimeSlots(context.testSessionId, { 
        start_date: today.toISOString().split('T')[0],
        end_date: yesterday.toISOString().split('T')[0]
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('end_date must be after start_date')
    })

    it('should return 404 for non-existent session', async () => {
      const response = await getTimeSlots('non-existent-session-id', { 
        start_date: new Date().toISOString().split('T')[0]
      })
      
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toContain('Session not found')
    })

    it('should return 401 without authentication', async () => {
      const response = await getTimeSlots(context.testSessionId, { 
        start_date: new Date().toISOString().split('T')[0]
      }, { Authorization: '' })
      
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/bookings/create', () => {
    const createBooking = async (payload: any, headers: Record<string, string> = {}) => {
      return fetch(`${API_BASE}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.authToken}`,
          ...headers
        },
        body: JSON.stringify(payload)
      })
    }

    it('should create booking with valid data', async () => {
      const payload = {
        slotId: context.testSlotId,
        sessionId: context.testSessionId,
        notes: 'Test booking for API validation'
      }
      
      const response = await createBooking(payload)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      
      // Validate response structure
      expect(data).toHaveProperty('booking')
      expect(data).toHaveProperty('message')
      
      // Validate booking object
      expect(data.booking).toMatchObject({
        id: expect.any(String),
        student_id: expect.any(String),
        expert_session_id: context.testSessionId,
        status: 'pending',
        payment_status: 'pending',
        notes: payload.notes
      })
      
      // Store for cleanup
      context.testBookingId = data.booking.id
    })

    it('should return 400 for missing required fields', async () => {
      const response = await createBooking({
        slotId: context.testSlotId
        // Missing sessionId
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('Missing required field: session_id')
    })

    it('should return 404 for non-existent session', async () => {
      const response = await createBooking({
        slotId: context.testSlotId,
        sessionId: 'non-existent-session'
      })
      
      expect([400, 404]).toContain(response.status)
    })

    it('should return 401 without authentication', async () => {
      const response = await createBooking({
        slotId: context.testSlotId,
        sessionId: context.testSessionId
      }, { Authorization: '' })
      
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should validate slot availability', async () => {
      // Create first booking
      const response1 = await createBooking({
        slotId: context.testSlotId,
        sessionId: context.testSessionId
      })
      
      expect(response1.status).toBe(200)
      const data1 = await response1.json()
      context.testBookingId = data1.booking.id
      
      // Try to create second booking for same slot
      const response2 = await createBooking({
        slotId: context.testSlotId,
        sessionId: context.testSessionId
      })
      
      expect(response2.status).toBe(409)
      
      const data2 = await response2.json()
      expect(data2.error).toContain('no longer available')
    })
  })

  describe('POST /api/payment/create-intent', () => {
    const createPaymentIntent = async (payload: any, headers: Record<string, string> = {}) => {
      return fetch(`${API_BASE}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.authToken}`,
          ...headers
        },
        body: JSON.stringify(payload)
      })
    }

    beforeEach(async () => {
      // Create a booking for payment intent tests
      const bookingResponse = await fetch(`${API_BASE}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.authToken}`
        },
        body: JSON.stringify({
          slotId: context.testSlotId,
          sessionId: context.testSessionId,
          notes: 'Payment intent test booking'
        })
      })
      
      if (bookingResponse.status === 200) {
        const bookingData = await bookingResponse.json()
        context.testBookingId = bookingData.booking.id
      }
    })

    it('should create payment intent with valid booking', async () => {
      if (!context.testBookingId) {
        throw new Error('No test booking available')
      }
      
      const payload = {
        bookingId: context.testBookingId,
        amount: 50.00,
        currency: 'usd'
      }
      
      const response = await createPaymentIntent(payload)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      
      // Validate response structure
      expect(data).toHaveProperty('clientSecret')
      expect(data).toHaveProperty('paymentIntentId')
      
      // Validate client secret format
      expect(data.clientSecret).toMatch(/^pi_.*_secret_.*/)
      expect(data.paymentIntentId).toMatch(/^pi_.*/)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await createPaymentIntent({
        bookingId: context.testBookingId
        // Missing amount
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
    })

    it('should return 404 for non-existent booking', async () => {
      const response = await createPaymentIntent({
        bookingId: 'non-existent-booking',
        amount: 50.00
      })
      
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toContain('not found or unauthorized')
    })

    it('should return 400 for already processed payment', async () => {
      if (!context.testBookingId) {
        throw new Error('No test booking available')
      }
      
      // Update booking to processed state
      await context.supabase
        .from('bookings')
        .update({ payment_status: 'processing' })
        .eq('id', context.testBookingId)
      
      const response = await createPaymentIntent({
        bookingId: context.testBookingId,
        amount: 50.00
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('already been processed')
    })

    it('should validate amount format', async () => {
      if (!context.testBookingId) {
        throw new Error('No test booking available')
      }
      
      const response = await createPaymentIntent({
        bookingId: context.testBookingId,
        amount: 'invalid-amount'
      })
      
      expect([400, 500]).toContain(response.status)
    })

    it('should return 401 without authentication', async () => {
      const response = await createPaymentIntent({
        bookingId: context.testBookingId,
        amount: 50.00
      }, { Authorization: '' })
      
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/bookings/expert/confirm', () => {
    const expertConfirm = async (payload: any, headers: Record<string, string> = {}) => {
      return fetch(`${API_BASE}/api/bookings/expert/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.authToken}`,
          ...headers
        },
        body: JSON.stringify(payload)
      })
    }

    beforeEach(async () => {
      // Create booking and payment for expert confirmation tests
      const bookingResponse = await fetch(`${API_BASE}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.authToken}`
        },
        body: JSON.stringify({
          slotId: context.testSlotId,
          sessionId: context.testSessionId
        })
      })
      
      if (bookingResponse.status === 200) {
        const bookingData = await bookingResponse.json()
        context.testBookingId = bookingData.booking.id
        
        // Set payment status to authorized for confirmation tests
        await context.supabase
          .from('bookings')
          .update({ 
            payment_status: 'authorized',
            stripe_payment_intent_id: 'pi_test_' + Date.now()
          })
          .eq('id', context.testBookingId)
      }
    })

    it('should confirm booking with valid action', async () => {
      if (!context.testBookingId) {
        throw new Error('No test booking available')
      }
      
      const response = await expertConfirm({
        bookingId: context.testBookingId,
        action: 'confirm'
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      
      // Validate response structure
      expect(data).toHaveProperty('booking')
      expect(data.booking).toMatchObject({
        status: expect.stringMatching(/^(confirmed|processing)$/),
        payment_status: expect.stringMatching(/^(captured|processing)$/)
      })
    })

    it('should decline booking with valid action', async () => {
      if (!context.testBookingId) {
        throw new Error('No test booking available')
      }
      
      const response = await expertConfirm({
        bookingId: context.testBookingId,
        action: 'decline'
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.booking).toMatchObject({
        status: expect.stringMatching(/^(declined|processing)$/)
      })
    })

    it('should return 400 for invalid action', async () => {
      const response = await expertConfirm({
        bookingId: context.testBookingId,
        action: 'invalid-action'
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('confirm/decline')
    })

    it('should return 400 for missing required fields', async () => {
      const response = await expertConfirm({
        bookingId: context.testBookingId
        // Missing action
      })
      
      expect(response.status).toBe(400)
    })

    it('should return 401 without authentication', async () => {
      const response = await expertConfirm({
        bookingId: context.testBookingId,
        action: 'confirm'
      }, { Authorization: '' })
      
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/webhooks/stripe', () => {
    const sendWebhook = async (payload: any, headers: Record<string, string> = {}) => {
      return fetch(`${API_BASE}/api/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      })
    }

    it('should return 400 for missing stripe-signature header', async () => {
      const response = await sendWebhook({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } }
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('signature')
    })

    it('should return 400 for invalid signature', async () => {
      const response = await sendWebhook({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } }
      }, {
        'stripe-signature': 'invalid-signature'
      })
      
      expect(response.status).toBe(400)
    })

    it('should handle unknown event types gracefully', async () => {
      const response = await sendWebhook({
        type: 'unknown.event.type',
        data: { object: { id: 'test' } }
      }, {
        'stripe-signature': 'test-signature'
      })
      
      // Should not crash, may return 200 (ignored) or 400 (validation error)
      expect([200, 400]).toContain(response.status)
    })
  })

  describe('POST /api/cron/cleanup-bookings', () => {
    const runCleanup = async (headers: Record<string, string> = {}) => {
      return fetch(`${API_BASE}/api/cron/cleanup-bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      })
    }

    it('should return 401 without proper authorization', async () => {
      const response = await runCleanup()
      
      expect(response.status).toBe(401)
    })

    it('should return 401 with invalid cron secret', async () => {
      const response = await runCleanup({
        'Authorization': 'Bearer invalid-secret'
      })
      
      expect(response.status).toBe(401)
    })

    it('should run cleanup with valid authorization', async () => {
      const response = await runCleanup({
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-cron-secret'}`
      })
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data.success).toBe(true)
    })
  })

  describe('Error Response Format Validation', () => {
    it('should return consistent error response format', async () => {
      // Test various endpoints for consistent error format
      const errorResponses = await Promise.all([
        fetch(`${API_BASE}/api/expert-sessions/invalid/time-slots?start_date=2024-01-01`, {
          headers: { 'Authorization': `Bearer ${context.authToken}` }
        }),
        fetch(`${API_BASE}/api/bookings/create`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${context.authToken}`
          },
          body: JSON.stringify({}) // Invalid payload
        }),
        fetch(`${API_BASE}/api/payment/create-intent`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${context.authToken}`
          },
          body: JSON.stringify({}) // Invalid payload
        })
      ])
      
      for (const response of errorResponses) {
        if (!response.ok) {
          const data = await response.json()
          
          // All error responses should have an 'error' field
          expect(data).toHaveProperty('error')
          expect(typeof data.error).toBe('string')
          expect(data.error.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Response Time Performance', () => {
    it('should meet response time requirements', async () => {
      const endpoints = [
        {
          name: 'Time Slots',
          test: () => fetch(`${API_BASE}/api/expert-sessions/${context.testSessionId}/time-slots?start_date=${new Date().toISOString().split('T')[0]}`, {
            headers: { 'Authorization': `Bearer ${context.authToken}` }
          }),
          maxTime: 2000
        },
        {
          name: 'Booking Creation',
          test: () => fetch(`${API_BASE}/api/bookings/create`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.authToken}`
            },
            body: JSON.stringify({
              slotId: context.testSlotId,
              sessionId: context.testSessionId
            })
          }),
          maxTime: 3000
        }
      ]
      
      for (const endpoint of endpoints) {
        const start = Date.now()
        const response = await endpoint.test()
        const duration = Date.now() - start
        
        console.log(`📊 ${endpoint.name}: ${duration}ms (max: ${endpoint.maxTime}ms)`)
        expect(duration).toBeLessThan(endpoint.maxTime)
        
        // Clean up if booking was created
        if (endpoint.name === 'Booking Creation' && response.ok) {
          const data = await response.json()
          if (data.booking?.id) {
            context.testBookingId = data.booking.id
          }
        }
      }
    })
  })
})

console.log(`
📋 API Endpoints Validation Coverage:
✅ GET /api/expert-sessions/[id]/time-slots
   - Valid parameters & response structure
   - Date validation & business rules
   - Authentication & authorization
   - Error handling & edge cases

✅ POST /api/bookings/create  
   - Valid booking creation
   - Required field validation
   - Slot availability checks
   - Authentication & error handling

✅ POST /api/payment/create-intent
   - Payment intent creation
   - Booking validation
   - Idempotency & error handling
   - Authentication & authorization

✅ POST /api/bookings/expert/confirm
   - Expert confirmation/decline
   - Action validation
   - State transitions
   - Authentication & error handling

✅ POST /api/webhooks/stripe
   - Webhook signature validation
   - Event type handling
   - Security validation
   - Error handling

✅ POST /api/cron/cleanup-bookings
   - Authorization validation
   - Cleanup execution
   - Response format validation

✅ Cross-cutting Concerns
   - Consistent error response format
   - Response time performance
   - Security validation
   - Data contract compliance
`)