import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil',
  typescript: true,
})

// Helper function to format amount for Stripe (already in minor units)
export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount)
}

// Helper function to format amount from Stripe (already in minor units)
export const formatAmountFromStripe = (amount: number): number => {
  return Math.round(amount)
}

// Currency conversion helpers
export const getCurrencyForStripe = (currency: string): string => {
  switch (currency.toUpperCase()) {
    case 'DKK':
      return 'dkk'
    case 'USD':
      return 'usd'
    case 'EUR':
      return 'eur'
    default:
      return currency.toLowerCase()
  }
}