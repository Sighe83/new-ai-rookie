'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, AppUser } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Alert } from '@/components/ui'
import { Clock, User, Calendar, DollarSign, MessageSquare, RefreshCw, ChevronLeft, AlertCircle, CheckCircle, XCircle, Phone } from 'lucide-react'

interface BookingItem {
  id: string
  status: string
  payment_status: string
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
  amount_authorized: number
  currency: string
  learner_notes: string | null
  expert_notes: string | null
  declined_reason: string | null
  approved_at: string | null
  declined_at: string | null
  
  session: {
    id: string
    title: string
    description: string
    duration_minutes: number
    price_cents: number
    topic_tags: string[]
    level: string
  }
  
  expert: {
    id: string
    display_name: string
    avatar_url: string | null
    bio: string
    rating: number
  }
  
  // Helper fields
  status_display: {
    label: string
    color: string
    description: string
  }
  time_until_session: string | null
  can_cancel: boolean
  next_action: string | null
}

interface BookingsResponse {
  bookings: BookingItem[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
  summary: Record<string, number>
}

export default function LearnerBookingsPage() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const router = useRouter()

  const loadBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (statusFilter === 'all') {
        params.append('include_completed', 'true')
      }

      const response = await fetch(`/api/learner/my-bookings?${params.toString()}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/')
          return
        }
        throw new Error('Failed to load bookings')
      }

      const data: BookingsResponse = await response.json()
      setBookings(data.bookings)
      setSummary(data.summary)
      setError(null)
    } catch (error) {
      console.error('Error loading bookings:', error)
      setError('Failed to load your bookings. Please try again.')
    }
  }, [statusFilter, router])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      // Check if user is a learner
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        let userRole = 'learner'
        if (!profileError && profileData?.role) {
          userRole = profileData.role
        }
        
        if (userRole === 'expert') {
          router.push('/dashboard/expert')
          return
        } else if (userRole === 'admin') {
          router.push('/admin')
          return
        }

        setUser(user)
        await loadBookings()
        setLoading(false)
      } catch (error) {
        console.error('Error checking user role:', error)
        setUser(user)
        await loadBookings()
        setLoading(false)
      }
    }

    getUser()
  }, [router, loadBookings])

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return
    }

    setActionLoading(bookingId)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel booking')
      }

      setSuccessMessage('Booking cancelled successfully.')
      await loadBookings() // Reload to get updated status
    } catch (error: any) {
      console.error('Error cancelling booking:', error)
      setError(error.message || 'Failed to cancel booking')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amountCents: number, currency: string) => {
    const amount = amountCents / 100
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'DKK'
    }).format(amount)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />
      case 'pending_approval':
        return <AlertCircle className="w-4 h-4" />
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />
      case 'declined':
        return <XCircle className="w-4 h-4" />
      case 'cancelled':
        return <XCircle className="w-4 h-4" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusVariant = (color: string): 'primary' | 'success' | 'warning' | 'destructive' | 'neutral' => {
    switch (color) {
      case 'green':
        return 'success'
      case 'yellow':
        return 'warning'
      case 'red':
        return 'destructive'
      case 'blue':
        return 'primary'
      default:
        return 'neutral'
    }
  }

  const filterOptions = [
    { value: 'all', label: 'All Bookings', count: summary.total || 0 },
    { value: 'pending', label: 'Payment Pending', count: summary.pending || 0 },
    { value: 'pending_approval', label: 'Awaiting Approval', count: summary.pending_approval || 0 },
    { value: 'confirmed', label: 'Confirmed', count: summary.confirmed || 0 },
    { value: 'declined', label: 'Declined', count: summary.declined || 0 },
    { value: 'cancelled', label: 'Cancelled', count: summary.cancelled || 0 },
    { value: 'completed', label: 'Completed', count: summary.completed || 0 }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading your bookings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-base border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard/learner')}
                className="flex items-center"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
              <h1 className="text-xl font-bold text-text">My Bookings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadBookings}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <span className="text-sm text-text-light hidden sm:block">
                {user?.email}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Filter */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filter by Status</CardTitle>
            <CardDescription>View bookings by their current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={statusFilter === option.value ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter(option.value)}
                  className="flex items-center"
                >
                  {option.label}
                  {option.count > 0 && (
                    <Badge variant="neutral" className="ml-2 text-xs">
                      {option.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <div>
              <h4 className="font-semibold">Error</h4>
              <p>{error}</p>
            </div>
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <div>
              <h4 className="font-semibold">Success</h4>
              <p>{successMessage}</p>
            </div>
          </Alert>
        )}

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text mb-2">
                {statusFilter === 'all' ? 'No bookings yet' : `No ${statusFilter.replace('_', ' ')} bookings`}
              </h3>
              <p className="text-text-light mb-4">
                {statusFilter === 'all' 
                  ? "You haven't made any bookings yet. Browse experts to get started!"
                  : `You don't have any bookings with ${statusFilter.replace('_', ' ')} status.`
                }
              </p>
              <Button
                variant="primary"
                onClick={() => router.push('/dashboard/learner/experts')}
              >
                Browse Experts
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center">
                        {booking.session.title}
                        <Badge 
                          variant={getStatusVariant(booking.status_display.color)} 
                          className="ml-3"
                        >
                          <span className="flex items-center">
                            {getStatusIcon(booking.status)}
                            <span className="ml-1">{booking.status_display.label}</span>
                          </span>
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {booking.status_display.description}
                      </CardDescription>
                      {booking.next_action && (
                        <div className="mt-2">
                          <Badge variant="warning" className="text-xs">
                            Next: {booking.next_action}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-accent">
                        {formatCurrency(booking.amount_authorized, booking.currency)}
                      </p>
                      {booking.time_until_session && (
                        <p className="text-sm text-text-light">
                          {booking.time_until_session === 'Past session' 
                            ? 'Past session' 
                            : `In ${booking.time_until_session}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Session and Expert Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface rounded-lg">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-text-light" />
                        <span className="text-sm text-text">
                          {formatDateTime(booking.start_at)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-text-light" />
                        <span className="text-sm text-text">
                          {booking.session.duration_minutes} minutes
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-text-light" />
                        <span className="text-sm text-text">
                          {booking.expert.display_name}
                        </span>
                        {booking.expert.rating && (
                          <span className="text-sm text-text-light">
                            • ⭐ {booking.expert.rating}/5
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-text-light mb-1">Level</p>
                        <Badge variant="neutral" className="text-xs">
                          {booking.session.level}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-text-light mb-1">Topics</p>
                        <div className="flex flex-wrap gap-1">
                          {booking.session.topic_tags.map((tag, index) => (
                            <Badge key={index} variant="neutral" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Session Description */}
                  {booking.session.description && (
                    <div className="p-4 bg-base rounded-lg">
                      <h4 className="font-medium text-text mb-2">Session Description</h4>
                      <p className="text-sm text-text-light">{booking.session.description}</p>
                    </div>
                  )}

                  {/* Your Notes */}
                  {booking.learner_notes && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <h4 className="font-medium text-text mb-2">Your Notes</h4>
                      <p className="text-sm text-text-light">{booking.learner_notes}</p>
                    </div>
                  )}

                  {/* Expert Notes */}
                  {booking.expert_notes && (
                    <div className="p-4 bg-success-bg/50 border border-success-text/20 rounded-lg">
                      <h4 className="font-medium text-text mb-2">Notes from {booking.expert.display_name}</h4>
                      <p className="text-sm text-text-light">{booking.expert_notes}</p>
                    </div>
                  )}

                  {/* Decline Reason */}
                  {booking.declined_reason && (
                    <div className="p-4 bg-error-bg border border-error-text/20 rounded-lg">
                      <h4 className="font-medium text-error-text mb-2">Decline Reason</h4>
                      <p className="text-sm text-text-light">{booking.declined_reason}</p>
                      <p className="text-xs text-text-light mt-2">
                        Your payment has been refunded. You can book another session with this expert or find a different one.
                      </p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="flex justify-between text-xs text-text-light pt-2 border-t border-border">
                    <span>Booked: {formatDateTime(booking.created_at)}</span>
                    {booking.approved_at && (
                      <span>Approved: {formatDateTime(booking.approved_at)}</span>
                    )}
                    {booking.declined_at && (
                      <span>Declined: {formatDateTime(booking.declined_at)}</span>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex gap-3 pt-0">
                  {/* Action Buttons */}
                  {booking.status === 'pending' && (
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="primary" 
                        className="flex-1"
                        onClick={() => router.push(`/dashboard/learner/book/${booking.session.id}?booking_id=${booking.id}`)}
                      >
                        Complete Payment
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={actionLoading === booking.id}
                        loading={actionLoading === booking.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {booking.status === 'pending_approval' && (
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="secondary" 
                        className="flex-1"
                        disabled
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Awaiting Expert Response
                      </Button>
                      {booking.can_cancel && (
                        <Button 
                          variant="destructive"
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={actionLoading === booking.id}
                          loading={actionLoading === booking.id}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}

                  {booking.status === 'confirmed' && (
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="primary" 
                        className="flex-1"
                        onClick={() => {
                          // In a real app, this would open the meeting/session
                          alert('Session will start at the scheduled time. Meeting details will be sent via email.')
                        }}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Join Session
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => {
                          alert('Messaging feature coming soon!')
                        }}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message Expert
                      </Button>
                      {booking.can_cancel && (
                        <Button 
                          variant="destructive"
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={actionLoading === booking.id}
                          loading={actionLoading === booking.id}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}

                  {booking.status === 'declined' && (
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="primary" 
                        className="flex-1"
                        onClick={() => router.push('/dashboard/learner/experts')}
                      >
                        Book Another Session
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => router.push(`/dashboard/learner/experts/${booking.expert.id}`)}
                      >
                        View Expert Profile
                      </Button>
                    </div>
                  )}

                  {(booking.status === 'completed' || booking.status === 'cancelled') && (
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="secondary" 
                        className="flex-1"
                        onClick={() => router.push('/dashboard/learner/experts')}
                      >
                        Book Another Session
                      </Button>
                      {booking.status === 'completed' && (
                        <Button 
                          variant="primary"
                          onClick={() => {
                            alert('Rating and review feature coming soon!')
                          }}
                        >
                          Leave Review
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}