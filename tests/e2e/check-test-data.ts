// Check what test data exists
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

async function checkTestData() {
  console.log('🔍 Checking what test data exists...\n');
  
  try {
    // Check expert profiles
    console.log('👨‍🏫 Expert profiles:');
    const { data: experts, error: expertsError } = await supabase
      .from('expert_profiles')
      .select('id, display_name, user_id');
    
    if (expertsError) {
      console.error('❌ Error fetching experts:', expertsError);
    } else {
      if (experts && experts.length > 0) {
        experts.forEach((expert, index) => {
          console.log(`   ${index + 1}. ${expert.display_name} (ID: ${expert.id})`);
        });
      } else {
        console.log('   No expert profiles found');
      }
    }
    console.log('');
    
    // Check expert sessions
    console.log('📚 Expert sessions:');
    const { data: sessions, error: sessionsError } = await supabase
      .from('expert_sessions')
      .select('id, title, session_rate, expert_id, is_active');
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
    } else {
      if (sessions && sessions.length > 0) {
        sessions.forEach((session, index) => {
          console.log(`   ${index + 1}. ${session.title} - $${session.session_rate} (Expert: ${session.expert_id}, Active: ${session.is_active})`);
        });
      } else {
        console.log('   No expert sessions found');
      }
    }
    console.log('');
    
    // Check slots
    console.log('🕐 Available slots:');
    const { data: slots, error: slotsError } = await supabase
      .from('slots')
      .select('id, expert_session_id, start_time, is_available')
      .eq('is_available', true)
      .gte('start_time', new Date().toISOString())
      .limit(10);
    
    if (slotsError) {
      console.error('❌ Error fetching slots:', slotsError);
    } else {
      if (slots && slots.length > 0) {
        slots.forEach((slot, index) => {
          const start = new Date(slot.start_time);
          console.log(`   ${index + 1}. Session ${slot.expert_session_id} - ${start.toLocaleDateString()} at ${start.toLocaleTimeString()}`);
        });
      } else {
        console.log('   No available slots found');
      }
    }
    console.log('');
    
    // Check recent bookings
    console.log('📝 Recent bookings:');
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, status, payment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
    } else {
      if (bookings && bookings.length > 0) {
        bookings.forEach((booking, index) => {
          const created = new Date(booking.created_at);
          console.log(`   ${index + 1}. ${booking.status}/${booking.payment_status} - ${created.toLocaleDateString()}`);
        });
      } else {
        console.log('   No bookings found');
      }
    }
    console.log('');
    
    console.log('✅ Test data check completed');
    
  } catch (error) {
    console.error('❌ Error checking test data:', error);
    process.exit(1);
  }
}

// Run the check
checkTestData();