'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { CheckCircleIcon, XCircleIcon, ArrowLeftIcon } from 'lucide-react'

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret')
    const paymentIntent = searchParams.get('payment_intent')
    const redirectStatus = searchParams.get('redirect_status')

    if (redirectStatus === 'succeeded' && paymentIntent) {
      setStatus('success')
    } else if (redirectStatus === 'failed') {
      setStatus('error')
      setError('Payment was declined or failed. Please try again with a different payment method.')
    } else if (redirectStatus === 'processing') {
      setStatus('loading')
      // In practice, you might want to poll for the payment status here
    } else {
      setStatus('error')
      setError('Invalid payment status. Please contact support if you believe this is an error.')
    }
  }, [searchParams])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Processing your payment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {status === 'success' ? (
          <Card className="bg-success-bg border-success-text/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success-text text-center justify-center">
                <CheckCircleIcon className="w-8 h-8" />
                Payment Authorized Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="text-success-text/80">
                <p className="text-lg">Your booking has been confirmed and payment authorized.</p>
                <p className="text-sm mt-2">
                  The expert will be notified and has 24 hours to confirm your session. 
                  You will only be charged once they confirm.
                </p>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => router.push('/dashboard/learner')}
                  className="flex-1"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <Button
                  variant="primary"
                  onClick={() => router.push('/dashboard/learner/bookings')}
                  className="flex-1"
                >
                  View My Bookings
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-error-bg border-error-text/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error-text text-center justify-center">
                <XCircleIcon className="w-8 h-8" />
                Payment Failed
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="text-error-text/80">
                <p className="text-lg">We couldn't process your payment.</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="primary"
                  onClick={() => router.push('/dashboard/learner')}
                  className="flex-1"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}