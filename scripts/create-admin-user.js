#!/usr/bin/env node

/**
 * Script to create an admin user in Supabase
 * Usage: node scripts/create-admin-user.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  console.log('🔧 Creating admin user...\n');

  // Admin user credentials
  const adminEmail = 'admin@airookie.com';
  const adminPassword = 'AdminPass123!';
  
  try {
    // Step 1: Create the user in Supabase Auth
    console.log('1️⃣ Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'admin',
        first_name: 'Admin',
        last_name: 'User'
      }
    });

    if (authError) {
      // Check if user already exists
      if (authError.message?.includes('already been registered')) {
        console.log('⚠️  User already exists in Auth. Retrieving user...');
        
        // Get existing user
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.find(u => u.email === adminEmail);
        if (!existingUser) throw new Error('Could not find existing user');
        
        console.log('✅ Found existing auth user:', existingUser.id);
        
        // Update the user profile to admin role
        await updateUserProfile(existingUser.id);
      } else {
        throw authError;
      }
    } else {
      console.log('✅ User created in Auth:', authData.user.id);
      
      // Step 2: Wait for trigger to create profile, then update it
      console.log('2️⃣ Waiting for profile creation trigger...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await updateUserProfile(authData.user.id);
    }

    // Step 3: Display login credentials
    console.log('\n' + '='.repeat(50));
    console.log('🎉 ADMIN USER CREATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\n📧 Email:    ', adminEmail);
    console.log('🔑 Password: ', adminPassword);
    console.log('\n💡 Login at: ', `${supabaseUrl.replace('.supabase.co', '.supabase.co').replace('https://', 'http://localhost:3000/')}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

async function updateUserProfile(userId) {
  console.log('3️⃣ Updating user profile to admin role...');
  
  // Update the user profile to have admin role
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      role: 'admin',
      first_name: 'Admin',
      last_name: 'User',
      display_name: 'Administrator',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (profileError) {
    // If profile doesn't exist, create it
    if (profileError.code === 'PGRST116') {
      console.log('   Profile not found, creating new profile...');
      
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: userId,
          email: 'admin@airookie.com',
          role: 'admin',
          first_name: 'Admin',
          last_name: 'User',
          display_name: 'Administrator',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      console.log('✅ Admin profile created:', newProfile.id);
    } else {
      throw profileError;
    }
  } else {
    console.log('✅ Profile updated to admin role:', profileData.id);
  }
}

// Run the script
createAdminUser().catch(console.error);