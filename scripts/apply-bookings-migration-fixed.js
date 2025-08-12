#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyBookingsMigration() {
  try {
    console.log('🔍 Checking bookings table status...');
    
    // Check if bookings table already exists
    const { data: tables, error: tablesError } = await supabase
      .from('bookings')
      .select('id')
      .limit(1);
    
    if (!tablesError) {
      console.log('✅ Bookings table already exists!');
      
      // Count existing records
      const { count, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact' });
      
      if (!countError) {
        console.log(`📊 Found ${count} existing booking records`);
      }
      
      return;
    }
    
    console.log('📄 Reading migration file...');
    const migrationPath = path.join(__dirname, 'bookings_migration_to_apply.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      console.log('Available files in scripts directory:');
      const files = fs.readdirSync(__dirname);
      console.log(files.filter(f => f.includes('booking') || f.endsWith('.sql')));
      return;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔧 Attempting to execute migration...');
    console.log('⚠️  Note: This may require manual execution in Supabase Dashboard SQL Editor');
    
    // Save instructions for manual execution
    console.log('\\n📋 MANUAL MIGRATION REQUIRED:');
    console.log('1. Go to Supabase Dashboard SQL Editor:');
    console.log(`   ${supabaseUrl.replace('.supabase.co', '')}.supabase.co/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/sql`);
    console.log('');
    console.log('2. Copy the following SQL and execute it:');
    console.log('   (Content from scripts/bookings_migration_to_apply.sql)');
    console.log('');
    console.log('3. Alternatively, copy the file content from:');
    console.log(`   ${migrationPath}`);
    
    // Try to show first few lines of the migration
    const lines = migrationSQL.split('\\n');
    console.log('\\n📝 Migration preview (first 10 lines):');
    lines.slice(0, 10).forEach((line, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}: ${line}`);
    });
    
    if (lines.length > 10) {
      console.log(`   ... and ${lines.length - 10} more lines`);
    }
    
    console.log('\\n🎯 What this migration creates:');
    console.log('   - bookings table with proper constraints');
    console.log('   - indexes for performance');
    console.log('   - RLS policies for security');
    console.log('   - validation functions and triggers');
    console.log('   - helper functions for queries');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

console.log('🚀 Bookings Migration Tool\\n');
applyBookingsMigration();