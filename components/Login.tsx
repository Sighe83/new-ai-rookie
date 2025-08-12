'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui'

interface LoginProps {
  onSignupClick: () => void
}

export default function Login({ onSignupClick }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      // Check if email is confirmed for users created via admin (experts)
      if (data.user && !data.user.email_confirmed_at) {
        // Sign out the user since they shouldn't be allowed to login unverified
        await supabase.auth.signOut()
        throw new Error('Email not confirmed')
      }
      
      // Log successful authentication for debugging
      console.log('Login successful:', data)
    } catch (error) {
      console.error('Login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      
      // Provide more helpful error messages
      if (errorMessage.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.')
      } else if (errorMessage.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials and ensure your email is confirmed.')
      } else if (errorMessage.includes('Email rate limit exceeded')) {
        setError('Too many requests. Please wait a few minutes before trying again.')
      } else {
        setError(errorMessage)
      }
      
      console.log('Full error details:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="p-8">
        <CardHeader className="text-center p-0 mb-8">
          <CardTitle className="text-3xl">Welcome Back</CardTitle>
          <CardDescription className="mt-2">Sign in to your account</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            {error && (
              <div className="bg-error-bg border border-red-300 rounded-xl p-4">
                <p className="text-error-text text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>
        </CardContent>

        <CardFooter className="text-center p-0 pt-8">
          <p className="text-text-light">
            New AI Rookie?{' '}
            <button
              onClick={onSignupClick}
              className="text-primary hover:text-primary-hover font-bold transition-colors"
            >
              Create account
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}