'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { 
  CalendarIcon, 
  ClockIcon, 
  UserIcon, 
  CheckIcon, 
  XIcon, 
  MessageSquareIcon,
  DollarSignIcon,
  AlertCircleIcon,
  RefreshCwIcon
} from 'lucide-react'
import { ExpertBooking, getBookingStatusColor, getBookingStatusLabel, formatBookingPrice } from '@/types/bookings'

export default function ExpertBookingsPage() {
  const [bookings, setBookings] = useState<ExpertBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadBookings()
  }, [selectedStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadBookings = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get current user's expert profile
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('You must be logged in')
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (profileError || !userProfile) {
        throw new Error('User profile not found')
      }

      const { data: expertProfile, error: expertError } = await supabase
        .from('expert_profiles')
        .select('id')
        .eq('user_profile_id', userProfile.id)
        .single()

      if (expertError || !expertProfile) {
        throw new Error('Expert profile not found')
      }

      // Get bookings using the database function
      const { data: bookingsData, error: bookingsError } = await supabase
        .rpc('get_expert_bookings', {
          p_expert_id: expertProfile.id,
          p_status: selectedStatus === 'all' ? null : selectedStatus
        })

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError)
        throw new Error('Failed to load bookings')
      }

      setBookings(bookingsData || [])
    } catch (err) {
      console.error('Load bookings error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const handleBookingAction = async (bookingId: string, action: 'confirm' | 'decline', notes?: string) => {
    setActionLoading(bookingId)
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('You must be logged in')
      }

      const response = await fetch(`/api/bookings/${bookingId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          expert_notes: notes,
          cancellation_reason: action === 'decline' ? notes : undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${action} booking`)
      }

      // Reload bookings to get updated data
      await loadBookings()
    } catch (err) {
      console.error(`Booking ${action} error:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${action} booking`)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const statusOptions = [
    { value: 'all', label: 'All Bookings' },
    { value: 'pending', label: 'Pending Payment' },
    { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  const pendingCount = bookings.filter(b => b.status === 'awaiting_confirmation').length

  if (loading) {
    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-text-light">Loading your bookings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header Navigation */}
      <header className="bg-base border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-text">My Bookings</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="/dashboard/expert" className="text-text-light hover:text-text">Dashboard</a>
                <a href="/dashboard/expert/sessions" className="text-text-light hover:text-text">My Sessions</a>
                <a href="/dashboard/expert/bookings" className="text-primary font-medium">Bookings</a>
                <a href="/dashboard/expert/availability" className="text-text-light hover:text-text">Availability</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadBookings}
                loading={loading}
              >
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(option => (
            <Button
              key={option.value}
              variant={selectedStatus === option.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedStatus(option.value)}
            >
              {option.label}
              {option.value === 'awaiting_confirmation' && pendingCount > 0 && (
                <Badge variant="warning" className="ml-2 px-1 py-0 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <Card className="bg-error-bg border-error text-error-text">
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarIcon className="w-16 h-16 text-text-light mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text mb-2">No bookings found</h3>
              <p className="text-text-light">
                {selectedStatus === 'all' 
                  ? "You don't have any bookings yet."
                  : `No bookings with status "${statusOptions.find(s => s.value === selectedStatus)?.label}".`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{booking.session_title}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-text-light mt-1">
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-4 h-4" />
                          <span>{booking.learner_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{formatDateTime(booking.start_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>{booking.session_duration_minutes} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSignIcon className="w-4 h-4" />
                          <span>{formatBookingPrice(booking.amount_authorized, booking.currency)}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={getBookingStatusColor(booking.status)}>
                      {getBookingStatusLabel(booking.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Session Description */}
                  <div>
                    <h4 className="text-sm font-medium text-text mb-1">Session Details</h4>
                    <p className="text-sm text-text-light">{booking.session_description}</p>
                  </div>

                  {/* Learner Notes */}
                  {booking.learner_notes && (
                    <div>
                      <h4 className="text-sm font-medium text-text mb-1">Learner Notes</h4>
                      <div className="bg-secondary/30 rounded p-3">
                        <div className="flex items-start gap-2">
                          <MessageSquareIcon className="w-4 h-4 text-text-light mt-0.5" />
                          <p className="text-sm text-text">{booking.learner_notes}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expert Notes */}
                  {booking.expert_notes && (
                    <div>
                      <h4 className="text-sm font-medium text-text mb-1">Your Notes</h4>
                      <div className="bg-primary/10 rounded p-3">
                        <p className="text-sm text-text">{booking.expert_notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Cancellation Reason */}
                  {booking.cancellation_reason && (
                    <div>
                      <h4 className="text-sm font-medium text-text mb-1">Cancellation Reason</h4>
                      <div className="bg-error-bg rounded p-3">
                        <p className="text-sm text-error-text">{booking.cancellation_reason}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {booking.status === 'awaiting_confirmation' && (
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="primary"
                        onClick={() => handleBookingAction(booking.id, 'confirm', 'Session confirmed and ready to proceed')}
                        loading={actionLoading === booking.id}
                        className="flex-1"
                      >
                        <CheckIcon className="w-4 h-4 mr-2" />
                        Confirm Booking
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const reason = prompt('Please provide a reason for declining this booking:')
                          if (reason) {
                            handleBookingAction(booking.id, 'decline', reason)
                          }
                        }}
                        loading={actionLoading === booking.id}
                        className="flex-1"
                      >
                        <XIcon className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  )}

                  {/* Booking Details */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-text-light">
                      <div>
                        <p>Booking ID</p>
                        <p className="font-mono text-text">{booking.id.substring(0, 8)}...</p>
                      </div>
                      <div>
                        <p>Created</p>
                        <p className="text-text">{new Date(booking.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p>Status</p>
                        <p className="text-text">{getBookingStatusLabel(booking.status)}</p>
                      </div>
                      <div>
                        <p>Payment</p>
                        <p className="text-text">
                          {booking.status === 'confirmed' || booking.status === 'completed' 
                            ? 'Charged' 
                            : 'Authorized'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}