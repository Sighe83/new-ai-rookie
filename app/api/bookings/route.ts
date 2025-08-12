import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { stripe, formatAmountForStripe, getCurrencyForStripe } from '@/lib/stripe'
import { CreateBookingRequest, CreateBookingResponse } from '@/types/bookings'
import { validateBookingTime } from '@/types/bookings'

export async function POST(request: NextRequest) {
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestData: CreateBookingRequest = await request.json()
    const { expert_session_id, start_at, learner_notes } = requestData

    // Validate required fields
    if (!expert_session_id || !start_at) {
      return NextResponse.json({ 
        error: 'expert_session_id and start_at are required' 
      }, { status: 400 })
    }

    // First get the user profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (userProfileError || !userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 })
    }

    // Get or create learner profile
    let { data: learnerProfile, error: learnerError } = await supabase
      .from('learner_profiles')
      .select('id, user_profile_id')
      .eq('user_profile_id', userProfile.id)
      .single()

    // If learner profile doesn't exist, create one
    if (learnerError || !learnerProfile) {
      const { data: newLearnerProfile, error: createError } = await supabase
        .from('learner_profiles')
        .insert({
          user_profile_id: userProfile.id,
          learning_goals: 'Learn AI basics',
          level: 'BEGINNER'
        })
        .select('id, user_profile_id')
        .single()

      if (createError || !newLearnerProfile) {
        return NextResponse.json({ 
          error: 'Failed to create learner profile' 
        }, { status: 500 })
      }
      
      learnerProfile = newLearnerProfile
    }

    // Get expert session details
    const { data: session, error: sessionError } = await supabase
      .from('expert_sessions')
      .select(`
        id, 
        expert_id, 
        title,
        duration_minutes, 
        price_amount, 
        currency,
        is_active
      `)
      .eq('id', expert_session_id)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ 
        error: 'Expert session not found or inactive' 
      }, { status: 404 })
    }

    // Validate booking time
    const validation = validateBookingTime(start_at, session.duration_minutes)
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid booking time', 
        details: validation.errors 
      }, { status: 400 })
    }

    // Calculate end time
    const startDate = new Date(start_at)
    const endDate = new Date(startDate.getTime() + session.duration_minutes * 60 * 1000)
    
    // Set hold time (10 minutes from now)
    const heldUntil = new Date(Date.now() + 10 * 60 * 1000)

    // Check for availability conflicts
    const { data: conflictingBookings, error: conflictError } = await supabase
      .from('bookings')
      .select('id')
      .eq('expert_id', session.expert_id)
      .in('status', ['pending', 'awaiting_confirmation', 'confirmed'])
      .or(`and(start_at.lt.${endDate.toISOString()},end_at.gt.${startDate.toISOString()})`)

    if (conflictError) {
      console.error('Error checking conflicts:', conflictError)
      return NextResponse.json({ 
        error: 'Failed to check availability' 
      }, { status: 500 })
    }

    if (conflictingBookings && conflictingBookings.length > 0) {
      return NextResponse.json({ 
        error: 'Time slot is no longer available' 
      }, { status: 409 })
    }

    // Check if time is within an availability window
    const { data: availabilityWindows, error: availabilityError } = await supabase
      .from('availability_windows')
      .select('id')
      .eq('expert_id', session.expert_id)
      .eq('is_closed', false)
      .lte('start_at', startDate.toISOString())
      .gte('end_at', endDate.toISOString())

    if (availabilityError || !availabilityWindows || availabilityWindows.length === 0) {
      return NextResponse.json({ 
        error: 'Time slot is not within expert availability' 
      }, { status: 400 })
    }

    // Create Stripe PaymentIntent for authorization
    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: formatAmountForStripe(session.price_amount),
        currency: getCurrencyForStripe(session.currency),
        capture_method: 'manual', // Authorization only, capture later
        metadata: {
          expert_session_id: session.id,
          expert_id: session.expert_id,
          learner_id: learnerProfile.id,
          start_at: start_at,
          booking_type: 'expert_session'
        },
        description: `${session.title} - AI Learning Session`
      })
    } catch (stripeError) {
      console.error('Stripe PaymentIntent creation failed:', stripeError)
      return NextResponse.json({ 
        error: 'Payment initialization failed' 
      }, { status: 500 })
    }

    // Create booking in database
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        expert_id: session.expert_id,
        learner_id: learnerProfile.id,
        expert_session_id: session.id,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        status: 'pending',
        held_until: heldUntil.toISOString(),
        currency: session.currency,
        amount_authorized: session.price_amount,
        stripe_payment_intent_id: paymentIntent.id,
        learner_notes: learner_notes
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Booking creation failed:', bookingError)
      
      // Cancel the PaymentIntent since booking creation failed
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id)
      } catch (cancelError) {
        console.error('Failed to cancel PaymentIntent:', cancelError)
      }
      
      return NextResponse.json({ 
        error: 'Failed to create booking',
        details: bookingError.message
      }, { status: 500 })
    }

    const response: CreateBookingResponse = {
      booking: booking,
      stripe_client_secret: paymentIntent.client_secret!
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Booking creation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // First get the user profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (userProfileError || !userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 })
    }

    // Get or create user's learner profile
    let { data: learnerProfile, error: learnerError } = await supabase
      .from('learner_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single()

    // If learner profile doesn't exist, create one
    if (learnerError || !learnerProfile) {
      const { data: newLearnerProfile, error: createError } = await supabase
        .from('learner_profiles')
        .insert({
          user_profile_id: userProfile.id,
          learning_goals: 'Learn AI basics',
          level: 'BEGINNER'
        })
        .select('id')
        .single()

      if (createError || !newLearnerProfile) {
        return NextResponse.json({ 
          error: 'Failed to create learner profile' 
        }, { status: 500 })
      }
      
      learnerProfile = newLearnerProfile
    }

    // Get bookings using the database function
    const { data: bookings, error: bookingsError } = await supabase
      .rpc('get_learner_bookings', {
        p_learner_id: learnerProfile.id,
        p_status: status,
        p_start_date: startDate,
        p_end_date: endDate
      })

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json({ 
        error: 'Failed to fetch bookings' 
      }, { status: 500 })
    }

    return NextResponse.json({ bookings })

  } catch (error) {
    console.error('Bookings fetch error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}