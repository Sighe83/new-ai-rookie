'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge } from '@/components/ui'

export default function ExpertDashboard() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      if (user.user_metadata?.role !== 'AI_EXPERT') {
        router.push('/dashboard/rookie')
        return
      }

      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleAcceptSession = (sessionId: string) => {
    // TODO: Implement session acceptance logic
    console.log('Accepting session:', sessionId)
  }

  const handleDeclineSession = (sessionId: string) => {
    // TODO: Implement session decline logic
    console.log('Declining session:', sessionId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-base border-b border-border sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-text">AI Expert Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text-light">
                Welcome, {user?.email}
              </span>
              <Button onClick={handleSignOut} variant="destructive" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text mb-2">
            AI Coaching Hub ⚡
          </h2>
          <p className="text-text-light">
            Guide your students through personalized AI mentoring journeys
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>New Coaching Requests</CardTitle>
                    <CardDescription>Students seeking personalized AI mentoring</CardDescription>
                  </div>
                  <Badge variant="warning">1 new</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-warning-bg rounded-lg bg-warning-bg/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-base font-bold">LW</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-text">Lisa Wong</h4>
                        <p className="text-sm text-text-light">Seeking AI Career Guidance</p>
                        <p className="text-sm text-accent font-medium">Looking for ongoing mentoring</p>
                      </div>
                    </div>
                    <Badge variant="warning">New Request</Badge>
                  </div>
                  
                  <div className="mb-4 p-3 bg-base rounded-lg">
                    <p className="text-sm text-text-light mb-2">
&quot;Hi Dr. Chen! I&apos;m a software developer transitioning to AI. I&apos;d love a mentor to guide me through this journey. I&apos;m particularly interested in computer vision and have some Python background.&quot;
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-text-light">
                      <span>• 3 years Python experience</span>
                      <span>• CS degree</span>
                      <span>• Available evenings</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="primary"
                      onClick={() => handleAcceptSession('1')}
                    >
                      Accept as Student
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleDeclineSession('1')}
                    >
                      Send Message
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDeclineSession('1')}
                    >
                      Decline
                    </Button>
                  </div>
                </div>

                <div className="text-center p-4 bg-surface/50 rounded-lg">
                  <p className="text-sm text-text-light">
                    No other pending requests. Your coaching slots are currently full.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" className="w-full">View All Requests</Button>
              </CardFooter>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Sessions</CardTitle>
                  <CardDescription>Your coaching schedule</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-text">Sarah Anderson</h4>
                        <p className="text-sm text-text-light">Session #4 • Tomorrow, 2:00 PM</p>
                      </div>
                      <Button size="sm" variant="primary">Start Session</Button>
                    </div>
                    <div className="text-xs text-text-light bg-base p-2 rounded">
                      <strong>Focus:</strong> Neural network fundamentals & first project planning
                    </div>
                  </div>
                  
                  <div className="p-3 bg-surface rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-text">Marcus Johnson</h4>
                        <p className="text-sm text-text-light">Session #2 • Thursday, 7:00 PM</p>
                      </div>
                      <Button variant="secondary" size="sm">View Notes</Button>
                    </div>
                    <div className="text-xs text-text-light bg-base p-2 rounded">
                      <strong>Focus:</strong> Career transition strategy & learning roadmap
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-surface/50 rounded-lg">
                    <p className="text-sm text-text-light">
                      Next available slot: Dec 15 • 3:00 PM
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Coaching Impact</CardTitle>
                  <CardDescription>Your mentoring success</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-primary/10 rounded-lg">
                    <div className="text-2xl font-bold text-primary">4.9</div>
                    <p className="text-sm text-text-light">Student Satisfaction</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-text">7</div>
                      <p className="text-xs text-text-light">Sessions This Month</p>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-text">$525</div>
                      <p className="text-xs text-text-light">Monthly Earnings</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-light">Active Students</span>
                      <span className="text-text font-medium">3</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Earnings Overview</CardTitle>
                <CardDescription>Your coaching income</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-accent/10 rounded-lg">
                  <div className="text-3xl font-bold text-accent">$3,450</div>
                  <p className="text-sm text-text-light">Total Earnings (6 months)</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">This Month</span>
                    <span className="text-sm font-medium text-success-text">$525</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Avg per Session</span>
                    <span className="text-sm font-medium text-text">$75</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Next Payout</span>
                    <span className="text-sm text-text-light">Dec 15</span>
                  </div>
                </div>
                
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-xs text-text-light mb-1">
                    <strong>Steady Growth:</strong> +15% vs last month
                  </p>
                  <p className="text-xs text-text-light">
                    Consistent coaching relationships driving stable income
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="primary" className="w-full">View Payment History</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
                <CardDescription>Manage your schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-3 bg-success-bg rounded-lg">
                  <p className="text-sm text-success-text font-medium">Available Now</p>
                  <p className="text-xs text-success-text">Next 4 hours open</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Mon - Wed</span>
                    <span className="text-sm text-text-light">2:00 PM - 8:00 PM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Thu - Fri</span>
                    <span className="text-sm text-text-light">10:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Weekend</span>
                    <span className="text-sm text-text-light">Flexible</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" className="w-full">Update Availability</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Students</CardTitle>
                <CardDescription>Active coaching relationships</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">SA</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-text">Sarah Anderson</span>
                        <p className="text-xs text-text-light">3 sessions • Started Oct 15</p>
                      </div>
                    </div>
                    <Badge variant="success">Progressing</Badge>
                  </div>
                  <p className="text-xs text-text-light bg-surface p-2 rounded">
                    Focus: Neural networks foundations. Next: First project planning.
                  </p>
                </div>
                
                <div className="p-3 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">MJ</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-text">Marcus Johnson</span>
                        <p className="text-xs text-text-light">1 session • Started Nov 28</p>
                      </div>
                    </div>
                    <Badge variant="warning">Starting</Badge>
                  </div>
                  <p className="text-xs text-text-light bg-surface p-2 rounded">
                    Focus: Career transition from software dev. Next: Learning roadmap.
                  </p>
                </div>

                <div className="text-center p-3 bg-success-bg/10 rounded-lg">
                  <p className="text-xs text-success-text font-medium">
                    2/3 coaching slots filled
                  </p>
                  <p className="text-xs text-text-light">
                    Available for 1 more long-term student
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" className="w-full">Manage Students</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}