#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Remote dev database configuration
const remoteUrl = 'https://ogohsocipjwhohoiiilk.supabase.co';
const remoteServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI';

const remoteSupabase = createClient(remoteUrl, remoteServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkBookingsTable() {
  console.log('🔍 Checking bookings table status...');
  
  try {
    const { data, error } = await remoteSupabase
      .from('bookings')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Bookings table missing:', error.message);
      return false;
    } else {
      console.log('✅ Bookings table exists');
      return true;
    }
  } catch (err) {
    console.log('❌ Error checking bookings table:', err.message);
    return false;
  }
}

async function prepareMigrationInstructions() {
  console.log('📄 Reading migration file...');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/004_bookings.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Save to a temporary file for easy copying
  const tempFile = path.join(__dirname, 'bookings_migration_to_apply.sql');
  fs.writeFileSync(tempFile, migrationSQL);
  
  console.log('\n📋 MANUAL MIGRATION INSTRUCTIONS:');
  console.log('1. Open Supabase Dashboard SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql');
  console.log('');
  console.log('2. Copy the migration content from:');
  console.log(`   ${tempFile}`);
  console.log('   OR from: supabase/migrations/004_bookings.sql');
  console.log('');
  console.log('3. Paste the entire content into the SQL Editor');
  console.log('4. Click "Run" to execute the migration');
  console.log('5. Run this script again to verify the migration was successful');
  
  console.log('\n📊 Migration Statistics:');
  const lines = migrationSQL.split('\n').length;
  const statements = migrationSQL.split(';').filter(s => s.trim() && !s.trim().startsWith('--')).length;
  console.log(`   - Total lines: ${lines}`);
  console.log(`   - SQL statements: ${statements}`);
  console.log(`   - Creates: bookings table, indexes, RLS policies, triggers, functions`);
}

async function main() {
  const tableExists = await checkBookingsTable();
  
  if (tableExists) {
    console.log('✅ Migration already applied! No action needed.');
    
    // Verify we can query the table
    try {
      const { count, error } = await remoteSupabase
        .from('bookings')
        .select('*', { count: 'exact' });
      
      if (!error) {
        console.log(`📊 Bookings table has ${count} records`);
      }
    } catch (err) {
      console.log('⚠️  Table exists but could not count records');
    }
    
  } else {
    await prepareMigrationInstructions();
  }
}

main().catch(console.error);