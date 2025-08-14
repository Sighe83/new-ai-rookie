#!/usr/bin/env node

/**
 * Edge Case Authentication Testing
 * Tests various edge cases and error scenarios for authentication
 */

const { createClient } = require('@supabase/supabase-js')

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ogohsocipjwhohoiiilk.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI'
const API_BASE_URL = 'http://localhost:3002'

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function cleanupTestUsers() {
  // Clean up any existing test users
  const testEmails = [
    'auth-test@example.com',
    'token-test@example.com',
    'edge-test1@example.com',
    'edge-test2@example.com'
  ]
  
  for (const email of testEmails) {
    try {
      const { data: users } = await supabase.auth.admin.listUsers({
        filter: `email.eq.${email}`
      })
      
      if (users && users.users.length > 0) {
        for (const user of users.users) {
          // Delete profile first
          await supabase.from('user_profiles').delete().eq('user_id', user.id)
          // Delete user
          await supabase.auth.admin.deleteUser(user.id)
          console.log(`Cleaned up existing user: ${email}`)
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

async function testEdgeCases() {
  console.log('🧪 Starting Edge Case Authentication Tests')
  console.log('==========================================\n')
  
  await cleanupTestUsers()
  
  const testResults = {
    passed: 0,
    failed: 0,
    errors: []
  }

  // Test 1: Malformed Authorization Header
  console.log('1. Testing malformed Authorization headers')
  const malformedHeaders = [
    'Bearer',
    'Bearer ',
    'Basic dGVzdDp0ZXN0',
    'InvalidType token123',
    '',
    'Bearer invalid.jwt.token.with.too.many.parts.here'
  ]
  
  for (let i = 0; i < malformedHeaders.length; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/availability-windows`, {
        headers: {
          'Authorization': malformedHeaders[i]
        }
      })
      
      if (response.status === 401) {
        console.log(`✅ PASS: Malformed header ${i + 1} correctly rejected`)
        testResults.passed++
      } else {
        console.log(`❌ FAIL: Malformed header ${i + 1} should return 401`)
        testResults.failed++
        testResults.errors.push(`Malformed header test ${i + 1}: Expected 401, got ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ ERROR: Malformed header test ${i + 1}: ${error.message}`)
      testResults.failed++
      testResults.errors.push(`Malformed header test ${i + 1} error: ${error.message}`)
    }
  }
  console.log()

  // Test 2: Expired token simulation
  console.log('2. Testing expired token behavior')
  try {
    // Create a user, get token, then delete user to simulate expired token
    const { data: tempUser, error: userError } = await supabase.auth.admin.createUser({
      email: 'edge-test1@example.com',
      password: 'password123',
      email_confirm: true
    })

    if (userError) {
      throw new Error(`Failed to create temp user: ${userError.message}`)
    }

    // Sign in to get token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'edge-test1@example.com',
      password: 'password123'
    })

    if (signInError) {
      throw new Error(`Failed to sign in temp user: ${signInError.message}`)
    }

    const token = signInData.session?.access_token
    if (!token) {
      throw new Error('No access token received for temp user')
    }

    // Delete the user to simulate token invalidation
    await supabase.auth.admin.deleteUser(tempUser.user.id)

    // Try to use the token
    const response = await fetch(`${API_BASE_URL}/api/availability-windows`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.status === 401) {
      console.log('✅ PASS: Invalidated token correctly rejected')
      testResults.passed++
    } else {
      console.log('❌ FAIL: Invalidated token should return 401')
      console.log(`   Status: ${response.status}`)
      testResults.failed++
      testResults.errors.push(`Invalidated token test: Expected 401, got ${response.status}`)
    }

  } catch (error) {
    console.log('❌ ERROR: Expired token test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Expired token test error: ${error.message}`)
  }
  console.log()

  // Test 3: Concurrent requests with same token
  console.log('3. Testing concurrent requests with same token')
  try {
    // Create test user
    const { data: concUser, error: concUserError } = await supabase.auth.admin.createUser({
      email: 'edge-test2@example.com',
      password: 'password123',
      email_confirm: true
    })

    if (concUserError) {
      throw new Error(`Failed to create concurrent test user: ${concUserError.message}`)
    }

    // Create profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: concUser.user.id,
        email: 'edge-test2@example.com',
        role: 'learner',
        display_name: 'Concurrent Test User'
      })
      .select()
      .single()

    if (profileError) {
      throw new Error(`Failed to create concurrent test profile: ${profileError.message}`)
    }

    // Sign in
    const { data: concSignIn, error: concSignInError } = await supabase.auth.signInWithPassword({
      email: 'edge-test2@example.com',
      password: 'password123'
    })

    if (concSignInError) {
      throw new Error(`Failed to sign in concurrent test user: ${concSignInError.message}`)
    }

    const concToken = concSignIn.session?.access_token
    if (!concToken) {
      throw new Error('No access token for concurrent test')
    }

    // Make 5 concurrent requests
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch(`${API_BASE_URL}/api/availability-windows`, {
          headers: {
            'Authorization': `Bearer ${concToken}`
          }
        })
      )
    }

    const responses = await Promise.all(promises)
    const statuses = responses.map(r => r.status)
    
    // All should return 200 (success) for valid token
    const allSuccessful = statuses.every(status => status === 200)
    
    if (allSuccessful) {
      console.log('✅ PASS: All concurrent requests handled correctly')
      testResults.passed++
    } else {
      console.log('❌ FAIL: Concurrent requests not handled consistently')
      console.log(`   Statuses: ${statuses.join(', ')}`)
      testResults.failed++
      testResults.errors.push(`Concurrent requests test: Inconsistent statuses ${statuses.join(', ')}`)
    }

    // Clean up
    await supabase.from('user_profiles').delete().eq('id', profileData.id)
    await supabase.auth.admin.deleteUser(concUser.user.id)

  } catch (error) {
    console.log('❌ ERROR: Concurrent requests test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Concurrent requests test error: ${error.message}`)
  }
  console.log()

  // Test 4: Role-based access control edge cases
  console.log('4. Testing role-based access control edge cases')
  try {
    // Test with user that has no profile
    const { data: noProfileUser, error: noProfileError } = await supabase.auth.admin.createUser({
      email: 'no-profile@example.com',
      password: 'password123',
      email_confirm: true
    })

    if (noProfileError) {
      throw new Error(`Failed to create no-profile user: ${noProfileError.message}`)
    }

    // Sign in without creating profile
    const { data: noProfileSignIn, error: noProfileSignInError } = await supabase.auth.signInWithPassword({
      email: 'no-profile@example.com',
      password: 'password123'
    })

    if (noProfileSignInError) {
      throw new Error(`Failed to sign in no-profile user: ${noProfileSignInError.message}`)
    }

    const noProfileToken = noProfileSignIn.session?.access_token
    
    // Try admin endpoint
    const adminResponse = await fetch(`${API_BASE_URL}/api/admin/get-user-auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${noProfileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: noProfileUser.user.id })
    })

    if (adminResponse.status === 403 || adminResponse.status === 401) {
      console.log('✅ PASS: User without profile correctly denied admin access')
      testResults.passed++
    } else {
      console.log('❌ FAIL: User without profile should be denied admin access')
      console.log(`   Status: ${adminResponse.status}`)
      testResults.failed++
      testResults.errors.push(`No profile admin test: Expected 401/403, got ${adminResponse.status}`)
    }

    // Clean up
    await supabase.auth.admin.deleteUser(noProfileUser.user.id)

  } catch (error) {
    console.log('❌ ERROR: Role-based access control test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Role-based access control test error: ${error.message}`)
  }
  console.log()

  // Test 5: Network timeout simulation
  console.log('5. Testing network timeout scenarios')
  try {
    // Create a very short timeout request to test timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10) // 10ms timeout
    
    try {
      await fetch(`${API_BASE_URL}/api/availability-windows`, {
        signal: controller.signal,
        headers: {
          'Authorization': 'Bearer some-token'
        }
      })
      
      clearTimeout(timeoutId)
      console.log('❌ FAIL: Request should have been aborted')
      testResults.failed++
      testResults.errors.push('Network timeout test: Request was not aborted as expected')
      
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        console.log('✅ PASS: Network timeout handled gracefully')
        testResults.passed++
      } else {
        console.log('❌ FAIL: Unexpected error during timeout test')
        console.log(`   Error: ${error.message}`)
        testResults.failed++
        testResults.errors.push(`Network timeout test: Unexpected error ${error.message}`)
      }
    }

  } catch (error) {
    console.log('❌ ERROR: Network timeout test setup error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Network timeout test setup error: ${error.message}`)
  }
  console.log()

  // Print summary
  console.log('📊 EDGE CASE TEST SUMMARY')
  console.log('========================')
  console.log(`✅ Passed: ${testResults.passed}`)
  console.log(`❌ Failed: ${testResults.failed}`)
  console.log(`📈 Total: ${testResults.passed + testResults.failed}`)
  console.log()

  if (testResults.errors.length > 0) {
    console.log('🚨 EDGE CASE ERRORS:')
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`)
    })
    console.log()
  }

  return testResults
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEdgeCases()
    .then((results) => {
      console.log('🏁 Edge case testing completed')
      process.exit(results.failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error('💥 Edge case test suite error:', error)
      process.exit(1)
    })
}

module.exports = { testEdgeCases }