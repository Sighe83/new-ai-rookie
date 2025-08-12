import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with the latest API version as specified
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia', // Using the latest stable version
})

export async function POST(request: NextRequest) {
  try {
    // Validate required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { 
          error: 'Stripe secret key not configured',
          details: 'Please set STRIPE_SECRET_KEY in your environment variables'
        },
        { status: 500 }
      )
    }

    const { 
      price_id,
      product_id, 
      connected_account_id, 
      quantity = 1, 
      application_fee_amount,
      success_url,
      cancel_url 
    } = await request.json()

    // Validation
    if (!price_id) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      )
    }

    if (!connected_account_id) {
      return NextResponse.json(
        { error: 'Connected account ID is required' },
        { status: 400 }
      )
    }

    if (!application_fee_amount || application_fee_amount < 0) {
      return NextResponse.json(
        { error: 'Valid application fee amount is required (in cents)' },
        { status: 400 }
      )
    }

    // Get the product/price information to build line items
    const price = await stripe.prices.retrieve(price_id, {
      expand: ['product']
    })

    // Create checkout session with destination charge and application fee
    const session = await stripe.checkout.sessions.create({
      // Line items for the purchase
      line_items: [
        {
          price: price_id,
          quantity: quantity,
        },
      ],
      
      // Use destination charge pattern with application fee
      payment_intent_data: {
        application_fee_amount: application_fee_amount,
        transfer_data: {
          destination: connected_account_id,
        },
        metadata: {
          product_id: product_id,
          connected_account_id: connected_account_id,
          platform_fee: application_fee_amount.toString()
        }
      },
      
      mode: 'payment',
      
      // Success and cancel URLs as specified
      success_url: success_url || `${request.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${request.nextUrl.origin}/cancel`,
      
      // Additional metadata
      metadata: {
        product_id: product_id,
        connected_account_id: connected_account_id,
        application_fee: application_fee_amount.toString()
      },
      
      // Allow promotion codes for customer experience
      allow_promotion_codes: true,
      
      // Billing address collection
      billing_address_collection: 'required',
    })

    console.log('✅ Created checkout session:', session.id, 'for account:', connected_account_id)
    console.log('💰 Application fee:', application_fee_amount, 'cents')

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
      expires_at: session.expires_at,
      amount_total: session.amount_total,
      application_fee_amount: application_fee_amount,
      connected_account_id: connected_account_id,
      product_info: {
        name: typeof price.product === 'object' ? price.product.name : 'Product',
        description: typeof price.product === 'object' ? price.product.description : null
      }
    })

  } catch (error) {
    console.error('❌ Checkout session creation failed:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      // Handle specific error cases
      if (error.code === 'resource_missing') {
        return NextResponse.json(
          { 
            error: 'Product or connected account not found', 
            details: error.message 
          },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        {
          error: 'Checkout session creation failed',
          details: error.message,
          type: error.type,
          code: error.code
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET: Retrieve checkout session details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items', 'line_items.data.price.product']
    })

    return NextResponse.json({
      session_id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email,
      payment_intent: session.payment_intent,
      metadata: session.metadata
    })

  } catch (error) {
    console.error('❌ Checkout session retrieval failed:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to retrieve checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}