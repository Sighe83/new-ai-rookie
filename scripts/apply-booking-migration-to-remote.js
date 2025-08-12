#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Remote (Dev) database configuration  
const remoteUrl = 'https://ogohsocipjwhohoiiilk.supabase.co';
const remoteServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI';

const remoteSupabase = createClient(remoteUrl, remoteServiceRoleKey);

// Use the service role to execute direct SQL
async function executeSQL(sql) {
  try {
    // Split into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          // Execute via direct SQL using postgres connection
          const { data, error } = await remoteSupabase
            .from('_sql_execution_temp')
            .select('1')
            .limit(0); // This will fail but we can try direct queries
          
          console.log(`Statement ${i + 1}: Would execute: ${statement.substring(0, 50)}...`);
        } catch (err) {
          console.log(`Statement ${i + 1}: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.error('SQL execution error:', error.message);
  }
}

async function checkAndApplyMigration() {
  try {
    console.log('🔍 Checking bookings table in remote database...');
    
    // Try to query the bookings table
    const { data, error } = await remoteSupabase
      .from('bookings')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Bookings table missing or inaccessible');
      console.log('Error:', error.message);
      
      console.log('\n📄 Reading migration file...');
      const migrationPath = path.join(__dirname, '../supabase/migrations/004_bookings.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log('\n⚠️  Cannot execute SQL directly via API.');
      console.log('🔧 MANUAL ACTION REQUIRED:');
      console.log('1. Go to: https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql');
      console.log('2. Copy the entire content of: supabase/migrations/004_bookings.sql');
      console.log('3. Paste and execute it in the SQL Editor');
      
      // Save migration content to a temporary file for easy copying
      const tempFile = path.join(__dirname, 'migration_to_apply.sql');
      fs.writeFileSync(tempFile, migrationSQL);
      console.log(`4. Or copy from: ${tempFile}`);
      
    } else {
      console.log('✅ Bookings table exists and is accessible');
      console.log('No migration needed');
    }
    
  } catch (error) {
    console.error('❌ Error checking migration status:', error.message);
  }
}

checkAndApplyMigration();