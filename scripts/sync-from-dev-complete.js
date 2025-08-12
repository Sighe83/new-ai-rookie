#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Remote (Dev) database configuration
const remoteUrl = 'https://ogohsocipjwhohoiiilk.supabase.co';
const remoteServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI';

// Local database configuration
const localUrl = 'http://127.0.0.1:54321';
const localServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Create clients
const remoteSupabase = createClient(remoteUrl, remoteServiceRoleKey);
const localSupabase = createClient(localUrl, localServiceRoleKey);

async function syncAuthUsers() {
  console.log('👤 Syncing auth users...');
  
  try {
    // Get all users from remote
    const { data: remoteUsers, error } = await remoteSupabase.auth.admin.listUsers();
    
    if (error) {
      console.log(`   ⚠️  Could not fetch users: ${error.message}`);
      return [];
    }
    
    console.log(`   Found ${remoteUsers.users.length} users in remote`);
    
    // Create users in local
    const createdUsers = [];
    for (const user of remoteUsers.users) {
      try {
        const { data: localUser, error: createError } = await localSupabase.auth.admin.createUser({
          email: user.email,
          password: 'password123', // Default password for local development
          email_confirm: true,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata
        });
        
        if (createError) {
          console.log(`   ⚠️  User ${user.email}: ${createError.message}`);
        } else {
          console.log(`   ✅ Created user: ${user.email}`);
          createdUsers.push({ remote: user, local: localUser.user });
        }
      } catch (err) {
        console.log(`   ⚠️  User ${user.email}: ${err.message}`);
      }
    }
    
    return createdUsers;
    
  } catch (error) {
    console.log(`   ❌ Auth sync error: ${error.message}`);
    return [];
  }
}

async function syncTable(tableName, userMappings = []) {
  try {
    console.log(`\n📄 Syncing ${tableName}...`);
    
    // Fetch data from remote
    const { data: remoteData, error: fetchError } = await remoteSupabase
      .from(tableName)
      .select('*');
    
    if (fetchError) {
      console.log(`   ⚠️  Could not fetch ${tableName}: ${fetchError.message}`);
      return;
    }
    
    if (!remoteData || remoteData.length === 0) {
      console.log(`   No data in ${tableName}`);
      return;
    }
    
    console.log(`   Found ${remoteData.length} records`);
    
    // Clear local table first (disable foreign key checks if needed)
    const { error: deleteError } = await localSupabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.log(`   Clear error (might be expected): ${deleteError.message}`);
    }
    
    // Transform data if needed (for user_id mappings)
    let dataToInsert = remoteData;
    if (tableName === 'user_profiles' && userMappings.length > 0) {
      dataToInsert = remoteData.map(record => {
        const mapping = userMappings.find(m => m.remote.id === record.user_id);
        if (mapping) {
          return { ...record, user_id: mapping.local.id };
        }
        return record;
      });
    }
    
    // Insert data into local (in batches of 100)
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < dataToInsert.length; i += batchSize) {
      const batch = dataToInsert.slice(i, i + batchSize);
      
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

async function fullSync() {
  console.log('🔄 Starting complete sync from dev to local...\n');
  console.log(`From: ${remoteUrl}`);
  console.log(`To:   ${localUrl}\n`);
  
  // Step 1: Sync auth users and get mappings
  const userMappings = await syncAuthUsers();
  
  // Step 2: Sync tables in dependency order
  const tablesToSync = [
    'user_profiles',
    'expert_profiles', 
    'learner_profiles',
    'expert_sessions',
    'availability_windows',
    'bookings'
  ];
  
  for (const table of tablesToSync) {
    await syncTable(table, userMappings);
  }
  
  console.log('\n🎉 Complete sync finished!');
  console.log('\n🔑 Test accounts (password: password123):');
  userMappings.forEach(mapping => {
    if (mapping.remote.email) {
      console.log(`   ${mapping.remote.email}`);
    }
  });
}

// Run the sync
fullSync().catch(console.error);