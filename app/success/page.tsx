'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { CheckCircleIcon, PackageIcon, DollarSignIcon, ArrowLeftIcon, DownloadIcon } from 'lucide-react'

interface CheckoutSession {
  session_id: string
  payment_status: string
  amount_total: number
  currency: string
  customer_email: string
  payment_intent: any
  metadata: any
}

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionData, setSessionData] = useState<CheckoutSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (sessionId) {
      fetchSessionData(sessionId)
    } else {
      setError('No session ID provided')
      setLoading(false)
    }
  }, [sessionId])

  const fetchSessionData = async (id: string) => {
    try {
      const response = await fetch(`/api/stripe/checkout?session_id=${id}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch session data')
      }
      
      const data = await response.json()
      setSessionData(data)
    } catch (err) {
      console.error('Error fetching session data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load purchase details')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  if (loading) {
    return (
      <div className=\"min-h-screen bg-surface flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4\"></div>
          <p className=\"text-text-light\">Loading purchase details...</p>
        </div>
      </div>
    )
  }

  if (error || !sessionData) {
    return (
      <div className=\"min-h-screen bg-surface flex items-center justify-center\">
        <div className=\"max-w-md mx-auto px-4\">
          <Card className=\"bg-error-bg border-error-text/20\">
            <CardHeader>
              <CardTitle className=\"text-error-text text-center\">
                Error Loading Purchase
              </CardTitle>
            </CardHeader>
            <CardContent className=\"text-center space-y-4\">
              <p className=\"text-error-text/80\">{error}</p>
              <Button
                variant=\"secondary\"
                onClick={() => router.push('/storefront')}
              >
                Back to Store
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isSuccessful = sessionData.payment_status === 'paid'

  return (
    <div className=\"min-h-screen bg-surface\">
      <div className=\"max-w-3xl mx-auto px-4 py-8\">
        {isSuccessful ? (
          <Card className=\"bg-success-bg border-success-text/20\">
            <CardHeader>
              <CardTitle className=\"flex items-center gap-2 text-success-text text-center justify-center text-2xl\">
                <CheckCircleIcon className=\"w-8 h-8\" />
                Purchase Successful!
              </CardTitle>
            </CardHeader>
            <CardContent className=\"space-y-6\">
              <div className=\"text-center\">
                <p className=\"text-success-text/80 text-lg\">
                  Thank you for your purchase! Your payment has been processed successfully.
                </p>
              </div>

              {/* Purchase Details */}
              <div className=\"bg-white/50 rounded-lg p-6 space-y-4\">
                <h3 className=\"font-semibold text-text mb-4\">Purchase Details</h3>
                
                <div className=\"grid md:grid-cols-2 gap-4\">
                  <div className=\"space-y-2\">
                    <div className=\"flex justify-between\">
                      <span className=\"text-text-light\">Session ID:</span>
                      <span className=\"font-mono text-sm text-text\">
                        {sessionData.session_id.substring(0, 12)}...
                      </span>
                    </div>
                    
                    <div className=\"flex justify-between\">
                      <span className=\"text-text-light\">Payment Status:</span>
                      <Badge variant=\"success\">
                        {sessionData.payment_status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className=\"flex justify-between\">
                      <span className=\"text-text-light\">Amount:</span>
                      <span className=\"font-semibold text-lg text-text\">
                        {formatPrice(sessionData.amount_total, sessionData.currency)}
                      </span>
                    </div>
                  </div>
                  
                  <div className=\"space-y-2\">
                    {sessionData.customer_email && (
                      <div className=\"flex justify-between\">
                        <span className=\"text-text-light\">Email:</span>
                        <span className=\"text-text\">{sessionData.customer_email}</span>
                      </div>
                    )}
                    
                    {sessionData.metadata?.connected_account_id && (
                      <div className=\"flex justify-between\">
                        <span className=\"text-text-light\">Seller:</span>
                        <span className=\"text-text\">Expert Instructor</span>
                      </div>
                    )}
                    
                    {sessionData.metadata?.application_fee && (
                      <div className=\"flex justify-between\">
                        <span className=\"text-text-light\">Platform Fee:</span>
                        <span className=\"text-text\">
                          {formatPrice(parseInt(sessionData.metadata.application_fee), sessionData.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">
                <h4 className=\"font-medium text-blue-800 mb-2\">What happens next?</h4>
                <ul className=\"space-y-1 text-sm text-blue-700\">
                  <li className=\"flex items-center gap-2\">
                    <CheckCircleIcon className=\"w-4 h-4 text-blue-600\" />
                    <span>Payment has been processed and funds transferred to the expert</span>
                  </li>
                  <li className=\"flex items-center gap-2\">
                    <CheckCircleIcon className=\"w-4 h-4 text-blue-600\" />
                    <span>You'll receive an email receipt shortly</span>
                  </li>
                  <li className=\"flex items-center gap-2\">
                    <CheckCircleIcon className=\"w-4 h-4 text-blue-600\" />
                    <span>The expert will contact you with access details</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className=\"flex gap-4\">
                <Button
                  variant=\"secondary\"
                  onClick={() => router.push('/storefront')}
                  className=\"flex-1\"
                >
                  <ArrowLeftIcon className=\"w-4 h-4 mr-2\" />
                  Continue Shopping
                </Button>
                <Button
                  variant=\"primary\"
                  onClick={() => window.print()}
                  className=\"flex-1\"
                >
                  <DownloadIcon className=\"w-4 h-4 mr-2\" />
                  Print Receipt
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className=\"bg-warning-bg border-warning-text/20\">
            <CardHeader>
              <CardTitle className=\"text-warning-text text-center\">
                Payment Processing
              </CardTitle>
            </CardHeader>
            <CardContent className=\"text-center space-y-4\">
              <p className=\"text-warning-text/80\">
                Your payment is still being processed. Please wait a moment.
              </p>
              <Button
                variant=\"primary\"
                onClick={() => window.location.reload()}
              >
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Support Info */}
        <Card className=\"mt-8 bg-base border-border\">
          <CardContent className=\"py-4\">
            <div className=\"text-center text-sm text-text-light\">
              <p>
                Need help? Contact support at{' '}
                <a href=\"mailto:support@ailearning.com\" className=\"text-primary hover:underline\">
                  support@ailearning.com
                </a>
              </p>
              <p className=\"mt-1\">
                Transaction ID: {sessionData?.session_id}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className=\"min-h-screen bg-surface flex items-center justify-center\">
        <div className=\"animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent\"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}