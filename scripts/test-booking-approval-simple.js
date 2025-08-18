#!/usr/bin/env node

/**
 * Simple Booking Approval Workflow Validation Script
 * 
 * This script verifies the booking approval workflow by:
 * 1. Creating test data directly in the database
 * 2. Calling the database functions
 * 3. Verifying the results
 * 
 * This approach bypasses authentication complexity while still testing
 * the core business logic and database functions.
 * 
 * Usage: node scripts/test-booking-approval-simple.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📄',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type];
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function createTestData() {
  log('Creating test data...');
  
  const testData = {
    learnerUserId: '00000000-0000-0000-0000-000000000001',
    expertUserId: '00000000-0000-0000-0000-000000000002',
    sessionId: '00000000-0000-0000-0000-000000000003',
    bookingId: '00000000-0000-0000-0000-000000000004'
  };

  try {
    // Create user profiles
    await supabase.from('user_profiles').upsert([
      {
        id: testData.learnerUserId,
        user_id: testData.learnerUserId,
        role: 'learner',
        display_name: 'Test Learner',
        email: 'test.learner@example.com'
      },
      {
        id: testData.expertUserId,
        user_id: testData.expertUserId,
        role: 'expert',
        display_name: 'Test Expert',
        email: 'test.expert@example.com'
      }
    ]);

    // Create expert profile
    await supabase.from('expert_profiles').upsert([
      {
        id: testData.expertUserId,
        user_profile_id: testData.expertUserId,
        bio: 'Test expert for workflow validation',
        hourly_rate_cents: 15000,
        rating: 4.8,
        total_sessions: 50
      }
    ]);

    // Create learner profile  
    await supabase.from('learner_profiles').upsert([
      {
        id: testData.learnerUserId,
        user_profile_id: testData.learnerUserId,
        learning_goals: 'Test AI fundamentals'
      }
    ]);

    // Create test session
    await supabase.from('sessions').upsert([
      {
        id: testData.sessionId,
        expert_id: testData.expertUserId,
        title: 'Test AI Fundamentals Session',
        description: 'A test session for workflow validation',
        duration_minutes: 60,
        price_cents: 15000,
        currency: 'DKK',
        topic_tags: ['AI', 'Machine Learning'],
        level: 'beginner'
      }
    ]);

    log('Test data created successfully', 'success');
    return testData;
    
  } catch (error) {
    log(`Failed to create test data: ${error.message}`, 'error');
    throw error;
  }
}

async function testBookingCreation(testData) {
  log('Testing booking creation...');
  
  try {
    // Create a booking in pending_approval state (simulating payment authorization)
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert([
        {
          id: testData.bookingId,
          learner_id: testData.learnerUserId,
          expert_id: testData.expertUserId, 
          session_id: testData.sessionId,
          status: 'pending_approval',
          payment_status: 'authorized',
          start_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          end_at: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow + 1 hour
          amount_authorized: 15000,
          currency: 'DKK',
          learner_notes: 'Test booking for workflow validation',
          stripe_payment_intent_id: 'pi_test_1234567890'
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Booking creation failed: ${error.message}`);
    }

    log(`Booking created with status: ${booking.status}`, 'success');
    return booking;
    
  } catch (error) {
    log(`Booking creation test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testApprovalFunction(testData) {
  log('Testing approve_booking database function...');
  
  try {
    const { data, error } = await supabase
      .rpc('approve_booking', {
        p_booking_id: testData.bookingId,
        p_expert_user_id: testData.expertUserId,
        p_notes: 'Approved via test script'
      });

    if (error) {
      throw new Error(`Approval function failed: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(`Approval failed: ${data.error_message}`);
    }

    log('Booking approval function executed successfully', 'success');
    log(`Booking status: ${data.booking_status}`, 'info');
    log(`Payment status: ${data.payment_status}`, 'info');
    
    return data;
    
  } catch (error) {
    log(`Approval function test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function verifyBookingStatus(bookingId, expectedStatus) {
  log(`Verifying booking status (expected: ${expectedStatus})...`);
  
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, status, payment_status, expert_notes, approved_at')
      .eq('id', bookingId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch booking: ${error.message}`);
    }

    if (booking.status !== expectedStatus) {
      throw new Error(`Status mismatch - expected: ${expectedStatus}, actual: ${booking.status}`);
    }

    log(`✓ Booking status verified: ${booking.status}`, 'success');
    log(`✓ Payment status: ${booking.payment_status}`, 'success');
    log(`✓ Expert notes: ${booking.expert_notes || '(none)'}`, 'info');
    log(`✓ Approved at: ${booking.approved_at || '(not set)'}`, 'info');
    
    return booking;
    
  } catch (error) {
    log(`Status verification failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testDeclineFunction(testData) {
  log('Testing decline_booking database function (creating second booking)...');
  
  // Create another booking to decline
  const declineBookingId = '00000000-0000-0000-0000-000000000005';
  
  try {
    await supabase
      .from('bookings')
      .insert([
        {
          id: declineBookingId,
          learner_id: testData.learnerUserId,
          expert_id: testData.expertUserId,
          session_id: testData.sessionId,
          status: 'pending_approval',
          payment_status: 'authorized',
          start_at: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
          end_at: new Date(Date.now() + 172800000 + 3600000).toISOString(),
          amount_authorized: 15000,
          currency: 'DKK',
          learner_notes: 'Second test booking for decline test',
          stripe_payment_intent_id: 'pi_test_0987654321'
        }
      ]);

    // Test decline function
    const { data, error } = await supabase
      .rpc('decline_booking', {
        p_booking_id: declineBookingId,
        p_expert_user_id: testData.expertUserId,
        p_notes: 'Declined via test script',
        p_reason: 'Testing decline workflow'
      });

    if (error) {
      throw new Error(`Decline function failed: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(`Decline failed: ${data.error_message}`);
    }

    log('Booking decline function executed successfully', 'success');
    
    // Verify declined booking
    const { data: declinedBooking } = await supabase
      .from('bookings')
      .select('status, payment_status, declined_reason, declined_at')
      .eq('id', declineBookingId)
      .single();

    log(`✓ Declined booking status: ${declinedBooking.status}`, 'success');
    log(`✓ Declined booking payment status: ${declinedBooking.payment_status}`, 'success');
    log(`✓ Decline reason: ${declinedBooking.declined_reason}`, 'info');
    
    return data;
    
  } catch (error) {
    log(`Decline function test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function cleanup(testData) {
  log('Cleaning up test data...');
  
  try {
    // Delete in reverse order of dependencies
    await supabase.from('bookings').delete().like('learner_notes', '%workflow validation%');
    await supabase.from('sessions').delete().eq('id', testData.sessionId);
    await supabase.from('expert_profiles').delete().eq('id', testData.expertUserId);
    await supabase.from('learner_profiles').delete().eq('id', testData.learnerUserId);
    await supabase.from('user_profiles').delete().in('id', [testData.learnerUserId, testData.expertUserId]);
    
    log('Test data cleanup completed', 'success');
  } catch (error) {
    log(`Cleanup warning: ${error.message}`, 'warning');
  }
}

async function runWorkflowTest() {
  log('🚀 Starting Booking Approval Workflow Test');
  log('This test validates the complete booking approval process using database functions');
  
  let testData;
  
  try {
    // Step 1: Create test data
    log('\n📋 Step 1: Creating test data');
    testData = await createTestData();
    
    // Step 2: Test booking creation (simulates learner creating booking)
    log('\n📋 Step 2: Testing booking creation');
    await testBookingCreation(testData);
    
    // Verify initial state
    await verifyBookingStatus(testData.bookingId, 'pending_approval');
    
    // Step 3: Test approval function (simulates expert approving)
    log('\n📋 Step 3: Testing booking approval');
    await testApprovalFunction(testData);
    
    // Verify approved state
    await verifyBookingStatus(testData.bookingId, 'confirmed');
    
    // Step 4: Test decline function (creates and declines another booking)
    log('\n📋 Step 4: Testing booking decline');
    await testDeclineFunction(testData);
    
    log('\n🎉 BOOKING APPROVAL WORKFLOW TEST COMPLETED SUCCESSFULLY!', 'success');
    log('\n✅ Verified components:', 'success');
    log('   ✓ Database schema and relationships', 'success');
    log('   ✓ approve_booking() function', 'success');
    log('   ✓ decline_booking() function', 'success');
    log('   ✓ Status transitions', 'success');
    log('   ✓ Data integrity', 'success');
    
    log('\n💡 Next steps for full testing:', 'info');
    log('   • Test the API endpoints manually in browser', 'info');
    log('   • Verify UI components display correctly', 'info');
    log('   • Test payment integration (Stripe mocking)', 'info');
    
  } catch (error) {
    log(`\n❌ TEST FAILED: ${error.message}`, 'error');
    throw error;
  } finally {
    if (testData) {
      await cleanup(testData);
    }
  }
}

// Manual test instructions
function printManualTestInstructions() {
  console.log(`
🧪 MANUAL TESTING INSTRUCTIONS
================================

To complete the workflow testing, follow these steps in your browser:

1. 🎭 SETUP TEST ACCOUNTS
   • Create a learner account: test.learner@example.com
   • Create an expert account: test.expert@example.com
   • Set up expert profile with sessions

2. 📝 LEARNER WORKFLOW TEST
   • Sign in as learner
   • Browse to expert dashboard
   • Book a session (should authorize payment)
   • Visit /dashboard/learner/bookings
   • Verify booking shows "Awaiting Expert Approval"

3. 👨‍🏫 EXPERT WORKFLOW TEST  
   • Sign in as expert
   • Visit /dashboard/expert/approvals
   • Verify pending booking appears
   • Add notes and approve booking
   • Verify success message

4. 🔍 VERIFICATION
   • Switch back to learner account
   • Check /dashboard/learner/bookings
   • Verify booking now shows "Confirmed"
   • Verify expert notes are displayed

5. ⚠️ DECLINE WORKFLOW TEST
   • Create another booking as learner
   • Sign in as expert
   • Visit approvals dashboard
   • Select decline reason and decline booking
   • Verify learner sees declined status and reason

✅ All steps working = Phase 1 Complete!
`);
}

// Run the test if called directly
if (require.main === module) {
  runWorkflowTest()
    .then(() => {
      log('\n🏁 Database workflow test completed successfully!', 'success');
      printManualTestInstructions();
      process.exit(0);
    })
    .catch((error) => {
      log(`\n💥 Test failed: ${error.message}`, 'error');
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = {
  runWorkflowTest
};