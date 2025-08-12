import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with the latest API version as specified
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia', // Using the latest stable version
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
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

    const resolvedParams = await params
    const { accountId } = resolvedParams

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Retrieve account status directly from Stripe API (as per instructions)
    // Do not store in database - always get fresh status from Stripe
    const account = await stripe.accounts.retrieve(accountId)

    console.log('✅ Retrieved account status for:', accountId)

    // Return comprehensive account status information
    return NextResponse.json({
      account_id: account.id,
      email: account.email,
      country: account.country,
      
      // Onboarding status
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      
      // Capabilities status
      capabilities: account.capabilities,
      
      // Requirements for completing onboarding
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        past_due: account.requirements?.past_due || [],
        pending_verification: account.requirements?.pending_verification || [],
        disabled_reason: account.requirements?.disabled_reason,
      },
      
      // Business profile if available
      business_profile: account.business_profile ? {
        name: account.business_profile.name,
        url: account.business_profile.url,
        support_email: account.business_profile.support_email,
      } : null,
      
      // Overall status summary
      status: {
        onboarding_complete: account.details_submitted,
        can_accept_payments: account.charges_enabled,
        can_receive_payouts: account.payouts_enabled,
        needs_attention: (account.requirements?.currently_due?.length || 0) > 0,
      }
    })

  } catch (error) {
    console.error('❌ Account status retrieval failed:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      // Handle case where account doesn't exist
      if (error.code === 'resource_missing') {
        return NextResponse.json(
          { error: 'Account not found', details: 'The specified Stripe account does not exist' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        {
          error: 'Account status retrieval failed',
          details: error.message,
          type: error.type
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to retrieve account status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}