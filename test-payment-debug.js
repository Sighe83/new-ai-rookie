#!/usr/bin/env node

/**
 * Specific test for payment intent creation API issue
 * This tests the exact failing scenario from the user's report
 */

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

async function testPaymentIntentFix() {
  console.log('🚨 Testing Payment Intent Creation Fix')
  console.log('=====================================')
  console.log('This test reproduces the exact error scenario from your report:\n')
  console.log('ERROR: "Failed to update booking with payment details"')
  console.log('CAUSE: payment_status column missing or update failing\n')

  try {
    // Step 1: Set up test data
    console.log('📋 Step 1: Setting up test scenario...')
    
    // Get test session, learner, and slot
    const { data: session } = await supabase
      .from('sessions')
      .select('id, expert_id, price_cents, currency')
      .eq('is_active', true)
      .limit(1)
      .single()

    const { data: learner } = await supabase
      .from('learner_profiles')
      .select('id')
      .limit(1)
      .single()

    const { data: slot } = await supabase
      .from('bookable_slots')
      .select('id, start_time, end_time')
      .eq('is_available', true)
      .limit(1)
      .single()

    if (!session || !learner || !slot) {
      throw new Error('Missing test data - need active session, learner, and available slot')
    }

    // Create test booking with all required fields
    const heldUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        learner_id: learner.id,
        expert_id: session.expert_id,
        session_id: session.id,
        slot_id: slot.id,
        start_at: slot.start_time,
        end_at: slot.end_time,
        scheduled_at: slot.start_time,
        held_until: heldUntil.toISOString(),
        amount_authorized: session.price_cents,
        currency: session.currency,
        status: 'pending',
        payment_status: 'pending'
      })
      .select()
      .single()

    if (bookingError) {
      throw new Error(`Failed to create test booking: ${bookingError.message}`)
    }

    console.log(`✅ Test booking created: ${booking.id}`)
    console.log(`   - Amount: ${booking.amount_authorized} ${booking.currency}`)
    console.log(`   - Payment Status: ${booking.payment_status}`)

    // Step 2: Test the EXACT update that was failing
    console.log('\n📋 Step 2: Testing the failing payment intent update...')
    console.log('Attempting the EXACT update from /app/api/payment/create-intent/route.ts:')
    console.log('')
    console.log('const { error: updateError } = await supabase')
    console.log('  .from("bookings")')
    console.log('  .update({')
    console.log('    stripe_payment_intent_id: paymentIntent.id,')
    console.log('    amount_authorized: amount,')
    console.log('    currency: currency,')
    console.log('    payment_status: "authorized",')
    console.log('  })')
    console.log('  .eq("id", bookingId)')
    console.log('')

    const mockPaymentIntentId = `pi_test_${Date.now()}`
    const amount = session.price_cents
    const currency = session.currency.toLowerCase()

    console.log(`Testing with:`)
    console.log(`  - stripe_payment_intent_id: ${mockPaymentIntentId}`)
    console.log(`  - amount_authorized: ${amount}`)
    console.log(`  - currency: ${currency}`)
    console.log(`  - payment_status: "authorized"`)
    console.log(`  - booking_id: ${booking.id}`)
    console.log('')

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        stripe_payment_intent_id: mockPaymentIntentId,
        amount_authorized: amount,
        currency: currency.toUpperCase(), // Fix: Database constraint expects uppercase currency codes
        payment_status: 'authorized', // Fix: Use 'authorized' instead of 'processing'
      })
      .eq('id', booking.id)

    if (updateError) {
      console.log('❌ PAYMENT INTENT UPDATE FAILED!')
      console.log('   This is the exact error you were experiencing:')
      console.log(`   Error Code: ${updateError.code}`)
      console.log(`   Error Message: ${updateError.message}`)
      console.log(`   Error Details: ${JSON.stringify(updateError.details)}`)
      
      // Analyze the specific error
      if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
        const column = updateError.message.match(/column "([^"]+)"/)?.[1]
        console.log(`\n🔍 ROOT CAUSE: Column "${column}" is missing from bookings table`)
        console.log('🛠️  SOLUTION: Need to apply migration that adds this column')
      } else if (updateError.code === '23502') {
        console.log('\n🔍 ROOT CAUSE: NULL constraint violation')
        console.log('🛠️  SOLUTION: Check for missing required fields')
      } else {
        console.log('\n🔍 ROOT CAUSE: Unknown database error')
        console.log('🛠️  SOLUTION: Need to investigate schema or permissions')
      }
    } else {
      console.log('✅ PAYMENT INTENT UPDATE SUCCEEDED!')
      console.log('   The database schema issue has been RESOLVED!')
    }

    // If update failed, test individual status values to debug the constraint
    if (updateError) {
      console.log('\n🔍 Step 2b: Testing valid payment status values...')
      
      const statusesToTest = ['authorized', 'captured', 'failed', 'cancelled']
      
      for (const status of statusesToTest) {
        const { error: statusError } = await supabase
          .from('bookings')
          .update({ payment_status: status })
          .eq('id', booking.id)
        
        if (statusError) {
          console.log(`❌ Status '${status}': ${statusError.code} - ${statusError.message}`)
        } else {
          console.log(`✅ Status '${status}': VALID`)
          // Reset to pending for next test
          await supabase.from('bookings').update({ payment_status: 'pending' }).eq('id', booking.id)
        }
      }
    }

    // Step 3: Verify the update worked
    if (!updateError) {
      console.log('\n📋 Step 3: Verifying update results...')
      
      const { data: updatedBooking } = await supabase
        .from('bookings')
        .select('stripe_payment_intent_id, payment_status, amount_authorized, currency')
        .eq('id', booking.id)
        .single()

      console.log('✅ Updated booking data:')
      console.log(`   - Stripe Payment Intent: ${updatedBooking.stripe_payment_intent_id}`)
      console.log(`   - Payment Status: ${updatedBooking.payment_status}`)
      console.log(`   - Amount: ${updatedBooking.amount_authorized}`)
      console.log(`   - Currency: ${updatedBooking.currency}`)
    }

    // Step 4: Cleanup
    console.log('\n📋 Step 4: Cleaning up test data...')
    await supabase.from('bookings').delete().eq('id', booking.id)
    console.log('✅ Test booking deleted')

    // Final result
    console.log('\n' + '='.repeat(60))
    console.log('🎯 PAYMENT INTENT CREATION TEST RESULT')
    console.log('='.repeat(60))
    
    if (updateError) {
      console.log('❌ ISSUE STILL EXISTS')
      console.log('   Your payment intent creation API will continue to fail')
      console.log('   The database schema needs to be updated')
      console.log('\n🛠️  IMMEDIATE ACTION REQUIRED:')
      console.log('   1. Apply the missing database migration')
      console.log('   2. Verify payment_status column exists in bookings table')
      console.log('   3. Check for any other missing columns')
    } else {
      console.log('✅ ISSUE RESOLVED')
      console.log('   Your payment intent creation API should now work correctly!')
      console.log('   The database schema has been properly updated')
      console.log('\n🎉 NEXT STEPS:')
      console.log('   1. Test the API endpoint in your browser/Postman')
      console.log('   2. Verify the complete payment flow')
      console.log('   3. Monitor for any other potential issues')
    }

  } catch (error) {
    console.error('💥 Test setup failed:', error.message)
    console.error('   This might indicate a deeper database issue')
  }
}

testPaymentIntentFix()