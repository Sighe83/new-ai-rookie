import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export async function POST(request: NextRequest) {
  try {
    const { payment_intent_id, return_url } = await request.json()

    if (!payment_intent_id) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the existing payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id)

    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'Payment intent not found' },
        { status: 404 }
      )
    }

    // Create a Stripe Checkout session for the existing payment intent
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        // Use the existing payment intent
        payment_intent: payment_intent_id,
      },
      line_items: [
        {
          price_data: {
            currency: paymentIntent.currency,
            product_data: {
              name: paymentIntent.metadata.booking_type === 'expert_session' 
                ? 'AI Learning Session' 
                : 'Service',
              description: paymentIntent.description || 'Payment authorization for booking',
            },
            unit_amount: paymentIntent.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}&payment_intent=${payment_intent_id}`,
      cancel_url: `${return_url}?canceled=true&payment_intent=${payment_intent_id}`,
      metadata: {
        payment_intent_id: payment_intent_id,
        ...paymentIntent.metadata
      }
    })

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id
    })

  } catch (error) {
    console.error('Stripe checkout session creation error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}