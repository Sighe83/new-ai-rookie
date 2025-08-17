import { NextRequest, NextResponse } from 'next/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import { createServerSideClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, amount, currency = 'usd' } = body;

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId and amount' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('booking_details')
      .select('*')
      .eq('id', bookingId)
      .eq('learner_id', user.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found or unauthorized' },
        { status: 404 }
      );
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
      amount: formatAmountForStripe(amount, currency),
      currency: currency,
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

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        amount_authorized: amount,
        currency: currency,
        payment_status: 'processing',
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
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}