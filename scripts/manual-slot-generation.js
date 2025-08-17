#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function manualSlotGeneration() {
  console.log('🔧 Manually generating bookable slots...\n');

  try {
    // Step 1: Get availability windows
    console.log('📅 Fetching availability windows...');
    const { data: windows, error: windowsError } = await supabaseAdmin
      .from('availability_windows')
      .select('*')
      .eq('is_closed', false)
      .gte('end_at', new Date().toISOString());

    if (windowsError) {
      console.error('❌ Error fetching windows:', windowsError.message);
      return;
    }

    console.log(`   Found ${windows?.length || 0} open availability windows`);

    // Step 2: Get active sessions
    console.log('📚 Fetching active sessions...');
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('is_active', true);

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError.message);
      return;
    }

    console.log(`   Found ${sessions?.length || 0} active sessions`);

    // Step 3: Generate slots manually
    let totalSlotsCreated = 0;

    for (const window of windows || []) {
      console.log(`\n🕐 Processing window ${window.id}...`);
      console.log(`   Time: ${window.start_at} - ${window.end_at}`);
      console.log(`   Expert: ${window.expert_id}`);

      // Find sessions for this expert
      const expertSessions = sessions?.filter(s => s.expert_id === window.expert_id) || [];
      console.log(`   Found ${expertSessions.length} sessions for this expert`);

      for (const session of expertSessions) {
        console.log(`\n   📝 Generating slots for session: "${session.title}" (${session.duration_minutes} min)`);

        // Clear existing slots for this combination
        const { error: deleteError } = await supabaseAdmin
          .from('bookable_slots')
          .delete()
          .eq('session_id', session.id)
          .eq('availability_window_id', window.id);

        if (deleteError) {
          console.error(`   ❌ Error clearing existing slots:`, deleteError.message);
          continue;
        }

        // Generate time slots
        const startTime = new Date(window.start_at);
        const endTime = new Date(window.end_at);
        const sessionDuration = session.duration_minutes * 60 * 1000; // Convert to milliseconds
        const slotInterval = 15 * 60 * 1000; // 15 minutes in milliseconds

        let currentSlotStart = startTime;
        let slotsForSession = 0;

        while (currentSlotStart.getTime() + sessionDuration <= endTime.getTime()) {
          const slotEnd = new Date(currentSlotStart.getTime() + sessionDuration);

          // Create the slot
          const { error: insertError } = await supabaseAdmin
            .from('bookable_slots')
            .insert({
              session_id: session.id,
              availability_window_id: window.id,
              start_time: currentSlotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              is_available: true,
              max_bookings: 1,
              current_bookings: 0,
              auto_generated: true
            });

          if (insertError) {
            console.error(`   ❌ Error creating slot:`, insertError.message);
          } else {
            slotsForSession++;
            totalSlotsCreated++;
          }

          // Move to next slot (15-minute increments)
          currentSlotStart = new Date(currentSlotStart.getTime() + slotInterval);
        }

        console.log(`   ✅ Created ${slotsForSession} slots for "${session.title}"`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🎉 SLOT GENERATION COMPLETED!`);
    console.log(`📊 Total slots created: ${totalSlotsCreated}`);
    console.log('='.repeat(60));

    // Verify the results
    console.log('\n🔍 Verifying results...');
    const { data: allSlots, error: slotsError } = await supabaseAdmin
      .from('bookable_slots')
      .select(`
        id,
        start_time,
        end_time,
        is_available,
        sessions!inner(title, duration_minutes),
        availability_windows!inner(start_at, end_at)
      `);

    if (slotsError) {
      console.error('❌ Error verifying slots:', slotsError.message);
    } else {
      console.log(`🎯 Total bookable slots in database: ${allSlots?.length || 0}`);
      
      if (allSlots && allSlots.length > 0) {
        console.log('\n📋 Sample slots:');
        allSlots.slice(0, 5).forEach(slot => {
          console.log(`   ${slot.start_time} - ${slot.end_time} | ${slot.sessions.title} (${slot.sessions.duration_minutes}min)`);
        });
        
        if (allSlots.length > 5) {
          console.log(`   ... and ${allSlots.length - 5} more slots`);
        }
      }
    }

    console.log('\n💡 You should now see available time slots in the booking page!');

  } catch (error) {
    console.error('❌ Manual generation error:', error.message);
    process.exit(1);
  }
}

manualSlotGeneration().catch(console.error);