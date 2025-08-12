import { loadStripe } from '@stripe/stripe-js'

// Make sure to check that the public key exists
if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable is not set')
}

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

// This is a singleton - it will only create one Stripe instance
export const getStripe = () => loadStripe(stripePublishableKey)