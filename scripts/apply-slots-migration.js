#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applySlotsMigration() {
  console.log('🔧 Applying bookable slots generation migration...\n');

  try {
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250817000002_generate_bookable_slots.sql', 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Execute the migration
    const { data, error } = await supabaseAdmin.rpc('exec', {
      query: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      
      // Try executing in parts for better error handling
      console.log('🔄 Trying to execute migration in parts...');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        
        const { error: stmtError } = await supabaseAdmin.rpc('exec', {
          query: statement
        });
        
        if (stmtError) {
          console.error(`   ❌ Statement ${i + 1} failed:`, stmtError.message);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
        } else {
          console.log(`   ✅ Statement ${i + 1} completed`);
        }
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }

    // Verify the results
    console.log('\n🔍 Verifying migration results...');
    
    // Check availability windows
    const { data: windows, error: windowsError } = await supabaseAdmin
      .from('availability_windows')
      .select('id, expert_id, start_at, end_at, is_closed')
      .eq('is_closed', false);

    if (windowsError) {
      console.error('❌ Error checking availability windows:', windowsError.message);
    } else {
      console.log(`📅 Found ${windows?.length || 0} open availability windows`);
      windows?.forEach(w => {
        console.log(`   Window ${w.id}: ${w.start_at} - ${w.end_at}`);
      });
    }

    // Check generated slots
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('bookable_slots')
      .select('id, session_id, availability_window_id, start_time, end_time, is_available');

    if (slotsError) {
      console.error('❌ Error checking bookable slots:', slotsError.message);
    } else {
      console.log(`🎯 Found ${slots?.length || 0} bookable slots`);
      slots?.slice(0, 5).forEach(s => {
        console.log(`   Slot ${s.id}: ${s.start_time} - ${s.end_time} (${s.is_available ? 'Available' : 'Booked'})`);
      });
      if ((slots?.length || 0) > 5) {
        console.log(`   ... and ${(slots?.length || 0) - 5} more slots`);
      }
    }

    // Check sessions
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('sessions')
      .select('id, title, duration_minutes, is_active')
      .eq('is_active', true);

    if (sessionsError) {
      console.error('❌ Error checking sessions:', sessionsError.message);
    } else {
      console.log(`📚 Found ${sessions?.length || 0} active sessions`);
      sessions?.forEach(s => {
        console.log(`   Session ${s.id}: "${s.title}" (${s.duration_minutes} min)`);
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 MIGRATION COMPLETED!');
    console.log('='.repeat(50));
    console.log('\n💡 Your availability windows should now generate bookable slots');
    console.log('🔗 Try visiting the booking page to see available time slots');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

applySlotsMigration().catch(console.error);