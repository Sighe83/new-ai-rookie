import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Booking request data:', JSON.stringify(body, null, 2));
    const { 
      session_id, 
      expert_id, 
      start_at, 
      end_at, 
      availability_window_id, 
      amount, 
      currency,
      slotId: inputSlotId, 
      sessionId, 
      notes 
    } = body;

    // Support both new format and legacy format
    const finalSessionId = session_id || sessionId;
    const finalExpertId = expert_id;
    const finalStartAt = start_at;
    const finalEndAt = end_at;
    const finalWindowId = availability_window_id;
    const finalCurrency = currency || 'DKK';

    if (!finalSessionId || !finalStartAt || !finalEndAt) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, start_at, end_at' },
        { status: 400 }
      );
    }

    // Validate session exists and get actual price
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('id, expert_id, price_cents, currency')
      .eq('id', finalSessionId)
      .eq('is_active', true)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 });
    }

    // Use server-side price, not client-provided price (security fix)
    const finalAmount = sessionData.price_cents;
    const actualExpertId = sessionData.expert_id;

    // First, get the user_profile_id for the authenticated user
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get the learner_profile_id
    const { data: learnerProfile, error: learnerProfileError } = await supabase
      .from('learner_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single();

    if (learnerProfileError || !learnerProfile) {
      return NextResponse.json({ error: 'Learner profile not found' }, { status: 404 });
    }

    // Find or create the bookable_slot first
    let slotId = inputSlotId || null;
    
    if (!slotId) {
      // First, try to find an existing available slot that matches the time window
      const { data: existingSlot } = await supabase
        .from('bookable_slots')
        .select('id')
        .eq('session_id', finalSessionId)
        .eq('start_time', finalStartAt)
        .eq('end_time', finalEndAt)
        .eq('is_available', true)
        .single();

      if (existingSlot) {
        slotId = existingSlot.id;
      } else if (finalWindowId) {
        // Create a new slot if we have an availability window ID
        const { data: newSlot, error: slotError } = await supabase
          .from('bookable_slots')
          .insert({
            session_id: finalSessionId,
            availability_window_id: finalWindowId,
            start_time: finalStartAt,
            end_time: finalEndAt,
            is_available: true,
            max_bookings: 1,
            current_bookings: 0
          })
          .select('id')
          .single();

        if (slotError) {
          console.error('Failed to create bookable slot:', slotError);
          return NextResponse.json({ error: 'Failed to create booking slot' }, { status: 500 });
        }
        
        slotId = newSlot.id;
      } else {
        return NextResponse.json({ error: 'No available slot found for selected time' }, { status: 400 });
      }
    }

    // Use atomic booking function to prevent race conditions
    const { data: bookingResult, error: bookingError } = await supabase
      .rpc('create_booking_with_payment', {
        p_learner_user_id: user.id, // Use Supabase auth user ID
        p_slot_id: slotId,
        p_notes: notes
      });

    const transactionResult = bookingResult || [];
    const transactionError = bookingError;

    if (transactionError) {
      console.error('Booking creation error:', transactionError);
      
      // Handle specific error cases from database function
      if (transactionError.message?.includes('Slot no longer available')) {
        return NextResponse.json(
          { error: 'This slot is no longer available' },
          { status: 409 }
        );
      }
      
      if (transactionError.message?.includes('already has active booking')) {
        return NextResponse.json(
          { error: 'You already have a pending booking for this session' },
          { status: 409 }
        );
      }
      
      if (transactionError.message?.includes('Slot already has active bookings')) {
        return NextResponse.json(
          { error: 'This time slot is no longer available' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    if (!transactionResult || transactionResult.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    const booking = transactionResult[0];

    // Transform database function result to match expected API response format
    const formattedBooking = {
      id: booking.booking_id,
      expert_id: booking.expert_id,
      learner_id: learnerProfile.id,
      session_id: booking.session_id,
      amount_authorized: booking.amount_cents,
      currency: booking.currency,
      status: 'pending',
      payment_status: 'pending',
      created_at: new Date().toISOString()
    };

    return NextResponse.json({
      booking: formattedBooking,
      message: 'Booking created successfully. Please proceed with payment.',
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}