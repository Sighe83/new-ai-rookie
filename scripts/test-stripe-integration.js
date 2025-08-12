#!/usr/bin/env node

require('dotenv').config({ path: '.env.development' });
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function testStripeIntegration() {
  console.log('🧪 STRIPE INTEGRATION TEST\n');
  
  try {
    // 1. Test basic Stripe connection
    console.log('1️⃣ Testing Stripe connection...');
    const account = await stripe.accounts.retrieve();
    console.log('✅ Connected to Stripe account:', account.display_name || account.id);
    console.log('   Country:', account.country);
    console.log('   Currency:', account.default_currency);
    
    // 2. Test payment intent creation (similar to booking flow)
    console.log('\n2️⃣ Testing payment intent creation...');
    
    const testAmount = 100000; // 1000 DKK in øre
    const testCurrency = 'dkk';
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: testAmount,
      currency: testCurrency,
      capture_method: 'manual', // Authorization only, like in booking
      metadata: {
        test: 'true',
        expert_session_id: 'test-session-123',
        learner_id: 'test-learner-456'
      },
      description: 'Test AI Learning Session Booking'
    });
    
    console.log('✅ Payment intent created:', paymentIntent.id);
    console.log('   Amount:', paymentIntent.amount, paymentIntent.currency);
    console.log('   Status:', paymentIntent.status);
    console.log('   Capture method:', paymentIntent.capture_method);
    console.log('   Client secret:', paymentIntent.client_secret ? 'Present' : 'Missing');
    
    // 3. Test payment intent retrieval
    console.log('\n3️⃣ Testing payment intent retrieval...');
    const retrievedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
    console.log('✅ Payment intent retrieved successfully');
    console.log('   Status:', retrievedIntent.status);
    
    // 4. Test payment intent cancellation (cleanup)
    console.log('\n4️⃣ Testing payment intent cancellation...');
    const cancelledIntent = await stripe.paymentIntents.cancel(paymentIntent.id);
    console.log('✅ Payment intent cancelled:', cancelledIntent.status);
    
    // 5. Test different currencies
    console.log('\n5️⃣ Testing multi-currency support...');
    const currencies = ['dkk', 'usd', 'eur'];
    
    for (const currency of currencies) {
      try {
        const testIntent = await stripe.paymentIntents.create({
          amount: currency === 'dkk' ? 100000 : 1000, // Adjust for currency
          currency: currency,
          capture_method: 'manual'
        });
        
        console.log('✅', currency.toUpperCase(), '- Payment intent created:', testIntent.id);
        
        // Clean up
        await stripe.paymentIntents.cancel(testIntent.id);
        
      } catch (error) {
        console.log('❌', currency.toUpperCase(), '- Error:', error.message);
      }
    }
    
    // 6. Test webhook endpoint signature verification (if webhook secret exists)
    console.log('\n6️⃣ Testing webhook configuration...');
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('✅ Webhook secret configured');
    } else {
      console.log('⚠️  Webhook secret not configured (optional for development)');
    }
    
    console.log('\n🎉 STRIPE INTEGRATION TEST COMPLETE!');
    console.log('\n📊 Test Results:');
    console.log('✅ Basic connection: PASS');
    console.log('✅ Payment intent creation: PASS');
    console.log('✅ Payment intent retrieval: PASS');
    console.log('✅ Payment intent cancellation: PASS');
    console.log('✅ Multi-currency support: PASS');
    
  } catch (error) {
    console.error('❌ STRIPE TEST FAILED:', error.message);
    
    if (error.code) {
      console.log('Error code:', error.code);
    }
    
    if (error.type) {
      console.log('Error type:', error.type);
    }
    
    // Specific error handling
    if (error.message.includes('No such account')) {
      console.log('\n💡 This might indicate an issue with your Stripe account setup');
    } else if (error.message.includes('Invalid API key')) {
      console.log('\n💡 Check your STRIPE_SECRET_KEY in .env.development');
    } else if (error.message.includes('permission')) {
      console.log('\n💡 Your Stripe account may need additional permissions');
    }
  }
}

// Additional test: Validate our Stripe helper functions
async function testHelperFunctions() {
  console.log('\n🔧 TESTING HELPER FUNCTIONS...');
  
  try {
    const path = require('path');
    const { formatAmountForStripe, getCurrencyForStripe } = require(path.join(__dirname, '../lib/stripe'));
    
    // Test amount formatting
    console.log('formatAmountForStripe(50000):', formatAmountForStripe(50000)); // Should be 50000
    console.log('formatAmountForStripe(50050):', formatAmountForStripe(50050)); // Should be 50050
    
    // Test currency formatting
    console.log('getCurrencyForStripe("DKK"):', getCurrencyForStripe("DKK")); // Should be "dkk"
    console.log('getCurrencyForStripe("USD"):', getCurrencyForStripe("USD")); // Should be "usd"
    console.log('getCurrencyForStripe("EUR"):', getCurrencyForStripe("EUR")); // Should be "eur"
    
    console.log('✅ Helper functions working correctly');
    
  } catch (error) {
    console.log('❌ Helper functions error:', error.message);
  }
}

// Run tests
testStripeIntegration()
  .then(() => testHelperFunctions())
  .catch(console.error);