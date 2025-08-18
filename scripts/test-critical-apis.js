import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testCriticalAPIs() {
  console.log('🔍 Testing Critical API Endpoints...\n')

  const results = {
    functions: {},
    endpoints: {},
    database: {}
  }

  try {
    // Test 1: Database Functions
    console.log('📋 Testing Database Functions:')
    
    // Test get_expert_sessions_with_availability
    try {
      const { data, error } = await supabase
        .rpc('get_expert_sessions_with_availability', {})
      
      if (error) {
        console.log('❌ get_expert_sessions_with_availability - FAILED:', error.message)
        results.functions.sessions_with_availability = false
      } else {
        console.log(`✅ get_expert_sessions_with_availability - OK (${data?.length || 0} sessions)`)
        results.functions.sessions_with_availability = true
      }
    } catch (err) {
      console.log('❌ get_expert_sessions_with_availability - ERROR:', err.message)
      results.functions.sessions_with_availability = false
    }

    // Test 2: Database Schema Verification
    console.log('\n📊 Testing Database Schema:')
    
    // Test sessions table
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, price_cents, duration_minutes')
        .eq('is_active', true)
        .limit(1)
      
      if (error) {
        console.log('❌ sessions table - FAILED:', error.message)
        results.database.sessions = false
      } else {
        console.log(`✅ sessions table - OK (${data?.length || 0} active sessions)`)
        results.database.sessions = true
      }
    } catch (err) {
      console.log('❌ sessions table - ERROR:', err.message)
      results.database.sessions = false
    }

    // Test bookable_slots table
    try {
      const { data, error } = await supabase
        .from('bookable_slots')
        .select('id, session_id, start_time, is_available')
        .eq('is_available', true)
        .limit(5)
      
      if (error) {
        console.log('❌ bookable_slots table - FAILED:', error.message)
        results.database.bookable_slots = false
      } else {
        console.log(`✅ bookable_slots table - OK (${data?.length || 0} available slots)`)
        results.database.bookable_slots = true
        
        if (data && data.length > 0) {
          console.log(`   Sample slot: ${data[0].start_time} for session ${data[0].session_id}`)
        }
      }
    } catch (err) {
      console.log('❌ bookable_slots table - ERROR:', err.message)
      results.database.bookable_slots = false
    }

    // Test bookings table schema
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, session_id, learner_id, status')
        .limit(1)
      
      if (error) {
        console.log('❌ bookings table schema - FAILED:', error.message)
        results.database.bookings = false
      } else {
        console.log('✅ bookings table schema - OK')
        results.database.bookings = true
      }
    } catch (err) {
      console.log('❌ bookings table schema - ERROR:', err.message)
      results.database.bookings = false
    }

    // Test 3: API Endpoint Simulation
    console.log('\n🌐 Simulating API Endpoints:')
    
    // Simulate the time-slots endpoint query
    try {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const { data, error } = await supabase
        .from('bookable_slots')
        .select('id, start_time, end_time, is_available, session_id')
        .gte('start_time', tomorrow.toISOString())
        .eq('is_available', true)
        .limit(10)
      
      if (error) {
        console.log('❌ time-slots endpoint simulation - FAILED:', error.message)
        results.endpoints.time_slots = false
      } else {
        console.log(`✅ time-slots endpoint simulation - OK (${data?.length || 0} future slots)`)
        results.endpoints.time_slots = true
      }
    } catch (err) {
      console.log('❌ time-slots endpoint simulation - ERROR:', err.message)
      results.endpoints.time_slots = false
    }

    // Summary
    console.log('\n📈 RESULTS SUMMARY:')
    console.log('==================')
    
    const functionsPassed = Object.values(results.functions).filter(Boolean).length
    const functionsTotal = Object.keys(results.functions).length
    console.log(`🔧 Database Functions: ${functionsPassed}/${functionsTotal} passing`)
    
    const databasePassed = Object.values(results.database).filter(Boolean).length
    const databaseTotal = Object.keys(results.database).length
    console.log(`📊 Database Tables: ${databasePassed}/${databaseTotal} working`)
    
    const endpointsPassed = Object.values(results.endpoints).filter(Boolean).length
    const endpointsTotal = Object.keys(results.endpoints).length
    console.log(`🌐 API Simulations: ${endpointsPassed}/${endpointsTotal} working`)

    const totalPassed = functionsPassed + databasePassed + endpointsPassed
    const totalTests = functionsTotal + databaseTotal + endpointsTotal
    const successRate = Math.round((totalPassed / totalTests) * 100)
    
    console.log(`\n🎯 Overall Success Rate: ${successRate}% (${totalPassed}/${totalTests})`)
    
    if (successRate >= 80) {
      console.log('\n✅ SYSTEM STATUS: OPERATIONAL')
      console.log('🚀 Ready for production use!')
    } else {
      console.log('\n⚠️ SYSTEM STATUS: NEEDS ATTENTION')
      console.log('🔧 Some critical components need fixing')
    }

    console.log('\n🎯 RECOMMENDED NEXT STEPS:')
    console.log('1. Test the complete booking flow in the browser')
    console.log('2. Verify that learners can see and book available slots')
    console.log('3. Test payment processing end-to-end')
    console.log('4. Monitor logs for any remaining schema issues')

  } catch (error) {
    console.error('💥 Critical testing failed:', error)
    process.exit(1)
  }
}

testCriticalAPIs()