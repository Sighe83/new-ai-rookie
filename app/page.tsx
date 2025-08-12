'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Signup from '@/components/Signup'
import Login from '@/components/Login'
import { Card, Button } from '@/components/ui'

export default function Home() {
  const [showModal, setShowModal] = useState(false)
  const [isLoginView, setIsLoginView] = useState(true)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('user_id', user.id)
            .single()
          
          if (!profileError && profileData?.role) {
            // Use database role for routing
            switch (profileData.role) {
              case 'admin':
                router.push('/admin')
                break
              case 'expert':
                router.push('/dashboard/expert')
                break
              case 'learner':
              default:
                router.push('/dashboard/learner')
                break
            }
          } else {
            // Fallback to user metadata if profile doesn't exist
            const role = user.user_metadata?.role
            if (role === 'AI_EXPERT' || role === 'expert') {
              router.push('/dashboard/expert')
            } else {
              router.push('/dashboard/learner')
            }
          }
        } catch (error) {
          console.error('Error checking user profile:', error)
          // Final fallback to user metadata
          const role = user.user_metadata?.role
          if (role === 'AI_EXPERT' || role === 'expert') {
            router.push('/dashboard/expert')
          } else {
            router.push('/dashboard/learner')
          }
        }
      }
      
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .single()
          
          if (!profileError && profileData?.role) {
            // Use database role for routing
            switch (profileData.role) {
              case 'admin':
                router.push('/admin')
                break
              case 'expert':
                router.push('/dashboard/expert')
                break
              case 'learner':
              default:
                router.push('/dashboard/learner')
                break
            }
          } else {
            // Fallback to user metadata if profile doesn't exist
            const role = session.user.user_metadata?.role
            if (role === 'AI_EXPERT' || role === 'expert') {
              router.push('/dashboard/expert')
            } else {
              router.push('/dashboard/learner')
            }
          }
        } catch (error) {
          console.error('Error checking user profile:', error)
          // Final fallback to user metadata
          const role = session.user.user_metadata?.role
          if (role === 'AI_EXPERT' || role === 'expert') {
            router.push('/dashboard/expert')
          } else {
            router.push('/dashboard/learner')
          }
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
    <div className="min-h-screen bg-surface">
      {/* Navigation Header */}
      <nav className="bg-base border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">AI Rookie</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsLoginView(true)
                  setShowModal(true)
                }}
              >
                Log In
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsLoginView(false)
                  setShowModal(true)
                }}
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-text mb-8">
              AI Rookie
            </h1>
            <p className="text-xl md:text-2xl text-text-light max-w-4xl mx-auto mb-12 leading-relaxed">
              AI Rookie connects you with experienced AI professionals for tailored, hands-on learning sessions. 
              You skip months of trial and error and go straight to practical skills you can use immediately.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                className="px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors text-lg"
                onClick={() => {
                  setIsLoginView(false)
                  setShowModal(true)
                }}
              >
                Get Started - Sign Up
              </button>
              <button 
                className="px-8 py-4 bg-base text-text font-semibold rounded-xl border border-border hover:bg-secondary transition-colors text-lg"
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                See How It Works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Unique Selling Points */}
      <div className="py-24 bg-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-text mb-4">Why AI Rookie?</h2>
            <p className="text-xl text-text-light">Skip the learning curve. Get results fast.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Real Experts, Real Skills</h3>
              <p className="text-text-light leading-relaxed">
                Learn from vetted AI experts who actually work with AI every day.
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-accent/10 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Your Goals, Your Pace</h3>
              <p className="text-text-light leading-relaxed">
                Whether you&apos;re starting from zero or refining specific skills, sessions adapt to you.
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-success-bg rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m9-9H3" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Instant Impact</h3>
              <p className="text-text-light leading-relaxed">
                Walk away from each session with clear, ready-to-apply actions for your work or projects.
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-warning-bg rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-warning-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 6v6m-7-3h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Hassle-Free Booking</h3>
              <p className="text-text-light leading-relaxed">
                Browse experts, pick a time, pay online, and you&apos;re set.
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">No Long-Term Commitments</h3>
              <p className="text-text-light leading-relaxed">
                Book one session or many—only when you need them.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-text mb-4">How It Works</h2>
            <p className="text-xl text-text-light">From search to success in 4 simple steps</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Find Your Expert</h3>
              <p className="text-text-light leading-relaxed">
                Browse our curated list of AI professionals and pick the one who matches your needs.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-accent text-white rounded-full flex items-center justify-center text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Book a Time</h3>
              <p className="text-text-light leading-relaxed">
                Choose a time slot that works for you. Your payment is only confirmed once the expert accepts.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-success-text text-white rounded-full flex items-center justify-center text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Meet Live Online</h3>
              <p className="text-text-light leading-relaxed">
                Join your session via a secure video link. Learn, ask, and get practical answers on the spot.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-warning-text text-white rounded-full flex items-center justify-center text-2xl font-bold">
                4
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Apply What You Learn</h3>
              <p className="text-text-light leading-relaxed">
                Leave with actionable steps, resources, and confidence to use AI right away.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-24 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-text mb-6">
            Start your AI journey today – it&apos;s just one click away.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              className="px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors text-lg"
              onClick={() => {
                setIsLoginView(false)
                setShowModal(true)
              }}
            >
              Get Started - Sign Up
            </button>
            <button 
              className="px-8 py-4 bg-base text-text font-semibold rounded-xl border border-border hover:bg-secondary transition-colors text-lg"
              onClick={() => {
                setIsLoginView(true)
                setShowModal(true)
              }}
            >
              Log In
            </button>
          </div>
        </div>
      </div>

      {/* Login/Signup Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-base rounded-2xl shadow-soft max-w-md w-full relative">
            <button 
              className="absolute top-4 right-4 text-text-light hover:text-text text-xl p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <div className="p-8 pt-6">
              {isLoginView ? (
                <Login 
                  onSignupClick={() => setIsLoginView(false)} 
                />
              ) : (
                <Signup 
                  onBackToLogin={() => setIsLoginView(true)} 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
