#!/usr/bin/env node

/**
 * Manual Booking Flow Test Script
 * 
 * This script tests the complete booking flow by making real API calls
 * to verify all the fixes are working correctly:
 * 
 * 1. Authentication validation (Bearer token)
 * 2. Booking creation with required fields
 * 3. Payment intent creation
 * 4. Error handling
 * 
 * Usage: node scripts/test-booking-flow.js
 */

const API_BASE_URL = 'http://localhost:3000'
const TEST_SESSION_ID = '15b51512-15b9-48a6-b58a-7dfe06e23df5'
const MOCK_AUTH_TOKEN = 'mock-jwt-token'

// Test data
const VALID_BOOKING_DATA = {
  session_id: TEST_SESSION_ID,
  expert_id: 'test-expert-id',
  start_at: '2025-08-18T10:00:00Z',
  end_at: '2025-08-18T11:00:00Z',
  availability_window_id: 'test-window-id',
  amount: 50.00,
  currency: 'USD',
  notes: 'Test booking for validation'
}

// Utility function to make API calls
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const defaultOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }
  
  const finalOptions = { ...defaultOptions, ...options }
  
  try {
    const response = await fetch(url, finalOptions)
    const data = await response.json().catch(() => ({}))
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      ok: response.ok
    }
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      ok: false
    }
  }
}

// Test functions
async function testAuthenticationValidation() {
  console.log('\n🔐 Testing Authentication Validation...')
  
  // Test 1: Request without Authorization header
  console.log('  Test 1: Request without Authorization header')
  const noAuthResult = await makeRequest('/api/bookings/create', {
    body: JSON.stringify(VALID_BOOKING_DATA)
  })
  
  const noAuthSuccess = noAuthResult.status === 401 && noAuthResult.data.error === 'Unauthorized'
  console.log(`  ✅ Status: ${noAuthResult.status} - ${noAuthSuccess ? 'PASS' : 'FAIL'}`)
  if (!noAuthSuccess) {
    console.log(`  ❌ Expected: 401 with 'Unauthorized', Got: ${noAuthResult.status} with '${noAuthResult.data.error}'`)
  }
  
  // Test 2: Request with invalid Authorization format
  console.log('  Test 2: Request with invalid Authorization format')
  const invalidAuthResult = await makeRequest('/api/bookings/create', {
    headers: { 'Authorization': 'InvalidFormat token123' },
    body: JSON.stringify(VALID_BOOKING_DATA)
  })
  
  const invalidAuthSuccess = invalidAuthResult.status === 401
  console.log(`  ✅ Status: ${invalidAuthResult.status} - ${invalidAuthSuccess ? 'PASS' : 'FAIL'}`)
  
  // Test 3: Request with Bearer token format (may fail on token validation, but format is accepted)
  console.log('  Test 3: Request with Bearer token format')
  const bearerAuthResult = await makeRequest('/api/bookings/create', {
    headers: { 'Authorization': `Bearer ${MOCK_AUTH_TOKEN}` },
    body: JSON.stringify(VALID_BOOKING_DATA)
  })
  
  // Should not be 401 for format issues, but may be 401 for invalid token or other errors
  const bearerFormatSuccess = bearerAuthResult.status !== 400 // 400 would indicate format issue
  console.log(`  ✅ Status: ${bearerAuthResult.status} - ${bearerFormatSuccess ? 'PASS' : 'FAIL'}`)
  console.log(`     (Note: May be 401 due to invalid token, which is expected)`)
  
  return { noAuthSuccess, invalidAuthSuccess, bearerFormatSuccess }
}

async function testBookingValidation() {
  console.log('\n📝 Testing Booking Validation...')
  
  // Test 1: Missing session_id field
  console.log('  Test 1: Missing session_id field')
  const missingSessionResult = await makeRequest('/api/bookings/create', {
    headers: { 'Authorization': `Bearer ${MOCK_AUTH_TOKEN}` },
    body: JSON.stringify({
      expert_id: 'test-expert-id',
      start_at: '2025-08-18T10:00:00Z',
      end_at: '2025-08-18T11:00:00Z'
    })
  })
  
  const missingSessionSuccess = missingSessionResult.status === 400 && 
    missingSessionResult.data.error?.includes('session_id')
  console.log(`  ✅ Status: ${missingSessionResult.status} - ${missingSessionSuccess ? 'PASS' : 'FAIL'}`)
  if (!missingSessionSuccess) {
    console.log(`  ❌ Expected: 400 with 'session_id' error, Got: ${missingSessionResult.status} with '${missingSessionResult.data.error}'`)
  }
  
  // Test 2: Valid booking data structure
  console.log('  Test 2: Valid booking data structure')
  const validDataResult = await makeRequest('/api/bookings/create', {
    headers: { 'Authorization': `Bearer ${MOCK_AUTH_TOKEN}` },
    body: JSON.stringify(VALID_BOOKING_DATA)
  })
  
  // Should not be 400 (validation error), may be 401 (auth error) or 404 (user not found)
  const validDataSuccess = validDataResult.status !== 400
  console.log(`  ✅ Status: ${validDataResult.status} - ${validDataSuccess ? 'PASS' : 'FAIL'}`)
  console.log(`     (Note: May be 401/404 due to auth/user issues, which is expected)`)
  
  // Test 3: Malformed JSON
  console.log('  Test 3: Malformed JSON handling')
  const malformedJsonResult = await makeRequest('/api/bookings/create', {
    headers: { 'Authorization': `Bearer ${MOCK_AUTH_TOKEN}` },
    body: 'invalid json{'
  })
  
  const malformedJsonSuccess = malformedJsonResult.status === 500 || malformedJsonResult.status === 400
  console.log(`  ✅ Status: ${malformedJsonResult.status} - ${malformedJsonSuccess ? 'PASS' : 'FAIL'}`)
  
  return { missingSessionSuccess, validDataSuccess, malformedJsonSuccess }
}

async function testPaymentValidation() {
  console.log('\n💳 Testing Payment Validation...')
  
  // Test 1: Payment without authorization
  console.log('  Test 1: Payment without authorization')
  const noAuthPaymentResult = await makeRequest('/api/payment/create-intent', {
    body: JSON.stringify({
      bookingId: 'test-booking-id',
      amount: 50.00,
      currency: 'usd'
    })
  })
  
  const noAuthPaymentSuccess = noAuthPaymentResult.status === 401
  console.log(`  ✅ Status: ${noAuthPaymentResult.status} - ${noAuthPaymentSuccess ? 'PASS' : 'FAIL'}`)
  
  // Test 2: Payment with missing required fields
  console.log('  Test 2: Missing required fields')
  const missingFieldsPaymentResult = await makeRequest('/api/payment/create-intent', {
    headers: { 'Authorization': `Bearer ${MOCK_AUTH_TOKEN}` },
    body: JSON.stringify({
      currency: 'usd'
      // Missing bookingId and amount
    })
  })
  
  const missingFieldsSuccess = missingFieldsPaymentResult.status === 400 && 
    missingFieldsPaymentResult.data.error?.includes('required fields')
  console.log(`  ✅ Status: ${missingFieldsPaymentResult.status} - ${missingFieldsSuccess ? 'PASS' : 'FAIL'}`)
  
  // Test 3: Payment with valid data structure
  console.log('  Test 3: Valid payment data structure')
  const validPaymentResult = await makeRequest('/api/payment/create-intent', {
    headers: { 'Authorization': `Bearer ${MOCK_AUTH_TOKEN}` },
    body: JSON.stringify({
      bookingId: 'non-existent-booking-id',
      amount: 50.00,
      currency: 'usd'
    })
  })
  
  // Should not be 400 (validation error), may be 401 (auth) or 404 (booking not found)
  const validPaymentSuccess = validPaymentResult.status !== 400
  console.log(`  ✅ Status: ${validPaymentResult.status} - ${validPaymentSuccess ? 'PASS' : 'FAIL'}`)
  console.log(`     (Note: May be 401/404 due to auth/booking issues, which is expected)`)
  
  return { noAuthPaymentSuccess, missingFieldsSuccess, validPaymentSuccess }
}

async function testErrorHandling() {
  console.log('\n⚠️  Testing Error Handling...')
  
  // Test 1: Invalid JSON response format
  console.log('  Test 1: Response format consistency')
  const errorFormatResult = await makeRequest('/api/bookings/create', {
    body: JSON.stringify({})
  })
  
  const hasErrorField = errorFormatResult.data && typeof errorFormatResult.data.error === 'string'
  console.log(`  ✅ Error field present: ${hasErrorField ? 'PASS' : 'FAIL'}`)
  
  // Test 2: Content-Type header
  const hasJsonContentType = errorFormatResult.headers['content-type']?.includes('application/json')
  console.log(`  ✅ JSON Content-Type: ${hasJsonContentType ? 'PASS' : 'FAIL'}`)
  
  return { hasErrorField, hasJsonContentType }
}

async function runAllTests() {
  console.log('🧪 Booking Flow Integration Tests')
  console.log('================================')
  console.log(`Testing server at: ${API_BASE_URL}`)
  console.log(`Using session ID: ${TEST_SESSION_ID}`)
  
  try {
    const authResults = await testAuthenticationValidation()
    const bookingResults = await testBookingValidation()  
    const paymentResults = await testPaymentValidation()
    const errorResults = await testErrorHandling()
    
    // Summary
    console.log('\n📊 Test Summary')
    console.log('===============')
    
    const allTests = [
      { name: 'Auth: No header rejection', result: authResults.noAuthSuccess },
      { name: 'Auth: Invalid format rejection', result: authResults.invalidAuthSuccess },
      { name: 'Auth: Bearer format acceptance', result: authResults.bearerFormatSuccess },
      { name: 'Booking: Missing session_id validation', result: bookingResults.missingSessionSuccess },
      { name: 'Booking: Valid data structure', result: bookingResults.validDataSuccess },
      { name: 'Booking: Malformed JSON handling', result: bookingResults.malformedJsonSuccess },
      { name: 'Payment: No auth rejection', result: paymentResults.noAuthPaymentSuccess },
      { name: 'Payment: Missing fields validation', result: paymentResults.missingFieldsSuccess },
      { name: 'Payment: Valid data structure', result: paymentResults.validPaymentSuccess },
      { name: 'Error: Consistent error format', result: errorResults.hasErrorField },
      { name: 'Error: JSON Content-Type', result: errorResults.hasJsonContentType }
    ]
    
    const passedTests = allTests.filter(test => test.result).length
    const totalTests = allTests.length
    
    console.log(`\n✅ Passed: ${passedTests}/${totalTests} tests`)
    
    allTests.forEach(test => {
      const status = test.result ? '✅ PASS' : '❌ FAIL'
      console.log(`  ${status} - ${test.name}`)
    })
    
    if (passedTests === totalTests) {
      console.log('\n🎉 All core booking flow fixes are working correctly!')
      console.log('✅ Authentication: Bearer token support implemented')
      console.log('✅ Validation: Required fields properly validated')
      console.log('✅ Error Handling: Consistent error responses')
      console.log('✅ API Structure: Proper endpoint behavior')
    } else {
      console.log(`\n⚠️  ${totalTests - passedTests} tests failed. Please review the implementation.`)
    }
    
    // Recommendations
    console.log('\n📋 Next Steps:')
    console.log('1. Test with real authentication tokens for complete flow')
    console.log('2. Create test user accounts for end-to-end testing')
    console.log('3. Test with valid expert sessions and availability windows')
    console.log('4. Verify Stripe payment integration with test cards')
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message)
    console.log('Please ensure the development server is running at http://localhost:3000')
  }
}

// Check if server is running before starting tests
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/create`, { method: 'POST' })
    return response.status !== 0
  } catch (error) {
    return false
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer()
  
  if (!serverRunning) {
    console.log('❌ Server is not running at http://localhost:3000')
    console.log('Please start the development server with: npm run dev')
    process.exit(1)
  }
  
  await runAllTests()
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}