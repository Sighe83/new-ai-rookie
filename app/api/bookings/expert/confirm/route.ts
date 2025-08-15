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
    const { bookingId, action } = body;

    if (!bookingId || !action || !['confirm', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request. Provide bookingId and action (confirm/decline)' },
        { status: 400 }
      );
    }

    // Use transaction function for atomic booking confirmation
    let transactionResult;
    try {
      const { data: result, error: transactionError } = await supabase.rpc('confirm_booking_transaction', {
        p_booking_id: bookingId,
        p_expert_user_id: user.id,
        p_action: action
      });

      if (transactionError) {
        throw transactionError;
      }

      transactionResult = result?.[0];
      if (!transactionResult) {
        throw new Error('No result from booking confirmation');
      }
    } catch (error) {
      console.error('Booking confirmation transaction error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to process booking confirmation' },
        { status: 400 }
      );
    }

    if (action === 'confirm') {
      if (transactionResult.payment_status !== 'captured') {
        return NextResponse.json(
          { error: 'Payment capture failed' },
          { status: 400 }
        );
      }

      // Get booking details for Stripe operations
      const { data: booking } = await supabase
        .from('bookings')
        .select('stripe_payment_intent_id, payment_status')
        .eq('id', bookingId)
        .single();

      if (booking?.stripe_payment_intent_id && booking.payment_status === 'authorized') {
        try {
          // Generate idempotency key for capture
          const captureIdempotencyKey = `capture_${bookingId}_${Date.now()}`;
          
          const paymentIntent = await stripe.paymentIntents.capture(
            booking.stripe_payment_intent_id,
            {},
            {
              idempotencyKey: captureIdempotencyKey,
            }
          );

          return NextResponse.json({
            message: 'Booking confirmed and payment captured successfully',
            booking: {
              id: bookingId,
              status: transactionResult.status,
              payment_status: transactionResult.payment_status,
              amount_captured: transactionResult.amount_captured,
            },
          });
        } catch (stripeError) {
          console.error('Stripe capture error:', stripeError);
          return NextResponse.json(
            { error: `Failed to capture payment: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json({
          message: 'Booking confirmed successfully',
          booking: {
            id: bookingId,
            status: transactionResult.status,
            payment_status: transactionResult.payment_status,
          },
        });
      }
    } else if (action === 'decline') {
      // Get booking details for Stripe operations
      const { data: booking } = await supabase
        .from('bookings')
        .select('stripe_payment_intent_id, payment_status')
        .eq('id', bookingId)
        .single();

      if (booking?.stripe_payment_intent_id && booking.payment_status === 'authorized') {
        try {
          // Generate idempotency key for cancellation
          const cancelIdempotencyKey = `cancel_${bookingId}_${Date.now()}`;
          
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id, {
            idempotencyKey: cancelIdempotencyKey,
          });
        } catch (error) {
          console.error('Error canceling payment intent:', error);
        }
      }

      return NextResponse.json({
        message: 'Booking declined and payment cancelled',
        booking: {
          id: bookingId,
          status: transactionResult.status,
          payment_status: transactionResult.payment_status,
        },
      });
    }
  } catch (error) {
    console.error('Error processing booking confirmation:', error);
    return NextResponse.json(
      { error: 'Failed to process booking confirmation' },
      { status: 500 }
    );
  }
}