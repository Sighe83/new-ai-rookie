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

async function executeSQL(sql) {
  try {
    // Use the SQL editor endpoint directly via REST API
    const response = await fetch(`${remoteUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${remoteServiceRoleKey}`,
        'apikey': remoteServiceRoleKey
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('SQL execution error:', error.message);
    throw error;
  }
}

async function applyMigration() {
  try {
    console.log('📄 Reading bookings migration...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/004_bookings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔍 Checking if bookings table already exists...');
    
    // Check if table exists first
    try {
      const { data, error } = await remoteSupabase
        .from('bookings')
        .select('id')
        .limit(1);
      
      if (!error) {
        console.log('✅ Bookings table already exists in remote database');
        return;
      }
    } catch (e) {
      console.log('   Bookings table does not exist, proceeding with migration...');
    }
    
    console.log('🔄 Applying migration to remote database...');
    console.log(`Target: ${remoteUrl}`);
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        // Try to execute using the service role client
        const { data, error } = await remoteSupabase.rpc('exec_sql', {
          query: statement + ';'
        });
        
        if (error) {
          console.log(`   ⚠️  Statement ${i + 1}: ${error.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.log(`   ❌ Statement ${i + 1} failed: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Migration execution completed!`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. This might be expected for CREATE OR REPLACE statements.');
    }
    
    // Verify the table was created
    try {
      const { data, error } = await remoteSupabase
        .from('bookings')
        .select('count')
        .limit(1);
      
      if (!error) {
        console.log('\n✅ Bookings table verification: SUCCESS');
      } else {
        console.log('\n❌ Bookings table verification: FAILED');
      }
    } catch (e) {
      console.log('\n❌ Could not verify bookings table creation');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📝 Manual steps needed:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ogohsocipjwhohoiiilk/sql');
    console.log('2. Copy contents of: supabase/migrations/004_bookings.sql');
    console.log('3. Paste and execute in SQL Editor');
  }
}

applyMigration();