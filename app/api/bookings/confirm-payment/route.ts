import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, payment_intent_id } = body;

    if (!booking_id || !payment_intent_id) {
      return NextResponse.json(
        { error: 'Missing required fields: booking_id and payment_intent_id' },
        { status: 400 }
      );
    }

    // Update booking status to payment authorized
    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'payment_authorized',
        stripe_payment_intent_id: payment_intent_id,
        payment_authorized_at: new Date().toISOString()
      })
      .eq('id', booking_id)
      .eq('learner_id', user.id) // Ensure user owns this booking
      .select()
      .single();

    if (updateError || !booking) {
      console.error('Failed to update booking status:', updateError);
      return NextResponse.json(
        { error: 'Failed to confirm payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      booking,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}