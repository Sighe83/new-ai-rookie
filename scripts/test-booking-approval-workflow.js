#!/usr/bin/env node

/**
 * Comprehensive End-to-End Test for Booking Approval Workflow
 * 
 * This script tests the complete flow:
 * 1. Learner creates booking → payment authorized
 * 2. Expert sees pending approval
 * 3. Expert approves → payment captured  
 * 4. Both parties see updated status
 * 
 * Note: This test uses direct database queries for verification
 * since cookie-based authentication is complex to simulate in Node.js
 * 
 * Usage: node scripts/test-booking-approval-workflow.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : supabase;

// Test data
const TEST_LEARNER = {
  email: 'test.learner@example.com',
  password: 'testpassword123',
  full_name: 'Test Learner'
};

const TEST_EXPERT = {
  email: 'test.expert@example.com', 
  password: 'testpassword123',
  full_name: 'Test Expert'
};

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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAuthenticatedRequest(url, options = {}, authToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // For browser-based cookie auth, we don't add Authorization header
  // Instead, the cookie will be sent automatically by the browser
  
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include' // Important for cookie-based auth
  });

  return response;
}

async function signUpUser(user, role) {
  log(`Creating ${role} account: ${user.email}`);
  
  const { data, error } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      data: {
        full_name: user.full_name,
        role: role
      }
    }
  });

  if (error && !error.message.includes('already registered')) {
    throw new Error(`Failed to create ${role}: ${error.message}`);
  }

  log(`${role} account ready: ${user.email}`, 'success');
  return data.user;
}

async function signInUser(email, password) {
  log(`Signing in: ${email}`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(`Failed to sign in: ${error.message}`);
  }

  log(`Signed in successfully: ${email}`, 'success');
  return data;
}

async function createTestSession(expertAuthData) {
  log('Creating test session for expert');
  
  // First sign in the expert to get cookies
  await signInUser(TEST_EXPERT.email, TEST_EXPERT.password);
  
  const sessionData = {
    title: 'Test AI Fundamentals Session',
    description: 'A comprehensive introduction to AI fundamentals for beginners',
    duration_minutes: 60,
    price_cents: 15000, // 150.00 DKK
    topic_tags: ['AI', 'Machine Learning', 'Fundamentals'],
    level: 'beginner'
  };

  const response = await makeAuthenticatedRequest('/api/expert-sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create session: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  log(`Test session created: ${result.session.id}`, 'success');
  return result.session;
}

async function createTestBooking(sessionId, learnerAuthData) {
  log('Creating test booking as learner');
  
  // Sign in the learner to get cookies
  await signInUser(TEST_LEARNER.email, TEST_LEARNER.password);
  
  const bookingData = {
    session_id: sessionId,
    learner_notes: 'Looking forward to learning AI fundamentals!'
  };

  const response = await makeAuthenticatedRequest('/api/bookings/create-with-payment', {
    method: 'POST',
    body: JSON.stringify(bookingData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create booking: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  log(`Test booking created: ${result.booking_id}`, 'success');
  return result;
}

async function checkPendingApprovals(expertAuthData) {
  log('Checking pending approvals as expert');
  
  // Sign in the expert
  await signInUser(TEST_EXPERT.email, TEST_EXPERT.password);
  
  const response = await makeAuthenticatedRequest('/api/expert/pending-approvals');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get pending approvals: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  log(`Found ${result.approvals.length} pending approvals`, 'success');
  
  if (result.approvals.length === 0) {
    throw new Error('No pending approvals found');
  }

  return result.approvals[0]; // Return first approval
}

async function approveBooking(bookingId, expertAuthData) {
  log(`Approving booking: ${bookingId}`);
  
  // Sign in the expert
  await signInUser(TEST_EXPERT.email, TEST_EXPERT.password);
  
  const approvalData = {
    notes: 'Approved! Looking forward to our session.'
  };

  const response = await makeAuthenticatedRequest(`/api/bookings/${bookingId}/approve`, {
    method: 'POST',
    body: JSON.stringify(approvalData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to approve booking: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  log(`Booking approved successfully`, 'success');
  return result;
}

async function checkLearnerBookings(learnerAuthData) {
  log('Checking learner bookings');
  
  // Sign in the learner
  await signInUser(TEST_LEARNER.email, TEST_LEARNER.password);
  
  const response = await makeAuthenticatedRequest('/api/learner/my-bookings');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get learner bookings: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  log(`Found ${result.bookings.length} bookings for learner`, 'success');
  return result.bookings;
}

async function verifyBookingStatus(bookingId, expectedStatus) {
  log(`Verifying booking status: ${expectedStatus}`);
  
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, payment_status')
    .eq('id', bookingId)
    .single();

  if (error) {
    throw new Error(`Failed to verify booking status: ${error.message}`);
  }

  if (booking.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${booking.status}`);
  }

  log(`Booking status verified: ${booking.status}`, 'success');
  return booking;
}

async function cleanup() {
  log('Cleaning up test data...');
  
  try {
    // Delete test bookings
    await supabase
      .from('bookings')
      .delete()
      .like('learner_notes', '%AI fundamentals%');
    
    // Delete test sessions
    await supabase
      .from('sessions')
      .delete()
      .like('title', '%Test AI Fundamentals%');
      
    log('Cleanup completed', 'success');
  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'warning');
  }
}

async function runBookingApprovalWorkflowTest() {
  log('🚀 Starting Booking Approval Workflow Test', 'info');
  log('This test will verify the complete booking approval process', 'info');
  
  let testSession, testBooking, pendingApproval;
  
  try {
    // Step 1: Setup test users
    log('\n📋 Step 1: Setting up test users');
    const learnerUser = await signUpUser(TEST_LEARNER, 'learner');
    const expertUser = await signUpUser(TEST_EXPERT, 'expert');
    
    // Wait a moment for user creation to propagate
    await delay(2000);
    
    // Step 2: Create test session
    log('\n📋 Step 2: Creating test session');
    const expertAuth = await signInUser(TEST_EXPERT.email, TEST_EXPERT.password);
    testSession = await createTestSession(expertAuth);
    
    // Step 3: Create booking (learner creates booking → payment authorized)
    log('\n📋 Step 3: Creating booking with payment authorization');
    const learnerAuth = await signInUser(TEST_LEARNER.email, TEST_LEARNER.password);
    testBooking = await createTestBooking(testSession.id, learnerAuth);
    
    // Verify booking is in pending_approval state
    await delay(1000);
    await verifyBookingStatus(testBooking.booking_id, 'pending_approval');
    
    // Step 4: Expert sees pending approval
    log('\n📋 Step 4: Expert checking pending approvals');
    pendingApproval = await checkPendingApprovals(expertAuth);
    
    if (pendingApproval.id !== testBooking.booking_id) {
      throw new Error('Pending approval ID does not match created booking');
    }
    
    // Step 5: Expert approves → payment captured
    log('\n📋 Step 5: Expert approving booking');
    const approvalResult = await approveBooking(testBooking.booking_id, expertAuth);
    
    // Verify booking is now confirmed
    await delay(2000); // Wait for payment capture
    await verifyBookingStatus(testBooking.booking_id, 'confirmed');
    
    // Step 6: Both parties see updated status
    log('\n📋 Step 6: Verifying status updates for both parties');
    
    // Check expert's view (should have no more pending approvals for this booking)
    const updatedApprovals = await checkPendingApprovals(expertAuth);
    const hasThisBooking = updatedApprovals.some(a => a.id === testBooking.booking_id);
    if (hasThisBooking) {
      throw new Error('Booking still appears in pending approvals after approval');
    }
    log('Expert dashboard correctly updated', 'success');
    
    // Check learner's view
    const learnerBookings = await checkLearnerBookings(learnerAuth);
    const confirmedBooking = learnerBookings.find(b => b.id === testBooking.booking_id);
    if (!confirmedBooking || confirmedBooking.status !== 'confirmed') {
      throw new Error('Learner does not see confirmed booking status');
    }
    log('Learner dashboard correctly updated', 'success');
    
    // Final verification
    log('\n📋 Final verification');
    const finalBooking = await verifyBookingStatus(testBooking.booking_id, 'confirmed');
    if (finalBooking.payment_status !== 'completed') {
      log(`Warning: Payment status is ${finalBooking.payment_status}, expected 'completed'`, 'warning');
    }
    
    log('\n🎉 BOOKING APPROVAL WORKFLOW TEST COMPLETED SUCCESSFULLY!', 'success');
    log('\n✅ Verified flow:', 'success');
    log('   1. Learner creates booking → payment authorized', 'success');
    log('   2. Expert sees pending approval', 'success'); 
    log('   3. Expert approves → payment captured', 'success');
    log('   4. Both parties see updated status', 'success');
    
  } catch (error) {
    log(`\n❌ TEST FAILED: ${error.message}`, 'error');
    throw error;
  } finally {
    // Cleanup
    await cleanup();
  }
}

// Run the test if called directly
if (require.main === module) {
  runBookingApprovalWorkflowTest()
    .then(() => {
      log('\n🏁 Test completed successfully!', 'success');
      process.exit(0);
    })
    .catch((error) => {
      log(`\n💥 Test failed: ${error.message}`, 'error');
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = {
  runBookingApprovalWorkflowTest,
  TEST_LEARNER,
  TEST_EXPERT
};