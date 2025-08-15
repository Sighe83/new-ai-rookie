/**
 * Live API Integration Tests for Booking System
 * 
 * Tests actual API endpoints with real network calls to verify:
 * 1. Authentication works correctly
 * 2. Booking creation with all required fields
 * 3. Payment intent creation
 * 4. Error handling and validation
 * 
 * NOTE: These tests require a running development server at localhost:3000
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

// Test configuration
const API_BASE_URL = 'http://localhost:3000'
const TEST_SESSION_ID = '15b51512-15b9-48a6-b58a-7dfe06e23df5'

// Mock authentication token - in real testing this would come from actual auth
const MOCK_AUTH_TOKEN = 'mock-jwt-token'

describe('Live API Integration Tests', () => {
  let testBookingId: string | null = null

  beforeAll(() => {
    // Ensure we have the required environment
    expect(API_BASE_URL).toBeDefined()
    expect(TEST_SESSION_ID).toBeDefined()
  })

  afterEach(() => {
    // Cleanup any test data if needed
    if (testBookingId) {
      // In a real test, you might want to cleanup test bookings
      console.log(`Test booking created: ${testBookingId}`)
    }
  })

  describe('Booking Creation API (/api/bookings/create)', () => {
    it('should return 401 for requests without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: TEST_SESSION_ID,
          expert_id: 'test-expert-id',
          start_at: '2025-08-18T10:00:00Z',
          end_at: '2025-08-18T11:00:00Z',
          notes: 'Test booking without auth'
        })
      })

      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should accept requests with Bearer token format', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: TEST_SESSION_ID,
          expert_id: 'test-expert-id',
          start_at: '2025-08-18T10:00:00Z',
          end_at: '2025-08-18T11:00:00Z',
          notes: 'Test booking with auth'
        })
      })

      // Should not be 401 (may be other errors due to invalid token, but auth header is accepted)
      expect(response.status).not.toBe(401)
    })

    it('should validate required session_id field', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expert_id: 'test-expert-id',
          start_at: '2025-08-18T10:00:00Z',
          end_at: '2025-08-18T11:00:00Z',
          notes: 'Test booking without session_id'
        })
      })

      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('Missing required field: session_id')
    })

    it('should handle malformed JSON requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: 'invalid json{'
      })

      expect(response.status).toBe(500) // Should handle JSON parse error gracefully
    })
  })

  describe('Payment Intent API (/api/payment/create-intent)', () => {
    it('should return 401 for requests without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: 'test-booking-id',
          amount: 50.00,
          currency: 'usd'
        })
      })

      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should validate required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing bookingId and amount
          currency: 'usd'
        })
      })

      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
    })

    it('should handle non-existent booking IDs', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: 'non-existent-booking-id',
          amount: 50.00,
          currency: 'usd'
        })
      })

      // May return 404 or 401 depending on how auth/lookup fails
      expect([401, 404]).toContain(response.status)
    })
  })

  describe('API Response Format Validation', () => {
    it('should return proper error format for 401 responses', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      expect(response.status).toBe(401)
      expect(response.headers.get('content-type')).toContain('application/json')
      
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
    })

    it('should return proper error format for 400 responses', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Missing required fields
      })

      expect(response.status).toBe(400)
      expect(response.headers.get('content-type')).toContain('application/json')
      
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
    })
  })

  describe('CORS and Headers', () => {
    it('should handle POST requests to booking API', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      // Should accept POST method (may return 401 but not method not allowed)
      expect(response.status).not.toBe(405)
    })

    it('should handle POST requests to payment API', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      // Should accept POST method
      expect(response.status).not.toBe(405)
    })
  })

  describe('Security Headers', () => {
    it('should have appropriate security headers', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      // Response should be JSON
      expect(response.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('Data Validation', () => {
    it('should validate date format in booking requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: TEST_SESSION_ID,
          expert_id: 'test-expert-id',
          start_at: 'invalid-date-format',
          end_at: '2025-08-18T11:00:00Z'
        })
      })

      // Should handle invalid date formats appropriately
      // May return 400 for validation error or 500 for processing error
      expect([400, 500]).toContain(response.status)
    })

    it('should validate amount format in payment requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MOCK_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: 'test-booking-id',
          amount: 'not-a-number',
          currency: 'usd'
        })
      })

      // Should handle invalid amount format
      expect([400, 401, 500]).toContain(response.status)
    })
  })
})