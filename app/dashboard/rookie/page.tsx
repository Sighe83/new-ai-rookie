'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/components/ui'

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
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
  <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'var(--color-text-light)' }}>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
  <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
  <header className="backdrop-blur-sm border-b sticky top-0 z-50" style={{ background: 'var(--color-base)', borderColor: 'var(--color-border)' }}>
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>AI Rookie Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm" style={{ color: 'var(--color-text-light)' }}>
                Welcome, {user?.email}
              </span>
              <Button
                onClick={handleSignOut}
                variant="destructive"
                size="sm"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Welcome to your AI learning journey! 🚀
          </h2>
          <p style={{ color: 'var(--color-text-light)' }}>
            You&apos;re logged in as an AI Rookie. Here&apos;s your personalized learning dashboard.
          </p>
        </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-primary)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Learning Resources</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Access curated AI learning materials perfect for beginners.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              Explore Resources →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-success-bg)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-success-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Progress Tracking</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Monitor your learning progress and achievements.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              View Progress →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-accent)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Community</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Connect with other AI Rookies and get support.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              Join Community →
            </Button>
          </Card>
        </div>

        <Card className="mt-8 p-6 border-0" style={{ background: 'var(--color-primary)', color: 'var(--color-base)' }}>
          <h3 className="text-xl font-bold mb-2">Ready to level up?</h3>
          <p className="mb-4 opacity-90">
            Once you&apos;ve mastered the basics, you can upgrade to AI Expert for advanced features and tools.
          </p>
          <Button style={{ background: 'var(--color-base)', color: 'var(--color-primary)' }}>
            Learn More
          </Button>
        </Card>
      </main>
    </div>
  )
}