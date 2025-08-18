import { Currency } from '@/types/expert-sessions'

export const CURRENCY_CONFIG = {
  DKK: {
    symbol: 'DKK',
    decimals: 2,
    minorUnit: 100, // øre
    stripeSupported: true,
    defaultForRegion: ['DK'],
    stripeCurrency: 'dkk'
  },
  USD: {
    symbol: '$',
    decimals: 2,
    minorUnit: 100, // cents
    stripeSupported: true,
    defaultForRegion: ['US', 'CA'],
    stripeCurrency: 'usd'
  },
  EUR: {
    symbol: '€',
    decimals: 2,
    minorUnit: 100, // cents
    stripeSupported: true,
    defaultForRegion: ['DE', 'FR', 'NL'],
    stripeCurrency: 'eur'
  }
} as const

// Environment-based default currency
export const getDefaultCurrency = (): Currency => {
  return (process.env.DEFAULT_CURRENCY as Currency) || 'DKK'
}

// Get Stripe-compatible currency code
export const getStripeCurrency = (currency: Currency): string => {
  return CURRENCY_CONFIG[currency].stripeCurrency
}

// Validate currency is supported
export const isSupportedCurrency = (currency: string): currency is Currency => {
  return currency in CURRENCY_CONFIG
}

// Future: Currency service class for exchange rates and conversions
export class CurrencyService {
  static getDefaultCurrency(): Currency {
    return getDefaultCurrency()
  }
  
  static getStripeCurrency(currency: Currency): string {
    return getStripeCurrency(currency)
  }
  
  static isSupportedCurrency(currency: string): currency is Currency {
    return isSupportedCurrency(currency)
  }
  
  // Future: Add exchange rate functionality
  static async convertAmount(
    amount: number, 
    fromCurrency: Currency, 
    toCurrency: Currency
  ): Promise<number> {
    // TODO: Implement when multi-currency payments are needed
    // For now, return original amount (no conversion)
    return amount
  }
  
  // Future: Get real-time exchange rates
  static async getExchangeRate(
    from: Currency, 
    to: Currency
  ): Promise<number> {
    // TODO: Integrate with exchange rate API (e.g., Fixer.io, CurrencyLayer)
    return 1 // Placeholder
  }
}