#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Remote (Dev) database configuration
const remoteUrl = 'https://ogohsocipjwhohoiiilk.supabase.co';
const remoteServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI';

const remoteSupabase = createClient(remoteUrl, remoteServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function analyzeRemoteDatabase() {
  console.log('🔍 Analyzing Remote Dev Database');
  console.log(`URL: ${remoteUrl}\n`);

  const tables = [
    'user_profiles',
    'expert_profiles', 
    'learner_profiles',
    'expert_sessions',
    'availability_windows',
    'bookings'
  ];

  console.log('📊 Table Record Counts:');
  for (const table of tables) {
    try {
      const { data, error, count } = await remoteSupabase
        .from(table)
        .select('*', { count: 'exact' });
      
      if (error) {
        console.log(`   ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`   ${table}: ${count || data?.length || 0} records`);
      }
    } catch (err) {
      console.log(`   ${table}: ERROR - ${err.message}`);
    }
  }

  console.log('\n🔍 Sample Data:');
  
  // Check for existing users
  try {
    const { data: users } = await remoteSupabase
      .from('user_profiles')
      .select('email, role')
      .limit(5);
    
    if (users && users.length > 0) {
      console.log('   👤 Users:');
      users.forEach(user => {
        console.log(`      ${user.email} (${user.role})`);
      });
    }
  } catch (err) {
    console.log('   👤 Users: Could not fetch');
  }

  // Check for expert sessions
  try {
    const { data: sessions } = await remoteSupabase
      .from('expert_sessions')
      .select('title, level, price_amount, currency')
      .limit(3);
    
    if (sessions && sessions.length > 0) {
      console.log('   📚 Expert Sessions:');
      sessions.forEach(session => {
        const price = session.price_amount ? `${session.price_amount/100} ${session.currency}` : 'No price';
        console.log(`      "${session.title}" (${session.level}) - ${price}`);
      });
    }
  } catch (err) {
    console.log('   📚 Expert Sessions: Could not fetch');
  }

  // Check bookings table exists
  try {
    const { count } = await remoteSupabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .limit(1);
    
    console.log(`   📅 Bookings table: EXISTS (${count} records)`);
  } catch (err) {
    console.log(`   📅 Bookings table: MISSING - ${err.message}`);
  }

  // Check auth users
  try {
    const { data: authUsers } = await remoteSupabase.auth.admin.listUsers();
    console.log(`   🔐 Auth Users: ${authUsers.users.length} users`);
    
    if (authUsers.users.length > 0) {
      authUsers.users.slice(0, 3).forEach(user => {
        console.log(`      ${user.email} (${user.user_metadata?.role || 'no role'})`);
      });
    }
  } catch (err) {
    console.log(`   🔐 Auth Users: Could not fetch - ${err.message}`);
  }
}

analyzeRemoteDatabase().catch(console.error);