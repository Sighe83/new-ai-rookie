'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { TimeSlotPicker } from '@/components/TimeSlotPicker'
import PaymentForm from '@/components/payment/PaymentForm'
import StripeProvider from '@/components/providers/StripeProvider'
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, DollarSignIcon, UserIcon, BookOpenIcon, StarIcon } from 'lucide-react'
import { ExpertSessionWithAvailability, formatSessionPrice } from '@/types/expert-sessions'

interface TimeSlot {
  start_at: string
  end_at: string
  is_available: boolean
  availability_window_id: string
  session_duration_minutes: number
}

interface ExpertProfile {
  id: string
  full_name: string
  bio: string
  avatar_url?: string
  rating?: number
  total_sessions?: number
}

export default function BookSessionPage({ 
  params 
}: { 
  params: Promise<{ sessionId: string }> 
}) {
  const resolvedParams = use(params)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<ExpertSessionWithAvailability | null>(null)
  const [expert, setExpert] = useState<ExpertProfile | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [step, setStep] = useState<'select-time' | 'confirm' | 'payment' | 'success'>('select-time')
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadSessionAndExpert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.sessionId])

  const loadSessionAndExpert = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get the session details
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', resolvedParams.sessionId)
        .eq('is_active', true)
        .single()

      if (sessionError) {
        console.error('Database error fetching expert session:', {
          error: sessionError,
          session_id: resolvedParams.sessionId,
          timestamp: new Date().toISOString()
        })
        throw new Error('Session not found or inactive')
      }

      if (!sessionData) {
        throw new Error('Session not found')
      }

      // Transform the session data to match expected interface (map price_cents to price_amount)
      const transformedSession = {
        ...sessionData,
        price_amount: sessionData.price_cents // Map database field to interface field
      }

      // Create a default expert profile - we'll try to get real data but won't fail if it doesn't work
      let expertProfile: ExpertProfile = {
        id: transformedSession.expert_id,
        full_name: 'AI Expert',
        bio: 'Experienced AI professional ready to help you master AI skills.',
        avatar_url: undefined,
        rating: 4.8, // Placeholder - would come from reviews
        total_sessions: 42 // Placeholder - would come from bookings count
      }

      // Try to get the expert profile, but don't fail the whole page if this doesn't work
      try {
        const { data: expertData, error: expertError } = await supabase
          .from('expert_profiles')
          .select(`
            id,
            bio,
            rating,
            total_sessions,
            user_profiles!inner(
              user_id,
              first_name,
              last_name,
              display_name,
              avatar_url
            )
          `)
          .eq('id', transformedSession.expert_id)
          .maybeSingle()

        if (expertError) {
          console.error('Database error fetching expert profile:', {
            error: expertError,
            expert_id: transformedSession.expert_id,
            timestamp: new Date().toISOString()
          })
        } else if (expertData && expertData.user_profiles) {
          // Update expert profile with real data if available
          const userProfile = Array.isArray(expertData.user_profiles) 
            ? expertData.user_profiles[0] 
            : expertData.user_profiles
          expertProfile = {
            id: sessionData.expert_id,
            full_name: userProfile.display_name || 
                       `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 
                       'AI Expert',
            bio: expertData.bio || 'Experienced AI professional ready to help you master AI skills.',
            avatar_url: userProfile.avatar_url,
            rating: expertData.rating || 4.8,
            total_sessions: expertData.total_sessions || 42
          }
        }
      } catch (profileError) {
        console.error('Expert profile query failed, using defaults:', {
          error: profileError,
          expert_id: transformedSession.expert_id,
          error_message: profileError instanceof Error ? profileError.message : 'Unknown profile error',
          timestamp: new Date().toISOString()
        })
      }

      setSession({
        ...transformedSession,
        has_availability: true,
        expert_display_name: expertProfile.full_name,
        expert_bio: expertProfile.bio,
        expert_rating: expertProfile.rating,
        expert_total_sessions: expertProfile.total_sessions
      } as ExpertSessionWithAvailability)
      
      setExpert(expertProfile)
    } catch (err) {
      console.error('Critical error in loadSessionAndExpert:', {
        error: err,
        session_id: resolvedParams.sessionId,
        error_message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      })
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  const handleSlotSelected = (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setStep('confirm')
  }

  const handleBackToSlotSelection = () => {
    setStep('select-time')
  }

  const handleConfirmBooking = async () => {
    if (!session || !selectedSlot) return

    try {
      setLoading(true)
      setError(null)

      // Get current session for authentication
      const { data: { session: authSession } } = await supabase.auth.getSession()
      
      if (!authSession) {
        throw new Error('Authentication required')
      }

      // Create booking in pending state
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        credentials: 'include', // Use cookie authentication
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: session.id,
          expert_id: session.expert_id,
          start_at: selectedSlot.start_at,
          end_at: selectedSlot.end_at,
          availability_window_id: selectedSlot.availability_window_id,
          amount: session.price_amount,
          currency: session.currency
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create booking')
      }

      setBookingId(data.booking.id)
      setStep('payment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = (paymentIntentId: string) => {
    console.log('Payment successful:', paymentIntentId)
    // Redirect to My Bookings page since payment is authorized and awaiting expert approval
    router.push('/dashboard/learner/bookings')
  }

  const handlePaymentError = (error: string) => {
    setError(error)
    console.error('Payment error:', error)
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading session details...</p>
        </div>
      </div>
    )
  }

  if (error || !session || !expert) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold text-text mb-4">Session Not Found</h2>
            <p className="text-text-light mb-6">{error || 'The session you are looking for does not exist or is no longer available.'}</p>
            <Button variant="primary" onClick={() => router.push('/dashboard/learner/experts')}>
              Browse Available Sessions
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-base border-b border-border sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard/learner/experts')}
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Sessions
              </Button>
              <h1 className="text-xl font-bold text-text hidden sm:block">Book Session</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary">{session.level || 'All Levels'}</Badge>
              <Badge variant="neutral">{session.duration_minutes} min</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Session & Expert Info */}
          <div className="md:col-span-1 space-y-4">
            {/* Session Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{session.title}</CardTitle>
                <CardDescription>{session.short_description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-text">
                  <DollarSignIcon className="w-4 h-4" />
                  <span className="font-semibold">{formatSessionPrice(session.price_amount, session.currency)}</span>
                </div>
                <div className="flex items-center gap-2 text-text-light">
                  <ClockIcon className="w-4 h-4" />
                  <span>{session.duration_minutes} minutes</span>
                </div>
                {session.level && (
                  <div className="flex items-center gap-2 text-text-light">
                    <BookOpenIcon className="w-4 h-4" />
                    <span>{session.level}</span>
                  </div>
                )}
                {session.topic_tags && session.topic_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.topic_tags.map((tag, idx) => (
                      <Badge key={idx} variant="neutral" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expert Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Your Expert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-text">{expert.full_name}</p>
                    <p className="text-sm text-text-light mt-1">{expert.bio}</p>
                  </div>
                  {expert.rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <StarIcon className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        <span className="font-medium">{expert.rating}</span>
                      </div>
                      <span className="text-text-light text-sm">
                        ({expert.total_sessions} sessions)
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Selection, Confirmation, Payment, or Success */}
          <div className="md:col-span-2">
            {step === 'select-time' ? (
              <TimeSlotPicker
                sessionId={session.id}
                sessionDuration={session.duration_minutes}
                onSlotSelected={handleSlotSelected}
                selectedSlot={selectedSlot}
              />
            ) : step === 'payment' ? (
              <StripeProvider>
                <Card>
                  <CardHeader>
                    <CardTitle>Complete Payment</CardTitle>
                    <CardDescription>
                      Secure payment for your session with {expert.full_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error && (
                      <div className="bg-error-bg border border-error-text/20 rounded-lg p-4 mb-4">
                        <p className="text-error-text text-sm">{error}</p>
                      </div>
                    )}
                    <PaymentForm
                      amount={session.price_amount}
                      bookingId={bookingId!}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </CardContent>
                </Card>
              </StripeProvider>
            ) : step === 'success' ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-success-text">
                    <CheckCircleIcon className="w-5 h-5" />
                    Payment Successful!
                  </CardTitle>
                  <CardDescription>
                    Your booking has been confirmed and the expert has been notified.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-success-bg rounded-lg p-4">
                    <h3 className="font-semibold text-success-text mb-2">Next Steps:</h3>
                    <ul className="text-sm text-success-text space-y-1">
                      <li>• The expert will confirm your booking within 24 hours</li>
                      <li>• You&apos;ll receive an email with session details once confirmed</li>
                      <li>• Payment will be captured after expert confirmation</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="primary" 
                      onClick={() => router.push('/dashboard/learner/bookings')}
                      className="flex-1"
                    >
                      View My Bookings
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => router.push('/dashboard/learner/experts')}
                      className="flex-1"
                    >
                      Book Another Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Booking Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-success-text" />
                      Ready to Book
                    </CardTitle>
                    <CardDescription>
                      Review your session details before proceeding to payment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border-l-4 border-primary pl-4 space-y-2">
                      <p className="font-semibold text-text">{session.title}</p>
                      <p className="text-text-light">with {expert.full_name}</p>
                    </div>

                    {selectedSlot && (
                      <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-text-light">Date & Time:</span>
                          <span className="font-medium text-text">
                            {formatDateTime(selectedSlot.start_at)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-light">Duration:</span>
                          <span className="font-medium text-text">
                            {session.duration_minutes} minutes
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-light">Time Zone:</span>
                          <span className="font-medium text-text">
                            {Intl.DateTimeFormat().resolvedOptions().timeZone}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg text-text">Total Amount:</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatSessionPrice(session.price_amount, session.currency)}
                        </span>
                      </div>
                      <p className="text-sm text-text-light mt-1">
                        Payment will be processed after expert confirmation
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleBackToSlotSelection}
                    className="flex-1"
                  >
                    Change Time
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmBooking}
                    className="flex-1"
                  >
                    Proceed to Payment
                  </Button>
                </div>

                {/* Info Note */}
                <Card className="bg-warning-bg border-warning-text/20">
                  <CardContent className="py-3">
                    <p className="text-sm text-warning-text">
                      <strong>Note:</strong> Your booking will be held for 10 minutes while you complete payment. 
                      The expert will review and confirm your booking within 24 hours.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}