import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerSideClient } from '@/lib/supabase-server';
import { PaymentStatusMapper, InvalidPaymentStatusTransitionError } from '@/lib/payment-status-mapper';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentIntentId, bookingId, amountToCapture } = body;

    if (!paymentIntentId && !bookingId) {
      return NextResponse.json(
        { error: 'Either paymentIntentId or bookingId is required' },
        { status: 400 }
      );
    }

    // Find booking by payment intent ID or booking ID
    let bookingQuery = supabase.from('bookings').select('*');
    
    if (bookingId) {
      bookingQuery = bookingQuery.eq('id', bookingId);
    } else {
      bookingQuery = bookingQuery.eq('stripe_payment_intent_id', paymentIntentId);
    }

    const { data: booking, error: bookingError } = await bookingQuery.single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify booking belongs to user (either as learner or expert)
    // Get user profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if user is the learner
    const { data: learnerProfile } = await supabase
      .from('learner_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    // Check if user is the expert
    const { data: expertProfile } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    const isLearner = learnerProfile && booking.learner_id === learnerProfile.id;
    const isExpert = expertProfile && booking.expert_id === expertProfile.id;

    if (!isLearner && !isExpert) {
      return NextResponse.json({ error: 'Unauthorized - booking does not belong to user' }, { status: 403 });
    }

    // Validate current payment status
    if (booking.payment_status !== 'authorized') {
      return NextResponse.json(
        { 
          error: `Cannot capture payment. Current status: ${booking.payment_status}. Expected: authorized`,
          currentStatus: booking.payment_status
        },
        { status: 400 }
      );
    }

    if (!booking.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'No payment intent associated with this booking' },
        { status: 400 }
      );
    }

    // Capture the payment with Stripe
    const captureOptions: any = {};
    if (amountToCapture && amountToCapture !== booking.amount_authorized) {
      captureOptions.amount_to_capture = amountToCapture;
    }

    const paymentIntent = await stripe.paymentIntents.capture(
      booking.stripe_payment_intent_id,
      captureOptions
    );

    // Update booking status to completed
    // Note: The webhook will also update this, but we update immediately for faster UX
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'completed',
        amount_captured: amountToCapture || booking.amount_authorized,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('payment_status', 'authorized'); // Ensure it's still authorized

    if (updateError) {
      console.error('Failed to update booking after capture:', updateError);
      // Don't fail the request since Stripe capture succeeded - webhook will handle it
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      capturedAmount: amountToCapture || booking.amount_authorized,
      bookingId: booking.id,
      status: 'completed'
    });

  } catch (error) {
    console.error('Error capturing payment:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as any;
      if (stripeError.type === 'StripeInvalidRequestError') {
        return NextResponse.json(
          { error: `Stripe error: ${stripeError.message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to capture payment' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if a payment can be captured
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const paymentIntentId = searchParams.get('paymentIntentId');

    if (!bookingId && !paymentIntentId) {
      return NextResponse.json(
        { error: 'Either bookingId or paymentIntentId is required' },
        { status: 400 }
      );
    }

    // Find booking
    let bookingQuery = supabase.from('bookings').select('*');
    
    if (bookingId) {
      bookingQuery = bookingQuery.eq('id', bookingId);
    } else {
      bookingQuery = bookingQuery.eq('stripe_payment_intent_id', paymentIntentId);
    }

    const { data: booking, error: bookingError } = await bookingQuery.single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check capture eligibility
    const canCapture = booking.payment_status === 'authorized' && booking.stripe_payment_intent_id;
    const validNextStatuses = PaymentStatusMapper.getValidNextStatuses(booking.payment_status as any);

    return NextResponse.json({
      bookingId: booking.id,
      paymentIntentId: booking.stripe_payment_intent_id,
      currentStatus: booking.payment_status,
      canCapture,
      validNextStatuses,
      authorizedAmount: booking.amount_authorized,
      statusDescription: PaymentStatusMapper.getStatusDescription(booking.payment_status as any)
    });

  } catch (error) {
    console.error('Error checking capture status:', error);
    return NextResponse.json(
      { error: 'Failed to check capture status' },
      { status: 500 }
    );
  }
}