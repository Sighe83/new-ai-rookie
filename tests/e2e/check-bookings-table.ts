// Check the actual bookings table schema
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

async function checkBookingsTable() {
  console.log('🔍 Checking bookings table schema...\n');
  
  try {
    // Get the table schema using information_schema
    console.log('📊 Getting column information from information_schema...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          ORDER BY ordinal_position;
        `
      });
    
    if (columnsError) {
      console.error('❌ Error getting schema:', columnsError);
      
      // Fallback: try to get a sample row to see the structure
      console.log('📊 Trying fallback approach...');
      const { data: sampleBooking, error: sampleError } = await supabase
        .from('bookings')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ Error getting sample:', sampleError);
      } else {
        if (sampleBooking && sampleBooking.length > 0) {
          console.log('✅ Sample booking columns:', Object.keys(sampleBooking[0]).join(', '));
          console.log('📊 Sample data:');
          console.log(JSON.stringify(sampleBooking[0], null, 2));
        } else {
          console.log('ℹ️  No existing bookings to sample from');
        }
      }
    } else {
      console.log('✅ Bookings table columns:');
      columns?.forEach((col: any) => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`   ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });
    }
    
    // Check for held_until specifically
    console.log('\n🔍 Checking for held_until column specifically...');
    const { data: heldUntilCheck, error: heldUntilError } = await supabase
      .from('bookings')
      .select('held_until')
      .limit(1);
    
    if (heldUntilError) {
      if (heldUntilError.message?.includes('held_until')) {
        console.log('❌ held_until column does NOT exist');
        console.log('   Error:', heldUntilError.message);
      } else {
        console.log('⚠️  Error checking held_until:', heldUntilError);
      }
    } else {
      console.log('✅ held_until column exists');
    }
    
  } catch (error) {
    console.error('❌ Error checking bookings table:', error);
  }
}

// Run the check
checkBookingsTable();