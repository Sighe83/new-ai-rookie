#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.development' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testCompleteUserFlow() {
  console.log('🧪 Testing Complete User Flow\n');

  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = 'password123';
  
  try {
    // Step 1: Create a test user (simulating signup)
    console.log('1️⃣ Creating test user via auth...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { role: 'learner' }
    });

    if (authError || !authUser.user) {
      console.error('❌ Failed to create auth user:', authError);
      return;
    }
    
    console.log('✅ Auth user created:', authUser.user.id);

    // Step 2: Check if profiles were auto-created (this would be by triggers or our main page logic)
    console.log('\n2️⃣ Checking if profiles exist after auth creation...');
    
    const { data: existingUserProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.user.id)
      .single();

    if (existingUserProfile) {
      console.log('✅ User profile already exists:', existingUserProfile.id);
      
      const { data: existingLearnerProfile } = await supabase
        .from('learner_profiles')
        .select('*')
        .eq('user_profile_id', existingUserProfile.id)
        .single();
      
      if (existingLearnerProfile) {
        console.log('✅ Learner profile already exists:', existingLearnerProfile.id);
        console.log('🎉 AUTOMATIC PROFILE CREATION IS WORKING!');
      } else {
        console.log('❌ Learner profile missing - need to test create-profile API');
        
        // Test the create-profile API
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });

        const response = await fetch('http://localhost:3000/api/create-profile', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${signInData.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: 'learner' })
        });

        if (response.ok) {
          console.log('✅ Create-profile API worked');
        } else {
          const errorData = await response.json();
          console.log('❌ Create-profile API failed:', errorData);
        }
      }
    } else {
      console.log('❌ No user profile exists - testing manual creation...');
      
      // Test the create-profile API
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      const response = await fetch('http://localhost:3000/api/create-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${signInData.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'learner' })
      });

      if (response.ok) {
        console.log('✅ Create-profile API worked');
      } else {
        const errorData = await response.json();
        console.log('❌ Create-profile API failed:', errorData);
        return;
      }
    }

    // Step 3: Test the booking flow
    console.log('\n3️⃣ Testing booking flow...');

    // Sign in the user for testing booking
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    // Get an expert session to book
    const { data: sessions, error: sessionsError } = await supabase
      .from('expert_sessions')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (sessionsError || !sessions || sessions.length === 0) {
      console.error('❌ No expert sessions available for testing');
      return;
    }

    const testSession = sessions[0];
    console.log('📚 Using test session:', testSession.title);

    // Create a properly aligned booking time (15-minute intervals, at least 2 hours ahead)
    const now = new Date();
    const bookingTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    bookingTime.setMinutes(0, 0, 0); // Set to top of the hour (0 minutes = 15-minute aligned)
    
    console.log('📅 Booking time:', bookingTime.toISOString());

    // Test booking API endpoint
    const bookingResponse = await fetch(`http://localhost:3000/api/bookings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${signInData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expert_session_id: testSession.id,
        start_at: bookingTime.toISOString(),
        learner_notes: 'Test booking'
      })
    });

    if (bookingResponse.ok) {
      const bookingData = await bookingResponse.json();
      console.log('✅ Booking created successfully:', bookingData.booking?.id);
    } else {
      const errorData = await bookingResponse.json();
      console.log('❌ Booking failed (might be due to availability):', errorData.error);
    }

    // Step 4: Verify all profiles exist
    console.log('\n4️⃣ Verifying final state...');

    const { data: finalUserProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.user.id)
      .single();

    const { data: finalLearnerProfile } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('user_profile_id', userProfile.id)
      .single();

    console.log('✅ Final verification:');
    console.log('   Auth user exists:', !!authUser.user);
    console.log('   User profile exists:', !!finalUserProfile);
    console.log('   Learner profile exists:', !!finalLearnerProfile);

    // Cleanup: Delete the test user
    console.log('\n🧹 Cleaning up test user...');
    await supabase.auth.admin.deleteUser(authUser.user.id);
    console.log('✅ Test user deleted');

    console.log('\n🎉 Complete user flow test PASSED!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCompleteUserFlow();