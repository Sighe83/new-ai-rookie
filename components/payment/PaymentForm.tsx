'use client'

import { useState } from 'react'
import {
  CardElement,
  useStripe,
  useElements,
  CardElementProps
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui'
import { formatSessionPrice } from '@/types/expert-sessions'

interface PaymentFormProps {
  amount: number
  currency?: 'DKK' | 'USD' | 'EUR'
  bookingId: string
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
}

const CARD_ELEMENT_OPTIONS: CardElementProps['options'] = {
  style: {
    base: {
      fontSize: '16px',
      color: '#44403C',
      fontFamily: 'Nunito, sans-serif',
      '::placeholder': {
        color: '#57534E',
      },
      iconColor: '#4A55A2',
    },
    invalid: {
      color: '#DC2626',
      iconColor: '#DC2626',
    },
  },
  hidePostalCode: false,
}

export default function PaymentForm({ amount, currency = 'DKK', bookingId, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      onError('Payment system not loaded')
      return
    }

    setLoading(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)

    if (!cardElement) {
      onError('Payment form not loaded')
      setLoading(false)
      return
    }

    try {
      // Create payment intent
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          amount: amount, // Amount already in cents from booking
          currency: currency.toLowerCase(),
          bookingId 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const paymentIntent = await response.json()

      // Confirm payment
      const { error: stripeError, paymentIntent: confirmedPayment } = await stripe.confirmCardPayment(
        paymentIntent.clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      )

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed')
      }

      // Handle both automatic capture (succeeded) and manual capture (requires_capture)
      if (confirmedPayment?.status === 'succeeded' || confirmedPayment?.status === 'requires_capture') {
        // For manual capture, the payment is authorized and awaiting expert approval
        onSuccess(confirmedPayment.id)
      } else {
        throw new Error('Payment was not successful')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed'
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-2">
            Card Information
          </label>
          <div className="border border-border rounded-lg p-4 bg-base">
            <CardElement
              id="card-element"
              options={CARD_ELEMENT_OPTIONS}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!stripe || loading}
          className="flex-1"
        >
          {loading ? 'Processing...' : `Pay ${formatSessionPrice(amount, currency)}`}
        </Button>
      </div>

      <div className="text-xs text-gray-500 text-center">
        Your payment is secure and encrypted. You will only be charged once the expert confirms your booking.
      </div>
    </form>
  )
}