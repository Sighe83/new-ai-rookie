'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Login from '@/components/Login'
import Signup from '@/components/Signup'
import { Card } from '@/components/ui'

export default function Home() {
  const [showSignup, setShowSignup] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const role = user.user_metadata?.role
        if (role === 'AI_ROOKIE') {
          router.push('/dashboard/rookie')
        } else if (role === 'AI_EXPERT') {
          router.push('/dashboard/expert')
        }
      }
      
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const role = session.user.user_metadata?.role
        if (role === 'AI_ROOKIE') {
          router.push('/dashboard/rookie')
        } else if (role === 'AI_EXPERT') {
          router.push('/dashboard/expert')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'var(--color-text-light)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
  <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--color-surface)' }}>
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            AI Learning Platform
          </h1>
          <p className="text-xl mb-2" style={{ color: 'var(--color-text-light)' }}>
            Master AI from Rookie to Expert
          </p>
          <p style={{ color: 'var(--color-text-light)' }}>
            Join thousands of learners on their AI journey
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
          <div className="flex-1 max-w-lg">
            <div className="space-y-8">
              <Card className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mr-4" style={{ background: 'var(--color-primary)' }}>
                    <svg className="w-6 h-6" style={{ color: 'var(--color-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>AI Rookie</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>Perfect for beginners</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-light)' }}>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2" style={{ color: 'var(--color-success-text)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Interactive learning modules
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-success-text mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Progress tracking
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-success-text mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Community support
                  </li>
                </ul>
              </Card>

              <Card className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mr-4" style={{ background: 'var(--color-accent)' }}>
                    <svg className="w-6 h-6" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>AI Expert</h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-light)' }}>For experienced practitioners</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-light)' }}>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2" style={{ color: 'var(--color-success-text)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Advanced model configuration
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-success-text mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    API management tools
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-success-text mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Team collaboration
                  </li>
                </ul>
              </Card>
            </div>
          </div>

          <div className="flex-1 max-w-md">
            {showSignup ? (
              <Signup onBackToLogin={() => setShowSignup(false)} />
            ) : (
              <Login onSignupClick={() => setShowSignup(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
