import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSideClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = params.id;
    const body = await request.json();
    const { notes, reason } = body;

    // Validate booking ID format
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid booking ID' },
        { status: 400 }
      );
    }

    // Validate notes input
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string') {
        return NextResponse.json(
          { error: 'Notes must be a string' },
          { status: 400 }
        );
      }
      if (notes.length > 500) {
        return NextResponse.json(
          { error: 'Notes must not exceed 500 characters' },
          { status: 400 }
        );
      }
    }

    // Validate reason input
    if (reason !== undefined && reason !== null) {
      if (typeof reason !== 'string') {
        return NextResponse.json(
          { error: 'Reason must be a string' },
          { status: 400 }
        );
      }
      if (reason.length > 500) {
        return NextResponse.json(
          { error: 'Reason must not exceed 500 characters' },
          { status: 400 }
        );
      }
    }

    // Call atomic decline_booking database function
    const { data: declineResult, error: declineError } = await supabase
      .rpc('decline_booking', {
        p_booking_id: bookingId,
        p_expert_user_id: user.id,
        p_notes: notes || null,
        p_reason: reason || 'Expert declined booking'
      })
      .single();

    if (declineError) {
      console.error('Database error in decline_booking:', declineError);
      return NextResponse.json(
        { error: 'Failed to decline booking' },
        { status: 500 }
      );
    }

    if (!declineResult.success) {
      return NextResponse.json(
        { error: declineResult.error_message || 'Failed to decline booking' },
        { status: 400 }
      );
    }

    // If payment needs to be cancelled, call Stripe cancel
    let paymentCancelled = false;
    let cancelError = null;

    if (declineResult.stripe_payment_intent_id && declineResult.amount_to_refund > 0) {
      try {
        const paymentIntent = await stripe.paymentIntents.cancel(
          declineResult.stripe_payment_intent_id
        );

        paymentCancelled = true;

        // Update payment status to refunded after successful cancellation
        const { error: paymentUpdateError } = await supabase
          .from('bookings')
          .update({ 
            payment_status: 'refunded',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (paymentUpdateError) {
          console.error('Failed to update payment status after cancellation:', paymentUpdateError);
        }

        // Add audit log for payment cancellation
        await supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          event_type: 'payment_refunded',
          actor_user_id: user.id,
          actor_type: 'expert',
          old_payment_status: 'authorized',
          new_payment_status: 'refunded',
          metadata: {
            stripe_payment_intent_id: paymentIntent.id,
            amount_refunded: declineResult.amount_to_refund,
            refunded_at: new Date().toISOString(),
            refund_reason: reason || 'Expert declined booking'
          }
        });

      } catch (stripeError: any) {
        console.error('Failed to cancel payment:', stripeError);
        cancelError = stripeError.message;
        
        // Log the error but don't fail the decline - booking is declined
        await supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          event_type: 'payment_cancel_failed',
          actor_user_id: user.id,
          actor_type: 'system',
          notes: `Payment cancellation failed: ${stripeError.message}`,
          metadata: {
            stripe_payment_intent_id: declineResult.stripe_payment_intent_id,
            stripe_error_code: stripeError.code,
            error_message: stripeError.message
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: bookingId,
        status: declineResult.booking_status,
        payment_status: paymentCancelled ? 'refunded' : declineResult.payment_status,
        declined_at: new Date().toISOString(),
        decline_reason: reason || 'Expert declined booking'
      },
      payment: {
        cancelled: paymentCancelled,
        amount: declineResult.amount_to_refund,
        currency: declineResult.currency,
        error: cancelError
      }
    });

  } catch (error) {
    console.error('Error in decline booking endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if booking can be declined
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = params.id;

    // Get user's expert profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: expertProfile, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    if (expertError || !expertProfile) {
      return NextResponse.json({ error: 'Expert profile not found' }, { status: 403 });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, status, payment_status, expert_id, learner_id,
        start_at, end_at, created_at, amount_authorized, currency,
        expert_notes, learner_notes, declined_reason, declined_at
      `)
      .eq('id', bookingId)
      .eq('expert_id', expertProfile.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found or unauthorized' }, { status: 404 });
    }

    const canDecline = booking.status === 'pending_approval';

    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
        payment_status: booking.payment_status,
        start_at: booking.start_at,
        end_at: booking.end_at,
        created_at: booking.created_at,
        amount_authorized: booking.amount_authorized,
        currency: booking.currency,
        expert_notes: booking.expert_notes,
        learner_notes: booking.learner_notes,
        declined_reason: booking.declined_reason,
        declined_at: booking.declined_at
      },
      permissions: {
        can_decline: canDecline
      },
      decline_reasons: [
        'Schedule conflict',
        'Topic not in my expertise',
        'Insufficient information provided',
        'Student requirements unclear',
        'Other (please specify in notes)'
      ]
    });

  } catch (error) {
    console.error('Error checking booking decline status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}