'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui'
import { CreditCardIcon, LockIcon, AlertCircleIcon } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentFormProps {
  clientSecret: string
  amount: number
  currency: string
  onSuccess: () => void
  onError: (error: string) => void
}

function CheckoutForm({ 
  clientSecret, 
  amount, 
  currency, 
  onSuccess, 
  onError 
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      onError('Card element not found')
      return
    }

    setIsProcessing(true)
    setCardError(null)

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      })

      if (error) {
        console.error('Payment error:', error)
        onError(error.message || 'Payment failed')
      } else if (paymentIntent && paymentIntent.status === 'requires_capture') {
        console.log('Payment authorized successfully')
        onSuccess()
      } else {
        console.error('Unexpected payment status:', paymentIntent?.status)
        onError('Payment authorization failed')
      }
    } catch (error) {
      console.error('Payment processing error:', error)
      onError(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatAmount = (amount: number, currency: string): string => {
    switch (currency) {
      case 'DKK':
        return `${Math.round(amount / 100)} DKK`
      case 'USD':
        return `$${Math.round(amount / 100)}`
      case 'EUR':
        return `€${Math.round(amount / 100)}`
      default:
        return `${amount / 100} ${currency}`
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Payment Amount */}
      <div className="bg-secondary/30 rounded-lg p-4 text-center">
        <p className="text-sm text-text-light">Amount to authorize</p>
        <p className="text-2xl font-bold text-primary">
          {formatAmount(amount, currency)}
        </p>
        <p className="text-xs text-text-light mt-1">
          This amount will be held until the expert confirms your session
        </p>
      </div>

      {/* Card Element */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <CreditCardIcon className="w-5 h-5 text-text-light" />
          <span className="font-medium text-text">Payment Details</span>
        </div>
        
        <div className="p-3 border border-gray-300 rounded-md">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
            onChange={(event) => {
              if (event.error) {
                setCardError(event.error.message)
              } else {
                setCardError(null)
              }
            }}
          />
        </div>
        
        {cardError && (
          <div className="flex items-center gap-2 mt-2 text-sm text-error-text">
            <AlertCircleIcon className="w-4 h-4" />
            <span>{cardError}</span>
          </div>
        )}
      </div>

      {/* Security Note */}
      <div className="flex items-center gap-2 text-xs text-text-light">
        <LockIcon className="w-4 h-4" />
        <span>Your payment information is secured with bank-level encryption</span>
      </div>

      {/* Payment Button */}
      <Button
        type="submit"
        variant="primary"
        loading={isProcessing}
        disabled={isProcessing || !stripe || !elements}
        className="w-full"
      >
        {isProcessing ? 'Processing...' : 'Authorize Payment'}
      </Button>

      <div className="text-xs text-text-light text-center">
        <p>
          <strong>Payment Authorization:</strong> We'll hold this amount on your card but won't charge you until the expert confirms your session. 
          If the expert declines or doesn't respond within 24 hours, the hold will be automatically released.
        </p>
      </div>
    </form>
  )
}

export function PaymentForm(props: PaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  )
}