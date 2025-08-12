'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge } from '@/components/ui'
import { CalendarIcon, ClockIcon, UserIcon, TrendingUpIcon, BookOpenIcon, VideoIcon, MessageSquareIcon, DollarSignIcon } from 'lucide-react'

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
  expert: {
    id: string
    full_name: string
    expertise: string[]
    hourly_rate: number
    rating: number
  }
}

interface LearningProgress {
  total_sessions: number
  total_hours: number
  sessions_this_month: number
  money_spent: number
  next_session?: Session
  recent_sessions: Session[]
}

export default function LearnerDashboard() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<LearningProgress | null>(null)
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([])
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
          } else if (metaRole === 'admin') {
            userRole = 'admin'
          }
        }
        
        // If not learner, redirect to appropriate dashboard
        if (userRole !== 'learner') {
          if (userRole === 'admin') {
            router.push('/admin')
          } else {
            router.push('/dashboard/expert')
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
        if (metaRole === 'AI_EXPERT' || metaRole === 'expert') {
          router.push('/dashboard/expert')
          return
        } else if (metaRole === 'admin') {
          router.push('/admin')
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
    // In a real app, these would be actual database queries
    // For now, using mock data that represents what would come from Supabase
    
    const mockProgress: LearningProgress = {
      total_sessions: 12,
      total_hours: 18,
      sessions_this_month: 1,
      money_spent: 1350,
      next_session: {
        id: '1',
        expert_id: 'expert-1',
        learner_id: userId,
        scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        duration_minutes: 60,
        status: 'confirmed',
        price: 125,
        meeting_url: 'https://zoom.us/j/123456789',
        notes: 'Continue discussing your project - flexible on timing to fit your schedule',
        expert: {
          id: 'expert-1',
          full_name: 'Dr. Sarah Chen',
          expertise: ['Machine Learning', 'Neural Networks', 'Python'],
          hourly_rate: 125,
          rating: 4.9
        }
      },
      recent_sessions: [
        {
          id: '2',
          expert_id: 'expert-1',
          learner_id: userId,
          scheduled_at: new Date(Date.now() - 604800000).toISOString(), // Last week
          duration_minutes: 90,
          status: 'completed',
          price: 187.50,
          expert: {
            id: 'expert-1',
            full_name: 'Dr. Sarah Chen',
            expertise: ['Machine Learning', 'Neural Networks', 'Python'],
            hourly_rate: 125,
            rating: 4.9
          }
        }
      ]
    }

    const mockUpcoming: Session[] = [
      mockProgress.next_session!,
      {
        id: '3',
        expert_id: 'expert-1',
        learner_id: userId,
        scheduled_at: new Date(Date.now() + 432000000).toISOString(), // In 5 days
        duration_minutes: 60,
        status: 'confirmed',
        price: 125,
        expert: {
          id: 'expert-1',
          full_name: 'Dr. Sarah Chen',
          expertise: ['Machine Learning', 'Neural Networks', 'Python'],
          hourly_rate: 125,
          rating: 4.9
        }
      }
    ]

    setProgress(mockProgress)
    setUpcomingSessions(mockUpcoming)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading your learning journey...</p>
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
              <h1 className="text-xl font-bold text-text">AI Rookie</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="/dashboard/learner" className="text-primary font-medium">Dashboard</a>
                <a href="/experts" className="text-text-light hover:text-text">Find Experts</a>
                <a href="/sessions" className="text-text-light hover:text-text">My Sessions</a>
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
            Welcome back, {user?.email?.split('@')[0]}!
          </h2>
          <p className="text-text-light">
            Connect with AI experts for monthly coaching sessions
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Total Sessions</p>
                  <p className="text-2xl font-bold text-text">{progress?.total_sessions || 0}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <BookOpenIcon className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Learning Hours</p>
                  <p className="text-2xl font-bold text-text">{progress?.total_hours || 0}h</p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <ClockIcon className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Recent Sessions</p>
                  <p className="text-2xl font-bold text-text">{progress?.sessions_this_month || 0}</p>
                </div>
                <div className="w-12 h-12 bg-success-bg/10 rounded-xl flex items-center justify-center">
                  <TrendingUpIcon className="w-6 h-6 text-success-text" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-light mb-1">Invested</p>
                  <p className="text-2xl font-bold text-text">${progress?.money_spent || 0}</p>
                </div>
                <div className="w-12 h-12 bg-warning-bg/10 rounded-xl flex items-center justify-center">
                  <DollarSignIcon className="w-6 h-6 text-warning-text" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Next Session Card */}
            {progress?.next_session && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Your Next Session</CardTitle>
                      <CardDescription>
                        {formatDate(progress.next_session.scheduled_at)} • {progress.next_session.duration_minutes} minutes
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
                      <h4 className="font-semibold text-text">{progress.next_session.expert.full_name}</h4>
                      <p className="text-sm text-text-light mb-2">Your AI Coach • {progress.next_session.expert.rating} ★</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {progress.next_session.expert.expertise.map((skill, idx) => (
                          <Badge key={idx} variant="neutral">{skill}</Badge>
                        ))}
                      </div>
                      {progress.next_session.notes && (
                        <div className="p-3 bg-base rounded-lg">
                          <p className="text-sm text-text-light">{progress.next_session.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button variant="primary" className="flex-1">
                      <VideoIcon className="w-4 h-4 mr-2" />
                      Join Session
                    </Button>
                    <Button variant="secondary">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Add to Calendar
                    </Button>
                    <Button variant="secondary">Reschedule</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Your Next Sessions</CardTitle>
                <CardDescription>Scheduled with your AI coach</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-surface rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-text">{session.expert.full_name}</p>
                          <p className="text-sm text-text-light">
                            {formatDate(session.scheduled_at)} • {session.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      <Badge variant={session.status === 'confirmed' ? 'success' : 'neutral'}>
                        {session.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-accent font-medium">${session.price}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary">View Details</Button>
                      </div>
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
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="secondary" className="w-full justify-start">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Find Your AI Coach
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <ClockIcon className="w-4 h-4 mr-2" />
                  Session History
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <DollarSignIcon className="w-4 h-4 mr-2" />
                  Payment Methods
                </Button>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="pt-6">
                <h4 className="font-semibold text-text mb-2">Need Help?</h4>
                <p className="text-sm text-text-light mb-4">
                  Our support team is here to help you get the most from your learning experience.
                </p>
                <Button variant="primary" size="sm" className="w-full">
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}