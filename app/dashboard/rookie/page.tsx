'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge } from '@/components/ui'

export default function RookieDashboard() {
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

      if (user.user_metadata?.role !== 'AI_ROOKIE') {
        router.push('/dashboard/expert')
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
              <h1 className="text-xl font-bold text-text">AI Rookie Dashboard</h1>
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
            Your AI Coaching Journey 🚀
          </h2>
          <p className="text-text-light">
            Connect with AI experts for personalized guidance and mentoring
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Next Session</CardTitle>
                    <CardDescription>Upcoming coaching conversation</CardDescription>
                  </div>
                  <Badge variant="success">Confirmed</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-base font-bold text-white">DS</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-text">Dr. Sarah Chen</h4>
                        <p className="text-sm text-text-light">Your AI Coach</p>
                        <p className="text-sm text-accent font-medium">Tomorrow, 2:00 PM (60 min)</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4 p-3 bg-base rounded-lg">
                    <h5 className="text-sm font-semibold text-text mb-2">Session 4: Next Steps Discussion</h5>
                    <p className="text-sm text-text-light">
                      Follow up on neural network concepts from last session. Discuss your project ideas and plan next learning steps.
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Button size="sm" variant="primary">Join Session</Button>
                    <Button size="sm" variant="secondary">Add to Calendar</Button>
                  </div>
                </div>

                <div className="p-3 bg-surface/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">Need to reschedule?</p>
                      <p className="text-xs text-text-light">Free changes up to 24h before session</p>
                    </div>
                    <Button size="sm" variant="secondary">Reschedule</Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="primary" className="w-full">View All Sessions</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your AI Coaching Relationship</CardTitle>
                <CardDescription>Building expertise through personalized mentoring</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                  <div className="flex items-center space-x-4 mb-3">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-base font-bold text-white">DS</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-text">Dr. Sarah Chen</h4>
                      <p className="text-sm text-text-light">Your AI Coach • 3 sessions completed</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="flex space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className="text-warning-text">⭐</span>
                          ))}
                        </div>
                        <span className="text-xs text-text-light">(5.0 rating)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-accent">$75/session</p>
                    </div>
                  </div>
                  
                  <div className="mb-4 p-3 bg-base rounded-lg">
                    <h5 className="text-sm font-semibold text-text mb-1">Coaching Focus Areas</h5>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="primary">Neural Networks</Badge>
                      <Badge variant="neutral">Python</Badge>
                      <Badge variant="neutral">Computer Vision</Badge>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" variant="primary" className="flex-1">Schedule Next Session</Button>
                    <Button size="sm" variant="secondary">View Profile</Button>
                  </div>
                </div>

                <div className="text-center p-4 border border-border rounded-lg">
                  <p className="text-sm text-text-light mb-3">
                    Need a different coaching style or expertise area?
                  </p>
                  <Button size="sm" variant="secondary">Find New Coach</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Coaching Journey</CardTitle>
                <CardDescription>Your personal growth in AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <p className="text-sm text-text-light">Sessions with Dr. Chen</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Total Coaching Hours</span>
                    <Badge variant="primary">4.5h</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Started Coaching</span>
                    <span className="text-sm text-text-light">Oct 15, 2024</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text">Next Milestone</span>
                    <Badge variant="success">First Project</Badge>
                  </div>
                </div>
                
                <div className="p-3 bg-accent/5 rounded-lg">
                  <h5 className="text-sm font-semibold text-text mb-2">Current Focus</h5>
                  <p className="text-sm text-text-light">
                    Building foundation in neural networks and preparing for your first hands-on project.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session Notes & Insights</CardTitle>
                <CardDescription>Key takeaways from your coaching</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-success-bg/10 border border-success-bg rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-success-text rounded-full mt-2"></div>
                    <div className="text-sm flex-1">
                      <p className="text-text font-medium">Session 3 Key Insight</p>
                      <p className="text-text-light text-xs mb-1">Dec 8, 2024 • Dr. Chen</p>
                      <p className="text-text-light">
                        Focus on understanding the math behind backpropagation before moving to complex architectures.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div className="text-sm flex-1">
                      <p className="text-text font-medium">Next Session Planned</p>
                      <p className="text-text-light text-xs mb-1">Scheduled for Dec 10</p>
                      <p className="text-text-light">
                        Will work through a practical example of building your first neural network.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
                    <div className="text-sm flex-1">
                      <p className="text-text font-medium">Homework Progress</p>
                      <p className="text-text-light text-xs mb-1">Due before next session</p>
                      <p className="text-text-light">
                        Read Chapter 3 of suggested book and practice Python exercises.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="primary" className="w-full">Schedule Next Session</Button>
                <Button variant="secondary" className="w-full">Message Your Coach</Button>
                <Button variant="secondary" className="w-full">Review Session Notes</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}