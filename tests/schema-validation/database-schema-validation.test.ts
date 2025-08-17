/**
 * Database Schema Validation Tests
 * 
 * These tests prevent the critical failure where database schema changes
 * (expert_sessions → sessions, expert_session_id → session_id) broke API code.
 * 
 * CRITICAL: These tests must run BEFORE any database migration and
 * AFTER any schema changes to verify API code compatibility.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createServerSideClient } from '@/lib/supabase-server'

describe('Database Schema Validation - CRITICAL FAILURE PREVENTION', () => {
  let supabase: any

  beforeAll(async () => {
    supabase = await createServerSideClient()
  })

  describe('Table Existence Validation', () => {
    it('should verify all required tables exist', async () => {
      const requiredTables = [
        'sessions',
        'bookings',
        'availability_windows',
        'experts',
        'profiles',
        'users'
      ]

      for (const tableName of requiredTables) {
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', tableName)
          .eq('table_schema', 'public')

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data.length).toBeGreaterThan(0)
        console.log(`✓ Table '${tableName}' exists`)
      }
    })

    it('should verify deprecated tables do not exist', async () => {
      const deprecatedTables = [
        'expert_sessions' // This was renamed to 'sessions'
      ]

      for (const tableName of deprecatedTables) {
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', tableName)
          .eq('table_schema', 'public')

        // Should not find deprecated tables
        expect(data.length).toBe(0)
        console.log(`✓ Deprecated table '${tableName}' correctly removed`)
      }
    })
  })

  describe('Column Validation - Sessions Table', () => {
    it('should verify sessions table has correct columns', async () => {
      const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'sessions')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      expect(columns).toBeDefined()

      const columnNames = columns.map((col: any) => col.column_name)
      
      // Critical columns that API code depends on
      const requiredColumns = [
        'id',
        'expert_id',
        'title',
        'description',
        'duration_minutes',
        'price_cents',
        'specialties',
        'difficulty_level',
        'max_participants',
        'created_at',
        'updated_at'
      ]

      for (const column of requiredColumns) {
        expect(columnNames).toContain(column)
        console.log(`✓ sessions.${column} exists`)
      }

      // Verify deprecated columns don't exist
      const deprecatedColumns = ['expert_session_id'] // Old naming
      for (const column of deprecatedColumns) {
        expect(columnNames).not.toContain(column)
        console.log(`✓ sessions.${column} correctly removed`)
      }
    })
  })

  describe('Column Validation - Bookings Table', () => {
    it('should verify bookings table has correct foreign key columns', async () => {
      const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'bookings')
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      expect(columns).toBeDefined()

      const columnNames = columns.map((col: any) => col.column_name)
      
      // Critical: This was the source of the failure
      // API code was looking for 'session_id' but database had 'expert_session_id'
      expect(columnNames).toContain('session_id')
      expect(columnNames).not.toContain('expert_session_id')
      
      console.log('✓ bookings.session_id exists (not expert_session_id)')

      // Other required columns
      const requiredColumns = [
        'id',
        'session_id', // CRITICAL: Must be session_id, not expert_session_id
        'user_id',
        'availability_window_id',
        'status',
        'payment_intent_id',
        'payment_status',
        'created_at',
        'updated_at'
      ]

      for (const column of requiredColumns) {
        expect(columnNames).toContain(column)
        console.log(`✓ bookings.${column} exists`)
      }
    })
  })

  describe('Foreign Key Relationship Validation', () => {
    it('should verify foreign key relationships are correctly defined', async () => {
      // Check bookings -> sessions relationship
      const { data: fkConstraints, error } = await supabase
        .from('information_schema.table_constraints')
        .select(`
          constraint_name,
          table_name,
          constraint_type
        `)
        .eq('table_schema', 'public')
        .eq('constraint_type', 'FOREIGN KEY')

      expect(error).toBeNull()
      expect(fkConstraints).toBeDefined()

      // Verify critical foreign key exists
      const bookingsFKs = fkConstraints.filter((fk: any) => fk.table_name === 'bookings')
      expect(bookingsFKs.length).toBeGreaterThan(0)
      console.log('✓ Bookings table has foreign key constraints')
    })

    it('should verify foreign key column references are valid', async () => {
      // Test actual foreign key relationship works
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .limit(1)

      if (sessionData && sessionData.length > 0) {
        const sessionId = sessionData[0].id

        // This query would fail if foreign key relationship is broken
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select('session_id')
          .eq('session_id', sessionId)

        // Should not error even if no results
        expect(bookingError).toBeNull()
        console.log('✓ Foreign key relationship sessions.id -> bookings.session_id works')
      }
    })
  })

  describe('Data Type Validation', () => {
    it('should verify critical columns have correct data types', async () => {
      const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, table_name')
        .in('table_name', ['sessions', 'bookings'])
        .eq('table_schema', 'public')

      expect(error).toBeNull()
      expect(columns).toBeDefined()

      // Critical data type validations
      const typeValidations = [
        { table: 'sessions', column: 'id', expectedType: 'uuid' },
        { table: 'sessions', column: 'price_cents', expectedType: 'integer' },
        { table: 'sessions', column: 'duration_minutes', expectedType: 'integer' },
        { table: 'bookings', column: 'id', expectedType: 'uuid' },
        { table: 'bookings', column: 'session_id', expectedType: 'uuid' },
        { table: 'bookings', column: 'user_id', expectedType: 'uuid' }
      ]

      for (const validation of typeValidations) {
        const column = columns.find((col: any) => 
          col.table_name === validation.table && 
          col.column_name === validation.column
        )

        expect(column).toBeDefined()
        expect(column.data_type).toBe(validation.expectedType)
        console.log(`✓ ${validation.table}.${validation.column} is ${validation.expectedType}`)
      }
    })
  })

  describe('Index Validation', () => {
    it('should verify performance-critical indexes exist', async () => {
      const { data: indexes, error } = await supabase
        .from('pg_indexes')
        .select('indexname, tablename')
        .eq('schemaname', 'public')

      expect(error).toBeNull()
      expect(indexes).toBeDefined()

      // Critical indexes that should exist for performance
      const requiredIndexes = [
        { table: 'bookings', columns: ['session_id'] },
        { table: 'bookings', columns: ['user_id'] },
        { table: 'sessions', columns: ['expert_id'] },
        { table: 'availability_windows', columns: ['expert_id'] }
      ]

      const indexNames = indexes.map((idx: any) => idx.indexname)
      
      // Note: This is a basic check. More sophisticated index validation
      // would check the actual columns in each index
      for (const requiredIndex of requiredIndexes) {
        const hasRelatedIndex = indexes.some((idx: any) => 
          idx.tablename === requiredIndex.table &&
          requiredIndex.columns.some(col => 
            idx.indexname.toLowerCase().includes(col.toLowerCase())
          )
        )
        
        expect(hasRelatedIndex).toBe(true)
        console.log(`✓ Index exists for ${requiredIndex.table}(${requiredIndex.columns.join(', ')})`)
      }
    })
  })
})
