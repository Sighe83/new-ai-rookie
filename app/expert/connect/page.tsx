'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { CheckCircleIcon, AlertCircleIcon, CreditCardIcon, DollarSignIcon, UserIcon, RefreshCwIcon } from 'lucide-react'

interface AccountStatus {
  account_id: string
  email: string
  country: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  requirements: {
    currently_due: string[]
    eventually_due: string[]
    past_due: string[]
    pending_verification: string[]
    disabled_reason?: string
  }
  status: {
    onboarding_complete: boolean
    can_accept_payments: boolean
    can_receive_payouts: boolean
    needs_attention: boolean
  }
}

export default function StripeConnectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null)

  useEffect(() => {
    loadUserAndStripeAccount()
  }, [])

  const loadUserAndStripeAccount = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      
      setUser(currentUser)
      
      // Check if user already has a Stripe Connect account
      // In a real app, you'd store this in your user_profiles or expert_profiles table
      // For demo purposes, we'll check localStorage or create new account
      const savedAccountId = localStorage.getItem(`stripe_account_${currentUser.id}`)
      if (savedAccountId) {
        setStripeAccountId(savedAccountId)
        await fetchAccountStatus(savedAccountId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    }
  }

  const fetchAccountStatus = async (accountId: string) => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/stripe/connect/account-status/${accountId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch account status')
      }
      
      const status = await response.json()
      setAccountStatus(status)
    } catch (err) {
      console.error('Error fetching account status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch account status')
    } finally {
      setRefreshing(false)
    }
  }

  const createStripeAccount = async () => {
    if (!user) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/stripe/connect/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          country: 'US' // In production, you'd collect this from the user
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create account')
      }

      const accountData = await response.json()
      setStripeAccountId(accountData.account_id)
      
      // Store the account ID (in production, save to database)
      localStorage.setItem(`stripe_account_${user.id}`, accountData.account_id)
      
      console.log('✅ Created Stripe Connect account:', accountData.account_id)
      
      // Fetch initial status
      await fetchAccountStatus(accountData.account_id)
      
    } catch (err) {
      console.error('Error creating Stripe account:', err)
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const startOnboarding = async () => {
    if (!stripeAccountId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/stripe/connect/account-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: stripeAccountId,
          return_url: `${window.location.origin}/expert/connect/return`,
          refresh_url: `${window.location.origin}/expert/connect/refresh`
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create onboarding link')
      }

      const linkData = await response.json()
      console.log('✅ Created onboarding link, redirecting...')
      
      // Redirect to Stripe's hosted onboarding
      window.location.href = linkData.url
      
    } catch (err) {
      console.error('Error starting onboarding:', err)
      setError(err instanceof Error ? err.message : 'Failed to start onboarding')
    } finally {
      setLoading(false)
    }
  }

  const refreshStatus = () => {
    if (stripeAccountId) {
      fetchAccountStatus(stripeAccountId)
    }
  }

  const getStatusColor = (status: AccountStatus) => {
    if (status.status.onboarding_complete && status.status.can_accept_payments) {
      return 'success'
    } else if (status.status.needs_attention) {
      return 'error'
    } else {
      return 'warning'
    }
  }

  const getStatusText = (status: AccountStatus) => {
    if (status.status.onboarding_complete && status.status.can_accept_payments) {
      return 'Ready to Accept Payments'
    } else if (status.status.needs_attention) {
      return 'Action Required'
    } else if (status.details_submitted) {
      return 'Under Review'
    } else {
      return 'Onboarding Required'
    }
  }

  if (!user) {
    return (
      <div className=\"min-h-screen bg-surface flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4\"></div>
          <p className=\"text-text-light\">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className=\"min-h-screen bg-surface\">
      <div className=\"max-w-4xl mx-auto px-4 py-8\">
        <div className=\"mb-8\">
          <h1 className=\"text-3xl font-bold text-text mb-2\">Stripe Connect Setup</h1>
          <p className=\"text-text-light\">
            Connect your Stripe account to start accepting payments from learners.
          </p>
        </div>

        {error && (
          <Card className=\"bg-error-bg border-error-text/20 mb-6\">
            <CardContent className=\"py-4\">
              <div className=\"flex items-center gap-2 text-error-text\">
                <AlertCircleIcon className=\"w-5 h-5\" />
                <p className=\"font-medium\">Error</p>
              </div>
              <p className=\"text-error-text/80 mt-1\">{error}</p>
            </CardContent>
          </Card>
        )}

        <div className=\"space-y-6\">
          {/* Account Status Card */}
          {stripeAccountId && accountStatus ? (
            <Card>
              <CardHeader>
                <div className=\"flex items-center justify-between\">
                  <div>
                    <CardTitle className=\"flex items-center gap-2\">
                      <CreditCardIcon className=\"w-5 h-5\" />
                      Account Status
                    </CardTitle>
                    <CardDescription>
                      Stripe Account: {stripeAccountId.substring(0, 12)}...
                    </CardDescription>
                  </div>
                  <div className=\"flex items-center gap-2\">
                    <Badge variant={getStatusColor(accountStatus) as any}>
                      {getStatusText(accountStatus)}
                    </Badge>
                    <Button
                      variant=\"secondary\"
                      size=\"sm\"
                      onClick={refreshStatus}
                      loading={refreshing}
                    >
                      <RefreshCwIcon className=\"w-4 h-4\" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className=\"space-y-4\">
                {/* Capabilities Status */}
                <div className=\"grid md:grid-cols-3 gap-4\">
                  <div className=\"flex items-center gap-2\">
                    {accountStatus.status.onboarding_complete ? (
                      <CheckCircleIcon className=\"w-5 h-5 text-success-text\" />
                    ) : (
                      <AlertCircleIcon className=\"w-5 h-5 text-warning-text\" />
                    )}
                    <span className=\"text-sm\">
                      {accountStatus.status.onboarding_complete ? 'Onboarding Complete' : 'Onboarding Pending'}
                    </span>
                  </div>
                  
                  <div className=\"flex items-center gap-2\">
                    {accountStatus.status.can_accept_payments ? (
                      <CheckCircleIcon className=\"w-5 h-5 text-success-text\" />
                    ) : (
                      <AlertCircleIcon className=\"w-5 h-5 text-warning-text\" />
                    )}
                    <span className=\"text-sm\">
                      {accountStatus.status.can_accept_payments ? 'Can Accept Payments' : 'Cannot Accept Payments'}
                    </span>
                  </div>
                  
                  <div className=\"flex items-center gap-2\">
                    {accountStatus.status.can_receive_payouts ? (
                      <CheckCircleIcon className=\"w-5 h-5 text-success-text\" />
                    ) : (
                      <AlertCircleIcon className=\"w-5 h-5 text-warning-text\" />
                    )}
                    <span className=\"text-sm\">
                      {accountStatus.status.can_receive_payouts ? 'Can Receive Payouts' : 'Cannot Receive Payouts'}
                    </span>
                  </div>
                </div>

                {/* Requirements */}
                {(accountStatus.requirements.currently_due.length > 0 || 
                  accountStatus.requirements.past_due.length > 0) && (
                  <div className=\"bg-warning-bg border border-warning-text/20 rounded-lg p-4\">
                    <h4 className=\"font-medium text-warning-text mb-2\">Action Required</h4>
                    
                    {accountStatus.requirements.currently_due.length > 0 && (
                      <div className=\"mb-2\">
                        <p className=\"text-sm text-warning-text/80 mb-1\">Currently Due:</p>
                        <ul className=\"text-xs text-warning-text space-y-1\">
                          {accountStatus.requirements.currently_due.map((req, idx) => (
                            <li key={idx} className=\"flex items-center gap-1\">
                              <span className=\"w-1 h-1 bg-warning-text rounded-full\"></span>
                              {req.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase())}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {accountStatus.requirements.past_due.length > 0 && (
                      <div>
                        <p className=\"text-sm text-error-text mb-1\">Past Due:</p>
                        <ul className=\"text-xs text-error-text space-y-1\">
                          {accountStatus.requirements.past_due.map((req, idx) => (
                            <li key={idx} className=\"flex items-center gap-1\">
                              <span className=\"w-1 h-1 bg-error-text rounded-full\"></span>
                              {req.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase())}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Button */}
                {!accountStatus.status.onboarding_complete && (
                  <Button
                    variant=\"primary\"
                    onClick={startOnboarding}
                    loading={loading}
                    className=\"w-full\"
                  >
                    {accountStatus.details_submitted ? 'Continue Onboarding' : 'Start Onboarding'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Create Account Card */
            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <UserIcon className=\"w-5 h-5\" />
                  Connect Stripe Account
                </CardTitle>
                <CardDescription>
                  Create a Stripe Connect account to start accepting payments from learners.
                </CardDescription>
              </CardHeader>
              <CardContent className=\"space-y-4\">
                <div className=\"bg-secondary/30 rounded-lg p-4 space-y-3\">
                  <h4 className=\"font-medium text-text\">What you'll get:</h4>
                  <ul className=\"space-y-2 text-sm text-text-light\">
                    <li className=\"flex items-center gap-2\">
                      <CheckCircleIcon className=\"w-4 h-4 text-success-text\" />
                      Accept payments directly from customers
                    </li>
                    <li className=\"flex items-center gap-2\">
                      <CheckCircleIcon className=\"w-4 h-4 text-success-text\" />
                      Automatic payouts to your bank account
                    </li>
                    <li className=\"flex items-center gap-2\">
                      <CheckCircleIcon className=\"w-4 h-4 text-success-text\" />
                      Access to Stripe Express Dashboard
                    </li>
                    <li className=\"flex items-center gap-2\">
                      <CheckCircleIcon className=\"w-4 h-4 text-success-text\" />
                      Platform handles pricing and fees
                    </li>
                  </ul>
                </div>

                <Button
                  variant=\"primary\"
                  onClick={createStripeAccount}
                  loading={loading}
                  className=\"w-full\"
                >
                  <CreditCardIcon className=\"w-4 h-4 mr-2\" />
                  Create Stripe Account
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className=\"bg-blue-50 border-blue-200\">
            <CardContent className=\"py-4\">
              <div className=\"flex items-start gap-3\">
                <DollarSignIcon className=\"w-5 h-5 text-blue-600 mt-0.5\" />
                <div>
                  <h4 className=\"font-medium text-blue-800 mb-1\">How it works</h4>
                  <p className=\"text-sm text-blue-700\">
                    Our platform uses Stripe Connect to handle payments securely. 
                    When customers purchase your products, payments go directly to your Stripe account, 
                    and we automatically deduct our platform fee. You get full visibility into all transactions 
                    and can manage your account through the Stripe Express Dashboard.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}