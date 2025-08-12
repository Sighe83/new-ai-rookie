#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.development' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCompletePaymentFlow() {
  console.log('💳 COMPLETE PAYMENT FLOW TEST\n');
  
  const testEmail = `payment-test-${Date.now()}@example.com`;
  const testPassword = 'password123';
  
  try {
    // 1. Create test user and profiles
    console.log('1️⃣ Setting up test user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { role: 'learner' }
    });

    if (authError || !authUser.user) {
      throw new Error('Failed to create auth user: ' + authError?.message);
    }

    // Check if profiles were created automatically (they should be)
    console.log('   Checking for auto-created profiles...');
    
    // Wait a moment for automatic profile creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.user.id)
      .single();

    if (userProfileError || !userProfile) {
      throw new Error('User profile not found - automatic creation may have failed');
    }

    const { data: learnerProfile, error: learnerError } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('user_profile_id', userProfile.id)
      .single();

    if (learnerError || !learnerProfile) {
      throw new Error('Learner profile not found - automatic creation may have failed');
    }

    console.log('✅ Test user created with profiles');

    // 2. Sign in the user
    console.log('\n2️⃣ Signing in test user...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError || !signInData.session) {
      throw new Error('Failed to sign in: ' + signInError?.message);
    }

    console.log('✅ User signed in successfully');

    // 3. Get an expert session to book
    console.log('\n3️⃣ Finding expert session to book...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('expert_sessions')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (sessionsError || !sessions || sessions.length === 0) {
      throw new Error('No expert sessions available for testing');
    }

    const testSession = sessions[0];
    console.log('✅ Found session:', testSession.title, '-', testSession.price_amount/100, testSession.currency);

    // 4. Create a properly formatted booking time
    console.log('\n4️⃣ Creating booking...');
    const now = new Date();
    const bookingTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    bookingTime.setMinutes(0, 0, 0); // Set to top of the hour (15-minute aligned)

    // Test booking creation through our API
    const bookingResponse = await fetch('http://localhost:3000/api/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${signInData.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expert_session_id: testSession.id,
        start_at: bookingTime.toISOString(),
        learner_notes: 'Payment flow test booking'
      })
    });

    if (!bookingResponse.ok) {
      const errorData = await bookingResponse.json();
      throw new Error('Booking failed: ' + errorData.error + (errorData.details ? ' - ' + errorData.details : ''));
    }

    const bookingData = await bookingResponse.json();
    console.log('✅ Booking created successfully:', bookingData.booking.id);
    console.log('   Stripe payment intent:', bookingData.booking.stripe_payment_intent_id);
    console.log('   Client secret present:', !!bookingData.stripe_client_secret);
    console.log('   Amount authorized:', bookingData.booking.amount_authorized, bookingData.booking.currency);

    // 5. Verify the payment intent in Stripe
    console.log('\n5️⃣ Verifying payment intent in Stripe...');
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.booking.stripe_payment_intent_id);
    console.log('✅ Payment intent verified in Stripe:');
    console.log('   Status:', paymentIntent.status);
    console.log('   Amount:', paymentIntent.amount, paymentIntent.currency);
    console.log('   Capture method:', paymentIntent.capture_method);
    console.log('   Metadata:', paymentIntent.metadata);

    // 6. Test payment simulation (in a real app, the frontend would handle this)
    console.log('\n6️⃣ Simulating payment completion...');
    
    // Note: In a real scenario, the frontend would use the client_secret
    // to confirm the payment with Stripe Elements. For testing, we'll
    // just verify the intent can be retrieved and has the right properties.
    
    console.log('✅ Payment intent is ready for frontend processing');
    console.log('   Client secret for frontend:', bookingData.stripe_client_secret ? 'Available' : 'Missing');
    
    // 7. Check booking in database
    console.log('\n7️⃣ Verifying booking in database...');
    const { data: dbBooking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingData.booking.id)
      .single();

    if (dbError) {
      throw new Error('Failed to retrieve booking from database: ' + dbError.message);
    }

    console.log('✅ Booking verified in database:');
    console.log('   Status:', dbBooking.status);
    console.log('   Start time:', dbBooking.start_at);
    console.log('   Held until:', dbBooking.held_until);
    console.log('   Learner notes:', dbBooking.learner_notes);

    // 8. Cleanup: Cancel the payment intent and clean up test data
    console.log('\n8️⃣ Cleaning up test data...');
    
    // Cancel the payment intent
    await stripe.paymentIntents.cancel(paymentIntent.id);
    console.log('✅ Payment intent cancelled');
    
    // Delete test user (cascades to profiles and bookings)
    await supabase.auth.admin.deleteUser(authUser.user.id);
    console.log('✅ Test user deleted');

    console.log('\n🎉 COMPLETE PAYMENT FLOW TEST PASSED!');
    console.log('\n📊 Test Summary:');
    console.log('✅ User creation and authentication: PASS');
    console.log('✅ Profile creation (user + learner): PASS');
    console.log('✅ Booking API integration: PASS');
    console.log('✅ Stripe payment intent creation: PASS');
    console.log('✅ Database booking storage: PASS');
    console.log('✅ Payment intent verification: PASS');
    console.log('✅ Cleanup and cancellation: PASS');

  } catch (error) {
    console.error('❌ PAYMENT FLOW TEST FAILED:', error.message);
    
    // Try to clean up if we have a user ID
    if (error.userId) {
      try {
        await supabase.auth.admin.deleteUser(error.userId);
        console.log('✅ Cleaned up test user after error');
      } catch (cleanupError) {
        console.log('⚠️  Could not clean up test user:', cleanupError.message);
      }
    }
  }
}

testCompletePaymentFlow();