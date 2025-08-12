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

    const { account_id, return_url, refresh_url } = await request.json()

    if (!account_id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Create Account Link for onboarding the connected account
    // This will redirect the user to Stripe's hosted onboarding flow
    const accountLink = await stripe.accountLinks.create({
      account: account_id,
      refresh_url: refresh_url || `${request.nextUrl.origin}/expert/connect/refresh`,
      return_url: return_url || `${request.nextUrl.origin}/expert/connect/return`,
      type: 'account_onboarding',
    })

    console.log('✅ Created account link for:', account_id)

    return NextResponse.json({
      url: accountLink.url,
      expires_at: accountLink.expires_at,
      account_id: account_id
    })

  } catch (error) {
    console.error('❌ Account link creation failed:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: 'Account link creation failed',
          details: error.message,
          type: error.type
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create account link',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}