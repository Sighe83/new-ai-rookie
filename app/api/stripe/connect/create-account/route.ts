import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'

// Initialize Stripe with the latest API version as specified
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia', // Using the latest stable version
})

export async function POST(request: NextRequest) {
  try {
    // Validate required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      // Helpful error for missing API key
      return NextResponse.json(
        { 
          error: 'Stripe secret key not configured',
          details: 'Please set STRIPE_SECRET_KEY in your environment variables'
        },
        { status: 500 }
      )
    }

    const { email, country = 'US' } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for account creation' },
        { status: 400 }
      )
    }

    // Create connected account with the specified controller properties
    // Platform is responsible for pricing, fees, and losses
    const account = await stripe.accounts.create({
      // Using email as a unique identifier for the account
      email: email,
      country: country,
      
      controller: {
        // Platform is responsible for pricing and fee collection
        fees: {
          payer: 'application' as const
        },
        // Platform is responsible for losses / refunds / chargebacks
        losses: {
          payments: 'application' as const
        },
        // Give them access to the express dashboard for management
        stripe_dashboard: {
          type: 'express' as const
        }
      },
      
      // Enable the account to accept payments and transfers
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      }
    })

    console.log('✅ Created Stripe Connect account:', account.id)

    return NextResponse.json({
      account_id: account.id,
      email: account.email,
      country: account.country,
      created: account.created,
      capabilities: account.capabilities,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled
    })

  } catch (error) {
    console.error('❌ Stripe Connect account creation failed:', error)
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: 'Stripe account creation failed',
          details: error.message,
          type: error.type
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create connected account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}