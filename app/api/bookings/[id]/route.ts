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

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        slots (
          *,
          expert_sessions (
            *,
            experts:profiles!expert_sessions_expert_id_fkey (
              id,
              email,
              full_name,
              avatar_url,
              bio
            )
          )
        ),
        student:profiles!bookings_student_id_fkey (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('id', bookingId)
      .or(`student_id.eq.${user.id},expert_id.eq.${user.id}`)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found or unauthorized' },
        { status: 404 }
      );
    }

    const isStudent = booking.student_id === user.id;
    const isExpert = booking.expert_id === user.id;

    const formattedBooking = {
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.payment_status,
      scheduledAt: booking.scheduled_at,
      duration: booking.slots?.expert_sessions?.duration || 60,
      price: booking.amount_authorized,
      currency: booking.currency,
      notes: booking.notes,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      role: isStudent ? 'student' : 'expert',
      session: {
        id: booking.slots?.expert_sessions?.id,
        title: booking.slots?.expert_sessions?.title,
        description: booking.slots?.expert_sessions?.description,
        type: booking.slots?.expert_sessions?.type,
        maxStudents: booking.slots?.expert_sessions?.max_students,
      },
      expert: isStudent ? {
        id: booking.slots?.expert_sessions?.experts?.id,
        name: booking.slots?.expert_sessions?.experts?.full_name,
        email: booking.slots?.expert_sessions?.experts?.email,
        avatar: booking.slots?.expert_sessions?.experts?.avatar_url,
        bio: booking.slots?.expert_sessions?.experts?.bio,
      } : undefined,
      student: isExpert ? {
        id: booking.student?.id,
        name: booking.student?.full_name,
        email: booking.student?.email,
        avatar: booking.student?.avatar_url,
      } : undefined,
      slot: {
        id: booking.slots?.id,
        startTime: booking.slots?.start_time,
        endTime: booking.slots?.end_time,
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
      .eq('student_id', user.id)
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