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
    const { bookingId, reason } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing required field: bookingId' },
        { status: 400 }
      );
    }

    // Use transaction function for atomic booking cancellation
    let transactionResult;
    try {
      const { data: result, error: transactionError } = await supabase.rpc('cancel_booking_transaction', {
        p_booking_id: bookingId,
        p_user_id: user.id,
        p_reason: reason
      });

      if (transactionError) {
        throw transactionError;
      }

      transactionResult = result?.[0];
      if (!transactionResult) {
        throw new Error('No result from booking cancellation');
      }
    } catch (error) {
      console.error('Booking cancellation transaction error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to cancel booking' },
        { status: 400 }
      );
    }

    // Get booking details for Stripe operations if refund is needed
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('stripe_payment_intent_id, payment_status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Could not fetch booking for Stripe operations:', bookingError);
    }

    // Handle Stripe operations based on transaction result
    const { refund_amount, payment_status, cancelled_by } = transactionResult;

    if (refund_amount > 0 && booking?.stripe_payment_intent_id) {
      try {
        // Generate idempotency key for refund
        const refundIdempotencyKey = `refund_${bookingId}_${Date.now()}`;
        
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(refund_amount * 100),
          reason: 'requested_by_customer',
          metadata: {
            bookingId: bookingId,
            cancelledBy: cancelled_by,
            reason: reason || 'No reason provided',
          },
        }, {
          idempotencyKey: refundIdempotencyKey,
        });
      } catch (refundError) {
        console.error('Refund error:', refundError);
        return NextResponse.json(
          { error: `Failed to process refund: ${refundError instanceof Error ? refundError.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    } else if (payment_status === 'cancelled' && booking?.stripe_payment_intent_id) {
      try {
        // Generate idempotency key for payment intent cancellation
        const cancelIdempotencyKey = `cancel_${bookingId}_${Date.now()}`;
        
        await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id, {
          idempotencyKey: cancelIdempotencyKey,
        });
      } catch (cancelError) {
        console.error('Payment intent cancellation error:', cancelError);
      }
    }

    return NextResponse.json({
      message: 'Booking cancelled successfully',
      booking: {
        id: bookingId,
        status: 'cancelled',
        refundAmount: refund_amount,
        cancellationFee: transactionResult.cancellation_fee,
        cancelledBy: cancelled_by,
      },
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}