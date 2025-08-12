#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Remote (Dev) database configuration
const remoteUrl = 'https://ogohsocipjwhohoiiilk.supabase.co';
const remoteAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYyNDAsImV4cCI6MjA3MDUxMjI0MH0.wWyDyTqlM06ZJbmSHlvHOcec7cwM_DOdKeCRTUgy7iQ';
const remoteServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI';

// Local database configuration
const localUrl = 'http://127.0.0.1:54321';
const localServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Create clients
const remoteSupabase = createClient(remoteUrl, remoteServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const localSupabase = createClient(localUrl, localServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Tables to sync (in dependency order)
const tablesToSync = [
  'user_profiles',
  'expert_profiles', 
  'learner_profiles',
  'expert_sessions',
  'availability_windows',
  'bookings'
];

async function syncTable(tableName) {
  try {
    console.log(`\n📄 Syncing ${tableName}...`);
    
    // Fetch data from remote
    const { data: remoteData, error: fetchError } = await remoteSupabase
      .from(tableName)
      .select('*');
    
    if (fetchError) {
      console.log(`⚠️  Could not fetch ${tableName}: ${fetchError.message}`);
      return;
    }
    
    if (!remoteData || remoteData.length === 0) {
      console.log(`   No data in ${tableName}`);
      return;
    }
    
    console.log(`   Found ${remoteData.length} records`);
    
    // Clear local table first
    const { error: deleteError } = await localSupabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.log(`   Clear error (might be expected): ${deleteError.message}`);
    }
    
    // Insert data into local (in batches of 100)
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < remoteData.length; i += batchSize) {
      const batch = remoteData.slice(i, i + batchSize);
      
      const { error: insertError } = await localSupabase
        .from(tableName)
        .insert(batch);
      
      if (insertError) {
        console.log(`   Insert error for batch ${i}-${i + batch.length}: ${insertError.message}`);
      } else {
        inserted += batch.length;
      }
    }
    
    console.log(`✅ ${tableName}: ${inserted} records synced`);
    
  } catch (error) {
    console.log(`❌ Error syncing ${tableName}: ${error.message}`);
  }
}

async function syncAllData() {
  console.log('🔄 Starting data sync from dev database to local...\n');
  console.log(`From: ${remoteUrl}`);
  console.log(`To:   ${localUrl}`);
  
  for (const table of tablesToSync) {
    await syncTable(table);
  }
  
  console.log('\n🎉 Data sync completed!');
}

// Run the sync
syncAllData().catch(console.error);