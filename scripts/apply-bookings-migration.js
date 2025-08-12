#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/004_bookings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying bookings migration...');
    
    // Check if bookings table already exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'bookings');
    
    if (tablesError) {
      console.error('Error checking for existing table:', tablesError);
      return;
    }
    
    if (tables && tables.length > 0) {
      console.log('✅ Bookings table already exists');
      return;
    }
    
    // Apply the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query (this might fail due to RLS)
      console.log('exec_sql function not found, trying direct execution...');
      const { error: directError } = await supabase.from('_temp').select('1');
      console.error('Cannot execute migration directly. Please apply the migration manually through Supabase Dashboard.');
      console.log('\nTo apply manually:');
      console.log('1. Go to https://supabase.com/dashboard/project/[your-project]/sql');
      console.log('2. Copy the contents of supabase/migrations/004_bookings.sql');
      console.log('3. Paste and execute the SQL');
      return;
    }
    
    console.log('✅ Migration applied successfully');
    
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.log('\nTo apply manually:');
    console.log('1. Go to https://supabase.com/dashboard/project/[your-project]/sql');
    console.log('2. Copy the contents of supabase/migrations/004_bookings.sql');
    console.log('3. Paste and execute the SQL');
  }
}

applyMigration();