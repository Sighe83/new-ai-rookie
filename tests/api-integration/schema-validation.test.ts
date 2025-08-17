/**
 * Schema Validation Tests
 * 
 * These tests ensure that the API code matches the actual database schema.
 * This prevents the critical column mismatch errors that were discovered.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

describe('Database Schema Validation', () => {
  let supabase: any

  beforeAll(async () => {
    supabase = await createServerSideClient()
  })

  it('should verify bookable_slots table has correct columns', async () => {
    // Test that we can query with session_id (not expert_session_id)
    const { error } = await supabase
      .from('bookable_slots')
      .select('id, session_id, availability_window_id, start_time, end_time, is_available')
      .limit(1)

    expect(error).toBeNull()
  })

  it('should verify bookings table has both session_id and expert_session_id for compatibility', async () => {
    // Test that we can query with both columns
    const { error: sessionIdError } = await supabase
      .from('bookings')
      .select('id, session_id')
      .limit(1)

    const { error: expertSessionIdError } = await supabase
      .from('bookings')
      .select('id, expert_session_id')
      .limit(1)

    expect(sessionIdError).toBeNull()
    expect(expertSessionIdError).toBeNull()
  })

  it('should verify sessions table exists and has expected columns', async () => {
    const { error } = await supabase
      .from('sessions')
      .select('id, expert_id, title, duration_minutes, price_cents, currency, is_active')
      .limit(1)

    expect(error).toBeNull()
  })

  it('should verify foreign key relationships are correct', async () => {
    // Test that bookable_slots.session_id references sessions.id
    const { error: slotsError } = await supabase
      .from('bookable_slots')
      .select(`
        id,
        session_id,
        sessions!inner(id, title)
      `)
      .limit(1)

    expect(slotsError).toBeNull()

    // Test that bookings.session_id references sessions.id  
    const { error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        session_id,
        sessions!inner(id, title)
      `)
      .limit(1)

    expect(bookingsError).toBeNull()
  })

  it('should verify API endpoints use correct column names', () => {
    // This is a static analysis test - we verify the code uses session_id
    // Instead of expert_session_id in critical API calls
    
    // Read the time-slots API file and verify it uses session_id
    const fs = require('fs')
    const path = require('path')
    
    const timeSlotsFile = fs.readFileSync(
      path.join(process.cwd(), 'app/api/expert-sessions/[id]/time-slots/route.ts'),
      'utf8'
    )
    
    // Should contain session_id, not expert_session_id
    expect(timeSlotsFile).toContain('.eq(\'session_id\'')
    expect(timeSlotsFile).not.toContain('.eq(\'expert_session_id\'')
  })
})

describe('Critical API Column Usage Validation', () => {
  it('should verify all API files use correct database column names', () => {
    const fs = require('fs')
    const path = require('path')
    const glob = require('glob')
    
    // Get all API route files
    const apiFiles = glob.sync('app/api/**/*.ts', { cwd: process.cwd() })
    
    const violations: string[] = []
    
    apiFiles.forEach(file => {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      
      // Check for dangerous patterns - using expert_session_id in bookable_slots queries
      if (content.includes('bookable_slots') && content.includes('expert_session_id')) {
        violations.push(`${file}: Uses expert_session_id with bookable_slots table`)
      }
    })
    
    expect(violations).toHaveLength(0)
    if (violations.length > 0) {
      console.error('Schema violations found:', violations)
    }
  })
})
