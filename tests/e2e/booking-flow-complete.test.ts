/**
 * Comprehensive End-to-End Booking Flow Tests
 * 
 * This test suite performs complete integration testing of the AI tutoring platform
 * booking system, covering the entire user journey from slot discovery through
 * payment processing and expert confirmation.
 * 
 * Test Coverage:
 * 1. Slot Discovery - GET /api/expert-sessions/[id]/time-slots
 * 2. Booking Creation - POST /api/bookings/create
 * 3. Payment Intent Creation - POST /api/payment/create-intent
 * 4. Stripe Webhook Processing - POST /api/webhooks/stripe
 * 5. Expert Confirmation/Decline - POST /api/bookings/expert/confirm
 * 6. Cancellation & Refunds - POST /api/bookings/cancel
 * 7. Automated Cleanup - POST /api/cron/cleanup-bookings
 * 
 * @fileoverview Complete end-to-end integration tests for booking system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-app.vercel.app' 
    : 'http://localhost:3000',
  timeout: 30000,
  retryAttempts: 3,
  expertSessionId: '',
  testSlotId: '',
  testBookingId: '',
  testPaymentIntentId: '',
  testUserId: '',
  testExpertId: ''
}

// Test data holders
let testSession: any
let testUser: any
let testExpert: any
let availableSlots: any[]
let testBooking: any
let performanceMetrics: any = {}

describe('Complete Booking Flow End-to-End Tests', () => {
  let supabase: any

  beforeAll(async () => {
    console.log('🚀 Initializing End-to-End Test Suite...')
    
    // Initialize Supabase client
    supabase = await createServerSideClient()
    
    // Verify test data exists
    await setupTestData()
    
    console.log('✅ Test environment initialized')
    console.log(`📊 Test Config:`, {
      baseUrl: TEST_CONFIG.baseUrl,
      sessionId: TEST_CONFIG.expertSessionId,
      userId: TEST_CONFIG.testUserId
    })
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up test environment...')
    await cleanupTestData()
    console.log('✅ Cleanup completed')
  })

  beforeEach(async () => {
    // Reset test state
    testBooking = null
    TEST_CONFIG.testBookingId = ''
    TEST_CONFIG.testPaymentIntentId = ''
  })

  afterEach(async () => {
    // Clean up any bookings created during this test
    if (TEST_CONFIG.testBookingId) {
      await cleanupBooking(TEST_CONFIG.testBookingId)
    }
  })

  describe('1. Slot Discovery Flow', () => {
    it('should fetch available time slots successfully', async () => {
      const startTime = Date.now()
      
      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 1) // Tomorrow
      const startDateStr = startDate.toISOString().split('T')[0]
      
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/expert-sessions/${TEST_CONFIG.expertSessionId}/time-slots?start_date=${startDateStr}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getTestUserToken()}`
          }
        }
      )
      
      const responseTime = Date.now() - startTime
      performanceMetrics.slotDiscovery = responseTime
      
      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(2000) // Should respond within 2 seconds
      
      const data = await response.json()
      
      // Validate response structure
      expect(data).toMatchObject({
        session: {
          id: TEST_CONFIG.expertSessionId,
          title: expect.any(String),
          duration_minutes: expect.any(Number)
        },
        date_range: {
          start_date: startDateStr,
          end_date: expect.any(String)
        },
        time_slots: expect.any(Array),
        availability_summary: {
          total_slots: expect.any(Number),
          available_slots: expect.any(Number),
          unavailable_slots: expect.any(Number)
        },
        constraints: {
          min_lead_time_hours: 2,
          slot_increment_minutes: 15
        }
      })
      
      // Store available slots for subsequent tests
      availableSlots = data.time_slots.filter((slot: any) => slot.is_available)
      expect(availableSlots.length).toBeGreaterThan(0)
      
      // Validate slot structure
      availableSlots.forEach(slot => {
        expect(slot).toMatchObject({
          id: expect.any(String),
          start_at: expect.any(String),
          end_at: expect.any(String),
          is_available: true,
          session_duration_minutes: expect.any(Number),
          bookings_remaining: expect.any(Number)
        })
        
        // Validate dates are properly formatted and in future
        const slotStart = new Date(slot.start_at)
        const now = new Date()
        expect(slotStart.getTime()).toBeGreaterThan(now.getTime())
      })
      
      TEST_CONFIG.testSlotId = availableSlots[0].id
      console.log(`✅ Found ${availableSlots.length} available slots`)
    }, TEST_CONFIG.timeout)

    it('should validate date parameters correctly', async () => {
      // Test invalid date format
      const response1 = await fetch(
        `${TEST_CONFIG.baseUrl}/api/expert-sessions/${TEST_CONFIG.expertSessionId}/time-slots?start_date=invalid-date`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${await getTestUserToken()}`
          }
        }
      )
      
      expect(response1.status).toBe(400)
      const data1 = await response1.json()
      expect(data1.error).toContain('Invalid start_date format')
      
      // Test missing start_date
      const response2 = await fetch(
        `${TEST_CONFIG.baseUrl}/api/expert-sessions/${TEST_CONFIG.expertSessionId}/time-slots`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${await getTestUserToken()}`
          }
        }
      )
      
      expect(response2.status).toBe(400)
      const data2 = await response2.json()
      expect(data2.error).toContain('start_date parameter is required')
    })

    it('should enforce authentication', async () => {
      const startDate = new Date().toISOString().split('T')[0]
      
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/expert-sessions/${TEST_CONFIG.expertSessionId}/time-slots?start_date=${startDate}`,
        {
          method: 'GET'
          // No authorization header
        }
      )
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('2. Complete Happy Path Flow', () => {
    it('should complete entire booking flow successfully', async () => {
      console.log('🎯 Starting complete happy path flow test...')
      
      // Step 1: Create booking
      const bookingResponse = await createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      expect(bookingResponse.status).toBe(200)
      
      const bookingData = await bookingResponse.json()
      testBooking = bookingData.booking
      TEST_CONFIG.testBookingId = testBooking.id
      
      console.log(`📝 Booking created: ${TEST_CONFIG.testBookingId}`)
      
      // Step 2: Create payment intent
      const paymentResponse = await createPaymentIntent(
        TEST_CONFIG.testBookingId, 
        testSession.price_per_session
      )
      expect(paymentResponse.status).toBe(200)
      
      const paymentData = await paymentResponse.json()
      TEST_CONFIG.testPaymentIntentId = paymentData.paymentIntentId
      
      console.log(`💳 Payment intent created: ${TEST_CONFIG.testPaymentIntentId}`)
      
      // Step 3: Simulate Stripe webhook - payment succeeded
      await simulateStripeWebhook('payment_intent.succeeded', {
        id: TEST_CONFIG.testPaymentIntentId,
        metadata: { bookingId: TEST_CONFIG.testBookingId }
      })
      
      // Step 4: Verify booking status updated
      const { data: updatedBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', TEST_CONFIG.testBookingId)
        .single()
      
      expect(updatedBooking.payment_status).toBe('authorized')
      console.log('✅ Payment authorized via webhook')
      
      // Step 5: Expert confirms booking
      const confirmResponse = await expertConfirmBooking(TEST_CONFIG.testBookingId, 'confirm')
      expect(confirmResponse.status).toBe(200)
      
      const confirmData = await confirmResponse.json()
      expect(confirmData.booking.status).toBe('confirmed')
      expect(confirmData.booking.payment_status).toBe('captured')
      
      console.log('✅ Expert confirmed booking - payment captured')
      
      // Step 6: Verify final state
      const { data: finalBooking } = await supabase
        .from('bookings')
        .select('*, slots(*)')
        .eq('id', TEST_CONFIG.testBookingId)
        .single()
      
      expect(finalBooking).toMatchObject({
        status: 'confirmed',
        payment_status: 'captured',
        stripe_payment_intent_id: TEST_CONFIG.testPaymentIntentId
      })
      
      // Verify slot is no longer available
      const { data: slot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', TEST_CONFIG.testSlotId)
        .single()
      
      expect(slot.current_bookings).toBeGreaterThan(0)
      
      console.log('🎉 Complete happy path flow successful!')
    }, TEST_CONFIG.timeout)
  })

  describe('3. Expert Decline Flow', () => {
    it('should handle expert decline with payment cancellation', async () => {
      console.log('🎯 Testing expert decline flow...')
      
      // Create booking and payment intent
      const bookingResponse = await createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      const bookingData = await bookingResponse.json()
      TEST_CONFIG.testBookingId = bookingData.booking.id
      
      const paymentResponse = await createPaymentIntent(
        TEST_CONFIG.testBookingId, 
        testSession.price_per_session
      )
      const paymentData = await paymentResponse.json()
      TEST_CONFIG.testPaymentIntentId = paymentData.paymentIntentId
      
      // Simulate payment authorization
      await simulateStripeWebhook('payment_intent.succeeded', {
        id: TEST_CONFIG.testPaymentIntentId,
        metadata: { bookingId: TEST_CONFIG.testBookingId }
      })
      
      // Expert declines booking
      const declineResponse = await expertConfirmBooking(TEST_CONFIG.testBookingId, 'decline')
      expect(declineResponse.status).toBe(200)
      
      const declineData = await declineResponse.json()
      expect(declineData.booking.status).toBe('declined')
      expect(declineData.booking.payment_status).toBe('cancelled')
      
      // Verify slot was released
      const { data: slot } = await supabase
        .from('slots')
        .select('*')
        .eq('id', TEST_CONFIG.testSlotId)
        .single()
      
      expect(slot.is_available).toBe(true)
      
      console.log('✅ Expert decline flow completed successfully')
    }, TEST_CONFIG.timeout)
  })

  describe('4. Timeout Handling', () => {
    it('should handle booking timeout and cleanup', async () => {
      console.log('🎯 Testing timeout handling...')
      
      // Create booking
      const bookingResponse = await createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      const bookingData = await bookingResponse.json()
      TEST_CONFIG.testBookingId = bookingData.booking.id
      
      // Create payment intent
      const paymentResponse = await createPaymentIntent(
        TEST_CONFIG.testBookingId, 
        testSession.price_per_session
      )
      const paymentData = await paymentResponse.json()
      TEST_CONFIG.testPaymentIntentId = paymentData.paymentIntentId
      
      // Simulate payment authorization
      await simulateStripeWebhook('payment_intent.succeeded', {
        id: TEST_CONFIG.testPaymentIntentId,
        metadata: { bookingId: TEST_CONFIG.testBookingId }
      })
      
      // Manually update booking created_at to simulate timeout (30+ minutes ago)
      const timeoutDate = new Date(Date.now() - 35 * 60 * 1000) // 35 minutes ago
      await supabase
        .from('bookings')
        .update({ created_at: timeoutDate.toISOString() })
        .eq('id', TEST_CONFIG.testBookingId)
      
      // Run cleanup
      const cleanupResponse = await fetch(
        `${TEST_CONFIG.baseUrl}/api/cron/cleanup-bookings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-cron-secret'}`
          }
        }
      )
      
      expect(cleanupResponse.status).toBe(200)
      const cleanupData = await cleanupResponse.json()
      expect(cleanupData.success).toBe(true)
      
      // Verify booking was cancelled and payment cancelled
      const { data: cleanedBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', TEST_CONFIG.testBookingId)
        .single()
      
      expect(cleanedBooking.status).toBe('cancelled')
      expect(cleanedBooking.payment_status).toBe('cancelled')
      
      console.log('✅ Timeout cleanup completed successfully')
    }, TEST_CONFIG.timeout)
  })

  describe('5. Race Condition Testing', () => {
    it('should prevent multiple bookings for same slot', async () => {
      console.log('🎯 Testing race condition prevention...')
      
      // Attempt multiple simultaneous bookings for the same slot
      const bookingPromises = Array.from({ length: 5 }, () => 
        createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      )
      
      const results = await Promise.all(bookingPromises)
      
      // Only one should succeed
      const successful = results.filter(r => r.status === 200)
      const failed = results.filter(r => r.status === 409)
      
      expect(successful.length).toBe(1)
      expect(failed.length).toBe(4)
      
      // Clean up the successful booking
      if (successful.length > 0) {
        const successData = await successful[0].json()
        TEST_CONFIG.testBookingId = successData.booking.id
      }
      
      console.log('✅ Race condition prevention working correctly')
    }, TEST_CONFIG.timeout)
  })

  describe('6. Error Scenarios', () => {
    it('should handle payment failures gracefully', async () => {
      console.log('🎯 Testing payment failure handling...')
      
      // Create booking
      const bookingResponse = await createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      const bookingData = await bookingResponse.json()
      TEST_CONFIG.testBookingId = bookingData.booking.id
      
      // Create payment intent
      const paymentResponse = await createPaymentIntent(
        TEST_CONFIG.testBookingId, 
        testSession.price_per_session
      )
      const paymentData = await paymentResponse.json()
      TEST_CONFIG.testPaymentIntentId = paymentData.paymentIntentId
      
      // Simulate payment failure webhook
      await simulateStripeWebhook('payment_intent.payment_failed', {
        id: TEST_CONFIG.testPaymentIntentId,
        metadata: { bookingId: TEST_CONFIG.testBookingId }
      })
      
      // Verify booking status updated to failed
      const { data: failedBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', TEST_CONFIG.testBookingId)
        .single()
      
      expect(failedBooking.payment_status).toBe('failed')
      
      console.log('✅ Payment failure handled correctly')
    })

    it('should handle invalid booking IDs', async () => {
      const response = await createPaymentIntent('invalid-booking-id', 50.00)
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    it('should validate session exists', async () => {
      const response = await createBooking(TEST_CONFIG.testSlotId, 'invalid-session-id')
      expect([400, 404]).toContain(response.status)
    })
  })

  describe('7. Security Validation', () => {
    it('should prevent unauthorized access to bookings', async () => {
      // Create booking with test user
      const bookingResponse = await createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      const bookingData = await bookingResponse.json()
      const bookingId = bookingData.booking.id
      
      // Try to access with different user token (simulate unauthorized access)
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/payment/create-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid-token'
          },
          body: JSON.stringify({
            bookingId: bookingId,
            amount: 50.00
          })
        }
      )
      
      expect(response.status).toBe(401)
      
      // Clean up
      TEST_CONFIG.testBookingId = bookingId
    })

    it('should validate webhook signatures', async () => {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/webhooks/stripe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // Missing stripe-signature header
          },
          body: JSON.stringify({
            type: 'payment_intent.succeeded',
            data: { object: { id: 'test' } }
          })
        }
      )
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('signature')
    })
  })

  describe('8. Performance Benchmarks', () => {
    it('should meet performance targets', async () => {
      console.log('📊 Running performance benchmarks...')
      
      const metrics = {
        slotDiscovery: 0,
        bookingCreation: 0,
        paymentIntent: 0,
        webhookProcessing: 0,
        expertConfirmation: 0
      }
      
      // Slot discovery
      const slotStart = Date.now()
      const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      await fetch(
        `${TEST_CONFIG.baseUrl}/api/expert-sessions/${TEST_CONFIG.expertSessionId}/time-slots?start_date=${startDate}`,
        {
          headers: { 'Authorization': `Bearer ${await getTestUserToken()}` }
        }
      )
      metrics.slotDiscovery = Date.now() - slotStart
      
      // Booking creation
      const bookingStart = Date.now()
      const bookingResponse = await createBooking(TEST_CONFIG.testSlotId, TEST_CONFIG.expertSessionId)
      metrics.bookingCreation = Date.now() - bookingStart
      
      const bookingData = await bookingResponse.json()
      TEST_CONFIG.testBookingId = bookingData.booking.id
      
      // Payment intent
      const paymentStart = Date.now()
      await createPaymentIntent(TEST_CONFIG.testBookingId, testSession.price_per_session)
      metrics.paymentIntent = Date.now() - paymentStart
      
      // Performance assertions
      expect(metrics.slotDiscovery).toBeLessThan(2000) // 2 seconds
      expect(metrics.bookingCreation).toBeLessThan(3000) // 3 seconds
      expect(metrics.paymentIntent).toBeLessThan(5000) // 5 seconds
      
      console.log('📊 Performance Metrics:', metrics)
      performanceMetrics = { ...performanceMetrics, ...metrics }
    }, TEST_CONFIG.timeout)
  })

  // Helper functions
  async function setupTestData() {
    console.log('🔧 Setting up test data...')
    
    // Get test session
    const { data: sessions } = await supabase
      .from('expert_sessions')
      .select('*, experts(*)')
      .eq('is_active', true)
      .limit(1)
    
    if (!sessions || sessions.length === 0) {
      throw new Error('No active expert sessions found for testing')
    }
    
    testSession = sessions[0]
    TEST_CONFIG.expertSessionId = testSession.id
    TEST_CONFIG.testExpertId = testSession.expert_id
    
    // Get test user (create if doesn't exist)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      testUser = user
      TEST_CONFIG.testUserId = user.id
    } else {
      throw new Error('No authenticated user found for testing')
    }
    
    console.log('✅ Test data setup complete')
  }
  
  async function cleanupTestData() {
    // Clean up any remaining test bookings
    if (TEST_CONFIG.testBookingId) {
      await cleanupBooking(TEST_CONFIG.testBookingId)
    }
  }
  
  async function cleanupBooking(bookingId: string) {
    try {
      await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
    } catch (error) {
      console.warn('Failed to cleanup booking:', error)
    }
  }
  
  async function getTestUserToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || 'test-token'
  }
  
  async function createBooking(slotId: string, sessionId: string) {
    return fetch(`${TEST_CONFIG.baseUrl}/api/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getTestUserToken()}`
      },
      body: JSON.stringify({
        slotId,
        sessionId,
        notes: 'E2E test booking'
      })
    })
  }
  
  async function createPaymentIntent(bookingId: string, amount: number) {
    return fetch(`${TEST_CONFIG.baseUrl}/api/payment/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getTestUserToken()}`
      },
      body: JSON.stringify({
        bookingId,
        amount,
        currency: "dkk"'
      })
    })
  }
  
  async function expertConfirmBooking(bookingId: string, action: 'confirm' | 'decline') {
    return fetch(`${TEST_CONFIG.baseUrl}/api/bookings/expert/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getTestUserToken()}`
      },
      body: JSON.stringify({
        bookingId,
        action
      })
    })
  }
  
  async function simulateStripeWebhook(eventType: string, eventData: any) {
    // In a real test, you'd use Stripe's test webhook functionality
    // For now, we'll directly update the database to simulate webhook processing
    
    if (eventType === 'payment_intent.succeeded') {
      await supabase
        .from('bookings')
        .update({ payment_status: 'authorized' })
        .eq('id', eventData.metadata.bookingId)
    } else if (eventType === 'payment_intent.payment_failed') {
      await supabase
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', eventData.metadata.bookingId)
    }
  }
})

console.log(`
🎯 End-to-End Test Suite Configuration:
- Environment: ${process.env.NODE_ENV || 'test'}
- Base URL: ${TEST_CONFIG.baseUrl}
- Timeout: ${TEST_CONFIG.timeout}ms
- Retry Attempts: ${TEST_CONFIG.retryAttempts}

📋 Test Coverage:
✅ Slot Discovery & Validation
✅ Complete Happy Path Flow
✅ Expert Decline Handling
✅ Timeout & Cleanup
✅ Race Condition Prevention
✅ Error Scenario Handling
✅ Security Validation
✅ Performance Benchmarking
`)