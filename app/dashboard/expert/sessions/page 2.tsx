'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, AppUser } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { ExpertSessionForm } from '@/components/ExpertSessionForm'
import { ExpertSessionCard } from '@/components/ExpertSessionCard'
import { 
  ExpertSession, 
  CreateExpertSessionRequest, 
  UpdateExpertSessionRequest 
} from '@/types/expert-sessions'
import { PlusIcon, ArrowLeftIcon } from 'lucide-react'

export default function ExpertSessionsPage() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [sessions, setSessions] = useState<ExpertSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSession, setEditingSession] = useState<ExpertSession | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      // Verify user is an expert
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
          router.push('/dashboard/learner')
          return
        }

        setUser(user)
        await loadSessions(user)
      } catch (error) {
        console.error('Error checking user role:', error)
        router.push('/dashboard/learner')
        return
      }
      
      setLoading(false)
    }

    getUser()
  }, [router])

  const loadSessions = async (user: AppUser) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        console.error('No access token available')
        return
      }

      const response = await fetch('/api/expert-sessions?my_sessions=true', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to load sessions:', errorData.error)
        return
      }

      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const handleCreateSession = async (sessionData: CreateExpertSessionRequest | UpdateExpertSessionRequest) => {
    if (!user) return

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No access token available')
      }

      const response = await fetch('/api/expert-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(sessionData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create session')
      }

      const data = await response.json()
      setSessions(prev => [data.session, ...prev])
      setShowCreateForm(false)
      
      // Show success message (you could use a toast library here)
      alert('Session created successfully!')
      
    } catch (error) {
      console.error('Error creating session:', error)
      alert(error instanceof Error ? error.message : 'Failed to create session')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateSession = async (sessionData: CreateExpertSessionRequest | UpdateExpertSessionRequest) => {
    if (!editingSession || !user) return

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No access token available')
      }

      const response = await fetch(`/api/expert-sessions/${editingSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(sessionData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update session')
      }

      const data = await response.json()
      setSessions(prev => prev.map(s => s.id === editingSession.id ? data.session : s))
      setEditingSession(null)
      
      // Show success message
      alert('Session updated successfully!')
      
    } catch (error) {
      console.error('Error updating session:', error)
      alert(error instanceof Error ? error.message : 'Failed to update session')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (sessionId: string, isActive: boolean) => {
    if (!user) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No access token available')
      }

      const response = await fetch(`/api/expert-sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ is_active: isActive })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update session')
      }

      const data = await response.json()
      setSessions(prev => prev.map(s => s.id === sessionId ? data.session : s))
      
      // Show success message
      alert(`Session ${isActive ? 'activated' : 'deactivated'} successfully!`)
      
    } catch (error) {
      console.error('Error toggling session status:', error)
      alert(error instanceof Error ? error.message : 'Failed to update session')
    }
  }

  const handleBackToDashboard = () => {
    router.push('/dashboard/expert')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-light">Loading your sessions...</p>
        </div>
      </div>
    )
  }

  // Show create form
  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="bg-base border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Sessions
                </Button>
                <h1 className="text-xl font-bold text-text">Create New Session</h1>
              </div>
              <div className="flex items-center space-x-4">
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
          <ExpertSessionForm
            mode="create"
            onSubmit={handleCreateSession}
            onCancel={() => setShowCreateForm(false)}
            isLoading={submitting}
          />
        </main>
      </div>
    )
  }

  // Show edit form
  if (editingSession) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="bg-base border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setEditingSession(null)}
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Sessions
                </Button>
                <h1 className="text-xl font-bold text-text">Edit Session</h1>
              </div>
              <div className="flex items-center space-x-4">
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
          <ExpertSessionForm
            mode="edit"
            session={editingSession}
            onSubmit={handleUpdateSession}
            onCancel={() => setEditingSession(null)}
            isLoading={submitting}
          />
        </main>
      </div>
    )
  }

  // Main sessions list view
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-base border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-text">My Sessions</h1>
              <nav className="hidden md:flex space-x-6">
                <button 
                  onClick={handleBackToDashboard}
                  className="text-text-light hover:text-text"
                >
                  Dashboard
                </button>
                <span className="text-primary font-medium">My Sessions</span>
                <a href="/dashboard/expert/availability" className="text-text-light hover:text-text">Availability</a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                New Session
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
        {/* Header Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text mb-2">
            Session Templates
          </h2>
          <p className="text-text-light">
            Manage your session offerings that learners can book
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-text">{sessions.length}</p>
                <p className="text-sm text-text-light">Total Sessions</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-success-text">
                  {sessions.filter(s => s.is_active).length}
                </p>
                <p className="text-sm text-text-light">Active Sessions</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-text-light">
                  {sessions.filter(s => !s.is_active).length}
                </p>
                <p className="text-sm text-text-light">Inactive Sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>No Sessions Yet</CardTitle>
              <CardDescription>
                Create your first session template to start accepting bookings from learners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="primary" 
                size="lg"
                onClick={() => setShowCreateForm(true)}
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Your First Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map(session => (
              <ExpertSessionCard
                key={session.id}
                session={session}
                onEdit={(sessionId) => {
                  const session = sessions.find(s => s.id === sessionId)
                  if (session) setEditingSession(session)
                }}
                onToggleActive={handleToggleActive}
                showActions={true}
                isOwner={true}
              />
            ))}
          </div>
        )}

        {/* Create Session CTA */}
        {sessions.length > 0 && (
          <div className="mt-12 text-center">
            <Button 
              variant="secondary" 
              size="lg"
              onClick={() => setShowCreateForm(true)}
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Another Session
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}