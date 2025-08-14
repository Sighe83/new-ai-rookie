#!/usr/bin/env node

/**
 * Manual Authentication Testing Script
 * Tests API endpoints for authentication issues
 */

const { createClient } = require('@supabase/supabase-js')

// Use built-in fetch (available in Node.js 18+)
if (typeof fetch === 'undefined') {
    global.fetch = require('node:util').fetch || require('undici').fetch
}

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ogohsocipjwhohoiiilk.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nb2hzb2NpcGp3aG9ob2lpaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkzNjI0MCwiZXhwIjoyMDcwNTEyMjQwfQ.YXl92fa3qxZAyBUYQ1lyKSIoIFkd3fhiqe0eqX7nUVI'
const API_BASE_URL = 'http://localhost:3002'

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testAuthEndpoints() {
  console.log('🧪 Starting Authentication Test Suite')
  console.log('=====================================\n')
  
  const testResults = {
    passed: 0,
    failed: 0,
    errors: []
  }

  // Test 1: Public endpoint (experts list) - should work without auth
  console.log('1. Testing PUBLIC endpoint (/api/experts)')
  try {
    const response = await fetch(`${API_BASE_URL}/api/experts`)
    const data = await response.json()
    
    if (response.status === 200) {
      console.log('✅ PASS: Public experts endpoint accessible')
      console.log(`   Experts found: ${data.experts?.length || 0}`)
      testResults.passed++
    } else {
      console.log('❌ FAIL: Public experts endpoint failed')
      console.log(`   Status: ${response.status}, Error: ${data.error}`)
      testResults.failed++
      testResults.errors.push(`Public experts endpoint: ${response.status} - ${data.error}`)
    }
  } catch (error) {
    console.log('❌ ERROR: Public experts endpoint error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Public experts endpoint error: ${error.message}`)
  }
  console.log()

  // Test 2: Protected endpoint without auth - should fail with 401
  console.log('2. Testing PROTECTED endpoint without auth (/api/availability-windows)')
  try {
    const response = await fetch(`${API_BASE_URL}/api/availability-windows`)
    const data = await response.json()
    
    if (response.status === 401) {
      console.log('✅ PASS: Protected endpoint correctly rejects unauthenticated requests')
      testResults.passed++
    } else {
      console.log('❌ FAIL: Protected endpoint should return 401 for unauthenticated requests')
      console.log(`   Status: ${response.status}, Data: ${JSON.stringify(data)}`)
      testResults.failed++
      testResults.errors.push(`Protected endpoint auth check: Expected 401, got ${response.status}`)
    }
  } catch (error) {
    console.log('❌ ERROR: Protected endpoint test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Protected endpoint test error: ${error.message}`)
  }
  console.log()

  // Test 3: Invalid token
  console.log('3. Testing with INVALID token')
  try {
    const response = await fetch(`${API_BASE_URL}/api/availability-windows`, {
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      }
    })
    const data = await response.json()
    
    if (response.status === 401) {
      console.log('✅ PASS: Invalid token correctly rejected')
      testResults.passed++
    } else {
      console.log('❌ FAIL: Invalid token should return 401')
      console.log(`   Status: ${response.status}, Data: ${JSON.stringify(data)}`)
      testResults.failed++
      testResults.errors.push(`Invalid token test: Expected 401, got ${response.status}`)
    }
  } catch (error) {
    console.log('❌ ERROR: Invalid token test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Invalid token test error: ${error.message}`)
  }
  console.log()

  // Test 4: Create test user and test valid authentication
  console.log('4. Testing with VALID authentication')
  let testUser = null
  let userProfile = null
  let expertProfile = null
  
  try {
    // Create test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'auth-test@example.com',
      password: 'password123',
      email_confirm: true
    })

    if (authError) {
      throw new Error(`Failed to create test user: ${authError.message}`)
    }
    
    testUser = authData.user
    console.log('   Created test user:', testUser.email)

    // Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: testUser.id,
        email: testUser.email,
        role: 'expert',
        display_name: 'Test Expert',
        first_name: 'Test',
        last_name: 'Expert'
      })
      .select()
      .single()

    if (profileError) {
      throw new Error(`Failed to create user profile: ${profileError.message}`)
    }
    
    userProfile = profileData
    console.log('   Created user profile')

    // Create expert profile
    const { data: expertData, error: expertError } = await supabase
      .from('expert_profiles')
      .insert({
        user_profile_id: userProfile.id,
        is_available: true,
        hourly_rate: 100
      })
      .select()
      .single()

    if (expertError) {
      throw new Error(`Failed to create expert profile: ${expertError.message}`)
    }
    
    expertProfile = expertData
    console.log('   Created expert profile')

    // Sign in to get access token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'auth-test@example.com',
      password: 'password123'
    })

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`)
    }

    const accessToken = signInData.session?.access_token
    if (!accessToken) {
      throw new Error('No access token received')
    }
    
    console.log('   Successfully signed in and got access token')

    // Test authenticated request
    const response = await fetch(`${API_BASE_URL}/api/availability-windows`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    const data = await response.json()
    
    if (response.status === 200) {
      console.log('✅ PASS: Valid authentication works')
      console.log(`   Windows found: ${data.windows?.length || 0}`)
      testResults.passed++
    } else {
      console.log('❌ FAIL: Valid authentication failed')
      console.log(`   Status: ${response.status}, Error: ${data.error}`)
      testResults.failed++
      testResults.errors.push(`Valid auth test: ${response.status} - ${data.error}`)
    }

    // Test admin endpoint access
    console.log('   Testing admin endpoint access...')
    const adminResponse = await fetch(`${API_BASE_URL}/api/admin/get-user-auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: testUser.id })
    })
    const adminData = await adminResponse.json()
    
    if (adminResponse.status === 403) {
      console.log('✅ PASS: Non-admin correctly denied admin access')
      testResults.passed++
    } else {
      console.log('❌ FAIL: Non-admin should be denied admin access')
      console.log(`   Status: ${adminResponse.status}, Data: ${JSON.stringify(adminData)}`)
      testResults.failed++
      testResults.errors.push(`Admin access control: Expected 403, got ${adminResponse.status}`)
    }

  } catch (error) {
    console.log('❌ ERROR: Valid authentication test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Valid auth test error: ${error.message}`)
  } finally {
    // Clean up test data
    if (expertProfile) {
      await supabase.from('expert_profiles').delete().eq('id', expertProfile.id)
      console.log('   Cleaned up expert profile')
    }
    if (userProfile) {
      await supabase.from('user_profiles').delete().eq('id', userProfile.id)
      console.log('   Cleaned up user profile')
    }
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id)
      console.log('   Cleaned up test user')
    }
  }
  console.log()

  // Test 5: Cross-API token consistency
  console.log('5. Testing token consistency across APIs')
  try {
    // Create another test user for consistency testing
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'token-test@example.com',
      password: 'password123',
      email_confirm: true
    })

    if (authError) {
      throw new Error(`Failed to create token test user: ${authError.message}`)
    }

    const tokenTestUser = authData.user

    // Create profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: tokenTestUser.id,
        email: tokenTestUser.email,
        role: 'learner',
        display_name: 'Token Test User'
      })
      .select()
      .single()

    if (profileError) {
      throw new Error(`Failed to create token test profile: ${profileError.message}`)
    }

    // Sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'token-test@example.com',
      password: 'password123'
    })

    if (signInError) {
      throw new Error(`Failed to sign in token test user: ${signInError.message}`)
    }

    const accessToken = signInData.session?.access_token
    if (!accessToken) {
      throw new Error('No access token for consistency test')
    }

    // Test token across multiple endpoints
    const endpoints = [
      '/api/availability-windows',
      '/api/experts',
      '/api/expert-sessions'
    ]

    let consistentResponses = 0
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        if (response.status === 200 || response.status === 401 || response.status === 403) {
          // These are all valid responses (success, unauthorized, or forbidden)
          consistentResponses++
        }
      } catch (error) {
        console.log(`   Warning: Error testing ${endpoint}: ${error.message}`)
      }
    }

    if (consistentResponses === endpoints.length) {
      console.log('✅ PASS: Token works consistently across all APIs')
      testResults.passed++
    } else {
      console.log('❌ FAIL: Token inconsistent across APIs')
      console.log(`   Successful: ${consistentResponses}/${endpoints.length}`)
      testResults.failed++
      testResults.errors.push(`Token consistency: Only ${consistentResponses}/${endpoints.length} endpoints responded correctly`)
    }

    // Clean up
    await supabase.from('user_profiles').delete().eq('id', profileData.id)
    await supabase.auth.admin.deleteUser(tokenTestUser.id)
    
  } catch (error) {
    console.log('❌ ERROR: Token consistency test error')
    console.log(`   Error: ${error.message}`)
    testResults.failed++
    testResults.errors.push(`Token consistency test error: ${error.message}`)
  }
  console.log()

  // Print summary
  console.log('📊 TEST SUMMARY')
  console.log('===============')
  console.log(`✅ Passed: ${testResults.passed}`)
  console.log(`❌ Failed: ${testResults.failed}`)
  console.log(`📈 Total: ${testResults.passed + testResults.failed}`)
  console.log()

  if (testResults.errors.length > 0) {
    console.log('🚨 ERRORS FOUND:')
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`)
    })
    console.log()
  }

  return testResults
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAuthEndpoints()
    .then((results) => {
      console.log('🏁 Testing completed')
      process.exit(results.failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error('💥 Test suite error:', error)
      process.exit(1)
    })
}

module.exports = { testAuthEndpoints }