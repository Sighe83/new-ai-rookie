'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { AvailabilityWindowForm } from '@/components/AvailabilityWindowForm'
import { AvailabilityWindowList } from '@/components/AvailabilityWindowList'
import { MessageSquareIcon, ArrowLeftIcon } from 'lucide-react'
import type { AvailabilityWindow, CreateAvailabilityWindowRequest } from '@/types/availability'

export default function ExpertAvailabilityPage() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        await loadAvailabilityWindows()
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
        await loadAvailabilityWindows()
        setLoading(false)
      }
    }

    getUser()
  }, [router])

  const loadAvailabilityWindows = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch('/api/availability-windows?include_all=true', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load availability windows')
      }

      const data = await response.json()
      setWindows(data.windows || [])
    } catch (error) {
      console.error('Error loading availability windows:', error)
      setError(error instanceof Error ? error.message : 'Failed to load availability windows')
    }
  }

  const handleCreateWindow = async (data: CreateAvailabilityWindowRequest) => {
    setIsCreating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch('/api/availability-windows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create availability window')
      }

      await loadAvailabilityWindows()
    } catch (error) {
      console.error('Error creating availability window:', error)
      setError(error instanceof Error ? error.message : 'Failed to create availability window')
      throw error // Re-throw so form knows it failed
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteWindow = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch(`/api/availability-windows/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete availability window')
      }

      await loadAvailabilityWindows()
    } catch (error) {
      console.error('Error deleting availability window:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete availability window')
    }
  }

  const handleToggleStatus = async (id: string, isClosed: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch(`/api/availability-windows/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ is_closed: isClosed })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update availability window')
      }

      await loadAvailabilityWindows()
    } catch (error) {
      console.error('Error updating availability window:', error)
      setError(error instanceof Error ? error.message : 'Failed to update availability window')
    }
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
          <p className="text-text-light">Loading availability settings...</p>
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
                <a href="/dashboard/expert" className="text-text-light hover:text-text">Dashboard</a>
                <a href="/sessions" className="text-text-light hover:text-text">Sessions</a>
                <a href="/earnings" className="text-text-light hover:text-text">Earnings</a>
                <a href="/dashboard/expert/availability" className="text-primary font-medium">Availability</a>
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
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => router.push('/dashboard/expert')}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          
          <h2 className="text-3xl font-bold text-text mb-2">
            Manage Availability
          </h2>
          <p className="text-text-light">
            Create time windows when learners can book sessions with you.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-bg border border-red-300 rounded-lg">
            <p className="text-error-text text-sm">{error}</p>
            <Button 
              variant="secondary" 
              size="sm" 
              className="mt-2"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create New Window Form */}
          <div className="space-y-6">
            <AvailabilityWindowForm 
              onSubmit={handleCreateWindow}
              isLoading={isCreating}
            />
          </div>

          {/* Existing Windows List */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-text mb-4">
                Your Availability Windows
              </h3>
              <AvailabilityWindowList
                windows={windows}
                onDelete={handleDeleteWindow}
                onToggleStatus={handleToggleStatus}
                isLoading={loading}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}