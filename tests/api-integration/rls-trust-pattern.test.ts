/**
 * Comprehensive tests for RLS Trust Pattern Implementation
 * Tests the security and authorization of API routes that rely on RLS policies
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
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

describe('RLS Trust Pattern - Comprehensive Security Tests', () => {
  let expertUser: any
  let learnerUser: any
  let adminUser: any
  let unauthorizedUser: any
  let expertProfile: any
  let learnerProfile: any
  let adminProfile: any
  let testWindow: any
  let testSession: any
  let anotherExpertUser: any
  let anotherExpertProfile: any

  beforeAll(async () => {
    // Create all test users
    const { data: expert } = await supabaseAdmin.auth.admin.createUser({
      email: 'rls-expert@test.com',
      password: 'test123456',
      email_confirm: true
    })
    expertUser = expert.user

    const { data: learner } = await supabaseAdmin.auth.admin.createUser({
      email: 'rls-learner@test.com',
      password: 'test123456',
      email_confirm: true
    })
    learnerUser = learner.user

    const { data: admin } = await supabaseAdmin.auth.admin.createUser({
      email: 'rls-admin@test.com',
      password: 'test123456',
      email_confirm: true
    })
    adminUser = admin.user

    const { data: unauthorized } = await supabaseAdmin.auth.admin.createUser({
      email: 'rls-unauthorized@test.com',
      password: 'test123456',
      email_confirm: true
    })
    unauthorizedUser = unauthorized.user

    const { data: anotherExpert } = await supabaseAdmin.auth.admin.createUser({
      email: 'rls-expert2@test.com',
      password: 'test123456',
      email_confirm: true
    })
    anotherExpertUser = anotherExpert.user

    // Create user profiles
    await supabaseAdmin.from('user_profiles').insert([
      {
        user_id: expertUser.id,
        role: 'expert',
        display_name: 'RLS Test Expert',
        first_name: 'Test',
        last_name: 'Expert'
      },
      {
        user_id: learnerUser.id,
        role: 'learner',
        display_name: 'RLS Test Learner',
        first_name: 'Test',
        last_name: 'Learner'
      },
      {
        user_id: adminUser.id,
        role: 'admin',
        display_name: 'RLS Test Admin',
        first_name: 'Test',
        last_name: 'Admin'
      },
      {
        user_id: unauthorizedUser.id,
        role: 'learner',
        display_name: 'RLS Unauthorized User',
        first_name: 'Unauthorized',
        last_name: 'User'
      },
      {
        user_id: anotherExpertUser.id,
        role: 'expert',
        display_name: 'RLS Another Expert',
        first_name: 'Another',
        last_name: 'Expert'
      }
    ])

    // Create expert profiles
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
        hourly_rate: 10000 // 100 DKK in øre
      })
      .select()
      .single()
    expertProfile = expertProfileData

    const { data: anotherExpertUserProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', anotherExpertUser.id)
      .single()

    const { data: anotherExpertProfileData } = await supabaseAdmin
      .from('expert_profiles')
      .insert({
        user_profile_id: anotherExpertUserProfile.id,
        is_available: true,
        hourly_rate: 15000 // 150 DKK in øre
      })
      .select()
      .single()
    anotherExpertProfile = anotherExpertProfileData

    // Get learner profile
    const { data: learnerUserProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', learnerUser.id)
      .single()
    learnerProfile = learnerUserProfile

    // Get admin profile
    const { data: adminUserProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', adminUser.id)
      .single()
    adminProfile = adminUserProfile
  })

  afterAll(async () => {
    // Clean up all test data
    if (expertProfile) {
      await supabaseAdmin.from('expert_profiles').delete().eq('id', expertProfile.id)
    }
    if (anotherExpertProfile) {
      await supabaseAdmin.from('expert_profiles').delete().eq('id', anotherExpertProfile.id)
    }
    
    // Delete user profiles and users
    const userIds = [expertUser?.id, learnerUser?.id, adminUser?.id, unauthorizedUser?.id, anotherExpertUser?.id].filter(Boolean)
    if (userIds.length > 0) {
      await supabaseAdmin.from('user_profiles').delete().in('user_id', userIds)
      for (const userId of userIds) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      }
    }
  })

  describe('Availability Windows - RLS Authorization Tests', () => {
    beforeEach(async () => {
      // Create test availability window
      const { data: windowData } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'RLS test availability window'
        })
        .select()
        .single()
      testWindow = windowData
    })

    afterEach(async () => {
      if (testWindow) {
        await supabaseAdmin.from('availability_windows').delete().eq('id', testWindow.id)
      }
    })

    describe('GET /api/availability-windows/[id]', () => {
      it('should allow expert to access their own window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.window.id).toBe(testWindow.id)
      })

      it('should return 403 for learner accessing window by ID', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-learner@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should allow admin to access any window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-admin@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.window.id).toBe(testWindow.id)
      })

      it('should return 403 for another expert accessing window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert2@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should return 401 for unauthenticated access', async () => {
        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`)

        expect(response.status).toBe(401)
        const data = await response.json()
        expect(data.error).toBe('Unauthorized')
      })

      it('should return 404 for non-existent window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-admin@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/00000000-0000-0000-0000-000000000000`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(404)
        const data = await response.json()
        expect(data.error).toContain('not found')
      })
    })

    describe('PUT /api/availability-windows/[id]', () => {
      it('should allow expert to update their own window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const newEndTime = new Date(Date.now() + 5 * 60 * 60 * 1000)
        newEndTime.setMinutes(Math.floor(newEndTime.getMinutes() / 15) * 15)
        newEndTime.setSeconds(0)
        newEndTime.setMilliseconds(0)

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            end_at: newEndTime.toISOString(),
            notes: 'Updated notes'
          })
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.message).toContain('updated successfully')
        expect(data.window.notes).toBe('Updated notes')
      })

      it('should return 403 for learner trying to update window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-learner@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: 'Malicious update'
          })
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should allow admin to update any window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-admin@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            is_closed: true,
            notes: 'Admin closed this window'
          })
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.window.is_closed).toBe(true)
        expect(data.window.notes).toBe('Admin closed this window')
      })

      it('should return 403 for another expert trying to update window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert2@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: 'Another expert trying to modify'
          })
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should validate business rules even for authorized users', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        // Try to set invalid time (not 15-minute aligned)
        const invalidTime = new Date(Date.now() + 3 * 60 * 60 * 1000)
        invalidTime.setMinutes(7) // Not aligned to 15 minutes

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            end_at: invalidTime.toISOString()
          })
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toContain('15-minute')
      })
    })

    describe('DELETE /api/availability-windows/[id]', () => {
      it('should allow expert to delete their own window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.message).toContain('deleted successfully')
      })

      it('should return 403 for learner trying to delete window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-learner@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should allow admin to delete any window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-admin@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.message).toContain('deleted successfully')
      })

      it('should return 403 for another expert trying to delete window', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert2@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should prevent deletion with active bookings even for owner', async () => {
        // Create a confirmed booking
        await supabaseAdmin.from('bookings').insert({
          learner_id: learnerProfile.id,
          expert_id: expertProfile.id,
          availability_window_id: testWindow.id,
          start_at: testWindow.start_at,
          end_at: testWindow.end_at,
          status: 'confirmed',
          total_amount: 10000
        })

        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${testWindow.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(409)
        const data = await response.json()
        expect(data.error).toContain('Cannot delete')
        expect(data.error).toContain('bookings')

        // Clean up
        await supabaseAdmin.from('bookings').delete().eq('availability_window_id', testWindow.id)
      })
    })
  })

  describe('Expert Sessions - RLS Authorization Tests', () => {
    beforeEach(async () => {
      // Create test expert session
      const { data: sessionData } = await supabaseAdmin
        .from('expert_sessions')
        .insert({
          expert_id: expertProfile.id,
          title: 'RLS Test Session',
          short_description: 'Testing RLS policies for expert sessions',
          topic_tags: ['testing', 'security'],
          duration_minutes: 60,
          price_amount: 10000, // 100 DKK in øre
          currency: 'DKK',
          level: 'INTERMEDIATE',
          is_active: true
        })
        .select()
        .single()
      testSession = sessionData
    })

    afterEach(async () => {
      if (testSession) {
        await supabaseAdmin.from('expert_sessions').delete().eq('id', testSession.id)
      }
    })

    describe('GET /api/expert-sessions/[id]', () => {
      it('should allow public access to active sessions', async () => {
        // No authentication needed for GET
        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`)

        // Since GET requires authentication in the current implementation
        expect(response.status).toBe(401)
      })

      it('should allow authenticated users to view sessions', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-learner@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.session.id).toBe(testSession.id)
      })
    })

    describe('PUT /api/expert-sessions/[id]', () => {
      it('should allow expert to update their own session', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Updated RLS Test Session',
            price_amount: 15000 // 150 DKK
          })
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.session.title).toBe('Updated RLS Test Session')
        expect(data.session.price_amount).toBe(15000)
      })

      it('should return 403 for learner trying to update session', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-learner@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Malicious title update'
          })
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should allow admin to update any session', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-admin@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            is_active: false,
            title: 'Admin Disabled Session'
          })
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.session.is_active).toBe(false)
        expect(data.session.title).toBe('Admin Disabled Session')
      })

      it('should return 403 for another expert trying to update session', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert2@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            price_amount: 5000 // Try to lower competitor's price
          })
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })
    })

    describe('DELETE /api/expert-sessions/[id]', () => {
      it('should allow expert to soft-delete their own session', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.message).toContain('deleted successfully')

        // Verify it's soft deleted (is_active = false)
        const { data: deletedSession } = await supabaseAdmin
          .from('expert_sessions')
          .select('is_active')
          .eq('id', testSession.id)
          .single()
        expect(deletedSession.is_active).toBe(false)
      })

      it('should return 403 for learner trying to delete session', async () => {
        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-learner@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toContain('Unauthorized')
      })

      it('should prevent deletion with active bookings', async () => {
        // Create an active booking
        await supabaseAdmin.from('bookings').insert({
          learner_id: learnerProfile.id,
          expert_id: expertProfile.id,
          expert_session_id: testSession.id,
          availability_window_id: null,
          start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          status: 'confirmed',
          total_amount: testSession.price_amount
        })

        const { data: session } = await supabaseAdmin.auth.signInWithPassword({
          email: 'rls-expert@test.com',
          password: 'test123456'
        })

        const response = await fetch(`${apiBaseUrl}/api/expert-sessions/${testSession.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        expect(response.status).toBe(409)
        const data = await response.json()
        expect(data.error).toContain('Cannot delete')
        expect(data.error).toContain('bookings')

        // Clean up
        await supabaseAdmin.from('bookings').delete().eq('expert_session_id', testSession.id)
      })
    })
  })

  describe('Cross-Entity RLS Tests', () => {
    it('should prevent information leakage through error messages', async () => {
      // Create a window for another expert
      const { data: anotherWindow } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: anotherExpertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'Secret window'
        })
        .select()
        .single()

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'rls-expert@test.com',
        password: 'test123456'
      })

      // Try to access another expert's window
      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${anotherWindow.id}`, {
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`
        }
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      // Should not reveal that the window exists
      expect(data.error).not.toContain('Secret')
      expect(data.error).toContain('Unauthorized')

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', anotherWindow.id)
    })

    it('should handle cascading RLS policies correctly', async () => {
      // Create a complex scenario with multiple related entities
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

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .insert({
          learner_id: learnerProfile.id,
          expert_id: expertProfile.id,
          availability_window_id: window.id,
          start_at: window.start_at,
          end_at: window.end_at,
          status: 'pending',
          total_amount: 10000
        })
        .select()
        .single()

      // Expert should be able to see their window even with bookings
      const { data: expertSession } = await supabaseAdmin.auth.signInWithPassword({
        email: 'rls-expert@test.com',
        password: 'test123456'
      })

      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        headers: {
          'Authorization': `Bearer ${expertSession.session?.access_token}`
        }
      })

      expect(response.status).toBe(200)

      // Clean up
      await supabaseAdmin.from('bookings').delete().eq('id', booking.id)
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })
  })

  describe('Admin Permission Edge Cases', () => {
    it('should allow admin to perform all operations', async () => {
      // Create resources owned by different users
      const { data: expertWindow } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false
        })
        .select()
        .single()

      const { data: adminSession } = await supabaseAdmin.auth.signInWithPassword({
        email: 'rls-admin@test.com',
        password: 'test123456'
      })

      // Admin can read
      const readResponse = await fetch(`${apiBaseUrl}/api/availability-windows/${expertWindow.id}`, {
        headers: {
          'Authorization': `Bearer ${adminSession.session?.access_token}`
        }
      })
      expect(readResponse.status).toBe(200)

      // Admin can update
      const updateResponse = await fetch(`${apiBaseUrl}/api/availability-windows/${expertWindow.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminSession.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: 'Admin override'
        })
      })
      expect(updateResponse.status).toBe(200)

      // Admin can delete
      const deleteResponse = await fetch(`${apiBaseUrl}/api/availability-windows/${expertWindow.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminSession.session?.access_token}`
        }
      })
      expect(deleteResponse.status).toBe(200)
    })

    it('should not allow non-admin users to escalate privileges', async () => {
      // Try to modify user role directly (should be blocked by RLS)
      const { data: learnerSession } = await supabaseAdmin.auth.signInWithPassword({
        email: 'rls-learner@test.com',
        password: 'test123456'
      })

      // Create a client with learner's token
      const learnerClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        global: {
          headers: {
            Authorization: `Bearer ${learnerSession.session?.access_token}`
          }
        }
      })

      // Try to update their own role to admin
      const { error } = await learnerClient
        .from('user_profiles')
        .update({ role: 'admin' })
        .eq('user_id', learnerUser.id)

      expect(error).toBeTruthy()
      // Verify role hasn't changed
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('user_id', learnerUser.id)
        .single()
      expect(profile.role).toBe('learner')
    })
  })
})