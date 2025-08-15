// Check database schema
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

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');
  
  try {
    // Check expert_profiles table
    console.log('👨‍🏫 Expert profiles table:');
    const { data: experts, error: expertsError } = await supabase
      .from('expert_profiles')
      .select('*')
      .limit(1);
    
    if (expertsError) {
      console.error('❌ Error:', expertsError);
    } else {
      if (experts && experts.length > 0) {
        console.log('✅ Columns:', Object.keys(experts[0]).join(', '));
        console.log('📊 Sample data:', experts[0]);
      } else {
        console.log('⚠️  Table exists but no data');
      }
    }
    console.log('');
    
    // Check expert_sessions table
    console.log('📚 Expert sessions table:');
    const { data: sessions, error: sessionsError } = await supabase
      .from('expert_sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      console.error('❌ Error:', sessionsError);
    } else {
      if (sessions && sessions.length > 0) {
        console.log('✅ Columns:', Object.keys(sessions[0]).join(', '));
        console.log('📊 Sample data:', sessions[0]);
      } else {
        console.log('⚠️  Table exists but no data');
      }
    }
    console.log('');
    
    // Check slots table
    console.log('🕐 Slots table:');
    const { data: slots, error: slotsError } = await supabase
      .from('slots')
      .select('*')
      .limit(1);
    
    if (slotsError) {
      console.error('❌ Error:', slotsError);
    } else {
      if (slots && slots.length > 0) {
        console.log('✅ Columns:', Object.keys(slots[0]).join(', '));
        console.log('📊 Sample data:', slots[0]);
      } else {
        console.log('⚠️  Table exists but no data');
      }
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

// Run the check
checkSchema();