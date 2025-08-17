#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyAdminUser() {
  console.log('🔍 Verifying admin user...\n');

  // Check user_profiles table
  const { data: profiles, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, role, display_name, first_name, last_name, created_at')
    .eq('role', 'admin');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (profiles && profiles.length > 0) {
    console.log('✅ Admin users found in database:\n');
    profiles.forEach(profile => {
      console.log('   ID:', profile.id);
      console.log('   Email:', profile.email);
      console.log('   Role:', profile.role);
      console.log('   Display Name:', profile.display_name);
      console.log('   Name:', `${profile.first_name} ${profile.last_name}`);
      console.log('   Created:', new Date(profile.created_at).toLocaleString());
      console.log('   ---');
    });
  } else {
    console.log('⚠️  No admin users found in database');
  }
}

verifyAdminUser().catch(console.error);