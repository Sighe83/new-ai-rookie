'use client'

import { useState, useEffect } from 'react'
import { supabase, AppUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/components/ui'

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
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>AI Expert Dashboard</h1>
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
            Expert AI Control Center ⚡
          </h2>
          <p style={{ color: 'var(--color-text-light)' }}>
            You&apos;re logged in as an AI Expert. Access advanced tools and features.
          </p>
        </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-accent)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Advanced Analytics</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Deep insights and analytics for complex AI projects.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              View Analytics →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-secondary)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-secondary-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Model Configuration</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Fine-tune and configure advanced AI models.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              Configure Models →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-success-bg)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-success-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>API Management</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Manage APIs, keys, and integrations.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              Manage APIs →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-warning-bg)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-warning-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Performance Metrics</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Monitor system performance and optimization.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              View Metrics →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-accent)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Team Management</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Manage AI Rookies and collaborative projects.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              Manage Team →
            </Button>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--color-primary)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--color-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Documentation</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-light)' }}>
              Access expert-level documentation and guides.
            </p>
            <Button variant="primary" size="sm" className="font-bold" onClick={() => {/* TODO: add handler */}}>
              Read Docs →
            </Button>
          </Card>
        </div>

        <Card className="mt-8 p-6 border-0" style={{ background: 'var(--color-accent)', color: 'var(--color-base)' }}>
          <h3 className="text-xl font-bold mb-2">Expert Tools Unlocked! 🎯</h3>
          <p className="mb-4 opacity-90">
            You have access to all advanced features, AI model configurations, and team management tools.
          </p>
          <Button style={{ background: 'var(--color-base)', color: 'var(--color-accent)' }}>
            Explore Advanced Features
          </Button>
        </Card>
      </main>
    </div>
  )
}