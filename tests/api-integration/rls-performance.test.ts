/**
 * Performance tests for RLS Trust Pattern
 * Ensures that RLS policies don't significantly impact API performance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  SINGLE_REQUEST: 2000,    // Single API request should complete within 2s
  BATCH_REQUEST: 5000,     // Batch of 10 requests should complete within 5s
  CREATE_REQUEST: 3000,    // Create operations should complete within 3s
  UPDATE_REQUEST: 2000,    // Update operations should complete within 2s
  DELETE_REQUEST: 2000     // Delete operations should complete within 2s
}

describe('RLS Performance Tests', () => {
  let expertUser: any
  let learnerUser: any
  let adminUser: any
  let expertProfile: any
  let expertSession: string
  let learnerSession: string
  let adminSession: string
  let testResources: any[] = []

  beforeAll(async () => {
    // Create test users
    const { data: expert } = await supabaseAdmin.auth.admin.createUser({
      email: 'perf-expert@test.com',
      password: 'test123456',
      email_confirm: true
    })
    expertUser = expert.user

    const { data: learner } = await supabaseAdmin.auth.admin.createUser({
      email: 'perf-learner@test.com',
      password: 'test123456',
      email_confirm: true
    })
    learnerUser = learner.user

    const { data: admin } = await supabaseAdmin.auth.admin.createUser({
      email: 'perf-admin@test.com',
      password: 'test123456',
      email_confirm: true
    })
    adminUser = admin.user

    // Create user profiles
    await supabaseAdmin.from('user_profiles').insert([
      {
        user_id: expertUser.id,
        role: 'expert',
        display_name: 'Performance Expert',
        first_name: 'Perf',
        last_name: 'Expert'
      },
      {
        user_id: learnerUser.id,
        role: 'learner',
        display_name: 'Performance Learner',
        first_name: 'Perf',
        last_name: 'Learner'
      },
      {
        user_id: adminUser.id,
        role: 'admin',
        display_name: 'Performance Admin',
        first_name: 'Perf',
        last_name: 'Admin'
      }
    ])

    // Create expert profile
    const { data: expertUserProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', expertUser.id)
      .single()

    const { data: expertProfileData } = await supabaseAdmin
      .from('expert_profiles')
      .insert({
        user_profile_id: expertUserProfile.id,
        is_available: true,
        hourly_rate: 10000
      })
      .select()
      .single()
    expertProfile = expertProfileData

    // Get auth sessions
    const expertAuth = await supabaseAdmin.auth.signInWithPassword({
      email: 'perf-expert@test.com',
      password: 'test123456'
    })
    expertSession = expertAuth.data.session?.access_token!

    const learnerAuth = await supabaseAdmin.auth.signInWithPassword({
      email: 'perf-learner@test.com',
      password: 'test123456'
    })
    learnerSession = learnerAuth.data.session?.access_token!

    const adminAuth = await supabaseAdmin.auth.signInWithPassword({
      email: 'perf-admin@test.com',
      password: 'test123456'
    })
    adminSession = adminAuth.data.session?.access_token!
  })

  afterAll(async () => {
    // Clean up all test resources
    for (const resource of testResources) {
      if (resource.type === 'availability_window') {
        await supabaseAdmin.from('availability_windows').delete().eq('id', resource.id)
      } else if (resource.type === 'expert_session') {
        await supabaseAdmin.from('expert_sessions').delete().eq('id', resource.id)
      }
    }

    // Clean up users
    if (expertProfile) {
      await supabaseAdmin.from('expert_profiles').delete().eq('id', expertProfile.id)
    }
    const userIds = [expertUser?.id, learnerUser?.id, adminUser?.id].filter(Boolean)
    if (userIds.length > 0) {
      await supabaseAdmin.from('user_profiles').delete().in('user_id', userIds)
      for (const userId of userIds) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      }
    }
  })

  const measureTime = async (operation: () => Promise<Response>) => {
    const start = Date.now()
    const response = await operation()
    const end = Date.now()
    return { response, duration: end - start }
  }

  describe('Single Request Performance', () => {
    it('should handle GET requests within performance threshold', async () => {
      // Create test window
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'Performance test window'
        })
        .select()
        .single()
      testResources.push({ type: 'availability_window', id: window.id })

      const { response, duration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)

      console.log(`GET availability window: ${duration}ms`)
    })

    it('should handle PUT requests within performance threshold', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'Performance test'
        })
        .select()
        .single()
      testResources.push({ type: 'availability_window', id: window.id })

      const { response, duration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${expertSession}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: 'Updated for performance test',
            is_closed: true
          })
        })
      )

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.UPDATE_REQUEST)

      console.log(`PUT availability window: ${duration}ms`)
    })

    it('should handle DELETE requests within performance threshold', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false
        })
        .select()
        .single()

      const { response, duration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DELETE_REQUEST)

      console.log(`DELETE availability window: ${duration}ms`)
    })
  })

  describe('Batch Request Performance', () => {
    it('should handle multiple GET requests efficiently', async () => {
      // Create multiple windows
      const windows = []
      for (let i = 0; i < 10; i++) {
        const { data: window } = await supabaseAdmin
          .from('availability_windows')
          .insert({
            expert_id: expertProfile.id,
            start_at: new Date(Date.now() + (2 + i) * 60 * 60 * 1000).toISOString(),
            end_at: new Date(Date.now() + (3 + i) * 60 * 60 * 1000).toISOString(),
            is_closed: false,
            notes: `Performance batch test ${i}`
          })
          .select()
          .single()
        windows.push(window)
        testResources.push({ type: 'availability_window', id: window.id })
      }

      const start = Date.now()
      const requests = windows.map(w =>
        fetch(`${apiBaseUrl}/api/availability-windows/${w.id}`, {
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      const responses = await Promise.all(requests)
      const duration = Date.now() - start

      // All should succeed
      responses.forEach(r => expect(r.status).toBe(200))
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_REQUEST)

      console.log(`Batch GET (10 windows): ${duration}ms`)
    })

    it('should handle mixed operations efficiently', async () => {
      // Create windows for mixed operations
      const windows = []
      for (let i = 0; i < 5; i++) {
        const { data: window } = await supabaseAdmin
          .from('availability_windows')
          .insert({
            expert_id: expertProfile.id,
            start_at: new Date(Date.now() + (2 + i) * 60 * 60 * 1000).toISOString(),
            end_at: new Date(Date.now() + (3 + i) * 60 * 60 * 1000).toISOString(),
            is_closed: false
          })
          .select()
          .single()
        windows.push(window)
        testResources.push({ type: 'availability_window', id: window.id })
      }

      const start = Date.now()
      
      // Mix of GET, PUT operations
      const operations = [
        ...windows.slice(0, 3).map(w => 
          fetch(`${apiBaseUrl}/api/availability-windows/${w.id}`, {
            headers: {
              'Authorization': `Bearer ${expertSession}`
            }
          })
        ),
        ...windows.slice(3, 5).map((w, i) => 
          fetch(`${apiBaseUrl}/api/availability-windows/${w.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${expertSession}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              notes: `Mixed operation ${i}`,
              is_closed: true
            })
          })
        )
      ]

      const responses = await Promise.all(operations)
      const duration = Date.now() - start

      responses.forEach(r => expect(r.status).toBe(200))
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_REQUEST)

      console.log(`Mixed operations (3 GET + 2 PUT): ${duration}ms`)
    })
  })

  describe('Authorization Overhead', () => {
    it('should compare authorized vs unauthorized request performance', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false
        })
        .select()
        .single()
      testResources.push({ type: 'availability_window', id: window.id })

      // Measure authorized request (should succeed)
      const { duration: authorizedDuration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      // Measure unauthorized request (should fail fast)
      const { duration: unauthorizedDuration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          headers: {
            'Authorization': `Bearer ${learnerSession}`
          }
        })
      )

      // Both should complete quickly
      expect(authorizedDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)
      expect(unauthorizedDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)

      // Unauthorized should be faster (fail-fast)
      expect(unauthorizedDuration).toBeLessThanOrEqual(authorizedDuration * 1.2) // Allow 20% variance

      console.log(`Authorized: ${authorizedDuration}ms, Unauthorized: ${unauthorizedDuration}ms`)
    })

    it('should measure admin vs owner performance difference', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false
        })
        .select()
        .single()
      testResources.push({ type: 'availability_window', id: window.id })

      // Measure owner access
      const { duration: ownerDuration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      // Measure admin access
      const { duration: adminDuration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          headers: {
            'Authorization': `Bearer ${adminSession}`
          }
        })
      )

      // Both should succeed and be similar in performance
      expect(ownerDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)
      expect(adminDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)

      // Performance should be similar (within 50% of each other)
      const ratio = Math.max(ownerDuration, adminDuration) / Math.min(ownerDuration, adminDuration)
      expect(ratio).toBeLessThan(1.5)

      console.log(`Owner: ${ownerDuration}ms, Admin: ${adminDuration}ms`)
    })
  })

  describe('Expert Sessions Performance', () => {
    it('should handle expert session operations efficiently', async () => {
      // Create test session
      const { data: session } = await supabaseAdmin
        .from('expert_sessions')
        .insert({
          expert_id: expertProfile.id,
          title: 'Performance Test Session',
          short_description: 'Testing performance of RLS policies',
          topic_tags: ['performance', 'testing'],
          duration_minutes: 60,
          price_amount: 10000,
          currency: 'DKK',
          is_active: true
        })
        .select()
        .single()
      testResources.push({ type: 'expert_session', id: session.id })

      // Test GET performance
      const { response: getResponse, duration: getDuration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/expert-sessions/${session.id}`, {
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      expect(getResponse.status).toBe(200)
      expect(getDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)

      // Test PUT performance
      const { response: putResponse, duration: putDuration } = await measureTime(() =>
        fetch(`${apiBaseUrl}/api/expert-sessions/${session.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${expertSession}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Updated Performance Test Session',
            price_amount: 12000
          })
        })
      )

      expect(putResponse.status).toBe(200)
      expect(putDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.UPDATE_REQUEST)

      console.log(`Expert Session GET: ${getDuration}ms, PUT: ${putDuration}ms`)
    })
  })

  describe('Stress Test', () => {
    it('should handle high concurrency without degradation', async () => {
      // Create window for stress test
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false
        })
        .select()
        .single()
      testResources.push({ type: 'availability_window', id: window.id })

      const concurrentRequests = 20
      const start = Date.now()

      // Create array of concurrent requests
      const requests = Array(concurrentRequests).fill(null).map(() =>
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          headers: {
            'Authorization': `Bearer ${expertSession}`
          }
        })
      )

      const responses = await Promise.all(requests)
      const totalDuration = Date.now() - start

      // All requests should succeed
      responses.forEach(r => expect(r.status).toBe(200))

      // Average response time should be reasonable
      const averageResponseTime = totalDuration / concurrentRequests
      expect(averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)

      // Total time should not be much worse than sequential
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST * 2)

      console.log(`Stress test (${concurrentRequests} concurrent): ${totalDuration}ms total, ${averageResponseTime}ms avg`)
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks with repeated operations', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false
        })
        .select()
        .single()
      testResources.push({ type: 'availability_window', id: window.id })

      const iterations = 50
      const durations: number[] = []

      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        const { duration } = await measureTime(() =>
          fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
            headers: {
              'Authorization': `Bearer ${expertSession}`
            }
          })
        )
        durations.push(duration)
      }

      // Calculate performance metrics
      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      const maxDuration = Math.max(...durations)
      const minDuration = Math.min(...durations)

      // Performance should remain consistent
      expect(averageDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST)
      expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_REQUEST * 2)

      // Performance should not degrade significantly over time
      const firstQuarter = durations.slice(0, Math.floor(iterations / 4))
      const lastQuarter = durations.slice(-Math.floor(iterations / 4))
      
      const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length
      const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length

      // Last quarter should not be significantly slower than first quarter
      expect(lastAvg).toBeLessThan(firstAvg * 1.5) // Allow 50% degradation

      console.log(`Memory test - Avg: ${averageDuration}ms, Min: ${minDuration}ms, Max: ${maxDuration}ms`)
      console.log(`First quarter avg: ${firstAvg}ms, Last quarter avg: ${lastAvg}ms`)
    })
  })
})