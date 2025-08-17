import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';

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

    const { id: bookingId } = await params;

    // Use the booking_details view for consolidated data
    const { data: booking, error: bookingError } = await supabase
      .from('booking_details')
      .select('*')
      .eq('id', bookingId)
      .or(`learner_id.eq.${user.id},expert_id.eq.${user.id}`)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found or unauthorized' },
        { status: 404 }
      );
    }

    const isStudent = booking.learner_id === user.id;
    const isExpert = booking.expert_id === user.id;

    const formattedBooking = {
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.payment_status,
      scheduledAt: booking.scheduled_at,
      duration: booking.duration_minutes,
      price: booking.amount_authorized,
      currency: booking.currency,
      notes: booking.learner_notes,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      role: isStudent ? 'student' : 'expert',
      session: {
        id: booking.session_id,
        title: booking.session_title,
        description: booking.session_description,
        duration: booking.duration_minutes,
      },
      expert: isStudent ? {
        id: booking.expert_id,
        name: booking.expert_name,
        bio: booking.expert_bio,
      } : undefined,
      student: isExpert ? {
        id: booking.learner_id,
        name: booking.learner_name,
      } : undefined,
      slot: {
        id: booking.slot_id,
        startTime: booking.slot_start_time,
        endTime: booking.slot_end_time,
      },
      payment: {
        stripePaymentIntentId: booking.stripe_payment_intent_id,
        amountAuthorized: booking.amount_authorized,
        amountCaptured: booking.amount_captured,
        amountRefunded: booking.amount_refunded,
        cancellationFee: booking.cancellation_fee,
      },
      cancellation: booking.status === 'cancelled' ? {
        cancelledBy: booking.cancelled_by,
        cancelledAt: booking.cancelled_at,
        reason: booking.cancellation_reason,
      } : undefined,
    };

    return NextResponse.json(formattedBooking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSideClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookingId } = await params;
    const body = await request.json();
    const { notes, scheduled_at } = body;

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
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

    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only update pending bookings' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (scheduled_at !== undefined) {
      updateData.scheduled_at = scheduled_at;
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Booking updated successfully',
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}