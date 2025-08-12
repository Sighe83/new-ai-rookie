import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { stripe } from '@/lib/stripe'
import { ConfirmBookingRequest } from '@/types/bookings'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  
  try {
    const { user, userError, supabase } = await getAuthenticatedUser(request)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestData: ConfirmBookingRequest = await request.json()
    const { action, expert_notes, cancellation_reason } = requestData

    if (!action || !['confirm', 'decline'].includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action. Must be "confirm" or "decline"' 
      }, { status: 400 })
    }

    // Get expert profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 })
    }

    const { data: expertProfile, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id')
      .eq('user_profile_id', userProfile.id)
      .single()

    if (expertError || !expertProfile) {
      return NextResponse.json({ 
        error: 'Expert profile not found' 
      }, { status: 404 })
    }

    // Get the booking and verify it belongs to this expert
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .eq('expert_id', expertProfile.id)
      .eq('status', 'awaiting_confirmation')
      .single()

    if (bookingError || !booking) {
      if (bookingError?.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Booking not found or not in awaiting confirmation status' 
        }, { status: 404 })
      }
      return NextResponse.json({ 
        error: 'Failed to fetch booking' 
      }, { status: 500 })
    }

    let stripeAction = null
    let newStatus = ''
    
    if (action === 'confirm') {
      // Capture the payment in Stripe
      try {
        if (booking.stripe_payment_intent_id) {
          stripeAction = await stripe.paymentIntents.capture(booking.stripe_payment_intent_id)
        }
        newStatus = 'confirmed'
      } catch (stripeError) {
        console.error('Stripe capture failed:', stripeError)
        return NextResponse.json({ 
          error: 'Payment capture failed' 
        }, { status: 500 })
      }
    } else {
      // Cancel/void the payment in Stripe
      try {
        if (booking.stripe_payment_intent_id) {
          stripeAction = await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
        }
        newStatus = 'cancelled'
      } catch (stripeError) {
        console.error('Stripe cancel failed:', stripeError)
        return NextResponse.json({ 
          error: 'Payment cancellation failed' 
        }, { status: 500 })
      }
    }

    // Update the booking in the database
    const updateData: Record<string, string | Date> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    if (expert_notes) {
      updateData.expert_notes = expert_notes
    }

    if (cancellation_reason) {
      updateData.cancellation_reason = cancellation_reason
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Booking update failed:', updateError)
      
      // Try to reverse the Stripe action if database update failed
      try {
        if (action === 'confirm' && booking.stripe_payment_intent_id) {
          await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent_id
          })
        }
      } catch (reverseError) {
        console.error('Failed to reverse Stripe action:', reverseError)
      }
      
      return NextResponse.json({ 
        error: 'Failed to update booking' 
      }, { status: 500 })
    }

    return NextResponse.json({
      booking: updatedBooking,
      stripe_action: stripeAction?.status,
      message: action === 'confirm' 
        ? 'Booking confirmed and payment captured' 
        : 'Booking declined and payment cancelled'
    })

  } catch (error) {
    console.error('Booking confirmation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}