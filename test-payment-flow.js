// Simple curl-based test for payment flow
const { exec } = require('child_process');

async function testWebhookEndpoint() {
  console.log('🧪 Testing webhook endpoint directly...');
  
  // Test 1: Check if webhook endpoint is accessible
  console.log('📍 Testing webhook endpoint accessibility...');
  
  exec('curl -X POST http://localhost:3000/api/webhooks/stripe -v', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Webhook endpoint test failed:', error.message);
      return;
    }
    
    console.log('📋 Webhook endpoint response:');
    console.log('STDOUT:', stdout);
    console.log('STDERR:', stderr);
    
    if (stderr.includes('400') && stdout.includes('Missing stripe-signature')) {
      console.log('✅ SUCCESS: Webhook endpoint is working! Returns expected 400 for missing signature.');
    } else if (stderr.includes('200')) {
      console.log('⚠️  Unexpected 200 response - check server logs');
    } else {
      console.log('🤔 Unexpected response - check server logs');
    }
  });
}

// Test webhook endpoint
testWebhookEndpoint();

// Also check current Stripe payment intents to see our previous tests
console.log('\n🔍 To verify webhook fixes worked, check that recent payment intents are no longer "canceled"');
console.log('💡 Run: stripe payment_intents list --limit=3');