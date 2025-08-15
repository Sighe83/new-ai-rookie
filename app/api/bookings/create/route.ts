import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request);
    
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
      slotId, 
      sessionId, 
      notes 
    } = body;

    // Support both new format and legacy format
    const finalSessionId = session_id || sessionId;
    const finalExpertId = expert_id;
    const finalStartAt = start_at;
    const finalEndAt = end_at;
    const finalWindowId = availability_window_id;
    const finalAmount = amount;
    const finalCurrency = currency || 'USD';

    if (!finalSessionId) {
      return NextResponse.json(
        { error: 'Missing required field: session_id' },
        { status: 400 }
      );
    }

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

    // Create booking with correct ID mapping and required fields
    const heldUntil = new Date(Date.now() + 30 * 60 * 1000); // Hold for 30 minutes
    
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        learner_id: learnerProfile.id,
        student_id: userProfile.id, 
        expert_id: finalExpertId,
        expert_session_id: finalSessionId, // REQUIRED field!
        session_id: finalSessionId, // For compatibility
        start_at: finalStartAt, // REQUIRED for availability window validation
        end_at: finalEndAt, // REQUIRED for availability window validation
        scheduled_at: finalStartAt,
        held_until: heldUntil.toISOString(), // REQUIRED field - hold booking for 30 minutes
        amount_authorized: finalAmount, // REQUIRED field
        currency: finalCurrency, // REQUIRED field
        notes: notes || null,
        status: 'pending',
        payment_status: 'pending'
      })
      .select()
      .single();

    const transactionResult = bookingData ? [bookingData] : [];
    const transactionError = bookingError;

    if (transactionError) {
      console.error('Booking creation error:', transactionError);
      
      // Handle specific error cases
      if (transactionError.message?.includes('Slot not available')) {
        return NextResponse.json(
          { error: 'This slot is no longer available' },
          { status: 409 }
        );
      }
      
      if (transactionError.message?.includes('already booked')) {
        return NextResponse.json(
          { error: 'You already have a pending booking for this slot' },
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

    return NextResponse.json({
      booking,
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