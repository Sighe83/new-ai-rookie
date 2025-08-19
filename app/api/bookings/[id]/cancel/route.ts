import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== CANCEL BOOKING ENDPOINT CALLED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const supabase = await createServerSideClient();
    console.log('✅ Supabase client created successfully');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth check result:', { 
      userId: user?.id, 
      userEmail: user?.email,
      authError: authError 
    });
    
    if (authError || !user) {
      console.log('❌ Authentication failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const bookingId = resolvedParams.id;
    console.log('📋 Extracted booking ID:', bookingId);
    console.log('📋 Booking ID type:', typeof bookingId);
    console.log('📋 Booking ID length:', bookingId?.length);

    // Parse request body with detailed logging
    let body: any = {};
    let reason = null;
    try {
      const rawBody = await request.text();
      console.log('📨 Raw request body:', rawBody);
      
      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
        reason = body.reason;
        console.log('📨 Parsed request body:', { body, reason });
      } else {
        console.log('📨 Empty request body received');
      }
    } catch (jsonError) {
      console.error('❌ JSON parsing error:', jsonError);
      body = {};
      reason = null;
    }

    if (!bookingId) {
      console.log('❌ Missing booking ID in request');
      return NextResponse.json(
        { error: 'Missing booking ID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      console.log('❌ Invalid booking ID format:', bookingId);
      return NextResponse.json(
        { error: 'Invalid booking ID format' },
        { status: 400 }
      );
    }

    if (!uuidRegex.test(user.id)) {
      console.log('❌ Invalid user ID format:', user.id);
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Pre-flight check: verify booking exists and user has access
    console.log('🔍 Pre-flight check: Looking for booking...');
    const { data: bookingCheck, error: bookingCheckError } = await supabase
      .from('bookings')
      .select('id, status, learner_id, expert_id')
      .eq('id', bookingId)
      .single();

    console.log('🔍 Booking check result:', { 
      booking: bookingCheck, 
      error: bookingCheckError 
    });

    if (bookingCheckError) {
      console.log('❌ Booking lookup failed:', bookingCheckError);
    }

    // Prepare database function call with correct parameter mapping
    // Function signature: cancel_booking_transaction(p_booking_id uuid, p_user_id uuid, p_reason text)
    const functionParams = {
      p_booking_id: bookingId,
      p_user_id: user.id,        // ✅ FIXED: Correct parameter name
      p_reason: reason || null   // ✅ FIXED: Correct parameter name
    };

    console.log('=== CALLING DATABASE FUNCTION ===');
    console.log('🔧 Function name: cancel_booking_transaction');
    console.log('🔧 Parameters:', functionParams);
    console.log('🔧 Parameter types:', {
      p_booking_id: typeof functionParams.p_booking_id,
      p_user_id: typeof functionParams.p_user_id,
      p_reason: typeof functionParams.p_reason
    });

    let result, transactionError;
    try {
      console.log('⏳ Executing database function...');
      const dbResponse = await supabase.rpc('cancel_booking_transaction', functionParams);
      result = dbResponse.data;
      transactionError = dbResponse.error;
      
      console.log('✅ Database function call completed');
      console.log('📊 Raw database response:', { 
        data: result, 
        error: transactionError,
        status: dbResponse.status,
        statusText: dbResponse.statusText
      });
    } catch (rpcError) {
      console.error('💥 RPC call threw exception:', rpcError);
      console.error('💥 Exception stack:', rpcError instanceof Error ? rpcError.stack : 'No stack trace');
      transactionError = rpcError;
    }

    if (transactionError) {
      console.error('Database transaction error details:', {
        code: transactionError.code,
        message: transactionError.message,
        details: transactionError.details,
        hint: transactionError.hint,
        fullError: transactionError
      });
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

    const transactionResult = result[0];
    console.log('Transaction result:', transactionResult);

    // Get the booking details to find the Stripe Payment Intent ID
    const { data: bookingData, error: bookingLookupError } = await supabase
      .from('bookings')
      .select('stripe_payment_intent_id, payment_status')
      .eq('id', bookingId)
      .single();

    if (bookingLookupError || !bookingData?.stripe_payment_intent_id) {
      console.log('No Stripe payment intent found for booking:', bookingLookupError);
      return NextResponse.json({
        success: true,
        message: 'Booking cancelled successfully (no payment to cancel)',
        booking: {
          id: bookingId,
          status: 'cancelled',
          refund_amount_cents: transactionResult.refund_amount_cents || 0,
          cancellation_fee_cents: transactionResult.cancellation_fee_cents || 0,
        }
      });
    }

    // Cancel the Stripe Payment Intent
    console.log('🎗️ Cancelling Stripe Payment Intent:', bookingData.stripe_payment_intent_id);
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const cancelledPaymentIntent = await stripe.paymentIntents.cancel(
        bookingData.stripe_payment_intent_id,
        {
          cancellation_reason: 'requested_by_customer'
        }
      );
      console.log('✅ Stripe Payment Intent cancelled:', cancelledPaymentIntent.status);
      
      return NextResponse.json({
        success: true,
        message: 'Booking cancelled successfully',
        booking: {
          id: bookingId,
          status: 'cancelled',
          stripe_status: cancelledPaymentIntent.status,
          refund_amount_cents: transactionResult.refund_amount_cents || 0,
          cancellation_fee_cents: transactionResult.cancellation_fee_cents || 0,
        }
      });
    } catch (stripeError: any) {
      console.error('❌ Failed to cancel Stripe payment:', stripeError);
      return NextResponse.json({
        success: true,
        message: 'Booking cancelled in database, but Stripe payment cancellation failed',
        warning: `Stripe error: ${stripeError.message}`,
        booking: {
          id: bookingId,
          status: 'cancelled',
          refund_amount_cents: transactionResult.refund_amount_cents || 0,
          cancellation_fee_cents: transactionResult.cancellation_fee_cents || 0,
        }
      });
    }

  } catch (error) {
    console.error('Error cancelling booking:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        details: error instanceof Error ? error.stack : error
      },
      { status: 500 }
    );
  }
}
