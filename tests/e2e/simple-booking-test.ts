// Simple booking system test to verify setup
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Create Supabase client for testing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testBookingSystem() {
  console.log('🧪 Starting simple booking system test...\n');
  
  try {
    // Test 1: Database connection
    console.log('1️⃣ Testing database connection...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('expert_sessions')
      .select('id, title')
      .limit(1);
    
    if (sessionsError) {
      console.error('❌ Database connection failed:', sessionsError);
      return false;
    }
    console.log('✅ Database connection successful\n');
    
    // Test 2: Find test expert
    console.log('2️⃣ Finding test expert (Dr. Sarah Chen)...');
    const { data: expert, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id, display_name')
      .eq('display_name', 'Dr. Sarah Chen - AI Expert')
      .single();
    
    if (expertError || !expert) {
      console.error('❌ Test expert not found');
      return false;
    }
    console.log(`✅ Found test expert: ${expert.display_name} (ID: ${expert.id})\n`);
    
    // Test 3: Get expert sessions
    console.log('3️⃣ Getting expert sessions...');
    const { data: expertSessions, error: sessionError } = await supabase
      .from('expert_sessions')
      .select('id, title, session_rate')
      .eq('expert_id', expert.id)
      .eq('is_active', true);
    
    if (sessionError || !expertSessions || expertSessions.length === 0) {
      console.error('❌ No sessions found for test expert');
      return false;
    }
    
    console.log('✅ Found sessions:');
    expertSessions.forEach(session => {
      console.log(`   - ${session.title} ($${session.session_rate})`);
    });
    console.log('');
    
    // Test 4: Check available slots
    console.log('4️⃣ Checking available slots...');
    const { data: slots, error: slotsError } = await supabase
      .from('slots')
      .select('id, start_time, end_time, is_available')
      .eq('expert_session_id', expertSessions[0].id)
      .eq('is_available', true)
      .gte('start_time', new Date().toISOString())
      .limit(5);
    
    if (slotsError) {
      console.error('❌ Error fetching slots:', slotsError);
      return false;
    }
    
    if (!slots || slots.length === 0) {
      console.log('⚠️  No available slots found');
    } else {
      console.log(`✅ Found ${slots.length} available slots:`);
      slots.forEach((slot, index) => {
        const start = new Date(slot.start_time);
        console.log(`   ${index + 1}. ${start.toLocaleDateString()} at ${start.toLocaleTimeString()}`);
      });
    }
    console.log('');
    
    // Test 5: Check bookings table
    console.log('5️⃣ Checking bookings table...');
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, status, payment_status')
      .eq('expert_id', expert.id)
      .limit(5);
    
    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
      return false;
    }
    
    console.log(`✅ Bookings table accessible. Found ${bookings?.length || 0} bookings.\n`);
    
    // Test 6: Verify stored procedures
    console.log('6️⃣ Verifying stored procedures...');
    const procedures = [
      'create_booking_transaction',
      'confirm_booking_transaction',
      'cancel_booking_transaction',
      'cleanup_orphaned_slots'
    ];
    
    let allProceduresExist = true;
    for (const proc of procedures) {
      const { data, error } = await supabase.rpc(proc, {}, { count: 'exact' }).limit(0);
      if (error && !error.message.includes('required')) {
        console.log(`   ❌ ${proc}: Not found`);
        allProceduresExist = false;
      } else {
        console.log(`   ✅ ${proc}: Available`);
      }
    }
    console.log('');
    
    // Summary
    console.log('📊 TEST SUMMARY');
    console.log('================');
    console.log('✅ Database connection: Working');
    console.log('✅ Test expert: Found');
    console.log('✅ Expert sessions: Found');
    console.log(`${slots && slots.length > 0 ? '✅' : '⚠️ '} Available slots: ${slots?.length || 0} found`);
    console.log('✅ Bookings table: Accessible');
    console.log(`${allProceduresExist ? '✅' : '⚠️ '} Stored procedures: ${allProceduresExist ? 'All available' : 'Some missing'}`);
    console.log('');
    console.log('🎉 Basic booking system test completed successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testBookingSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });