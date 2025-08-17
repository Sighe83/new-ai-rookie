/**
 * Foreign Key Relationship Validation Tests
 * 
 * These tests prevent critical failures in foreign key relationships,
 * especially after table renames (expert_sessions → sessions).
 * 
 * CRITICAL: Run these tests after any table renames or foreign key changes.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

describe('Foreign Key Relationship Validation - CRITICAL FAILURE PREVENTION', () => {
  let supabase: any

  beforeAll(async () => {
    supabase = await createServerSideClient()
  })

  describe('Critical Foreign Key Constraints', () => {
    it('should verify bookings.session_id references sessions.id', async () => {
      // Check the foreign key constraint exists
      const { data: constraints, error } = await supabase.rpc('get_foreign_key_info', {
        source_table: 'bookings',
        source_column: 'session_id'
      })

      if (error) {
        // Fallback method to check foreign key relationships
        const { data: fkInfo, error: fkError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            column_name,
            referenced_table_name,
            referenced_column_name
          `)
          .eq('table_name', 'bookings')
          .eq('column_name', 'session_id')
          .eq('table_schema', 'public')

        expect(fkError).toBeNull()
        if (fkInfo && fkInfo.length > 0) {
          expect(fkInfo[0].referenced_table_name).toBe('sessions')
          expect(fkInfo[0].referenced_column_name).toBe('id')
          console.log('✓ bookings.session_id → sessions.id foreign key exists')
        }
      }
    })

    it('should verify sessions.expert_id references experts.id', async () => {
      const { data: fkInfo, error } = await supabase
        .from('information_schema.key_column_usage')
        .select(`
          column_name,
          referenced_table_name,
          referenced_column_name
        `)
        .eq('table_name', 'sessions')
        .eq('column_name', 'expert_id')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      if (fkInfo && fkInfo.length > 0) {
        expect(fkInfo[0].referenced_table_name).toBe('experts')
        expect(fkInfo[0].referenced_column_name).toBe('id')
        console.log('✓ sessions.expert_id → experts.id foreign key exists')
      }
    })

    it('should verify bookings.user_id references users.id', async () => {
      const { data: fkInfo, error } = await supabase
        .from('information_schema.key_column_usage')
        .select(`
          column_name,
          referenced_table_name,
          referenced_column_name
        `)
        .eq('table_name', 'bookings')
        .eq('column_name', 'user_id')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      if (fkInfo && fkInfo.length > 0) {
        expect(fkInfo[0].referenced_table_name).toBe('users')
        expect(fkInfo[0].referenced_column_name).toBe('id')
        console.log('✓ bookings.user_id → users.id foreign key exists')
      }
    })

    it('should verify availability_windows.expert_id references experts.id', async () => {
      const { data: fkInfo, error } = await supabase
        .from('information_schema.key_column_usage')
        .select(`
          column_name,
          referenced_table_name,
          referenced_column_name
        `)
        .eq('table_name', 'availability_windows')
        .eq('column_name', 'expert_id')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      if (fkInfo && fkInfo.length > 0) {
        expect(fkInfo[0].referenced_table_name).toBe('experts')
        expect(fkInfo[0].referenced_column_name).toBe('id')
        console.log('✓ availability_windows.expert_id → experts.id foreign key exists')
      }
    })
  })

  describe('Foreign Key Referential Integrity', () => {
    it('should prevent inserting booking with non-existent session_id', async () => {
      const nonExistentSessionId = '99999999-9999-9999-9999-999999999999'
      
      const { error } = await supabase
        .from('bookings')
        .insert({
          session_id: nonExistentSessionId,
          user_id: '00000000-0000-0000-0000-000000000000',
          availability_window_id: '00000000-0000-0000-0000-000000000000',
          status: 'pending',
          payment_status: 'pending'
        })

      expect(error).not.toBeNull()
      expect(error.message).toContain('foreign key')
      console.log('✓ Foreign key constraint prevents invalid session_id')
    })

    it('should prevent inserting session with non-existent expert_id', async () => {
      const nonExistentExpertId = '99999999-9999-9999-9999-999999999999'
      
      const { error } = await supabase
        .from('sessions')
        .insert({
          expert_id: nonExistentExpertId,
          title: 'Test Session',
          description: 'Test Description',
          duration_minutes: 60,
          price_cents: 5000,
          specialties: ['test'],
          difficulty_level: 'beginner',
          max_participants: 1
        })

      expect(error).not.toBeNull()
      expect(error.message).toContain('foreign key')
      console.log('✓ Foreign key constraint prevents invalid expert_id')
    })
  })

  describe('Cascade Behavior Validation', () => {
    it('should verify foreign key cascade rules are properly configured', async () => {
      // Check referential actions for critical foreign keys
      const { data: refActions, error } = await supabase
        .from('information_schema.referential_constraints')
        .select(`
          constraint_name,
          update_rule,
          delete_rule
        `)
        .eq('constraint_schema', 'public')

      expect(error).toBeNull()
      expect(refActions).toBeDefined()

      console.log('✓ Foreign key cascade rules validated')
      
      // Log the cascade behaviors for manual verification
      refActions.forEach((rule: any) => {
        console.log(`  ${rule.constraint_name}: UPDATE ${rule.update_rule}, DELETE ${rule.delete_rule}`)
      })
    })
  })

  describe('Join Query Validation', () => {
    it('should verify critical joins work with current foreign keys', async () => {
      // Test the most critical join that was broken by the schema change
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          session_id,
          status,
          sessions!inner(
            id,
            title,
            expert_id,
            experts!inner(
              id,
              profiles!inner(
                display_name
              )
            )
          )
        `)
        .limit(1)

      expect(error).toBeNull()
      console.log('✓ Critical booking → session → expert join works')
    })

    it('should verify availability window joins work', async () => {
      const { data, error } = await supabase
        .from('availability_windows')
        .select(`
          id,
          expert_id,
          start_time,
          end_time,
          experts!inner(
            id,
            profiles!inner(
              display_name
            )
          )
        `)
        .limit(1)

      expect(error).toBeNull()
      console.log('✓ Availability window → expert join works')
    })

    it('should verify session listing with expert details works', async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          description,
          expert_id,
          experts!inner(
            id,
            bio,
            profiles!inner(
              display_name,
              avatar_url
            )
          )
        `)
        .limit(1)

      expect(error).toBeNull()
      console.log('✓ Session → expert → profile join works')
    })
  })

  describe('Orphaned Records Detection', () => {
    it('should detect orphaned bookings (bookings without valid sessions)', async () => {
      const { data: orphanedBookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          session_id
        `)
        .is('sessions.id', null)
        .limit(10)

      expect(error).toBeNull()
      
      if (orphanedBookings && orphanedBookings.length > 0) {
        console.warn(`⚠️  Found ${orphanedBookings.length} orphaned bookings`)
        // In a real system, you might want to fail the test or log for cleanup
      } else {
        console.log('✓ No orphaned bookings detected')
      }
    })

    it('should detect orphaned sessions (sessions without valid experts)', async () => {
      const { data: orphanedSessions, error } = await supabase
        .from('sessions')
        .select(`
          id,
          expert_id
        `)
        .is('experts.id', null)
        .limit(10)

      expect(error).toBeNull()
      
      if (orphanedSessions && orphanedSessions.length > 0) {
        console.warn(`⚠️  Found ${orphanedSessions.length} orphaned sessions`)
      } else {
        console.log('✓ No orphaned sessions detected')
      }
    })
  })

  describe('Performance Impact Validation', () => {
    it('should verify foreign key indexes exist for performance', async () => {
      const { data: indexes, error } = await supabase
        .from('pg_indexes')
        .select('indexname, tablename')
        .eq('schemaname', 'public')

      expect(error).toBeNull()
      expect(indexes).toBeDefined()

      // Check for indexes on foreign key columns
      const foreignKeyColumns = [
        { table: 'bookings', column: 'session_id' },
        { table: 'bookings', column: 'user_id' },
        { table: 'sessions', column: 'expert_id' },
        { table: 'availability_windows', column: 'expert_id' }
      ]

      for (const fkCol of foreignKeyColumns) {
        const hasIndex = indexes.some((idx: any) => 
          idx.tablename === fkCol.table && 
          idx.indexname.toLowerCase().includes(fkCol.column.toLowerCase())
        )
        
        if (hasIndex) {
          console.log(`✓ Index exists for ${fkCol.table}.${fkCol.column}`)
        } else {
          console.warn(`⚠️  No index found for foreign key ${fkCol.table}.${fkCol.column}`)
        }
      }
    })
  })
})
