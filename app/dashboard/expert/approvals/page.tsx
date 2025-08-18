'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, AppUser } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Alert } from '@/components/ui'
import { Clock, User, Calendar, DollarSign, MessageSquare, Check, X, AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react'

interface BookingApproval {
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
  
  session: {
    id: string
    title: string
    description: string
    duration_minutes: number
    price_cents: number
    topic_tags: string[]
    level: string
  }
  
  learner: {
    id: string
    display_name: string
    avatar_url: string | null
  }
  
  // Helper fields
  time_since_created: string
  expires_at: string
  is_urgent: boolean
}

interface ApprovalResponse {
  approvals: BookingApproval[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
  summary: {
    total_pending: number
    urgent_count: number
    expiring_soon: number
  }
}

export default function ExpertApprovalDashboard() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvals, setApprovals] = useState<BookingApproval[]>([])
  const [summary, setSummary] = useState<ApprovalResponse['summary']>({ total_pending: 0, urgent_count: 0, expiring_soon: 0 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [expertNotes, setExpertNotes] = useState<Record<string, string>>({})
  const [declineReasons, setDeclineReasons] = useState<Record<string, string>>({})
  const router = useRouter()

  const loadApprovals = useCallback(async () => {
    try {
      const response = await fetch('/api/expert/pending-approvals', {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/')
          return
        }
        throw new Error('Failed to load pending approvals')
      }

      const data: ApprovalResponse = await response.json()
      setApprovals(data.approvals)
      setSummary(data.summary)
      setError(null)
    } catch (error) {
      console.error('Error loading approvals:', error)
      setError('Failed to load pending approvals. Please try again.')
    }
  }, [router])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      // Check if user is an expert
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        let userRole = 'learner'
        if (!profileError && profileData?.role) {
          userRole = profileData.role
        } else {
          const metaRole = user.user_metadata?.role
          if (metaRole === 'AI_EXPERT' || metaRole === 'expert') {
            userRole = 'expert'
          }
        }
        
        if (userRole !== 'expert') {
          if (userRole === 'admin') {
            router.push('/admin')
          } else {
            router.push('/dashboard/learner')
          }
          return
        }

        setUser(user)
        await loadApprovals()
        setLoading(false)
      } catch (error) {
        console.error('Error checking user role:', error)
        router.push('/dashboard/learner')
      }
    }

    getUser()
  }, [router, loadApprovals])

  const handleApprove = async (bookingId: string) => {
    setActionLoading(bookingId)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: expertNotes[bookingId] || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to approve booking')
      }

      const result = await response.json()
      setSuccessMessage('Booking approved successfully! Payment has been captured.')
      
      // Remove from approvals list
      setApprovals(prev => prev.filter(a => a.id !== bookingId))
      setSummary(prev => ({ 
        ...prev, 
        total_pending: Math.max(0, prev.total_pending - 1)
      }))
      
      // Clear notes
      setExpertNotes(prev => {
        const updated = { ...prev }
        delete updated[bookingId]
        return updated
      })

    } catch (error: any) {
      console.error('Error approving booking:', error)
      setError(error.message || 'Failed to approve booking')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (bookingId: string) => {
    setActionLoading(bookingId)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/decline`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: expertNotes[bookingId] || null,
          reason: declineReasons[bookingId] || 'Expert declined booking'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to decline booking')
      }

      setSuccessMessage('Booking declined successfully. Payment has been refunded.')
      
      // Remove from approvals list
      setApprovals(prev => prev.filter(a => a.id !== bookingId))
      setSummary(prev => ({ 
        ...prev, 
        total_pending: Math.max(0, prev.total_pending - 1)
      }))
      
      // Clear notes and reasons
      setExpertNotes(prev => {
        const updated = { ...prev }
        delete updated[bookingId]
        return updated
      })
      setDeclineReasons(prev => {
        const updated = { ...prev }
        delete updated[bookingId]
        return updated
      })

    } catch (error: any) {
      console.error('Error declining booking:', error)
      setError(error.message || 'Failed to decline booking')
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

  const getUrgencyBadge = (approval: BookingApproval) => {
    if (approval.is_urgent) {
      return <Badge variant="warning" className="ml-2">Urgent</Badge>
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading pending approvals...</p>
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
                onClick={() => router.push('/dashboard/expert')}
                className="flex items-center"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
              <h1 className="text-xl font-bold text-text">Booking Approvals</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadApprovals}
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
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Pending Approvals</p>
                  <p className="text-2xl font-bold text-text">{summary.total_pending}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Urgent</p>
                  <p className="text-2xl font-bold text-text">{summary.urgent_count}</p>
                  <p className="text-xs text-warning-text mt-1">Need immediate attention</p>
                </div>
                <div className="w-12 h-12 bg-warning-bg/10 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-warning-text" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Expiring Soon</p>
                  <p className="text-2xl font-bold text-text">{summary.expiring_soon}</p>
                  <p className="text-xs text-error-text mt-1">Within 6 hours</p>
                </div>
                <div className="w-12 h-12 bg-error-bg/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-error-text" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Messages */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <div>
              <h4 className="font-semibold">Error</h4>
              <p>{error}</p>
            </div>
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" className="mb-6">
            <Check className="h-4 w-4" />
            <div>
              <h4 className="font-semibold">Success</h4>
              <p>{successMessage}</p>
            </div>
          </Alert>
        )}

        {/* Approvals List */}
        {approvals.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text mb-2">All caught up!</h3>
              <p className="text-text-light mb-4">
                You have no pending booking requests to approve.
              </p>
              <Button
                variant="secondary"
                onClick={() => router.push('/dashboard/expert')}
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {approvals.map((approval) => (
              <Card key={approval.id} className={`${approval.is_urgent ? 'border-warning-text/30 bg-warning-bg/5' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        {approval.session.title}
                        {getUrgencyBadge(approval)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Requested {approval.time_since_created} • Level: {approval.session.level}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-accent">
                        {formatCurrency(approval.amount_authorized, approval.currency)}
                      </p>
                      <Badge variant="warning">Payment Authorized</Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Session Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface rounded-lg">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-text-light" />
                        <span className="text-sm text-text">
                          {formatDateTime(approval.start_at)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-text-light" />
                        <span className="text-sm text-text">
                          {approval.session.duration_minutes} minutes
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-text-light" />
                        <span className="text-sm text-text">
                          {approval.learner.display_name}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-text-light mb-1">Topics</p>
                        <div className="flex flex-wrap gap-1">
                          {approval.session.topic_tags.map((tag, index) => (
                            <Badge key={index} variant="neutral" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Session Description */}
                  {approval.session.description && (
                    <div className="p-4 bg-base rounded-lg">
                      <h4 className="font-medium text-text mb-2">Session Description</h4>
                      <p className="text-sm text-text-light">{approval.session.description}</p>
                    </div>
                  )}

                  {/* Learner Notes */}
                  {approval.learner_notes && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <h4 className="font-medium text-text mb-2">Notes from Learner</h4>
                      <p className="text-sm text-text-light">{approval.learner_notes}</p>
                    </div>
                  )}

                  {/* Expert Response */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text mb-2">
                        Your notes (optional)
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-border rounded-lg bg-base text-text placeholder-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        rows={3}
                        placeholder="Add any notes or preparation instructions for the learner..."
                        value={expertNotes[approval.id] || ''}
                        onChange={(e) => setExpertNotes(prev => ({
                          ...prev,
                          [approval.id]: e.target.value
                        }))}
                        maxLength={500}
                      />
                      <p className="text-xs text-text-light mt-1">
                        {(expertNotes[approval.id] || '').length}/500 characters
                      </p>
                    </div>

                    {/* Decline Reason (hidden initially) */}
                    <div>
                      <label className="block text-sm font-medium text-text mb-2">
                        Decline reason (if declining)
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-border rounded-lg bg-base text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={declineReasons[approval.id] || ''}
                        onChange={(e) => setDeclineReasons(prev => ({
                          ...prev,
                          [approval.id]: e.target.value
                        }))}
                      >
                        <option value="">Select a reason...</option>
                        <option value="Schedule conflict">Schedule conflict</option>
                        <option value="Topic not in my expertise">Topic not in my expertise</option>
                        <option value="Insufficient information provided">Insufficient information provided</option>
                        <option value="Student requirements unclear">Student requirements unclear</option>
                        <option value="Other (please specify in notes)">Other (please specify in notes)</option>
                      </select>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex gap-3 pt-0">
                  <Button
                    variant="primary"
                    onClick={() => handleApprove(approval.id)}
                    disabled={actionLoading === approval.id}
                    loading={actionLoading === approval.id}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve & Capture Payment
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDecline(approval.id)}
                    disabled={actionLoading === approval.id || !declineReasons[approval.id]}
                    loading={actionLoading === approval.id}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline & Refund
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}