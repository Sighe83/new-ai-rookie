#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Dev database configuration
const devUrl = 'https://ogohsocipjwhohoiiilk.supabase.co';
const devServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI';

const devSupabase = createClient(devUrl, devServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyBookingsMigration() {
  try {
    console.log('📄 Reading bookings migration...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/004_bookings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Applying migration to dev database...');
    console.log('Target:', devUrl);
    
    // Check if bookings table already exists
    const { data: tables, error: tablesError } = await devSupabase
      .from('bookings')
      .select('id')
      .limit(1);
    
    if (!tablesError) {
      console.log('✅ Bookings table already exists in dev database');
      return;
    }
    
    // Split migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`   Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          // Use RPC to execute raw SQL
          const { error } = await devSupabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
          if (error) {
            console.log(`   ⚠️  Statement ${i + 1}: ${error.message}`);
          } else {
            console.log(`   ✅ Statement ${i + 1} executed`);
          }
        } catch (err) {
          console.log(`   ❌ Statement ${i + 1} failed: ${err.message}`);
        }
      }
    }
    
    console.log('🎉 Migration application completed!');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📝 Manual steps needed:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql');
    console.log('2. Copy contents of: supabase/migrations/004_bookings.sql');
    console.log('3. Paste and execute in SQL Editor');
  }
}

applyBookingsMigration();