import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const bookingId = resolvedParams.id;
    const body = await request.json();
    const { reason } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing booking ID' },
        { status: 400 }
      );
    }

    // Use transaction function for atomic booking cancellation
    let transactionResult;
    try {
      console.log('Calling cancel_booking_transaction with:', { 
        p_booking_id: bookingId, 
        p_cancelled_by_user_id: user.id, 
        p_cancellation_reason: reason || null 
      });

      const { data: result, error: transactionError } = await supabase.rpc('cancel_booking_transaction', {
        p_booking_id: bookingId,
        p_cancelled_by_user_id: user.id,
        p_cancellation_reason: reason || null
      });

      console.log('Database function result:', { result, error: transactionError });

      if (transactionError) {
        console.error('Database transaction error:', transactionError);
        return NextResponse.json(
          { 
            error: 'Database error: ' + (transactionError.message || 'Failed to cancel booking'),
            details: transactionError 
          },
          { status: 400 }
        );
      }

      if (!result || result.length === 0) {
        console.log('No result from database function');
        return NextResponse.json(
          { error: 'No result from booking cancellation - booking may not exist or you may not have permission to cancel it' },
          { status: 404 }
        );
      }

      transactionResult = result[0];
      console.log('Transaction result:', transactionResult);
    } catch (error) {
      console.error('Booking cancellation transaction error:', error);
      return NextResponse.json(
        { 
          error: 'Transaction error: ' + (error instanceof Error ? error.message : 'Failed to cancel booking'),
          details: error instanceof Error ? error.stack : error
        },
        { status: 500 }
      );
    }

    // Handle Stripe operations based on transaction result
    const { 
      refund_amount_cents, 
      cancellation_fee_cents,
      stripe_payment_intent_id,
      payment_status 
    } = transactionResult || {};

    console.log('Extracted values from transaction:', {
      refund_amount_cents,
      cancellation_fee_cents, 
      stripe_payment_intent_id,
      payment_status
    });

    let stripeOperationSuccess = true;
    let stripeError = null;

    // Handle refunds for captured payments
    if (refund_amount_cents > 0 && stripe_payment_intent_id) {
      try {
        const refundIdempotencyKey = `refund_${bookingId}_${Date.now()}`;
        
        await stripe.refunds.create({
          payment_intent: stripe_payment_intent_id,
          amount: refund_amount_cents,
          reason: 'requested_by_customer',
          metadata: {
            bookingId: bookingId,
            reason: reason || 'Booking cancelled by user',
          },
        }, {
          idempotencyKey: refundIdempotencyKey,
        });

        // Update payment status to refunded
        await supabase
          .from('bookings')
          .update({ 
            payment_status: 'refunded',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

      } catch (refundError: any) {
        console.error('Stripe refund error:', refundError);
        stripeOperationSuccess = false;
        stripeError = refundError.message;
      }
    }
    // Handle cancellation of authorized but uncaptured payments
    else if (payment_status === 'authorized' && stripe_payment_intent_id) {
      try {
        const cancelIdempotencyKey = `cancel_${bookingId}_${Date.now()}`;
        
        await stripe.paymentIntents.cancel(stripe_payment_intent_id, {
          idempotencyKey: cancelIdempotencyKey,
        });

        // Update payment status to cancelled
        await supabase
          .from('bookings')
          .update({ 
            payment_status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

      } catch (cancelError: any) {
        console.error('Stripe payment intent cancellation error:', cancelError);
        stripeOperationSuccess = false;
        stripeError = cancelError.message;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: bookingId,
        status: 'cancelled',
        refund_amount_cents: refund_amount_cents || 0,
        cancellation_fee_cents: cancellation_fee_cents || 0,
        payment_status: refund_amount_cents > 0 ? 'refunded' : (payment_status === 'authorized' ? 'cancelled' : payment_status),
      },
      stripe: {
        success: stripeOperationSuccess,
        error: stripeError
      }
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check cancellation policy before cancelling
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const bookingId = resolvedParams.id;

    // Get cancellation policy preview
    const { data: policyResult, error: policyError } = await supabase
      .rpc('get_cancellation_policy', {
        p_booking_id: bookingId,
        p_cancelled_by_user_id: user.id
      })
      .single();

    if (policyError) {
      console.error('Error getting cancellation policy:', policyError);
      return NextResponse.json(
        { error: policyError.message || 'Failed to get cancellation policy' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      booking_id: bookingId,
      can_cancel: policyResult.can_cancel,
      cancellation_fee_cents: policyResult.cancellation_fee_cents,
      refund_amount_cents: policyResult.refund_amount_cents,
      hours_until_session: policyResult.hours_until_session,
      policy_message: policyResult.policy_message
    });

  } catch (error) {
    console.error('Error checking cancellation policy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}