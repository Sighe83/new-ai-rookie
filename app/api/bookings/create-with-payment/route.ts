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
      slot_id, 
      notes
    } = body;

    if (!slot_id) {
      return NextResponse.json(
        { error: 'Missing slot_id' },
        { status: 400 }
      );
    }

    // Create booking using the consolidated function
    const { data: bookingResult, error: bookingError } = await supabase.rpc('create_booking_with_payment', {
      p_learner_user_id: user.id,
      p_slot_id: slot_id,
      p_notes: notes || null
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
      amount: booking.amount_cents, // Amount already in cents
      currency: booking.currency.toLowerCase(),
      metadata: {
        booking_id: booking.booking_id,
        session_id: booking.session_id,
        expert_id: booking.expert_id,
        learner_id: user.id
      },
      capture_method: 'manual', // Don't capture until expert confirms
    });

    // Update booking with payment intent ID
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'authorized'
      })
      .eq('id', booking.booking_id);

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