import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      session_id, 
      expert_id, 
      start_at, 
      end_at, 
      availability_window_id, 
      amount, 
      currency = 'USD'
    } = body;

    if (!session_id || !expert_id || !start_at || !end_at || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create booking and payment intent in a transaction
    const { data: bookingResult, error: bookingError } = await supabase.rpc('create_transactional_booking', {
      p_learner_id: user.id,
      p_expert_id: expert_id,
      p_session_id: session_id,
      p_start_at: start_at,
      p_end_at: end_at,
      p_availability_window_id: availability_window_id,
      p_amount: amount,
      p_currency: currency
    });

    if (bookingError || !bookingResult || bookingResult.length === 0) {
      console.error('Booking creation error:', bookingError);
      return NextResponse.json(
        { error: bookingError?.message || 'Failed to create booking' },
        { status: 500 }
      );
    }

    const booking = bookingResult[0];

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        booking_id: booking.id,
        session_id: session_id,
        expert_id: expert_id,
        learner_id: user.id
      },
      capture_method: 'manual', // Don't capture until expert confirms
    });

    // Update booking with payment intent ID
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending_payment'
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Failed to update booking with payment intent:', updateError);
      // Still return success as booking was created
    }

    return NextResponse.json({
      booking,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret
      },
      message: 'Booking created with payment intent'
    });
  } catch (error) {
    console.error('Error creating booking with payment:', error);
    return NextResponse.json(
      { error: 'Failed to create booking with payment' },
      { status: 500 }
    );
  }
}