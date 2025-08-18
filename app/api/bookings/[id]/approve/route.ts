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
    const { notes } = body;

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

    // Call atomic approve_booking database function
    const { data: approvalResult, error: approvalError } = await supabase
      .rpc('approve_booking', {
        p_booking_id: bookingId,
        p_expert_user_id: user.id,
        p_notes: notes || null
      })
      .single();

    if (approvalError) {
      console.error('Database error in approve_booking:', approvalError);
      return NextResponse.json(
        { error: 'Failed to approve booking' },
        { status: 500 }
      );
    }

    if (!approvalResult.success) {
      return NextResponse.json(
        { error: approvalResult.error_message || 'Failed to approve booking' },
        { status: 400 }
      );
    }

    // If payment needs to be captured, call Stripe capture
    let paymentCaptured = false;
    let captureError = null;

    if (approvalResult.stripe_payment_intent_id && approvalResult.amount_to_capture > 0) {
      try {
        const paymentIntent = await stripe.paymentIntents.capture(
          approvalResult.stripe_payment_intent_id,
          {
            amount_to_capture: approvalResult.amount_to_capture
          }
        );

        paymentCaptured = true;

        // Update payment status to completed after successful capture
        const { error: paymentUpdateError } = await supabase
          .from('bookings')
          .update({ 
            payment_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (paymentUpdateError) {
          console.error('Failed to update payment status after capture:', paymentUpdateError);
        }

        // Add audit log for payment capture
        await supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          event_type: 'payment_captured',
          actor_user_id: user.id,
          actor_type: 'expert',
          old_payment_status: 'authorized',
          new_payment_status: 'completed',
          metadata: {
            stripe_payment_intent_id: paymentIntent.id,
            amount_captured: approvalResult.amount_to_capture,
            captured_at: new Date().toISOString()
          }
        });

      } catch (stripeError: any) {
        console.error('Failed to capture payment:', stripeError);
        captureError = stripeError.message;
        
        // Don't fail the approval - the booking is approved but payment capture failed
        // This can be handled by admin/retry logic
        await supabase.from('booking_audit_log').insert({
          booking_id: bookingId,
          event_type: 'payment_capture_failed',
          actor_user_id: user.id,
          actor_type: 'system',
          notes: `Payment capture failed: ${stripeError.message}`,
          metadata: {
            stripe_payment_intent_id: approvalResult.stripe_payment_intent_id,
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
        status: approvalResult.booking_status,
        payment_status: paymentCaptured ? 'completed' : approvalResult.payment_status,
        approved_at: new Date().toISOString()
      },
      payment: {
        captured: paymentCaptured,
        amount: approvalResult.amount_to_capture,
        currency: approvalResult.currency,
        error: captureError
      }
    });

  } catch (error) {
    console.error('Error in approve booking endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if booking can be approved
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
        expert_notes, learner_notes
      `)
      .eq('id', bookingId)
      .eq('expert_id', expertProfile.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found or unauthorized' }, { status: 404 });
    }

    const canApprove = booking.status === 'pending_approval' && booking.payment_status === 'authorized';
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
        learner_notes: booking.learner_notes
      },
      permissions: {
        can_approve: canApprove,
        can_decline: canDecline
      }
    });

  } catch (error) {
    console.error('Error checking booking approval status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}