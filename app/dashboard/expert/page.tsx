'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge } from '@/components/ui'
import { CalendarIcon, UserIcon, TrendingUpIcon, DollarSignIcon, VideoIcon, MessageSquareIcon, StarIcon, CalendarDaysIcon } from 'lucide-react'

interface Session {
  id: string
  expert_id: string
  learner_id: string
  scheduled_at: string
  duration_minutes: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  price: number
  meeting_url?: string
  notes?: string
  learner: {
    id: string
    full_name: string
    email: string
    sessions_completed: number
  }
}

interface ExpertStats {
  total_earnings: number
  pending_earnings: number
  total_sessions: number
  sessions_this_month: number
  average_rating: number
  total_reviews: number
  completion_rate: number
  next_session?: Session
  upcoming_sessions: Session[]
}

interface AvailabilitySlot {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export default function ExpertDashboard() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ExpertStats | null>(null)
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      try {
        // Check database role first
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        let userRole = 'learner' // default
        
        if (!profileError && profileData?.role) {
          userRole = profileData.role
        } else {
          // Fallback to user metadata
          const metaRole = user.user_metadata?.role
          if (metaRole === 'AI_EXPERT' || metaRole === 'expert') {
            userRole = 'expert'
          }
        }
        
        // If not expert, redirect to appropriate dashboard
        if (userRole !== 'expert') {
          if (userRole === 'admin') {
            router.push('/admin')
          } else {
            router.push('/dashboard/learner')
          }
          return
        }

        setUser(user)
        await loadDashboardData(user.id)
        setLoading(false)
      } catch (error) {
        console.error('Error checking user role:', error)
        // Fallback to metadata check
        const metaRole = user.user_metadata?.role
        if (metaRole !== 'AI_EXPERT' && metaRole !== 'expert') {
          router.push('/dashboard/learner')
          return
        }
        
        setUser(user)
        await loadDashboardData(user.id)
        setLoading(false)
      }
    }

    getUser()
  }, [router])

  const loadDashboardData = async (userId: string) => {
    // Mock data representing expert statistics
    const mockStats: ExpertStats = {
      total_earnings: 8750,
      pending_earnings: 625,
      total_sessions: 72,
      sessions_this_month: 2,
      average_rating: 4.9,
      total_reviews: 45,
      completion_rate: 98,
      next_session: {
        id: '1',
        expert_id: userId,
        learner_id: 'learner-1',
        scheduled_at: new Date(Date.now() + 7200000).toISOString(), // In 2 hours
        duration_minutes: 60,
        status: 'confirmed',
        price: 125,
        meeting_url: 'https://zoom.us/j/123456789',
        notes: 'Available when convenient - flexible timing for this session',
        learner: {
          id: 'learner-1',
          full_name: 'Alex Johnson',
          email: 'alex@example.com',
          sessions_completed: 5
        }
      },
      upcoming_sessions: [
        {
          id: '2',
          expert_id: userId,
          learner_id: 'learner-2',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          duration_minutes: 90,
          status: 'confirmed',
          price: 187.50,
          learner: {
            id: 'learner-2',
            full_name: 'Maria Garcia',
            email: 'maria@example.com',
            sessions_completed: 12
          }
        },
        {
          id: '3',
          expert_id: userId,
          learner_id: 'learner-3',
          scheduled_at: new Date(Date.now() + 172800000).toISOString(), // In 2 days
          duration_minutes: 60,
          status: 'confirmed',
          price: 125,
          learner: {
            id: 'learner-3',
            full_name: 'James Wilson',
            email: 'james@example.com',
            sessions_completed: 2
          }
        }
      ],
    }

    const mockAvailability: AvailabilitySlot[] = [
      { id: '1', day_of_week: 1, start_time: '09:00', end_time: '12:00', is_active: true },
      { id: '2', day_of_week: 1, start_time: '14:00', end_time: '17:00', is_active: true },
      { id: '3', day_of_week: 3, start_time: '10:00', end_time: '13:00', is_active: true },
      { id: '4', day_of_week: 3, start_time: '15:00', end_time: '18:00', is_active: true },
      { id: '5', day_of_week: 5, start_time: '09:00', end_time: '12:00', is_active: true }
    ]

    setStats(mockStats)
    setAvailability(mockAvailability)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
    
    if (diffHours < 24) {
      if (diffHours <= 1) return 'In 1 hour'
      return `In ${diffHours} hours`
    }
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays <= 7) return `In ${diffDays} days`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[day]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading your expert dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-base border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-text">AI Expert Hub</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="/dashboard/expert" className="text-primary font-medium">Dashboard</a>
                <a href="/sessions" className="text-text-light hover:text-text">Sessions</a>
                <a href="/earnings" className="text-text-light hover:text-text">Earnings</a>
                <a href="/availability" className="text-text-light hover:text-text">Availability</a>
                <a href="/profile" className="text-text-light hover:text-text">Profile</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="secondary" size="sm">
                <MessageSquareIcon className="w-4 h-4 mr-2" />
                Messages
              </Button>
              <span className="text-sm text-text-light hidden sm:block">
                {user?.email}
              </span>
              <Button onClick={handleSignOut} variant="destructive" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text mb-2">
            Expert Dashboard
          </h2>
          <p className="text-text-light">
            Connect with learners when your schedule allows
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Total Earnings</p>
                  <p className="text-2xl font-bold text-text">${stats?.total_earnings.toLocaleString()}</p>
                  <p className="text-xs text-success-text mt-1">+${stats?.pending_earnings} pending</p>
                </div>
                <div className="w-12 h-12 bg-success-bg/10 rounded-xl flex items-center justify-center">
                  <DollarSignIcon className="w-6 h-6 text-success-text" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Total Coaching Sessions</p>
                  <p className="text-2xl font-bold text-text">{stats?.total_sessions}</p>
                  <p className="text-xs text-primary mt-1">{stats?.sessions_this_month} recently</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <VideoIcon className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Average Rating</p>
                  <p className="text-2xl font-bold text-text">{stats?.average_rating}</p>
                  <p className="text-xs text-text-light mt-1">from {stats?.total_reviews} reviews</p>
                </div>
                <div className="w-12 h-12 bg-warning-bg/10 rounded-xl flex items-center justify-center">
                  <StarIcon className="w-6 h-6 text-warning-text" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Completion Rate</p>
                  <p className="text-2xl font-bold text-text">{stats?.completion_rate}%</p>
                  <p className="text-xs text-accent mt-1">Excellent</p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <TrendingUpIcon className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Next Session */}
            {stats?.next_session && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Your Next Coaching Session</CardTitle>
                      <CardDescription>
                        {formatDate(stats.next_session.scheduled_at)} • {stats.next_session.duration_minutes} minutes
                      </CardDescription>
                    </div>
                    <Badge variant="success">Confirmed</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-text">{stats.next_session.learner.full_name}</h4>
                      <p className="text-sm text-text-light mb-2">
                        {stats.next_session.learner.email} • Session #{stats.next_session.learner.sessions_completed + 1}
                      </p>
                      {stats.next_session.notes && (
                        <div className="p-3 bg-base rounded-lg">
                          <p className="text-sm text-text-light">{stats.next_session.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-accent">${stats.next_session.price}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button variant="primary" className="flex-1">
                      <VideoIcon className="w-4 h-4 mr-2" />
                      Start Session
                    </Button>
                    <Button variant="secondary">
                      <MessageSquareIcon className="w-4 h-4 mr-2" />
                      Message Learner
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Sessions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Sessions</CardTitle>
                    <CardDescription>When you&apos;re available to help</CardDescription>
                  </div>
                  <Badge variant="primary">{stats?.upcoming_sessions.length} scheduled</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats?.upcoming_sessions.map((session) => (
                  <div key={session.id} className="p-4 bg-surface rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-text">{session.learner.full_name}</p>
                          <p className="text-sm text-text-light">
                            {formatDate(session.scheduled_at)} • {session.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-accent">${session.price}</p>
                        <Badge variant="success" className="mt-1">Confirmed</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button size="sm" variant="secondary">
                        <MessageSquareIcon className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button variant="secondary" className="w-full">View All Sessions</Button>
              </CardFooter>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Availability */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>When You&apos;re Available</CardTitle>
                  <Button size="sm" variant="secondary">Edit</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {availability.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                    <div>
                      <p className="font-medium text-text text-sm">{getDayName(slot.day_of_week)}</p>
                      <p className="text-xs text-text-light">
                        {slot.start_time} - {slot.end_time}
                      </p>
                    </div>
                    <Badge variant={slot.is_active ? 'success' : 'neutral'}>
                      {slot.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
                <Button variant="secondary" className="w-full mt-4">
                  <CalendarDaysIcon className="w-4 h-4 mr-2" />
                  Update Your Schedule
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="secondary" className="w-full justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Mark Unavailable
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <DollarSignIcon className="w-4 h-4 mr-2" />
                  Update Rates
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <StarIcon className="w-4 h-4 mr-2" />
                  View Reviews
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  )
}