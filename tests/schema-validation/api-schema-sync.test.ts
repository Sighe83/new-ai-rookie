/**
 * API-Schema Synchronization Tests
 * 
 * These tests prevent the critical failure where API code used column names
 * that didn't exist in the database after schema evolution.
 * 
 * CRITICAL: Run these tests after any database schema changes to verify
 * all API endpoints can successfully query the database.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

describe('API-Schema Synchronization - CRITICAL FAILURE PREVENTION', () => {
  let supabase: any

  beforeAll(async () => {
    supabase = await createServerSideClient()
  })

  describe('Sessions API Endpoint Schema Validation', () => {
    it('should verify sessions API can query all required columns', async () => {
      // Test the exact query pattern used in the API
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          expert_id,
          title,
          description,
          duration_minutes,
          price_cents,
          specialties,
          difficulty_level,
          max_participants,
          created_at,
          updated_at,
          experts!inner(
            id,
            user_id,
            bio,
            specialties,
            profiles!inner(
              display_name,
              avatar_url
            )
          )
        `)
        .limit(1)

      // Should not error even if no data
      expect(error).toBeNull()
      console.log('✓ Sessions API query pattern works with current schema')
    })

    it('should verify sessions creation uses correct column names', async () => {
      // Test insert pattern from API
      const testSession = {
        expert_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
        title: 'Test Session',
        description: 'Test Description',
        duration_minutes: 60,
        price_cents: 5000,
        specialties: ['test'],
        difficulty_level: 'beginner',
        max_participants: 1
      }

      // This will fail if column names don't match
      const { error } = await supabase
        .from('sessions')
        .insert(testSession)
        .select()

      // We expect this to fail due to foreign key constraint (expert_id doesn't exist)
      // but it should NOT fail due to column name mismatch
      if (error) {
        expect(error.message).not.toContain('column')
        expect(error.message).not.toContain('does not exist')
        console.log('✓ Session insert fails on constraints, not missing columns')
      } else {
        // If it succeeds, clean up
        console.log('✓ Session insert succeeded (test data was valid)')
      }
    })
  })

  describe('Bookings API Endpoint Schema Validation', () => {
    it('should verify bookings API can query with session_id (not expert_session_id)', async () => {
      // This was the critical failure - API used session_id but DB had expert_session_id
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          session_id,
          user_id,
          availability_window_id,
          status,
          payment_intent_id,
          payment_status,
          created_at,
          updated_at,
          sessions!inner(
            id,
            title,
            expert_id,
            duration_minutes,
            price_cents
          )
        `)
        .limit(1)

      expect(error).toBeNull()
      console.log('✓ Bookings API query pattern works with session_id')
    })

    it('should verify bookings creation uses correct foreign key column', async () => {
      const testBooking = {
        session_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
        user_id: '00000000-0000-0000-0000-000000000000',
        availability_window_id: '00000000-0000-0000-0000-000000000000',
        status: 'pending',
        payment_status: 'pending'
      }

      const { error } = await supabase
        .from('bookings')
        .insert(testBooking)
        .select()

      // Should fail on foreign key constraints, NOT on missing column names
      if (error) {
        expect(error.message).not.toContain('column "expert_session_id"')
        expect(error.message).not.toContain('column does not exist')
        console.log('✓ Booking insert uses correct column names (session_id)')
      }
    })

    it('should verify deprecated expert_session_id column is not used', async () => {
      // This query should fail because expert_session_id should not exist
      const { error } = await supabase
        .from('bookings')
        .select('expert_session_id')
        .limit(1)

      expect(error).not.toBeNull()
      expect(error.message).toContain('column "expert_session_id" does not exist')
      console.log('✓ Deprecated expert_session_id column correctly removed')
    })
  })

  describe('Expert Sessions API Migration Validation', () => {
    it('should verify expert-sessions API endpoints use sessions table', async () => {
      // Test that API routes that formerly used expert_sessions now use sessions
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          expert_id,
          title,
          description,
          duration_minutes,
          price_cents,
          specialties,
          difficulty_level,
          max_participants
        `)
        .eq('expert_id', '00000000-0000-0000-0000-000000000000') // Placeholder
        .limit(1)

      expect(error).toBeNull()
      console.log('✓ Expert sessions queries work against sessions table')
    })

    it('should verify time slots API uses correct session foreign key', async () => {
      // Test time slots endpoint that joins with sessions
      const { data, error } = await supabase
        .from('availability_windows')
        .select(`
          id,
          expert_id,
          start_time,
          end_time,
          is_available,
          bookings!inner(
            id,
            session_id,
            status
          )
        `)
        .limit(1)

      expect(error).toBeNull()
      console.log('✓ Time slots API correctly joins bookings.session_id')
    })
  })

  describe('Cross-Reference Validation', () => {
    it('should verify all API routes can access their required database columns', async () => {
      // Test patterns used across different API endpoints
      const apiQueries = [
        {
          name: 'GET /api/expert-sessions',
          query: () => supabase.from('sessions').select('id, expert_id, title').limit(1)
        },
        {
          name: 'GET /api/expert-sessions/[id]',
          query: () => supabase.from('sessions').select('*').eq('id', '00000000-0000-0000-0000-000000000000').limit(1)
        },
        {
          name: 'GET /api/bookings',
          query: () => supabase.from('bookings').select('id, session_id, user_id, status').limit(1)
        },
        {
          name: 'GET /api/bookings/[id]',
          query: () => supabase.from('bookings').select('*').eq('id', '00000000-0000-0000-0000-000000000000').limit(1)
        },
        {
          name: 'GET /api/availability-windows',
          query: () => supabase.from('availability_windows').select('id, expert_id, start_time, end_time').limit(1)
        }
      ]

      for (const apiQuery of apiQueries) {
        const { error } = await apiQuery.query()
        expect(error).toBeNull()
        console.log(`✓ ${apiQuery.name} schema compatibility verified`)
      }
    })
  })

  describe('TypeScript Interface Validation', () => {
    it('should verify database columns match TypeScript interface expectations', async () => {
      // Get actual database columns for sessions table
      const { data: sessionColumns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'sessions')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      expect(sessionColumns).toBeDefined()

      // Verify columns match what TypeScript interfaces expect
      const expectedSessionColumns = [
        'id', 'expert_id', 'title', 'description', 
        'duration_minutes', 'price_cents', 'specialties',
        'difficulty_level', 'max_participants', 'created_at', 'updated_at'
      ]

      const actualColumns = sessionColumns.map((col: any) => col.column_name)
      
      for (const expectedColumn of expectedSessionColumns) {
        expect(actualColumns).toContain(expectedColumn)
        console.log(`✓ TypeScript interface column '${expectedColumn}' exists in database`)
      }
    })

    it('should verify booking interface columns match database', async () => {
      const { data: bookingColumns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'bookings')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      expect(bookingColumns).toBeDefined()

      const expectedBookingColumns = [
        'id', 'session_id', 'user_id', 'availability_window_id',
        'status', 'payment_intent_id', 'payment_status', 'created_at', 'updated_at'
      ]

      const actualColumns = bookingColumns.map((col: any) => col.column_name)
      
      for (const expectedColumn of expectedBookingColumns) {
        expect(actualColumns).toContain(expectedColumn)
        console.log(`✓ Booking interface column '${expectedColumn}' exists in database`)
      }

      // Critical: Verify old column name is gone
      expect(actualColumns).not.toContain('expert_session_id')
      console.log('✓ Deprecated expert_session_id not in booking interface')
    })
  })
})
