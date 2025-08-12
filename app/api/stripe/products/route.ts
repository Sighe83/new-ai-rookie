import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with the latest API version as specified
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia', // Using the latest stable version
})

// CREATE: Create a new product at platform level
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
      name, 
      description, 
      priceInCents, 
      currency, 
      connectedAccountId,
      images = []
    } = await request.json()

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }

    if (!priceInCents || priceInCents < 0) {
      return NextResponse.json(
        { error: 'Valid price is required (in cents)' },
        { status: 400 }
      )
    }

    if (!connectedAccountId) {
      return NextResponse.json(
        { error: 'Connected account ID is required' },
        { status: 400 }
      )
    }

    // Create product at platform level (not on connected account)
    // Store the connected account mapping in metadata as per instructions
    const product = await stripe.products.create({
      name: name,
      description: description,
      images: images,
      
      // Create default price as specified in requirements
      default_price_data: {
        unit_amount: priceInCents,
        currency: currency || 'usd',
      },
      
      // Store connected account mapping in metadata
      metadata: {
        connected_account_id: connectedAccountId,
        created_via: 'platform_api',
        platform: 'ai_learning'
      }
    })

    console.log('✅ Created platform product:', product.id, 'for account:', connectedAccountId)

    return NextResponse.json({
      product_id: product.id,
      name: product.name,
      description: product.description,
      default_price: {
        id: product.default_price,
        unit_amount: priceInCents,
        currency: currency || 'usd'
      },
      connected_account_id: connectedAccountId,
      images: product.images,
      created: product.created,
      metadata: product.metadata
    })

  } catch (error) {
    console.error('❌ Product creation failed:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: 'Product creation failed',
          details: error.message,
          type: error.type
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET: List all platform products
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const connectedAccountId = searchParams.get('connected_account_id')

    // Get all products from platform account
    const products = await stripe.products.list({
      limit: limit,
      active: true,
      expand: ['data.default_price'] // Expand price data
    })

    // Filter by connected account if specified
    const filteredProducts = connectedAccountId 
      ? products.data.filter(product => 
          product.metadata?.connected_account_id === connectedAccountId
        )
      : products.data

    // Format response with expanded price information
    const formattedProducts = filteredProducts.map(product => ({
      product_id: product.id,
      name: product.name,
      description: product.description,
      images: product.images,
      default_price: product.default_price ? {
        id: typeof product.default_price === 'string' 
          ? product.default_price 
          : product.default_price.id,
        unit_amount: typeof product.default_price === 'object' 
          ? product.default_price.unit_amount 
          : null,
        currency: typeof product.default_price === 'object' 
          ? product.default_price.currency 
          : null
      } : null,
      connected_account_id: product.metadata?.connected_account_id,
      created: product.created,
      metadata: product.metadata
    }))

    console.log('✅ Retrieved', formattedProducts.length, 'products')

    return NextResponse.json({
      products: formattedProducts,
      total_count: filteredProducts.length,
      has_more: products.has_more
    })

  } catch (error) {
    console.error('❌ Product listing failed:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: 'Product listing failed',
          details: error.message,
          type: error.type
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to list products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}