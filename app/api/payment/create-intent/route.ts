import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerSideClient } from '@/lib/supabase-server';
import { CurrencyService } from '@/lib/currency-config';
import { Currency } from '@/types/expert-sessions';
import { PaymentStatusMapper } from '@/lib/payment-status-mapper';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Payment intent request body:', JSON.stringify(body, null, 2));
    const { bookingId, amount, currency = 'dkk' } = body;

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId and amount' },
        { status: 400 }
      );
    }

    // Get learner profile ID (bookings use learner_profiles.id, not user.id)
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: learnerProfile, error: learnerError } = await supabase
      .from('learner_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    if (learnerError || !learnerProfile) {
      return NextResponse.json({ error: 'Learner profile not found' }, { status: 404 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('learner_id', learnerProfile.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found or unauthorized' }, { status: 404 });
    }

    if (booking.payment_status !== 'pending') {
      return NextResponse.json(
        { error: 'Payment has already been processed for this booking' },
        { status: 400 }
      );
    }

    // Generate idempotency key to prevent duplicate payment intents
    const idempotencyKey = `booking_${bookingId}_${Date.now()}`;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount already in cents from booking
      currency: CurrencyService.getStripeCurrency(currency.toUpperCase() as Currency),
      automatic_payment_methods: {
        enabled: true,
      },
      capture_method: 'manual',
      metadata: {
        bookingId: bookingId,
        studentId: user.id,
        expertId: booking.expert_id || '',
        idempotencyKey: idempotencyKey,
      },
      description: `Booking for AI tutoring session with ${booking.expert_name || 'expert'}`,
    }, {
      idempotencyKey: idempotencyKey,
    });

    // Map the payment intent status to business-friendly status
    const businessStatus = PaymentStatusMapper.getBusinessStatusFromPaymentIntent(paymentIntent);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        amount_authorized: amount,
        currency: currency.toUpperCase(), // Database constraint expects uppercase currency codes
        payment_status: businessStatus, // Use mapped business status
      })
      .eq('id', bookingId);

    if (updateError) {
      await stripe.paymentIntents.cancel(paymentIntent.id);
      return NextResponse.json(
        { error: 'Failed to update booking with payment details' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: error?.constructor?.name,
      stripeError: error?.type || 'Not a Stripe error'
    });
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}