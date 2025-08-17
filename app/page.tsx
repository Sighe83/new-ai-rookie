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
    <>
      <style jsx>{`
        @keyframes rocketLaunch {
          0% {
            transform: translateY(20px) rotate(-45deg);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-10px) rotate(-45deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-30px) rotate(-45deg);
            opacity: 0.8;
          }
        }
        
        @keyframes floatUp {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .rocket-launch {
          animation: rocketLaunch 3s ease-in-out infinite;
        }
        
        .float-gentle {
          animation: floatUp 4s ease-in-out infinite;
        }
        
        .sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
        
        .slide-up {
          animation: slideInUp 0.8s ease-out forwards;
          opacity: 0;
        }
        
        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }
        .delay-3 { animation-delay: 0.6s; }
        .delay-4 { animation-delay: 0.8s; }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-surface via-base to-surface">
      
      {/* Navigation Header */}
      <nav className="bg-base/90 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-18">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">🚀</span>
              </div>
              <h1 className="text-xl font-bold text-text">AI Rookie</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsLoginView(true)
                  setShowModal(true)
                }}
              >
                Log ind
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsLoginView(false)
                  setShowModal(true)
                }}
              >
                Kom i gang
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text */}
            <div className="slide-up delay-1">
              <div className="inline-flex items-center bg-gradient-to-r from-primary/10 to-accent/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <span className="sparkle mr-2">⭐</span>
                Send din karriere til månen
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-text mb-6 leading-tight">
                Få din karriere til at
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  skyde i vejret
                </span>
                med AI
              </h1>
              <p className="text-xl text-text-light mb-8 leading-relaxed">
                Book en personlig AI-session og få din karriere til at accelerere. Erfarne eksperter hjælper dig med at mestre AI-værktøjer der gør dig uundværlig på arbejdspladsen.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  className="group px-8 py-4 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-300 text-lg transform hover:scale-105"
                  onClick={() => {
                    setIsLoginView(false)
                    setShowModal(true)
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    🚀 Start din rejse
                  </span>
                </button>
                <button 
                  className="px-8 py-4 bg-base text-text font-medium rounded-xl border border-border hover:bg-secondary transition-colors text-lg"
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Se hvordan det virker
                </button>
              </div>
            </div>
            
            {/* Right Column - Rocket Animation */}
            <div className="slide-up delay-2 relative">
              <div className="relative h-96 flex items-center justify-center">
                {/* Background stars */}
                <div className="absolute inset-0">
                  <div className="absolute top-12 left-12 sparkle text-yellow-400 text-2xl">⭐</div>
                  <div className="absolute top-24 right-16 sparkle text-yellow-300 text-xl delay-1">✨</div>
                  <div className="absolute bottom-20 left-8 sparkle text-yellow-500 text-lg delay-2">💫</div>
                  <div className="absolute top-32 right-8 sparkle text-yellow-400 text-sm delay-3">⭐</div>
                </div>
                
                {/* Career path line */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1 h-80 bg-gradient-to-t from-primary/20 via-primary/40 to-primary/60 rounded-full"></div>
                </div>
                
                {/* Career levels */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 float-gentle">
                  <div className="bg-base border border-border rounded-lg p-3 shadow-lg">
                    <div className="text-sm text-text-light">Nuværende niveau</div>
                    <div className="font-semibold text-text">AI Begynder</div>
                  </div>
                </div>
                
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 float-gentle delay-2">
                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-3 shadow-lg">
                    <div className="text-sm text-primary">Mål niveau</div>
                    <div className="font-semibold text-text">AI Expert 🏆</div>
                  </div>
                </div>
                
                {/* Rocket */}
                <div className="rocket-launch text-6xl">
                  🚀
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="py-20 bg-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 slide-up delay-1">
            <h2 className="text-3xl lg:text-4xl font-bold text-text mb-4">
              Hvorfor din karriere vil eksplodere
            </h2>
            <p className="text-xl text-text-light">Tre måder AI Rookie sender dig til tops</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 slide-up delay-1">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Praktisk ekspertise</h3>
              <p className="text-text-light leading-relaxed">
                Lær fra AI-eksperter der arbejder i top-virksomheder. Få insider-viden der gør dig uundværlig.
              </p>
            </Card>

            <Card className="p-8 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 slide-up delay-2">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-accent/20 to-primary/20 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Lynhurtige resultater</h3>
              <p className="text-text-light leading-relaxed">
                Implementer AI-løsninger samme dag som din session. Se din produktivitet skyde i vejret øjeblikkeligt.
              </p>
            </Card>

            <Card className="p-8 text-center hover:shadow-xl transition-all duration-300 hover:scale-105 slide-up delay-3">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🏆</span>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Karriere acceleration</h3>
              <p className="text-text-light leading-relaxed">
                Bliv den AI-ekspert på dit team. Få forfremmelser og bedre lønninger med dine nye superkræfter.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="py-20 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 slide-up delay-1">
            <h2 className="text-3xl font-bold text-text mb-4">Din rejse til AI-ekspertise</h2>
            <p className="text-xl text-text-light">Tre simple trin til karriere-acceleration</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center slide-up delay-1">
              <div className="relative mb-8">
                <div className="w-20 h-20 mx-auto bg-gradient-to-r from-primary to-accent text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                  1
                </div>
                <div className="absolute -top-2 -right-2 text-2xl sparkle">⭐</div>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Find din AI-mentor</h3>
              <p className="text-text-light leading-relaxed">
                Vælg blandt erfarne AI-praktikere der matcher dine karrieremål og branche.
              </p>
            </div>
            
            <div className="text-center slide-up delay-2">
              <div className="relative mb-8">
                <div className="w-20 h-20 mx-auto bg-gradient-to-r from-accent to-primary text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                  2
                </div>
                <div className="absolute -top-2 -right-2 text-2xl sparkle delay-1">🚀</div>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Boost din session</h3>
              <p className="text-text-light leading-relaxed">
                Book din personlige AI-accelerations session og beskriv dine karriereambitioner.
              </p>
            </div>
            
            <div className="text-center slide-up delay-3">
              <div className="relative mb-8">
                <div className="w-20 h-20 mx-auto bg-gradient-to-r from-primary to-accent text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                  3
                </div>
                <div className="absolute -top-2 -right-2 text-2xl sparkle delay-2">🏆</div>
              </div>
              <h3 className="text-xl font-bold text-text mb-4">Skyd af mod stjernerne</h3>
              <p className="text-text-light leading-relaxed">
                Implementer dine nye AI-superkræfter og se din karriere tage fart som aldrig før.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 bg-gradient-to-r from-primary to-accent text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-accent/90"></div>
        <div className="absolute top-8 left-8 sparkle text-3xl">⭐</div>
        <div className="absolute top-12 right-12 sparkle text-2xl delay-1">🚀</div>
        <div className="absolute bottom-8 left-12 sparkle text-xl delay-2">✨</div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 slide-up delay-1">
            Klar til at skyde din karriere af?
          </h2>
          <p className="text-xl mb-8 opacity-90 slide-up delay-2">
            Book din første AI-raket session og se din karriere tage fart
          </p>
          <button 
            className="group px-12 py-5 bg-white text-primary font-bold rounded-xl hover:bg-primary-50 transition-all duration-300 text-xl shadow-2xl transform hover:scale-105 slide-up delay-3"
            onClick={() => {
              setIsLoginView(false)
              setShowModal(true)
            }}
          >
            <span className="flex items-center justify-center gap-3">
              🚀 Send mig til månen!
            </span>
          </button>
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
    </>
  )
}
