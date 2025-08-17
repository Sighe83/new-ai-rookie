import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerSideClient();
    
    // Step 1: Clean up expired pending bookings (30 minutes timeout)
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, stripe_payment_intent_id, payment_status, slot_id')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error('Error fetching expired bookings:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch expired bookings' }, { status: 500 });
    }

    let cleanedCount = 0;
    let stripeErrorCount = 0;

    // Process each expired booking
    for (const booking of expiredBookings || []) {
      try {
        // Cancel Stripe payment intent if it exists and is authorized
        if (booking.stripe_payment_intent_id && booking.payment_status === 'authorized') {
          const idempotencyKey = `cleanup_cancel_${booking.id}_${Date.now()}`;
          
          try {
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id, {
              idempotencyKey,
            });
          } catch (stripeError) {
            console.error(`Failed to cancel payment intent for booking ${booking.id}:`, stripeError);
            stripeErrorCount++;
            continue; // Skip this booking if Stripe operation fails
          }
        }

        // Update booking status to cancelled
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            payment_status: booking.payment_status === 'authorized' ? 'cancelled' : booking.payment_status,
            cancelled_by: 'system',
            cancellation_reason: 'Booking expired - no expert confirmation within 30 minutes',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)
          .eq('status', 'pending'); // Ensure it's still pending

        if (updateError) {
          console.error(`Failed to update booking ${booking.id}:`, updateError);
          continue;
        }

        // Release the slot
        if (booking.slot_id) {
          const { error: slotError } = await supabase
            .from('bookable_slots')
            .update({
              is_available: true,
              current_bookings: 0, // Reset to 0 for simplicity
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.slot_id);

          if (slotError) {
            console.error(`Failed to release slot ${booking.slot_id}:`, slotError);
          }
        }

        cleanedCount++;
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error);
      }
    }

    // Step 2: Clean up very old cancelled/completed bookings (90 days)
    const { data: oldBookings, error: oldBookingsError } = await supabase
      .from('bookings')
      .select('id, stripe_payment_intent_id')
      .in('status', ['cancelled', 'completed', 'declined'])
      .lt('updated_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100); // Process in batches

    if (!oldBookingsError && oldBookings && oldBookings.length > 0) {
      // Archive old bookings by moving sensitive data
      const { error: archiveError } = await supabase
        .from('bookings')
        .update({
          stripe_payment_intent_id: null, // Remove Stripe references
          learner_notes: null,
          expert_notes: null,
        })
        .in('id', oldBookings.map(b => b.id));

      if (archiveError) {
        console.error('Error archiving old bookings:', archiveError);
      }
    }

    // Step 3: Clean up orphaned slots (slots with no active bookings that are marked unavailable)
    const { error: orphanedSlotsError } = await supabase.rpc('cleanup_orphaned_slots');
    
    if (orphanedSlotsError) {
      console.error('Error cleaning orphaned slots:', orphanedSlotsError);
    }

    return NextResponse.json({
      success: true,
      cleanedBookings: cleanedCount,
      stripeErrors: stripeErrorCount,
      processedExpiredBookings: expiredBookings?.length || 0,
      archivedOldBookings: oldBookings?.length || 0,
    });

  } catch (error) {
    console.error('Error in booking cleanup job:', error);
    return NextResponse.json(
      { error: 'Cleanup job failed' },
      { status: 500 }
    );
  }
}

// Allow manual triggering for testing (remove in production)
export async function GET() {
  return NextResponse.json({
    message: 'Booking cleanup endpoint ready. Use POST with proper authorization.',
    timeout: '30 minutes for pending bookings',
    archive: '90 days for completed bookings',
  });
}