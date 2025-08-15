// Test API endpoints
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

async function testAPIEndpoints() {
  console.log('🔗 Testing API endpoints...\n');
  
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
  
  try {
    // Test 1: Time slots API
    console.log('1️⃣ Testing time-slots API...');
    
    // Use the session ID from the schema check
    const sessionId = '86b80212-4532-4fbe-aee9-f69b1e6ded70';
    const today = new Date().toISOString().split('T')[0];
    
    const slotsURL = `${baseURL}/api/expert-sessions/${sessionId}/time-slots?start_date=${today}`;
    console.log(`   URL: ${slotsURL}`);
    
    try {
      const response = await fetch(slotsURL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Success!');
        console.log(`   📊 Found ${data.time_slots?.length || 0} time slots`);
        
        if (data.time_slots && data.time_slots.length > 0) {
          console.log('   📅 First 3 slots:');
          data.time_slots.slice(0, 3).forEach((slot: any, index: number) => {
            const start = new Date(slot.start_at);
            console.log(`      ${index + 1}. ${start.toLocaleDateString()} at ${start.toLocaleTimeString()} (Available: ${slot.is_available})`);
          });
        }
      } else {
        console.log('   ❌ Failed');
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (error) {
      console.log('   ❌ Request failed');
      console.log(`   Error: ${error}`);
    }
    
    console.log('');
    
    // Test 2: Check server health
    console.log('2️⃣ Testing server health...');
    
    try {
      const healthResponse = await fetch(`${baseURL}/api/health`, {
        method: 'GET'
      });
      
      console.log(`   Status: ${healthResponse.status}`);
      
      if (healthResponse.status === 404) {
        console.log('   ℹ️  Health endpoint not found (expected)');
      } else if (healthResponse.ok) {
        console.log('   ✅ Health endpoint working');
      }
    } catch (error) {
      console.log('   ℹ️  Health endpoint test skipped');
    }
    
    console.log('');
    
    // Test 3: Try to create a booking (should fail due to missing auth/data)
    console.log('3️⃣ Testing booking creation endpoint...');
    
    try {
      const bookingResponse = await fetch(`${baseURL}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          expert_id: 'f3656214-310f-43c9-a092-28a4c65c7ba8',
          start_at: '2025-08-18T10:00:00Z',
          end_at: '2025-08-18T11:00:00Z'
        })
      });
      
      console.log(`   Status: ${bookingResponse.status} ${bookingResponse.statusText}`);
      
      if (bookingResponse.status === 401) {
        console.log('   ✅ Correctly requires authentication');
      } else {
        const data = await bookingResponse.text();
        console.log(`   Response: ${data}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
    }
    
    console.log('');
    
    console.log('✅ API endpoint tests completed');
    
  } catch (error) {
    console.error('❌ Error testing endpoints:', error);
    process.exit(1);
  }
}

// Run the tests
testAPIEndpoints();