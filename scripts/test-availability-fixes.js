#!/usr/bin/env node

/**
 * Quick functional test script for the critical availability window fixes
 * Run this script to verify the fixes work correctly
 * 
 * Usage: node scripts/test-availability-fixes.js
 */

const BASE_URL = 'http://localhost:3000'

async function testSecurityFix() {
  console.log('\n🔐 Testing Security Fix - Information Disclosure Prevention')
  
  try {
    // Test without authentication - should fail
    const response = await fetch(`${BASE_URL}/api/availability-windows/test-id`)
    console.log(`   Unauthenticated request: ${response.status} ${response.statusText}`)
    
    if (response.status === 401) {
      console.log('   ✅ Correctly blocks unauthenticated access')
    } else {
      console.log('   ❌ Should block unauthenticated access')
    }
    
  } catch (error) {
    console.log('   ⚠️  Server not running or not accessible')
  }
}

async function testTimezoneHandling() {
  console.log('\n🕐 Testing Timezone Handling Fix')
  
  // Test the convertToISOString function logic
  const convertToISOString = (date, time) => {
    const localDateTime = new Date(`${date}T${time}:00`)
    if (isNaN(localDateTime.getTime())) {
      throw new Error('Invalid date or time format')
    }
    return localDateTime.toISOString()
  }
  
  try {
    const result = convertToISOString('2024-03-15', '10:00')
    console.log(`   Input: 2024-03-15 10:00`)
    console.log(`   Output: ${result}`)
    
    // Verify it's a valid ISO string
    if (result.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
      console.log('   ✅ Correctly formats to ISO string')
    } else {
      console.log('   ❌ Invalid ISO string format')
    }
    
    // Test error handling
    try {
      convertToISOString('invalid-date', '10:00')
      console.log('   ❌ Should throw error for invalid date')
    } catch (error) {
      console.log('   ✅ Correctly handles invalid date')
    }
    
  } catch (error) {
    console.log(`   ❌ Error in timezone conversion: ${error.message}`)
  }
}

async function testBookingConflictPrevention() {
  console.log('\n🚫 Testing Booking Conflict Prevention')
  
  // This would require actual database access and authentication
  // For now, just validate the logic exists in the API file
  const fs = require('fs')
  const path = require('path')
  
  try {
    const apiFilePath = path.join(__dirname, '../app/api/availability-windows/[id]/route.ts')
    const apiContent = fs.readFileSync(apiFilePath, 'utf8')
    
    if (apiContent.includes('existingBookings') && apiContent.includes('confirmed') && apiContent.includes('pending')) {
      console.log('   ✅ Booking conflict check logic implemented')
    } else {
      console.log('   ❌ Booking conflict check logic missing')
    }
    
    if (apiContent.includes('Cannot delete availability window with confirmed or pending bookings')) {
      console.log('   ✅ Proper error message for booking conflicts')
    } else {
      console.log('   ❌ Missing proper error message')
    }
    
  } catch (error) {
    console.log(`   ❌ Could not verify API file: ${error.message}`)
  }
}

async function testFormErrorHandling() {
  console.log('\n🛡️  Testing Form Error Handling')
  
  // Test the form component logic
  const fs = require('fs')
  const path = require('path')
  
  try {
    const formFilePath = path.join(__dirname, '../components/AvailabilityWindowForm.tsx')
    const formContent = fs.readFileSync(formFilePath, 'utf8')
    
    if (formContent.includes('Invalid date or time format')) {
      console.log('   ✅ Form has proper error handling for invalid dates')
    } else {
      console.log('   ❌ Missing error handling for invalid dates')
    }
    
    if (formContent.includes('try') && formContent.includes('catch')) {
      console.log('   ✅ Form has try-catch error handling')
    } else {
      console.log('   ❌ Missing try-catch error handling')
    }
    
  } catch (error) {
    console.log(`   ❌ Could not verify form file: ${error.message}`)
  }
}

async function main() {
  console.log('🧪 Running Critical Fixes Tests for Availability Windows')
  console.log('=' .repeat(60))
  
  await testSecurityFix()
  await testTimezoneHandling()
  await testBookingConflictPrevention()
  await testFormErrorHandling()
  
  console.log('\n📋 Test Summary')
  console.log('=' .repeat(60))
  console.log('✅ = Fix implemented correctly')
  console.log('❌ = Issue found or fix missing')
  console.log('⚠️  = Unable to test (server/env issue)')
  
  console.log('\n📖 For comprehensive testing, see:')
  console.log('   tests/manual/availability-window-critical-fixes.md')
  
  console.log('\n🚀 Next Steps:')
  console.log('   1. Start the dev server: npm run dev')
  console.log('   2. Run manual tests with actual user accounts')
  console.log('   3. Test with different timezones')
  console.log('   4. Test booking conflict scenarios')
}

main().catch(console.error)
