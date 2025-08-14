/**
 * Edge case tests for RLS Trust Pattern
 * Tests unusual scenarios, race conditions, and boundary cases
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

describe('RLS Edge Cases and Boundary Tests', () => {
  let expertUser: any
  let adminUser: any
  let expertProfile: any
  let testUsers: any[] = []

  beforeAll(async () => {
    // Create test users
    const { data: expert } = await supabaseAdmin.auth.admin.createUser({
      email: 'edge-expert@test.com',
      password: 'test123456',
      email_confirm: true
    })
    expertUser = expert.user

    const { data: admin } = await supabaseAdmin.auth.admin.createUser({
      email: 'edge-admin@test.com',
      password: 'test123456',
      email_confirm: true
    })
    adminUser = admin.user

    await supabaseAdmin.from('user_profiles').insert([
      {
        user_id: expertUser.id,
        role: 'expert',
        display_name: 'Edge Test Expert',
        first_name: 'Edge',
        last_name: 'Expert'
      },
      {
        user_id: adminUser.id,
        role: 'admin',
        display_name: 'Edge Test Admin',
        first_name: 'Edge',
        last_name: 'Admin'
      }
    ])

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
  })

  afterAll(async () => {
    // Clean up
    if (expertProfile) {
      await supabaseAdmin.from('expert_profiles').delete().eq('id', expertProfile.id)
    }
    const userIds = [expertUser?.id, adminUser?.id, ...testUsers.map(u => u.id)].filter(Boolean)
    if (userIds.length > 0) {
      await supabaseAdmin.from('user_profiles').delete().in('user_id', userIds)
      for (const userId of userIds) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      }
    }
  })

  describe('Token Expiration and Refresh', () => {
    it('should handle expired tokens gracefully', async () => {
      // Use an invalid/expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

      const response = await fetch(`${apiBaseUrl}/api/availability-windows/test-id`, {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle malformed tokens', async () => {
      const malformedToken = 'not-a-valid-jwt-token'

      const response = await fetch(`${apiBaseUrl}/api/availability-windows/test-id`, {
        headers: {
          'Authorization': `Bearer ${malformedToken}`
        }
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent updates safely', async () => {
      // Create a window
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'Concurrent test'
        })
        .select()
        .single()

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Make concurrent updates
      const updates = Array(5).fill(null).map((_, i) => 
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: `Update ${i}`
          })
        })
      )

      const results = await Promise.all(updates)
      
      // All should succeed (RLS allows owner to update)
      results.forEach(r => expect(r.status).toBe(200))

      // Check final state
      const { data: finalWindow } = await supabaseAdmin
        .from('availability_windows')
        .select('notes')
        .eq('id', window.id)
        .single()

      // Should have one of the update values
      expect(finalWindow.notes).toMatch(/Update \d/)

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })

    it('should handle race condition between delete and update', async () => {
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

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Simultaneous delete and update
      const [deleteResponse, updateResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        }),
        fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: 'Racing with delete'
          })
        })
      ])

      // One should succeed, one should fail
      const statuses = [deleteResponse.status, updateResponse.status]
      expect(statuses).toContain(200)
      
      // Verify window state
      const { data: finalWindow } = await supabaseAdmin
        .from('availability_windows')
        .select('id')
        .eq('id', window.id)
        .single()

      // If delete won, window should not exist
      if (deleteResponse.status === 200) {
        expect(finalWindow).toBeNull()
      }
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should sanitize malicious input in window ID', async () => {
      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Try SQL injection in ID parameter
      const maliciousId = "'; DROP TABLE availability_windows; --"
      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${encodeURIComponent(maliciousId)}`, {
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`
        }
      })

      // Should handle safely
      expect([400, 404]).toContain(response.status)

      // Verify table still exists
      const { error } = await supabaseAdmin
        .from('availability_windows')
        .select('count')
        .limit(1)
      expect(error).toBeNull()
    })

    it('should sanitize malicious input in request body', async () => {
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

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: "'; UPDATE user_profiles SET role='admin' WHERE user_id='" + expertUser.id + "'; --"
        })
      })

      expect(response.status).toBe(200)

      // Verify role hasn't changed
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('user_id', expertUser.id)
        .single()
      expect(profile.role).toBe('expert')

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })
  })

  describe('Large Data Handling', () => {
    it('should handle very long notes field', async () => {
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

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Create a very long string (10KB)
      const longNotes = 'A'.repeat(10000)

      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: longNotes
        })
      })

      // Should either succeed or return appropriate error
      expect([200, 400, 413]).toContain(response.status)

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })

    it('should handle batch operations efficiently', async () => {
      const windowCount = 10
      const windows = []

      // Create multiple windows
      for (let i = 0; i < windowCount; i++) {
        const { data: window } = await supabaseAdmin
          .from('availability_windows')
          .insert({
            expert_id: expertProfile.id,
            start_at: new Date(Date.now() + (2 + i) * 60 * 60 * 1000).toISOString(),
            end_at: new Date(Date.now() + (3 + i) * 60 * 60 * 1000).toISOString(),
            is_closed: false,
            notes: `Batch test ${i}`
          })
          .select()
          .single()
        windows.push(window)
      }

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Fetch all windows in parallel
      const startTime = Date.now()
      const fetches = windows.map(w => 
        fetch(`${apiBaseUrl}/api/availability-windows/${w.id}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })
      )

      const results = await Promise.all(fetches)
      const endTime = Date.now()

      // All should succeed
      results.forEach(r => expect(r.status).toBe(200))

      // Should complete in reasonable time (< 5 seconds for 10 requests)
      expect(endTime - startTime).toBeLessThan(5000)

      // Clean up
      for (const window of windows) {
        await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
      }
    })
  })

  describe('Role Transition Scenarios', () => {
    it('should handle user role changes correctly', async () => {
      // Create a user that starts as learner
      const { data: transitUser } = await supabaseAdmin.auth.admin.createUser({
        email: 'transit-user@test.com',
        password: 'test123456',
        email_confirm: true
      })
      testUsers.push(transitUser.user)

      await supabaseAdmin.from('user_profiles').insert({
        user_id: transitUser.user.id,
        role: 'learner',
        display_name: 'Transit User',
        first_name: 'Transit',
        last_name: 'User'
      })

      // Create a window as expert
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

      // Try to access as learner
      const { data: learnerSession } = await supabaseAdmin.auth.signInWithPassword({
        email: 'transit-user@test.com',
        password: 'test123456'
      })

      let response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${learnerSession.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: 'Learner trying to update'
        })
      })

      expect(response.status).toBe(403)

      // Change role to admin
      await supabaseAdmin
        .from('user_profiles')
        .update({ role: 'admin' })
        .eq('user_id', transitUser.user.id)

      // Get new session after role change
      const { data: adminSession } = await supabaseAdmin.auth.signInWithPassword({
        email: 'transit-user@test.com',
        password: 'test123456'
      })

      // Try again as admin
      response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminSession.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: 'Admin can now update'
        })
      })

      expect(response.status).toBe(200)

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })
  })

  describe('Null and Undefined Handling', () => {
    it('should handle null values in optional fields', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'Initial notes'
        })
        .select()
        .single()

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Set notes to null
      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: null
        })
      })

      expect(response.status).toBe(200)

      // Verify notes is null
      const { data: updatedWindow } = await supabaseAdmin
        .from('availability_windows')
        .select('notes')
        .eq('id', window.id)
        .single()

      expect(updatedWindow.notes).toBeNull()

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })

    it('should handle undefined vs null in request body', async () => {
      const { data: window } = await supabaseAdmin
        .from('availability_windows')
        .insert({
          expert_id: expertProfile.id,
          start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_closed: false,
          notes: 'Original notes'
        })
        .select()
        .single()

      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      // Send update with undefined (should not update notes)
      const updateData: any = {
        is_closed: true
      }
      // Explicitly set undefined (will be stripped in JSON.stringify)
      updateData.notes = undefined

      const response = await fetch(`${apiBaseUrl}/api/availability-windows/${window.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)

      // Verify notes unchanged
      const { data: updatedWindow } = await supabaseAdmin
        .from('availability_windows')
        .select('notes, is_closed')
        .eq('id', window.id)
        .single()

      expect(updatedWindow.notes).toBe('Original notes')
      expect(updatedWindow.is_closed).toBe(true)

      // Clean up
      await supabaseAdmin.from('availability_windows').delete().eq('id', window.id)
    })
  })

  describe('Invalid UUID Handling', () => {
    it('should handle invalid UUID formats', async () => {
      const { data: session } = await supabaseAdmin.auth.signInWithPassword({
        email: 'edge-expert@test.com',
        password: 'test123456'
      })

      const invalidIds = [
        'not-a-uuid',
        '12345',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '../../../etc/passwd',
        ''
      ]

      for (const invalidId of invalidIds) {
        const response = await fetch(`${apiBaseUrl}/api/availability-windows/${invalidId}`, {
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`
          }
        })

        // Should handle gracefully
        expect([400, 404]).toContain(response.status)
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })
  })
})