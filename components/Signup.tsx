'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui'

interface SignupProps {
  onBackToLogin: () => void
}

export default function Signup({ onBackToLogin }: SignupProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'AI_ROOKIE'
          }
        }
      })

      if (error) throw error

      if (data.user && !data.user.email_confirmed_at) {
        setSuccess(true)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle className="mb-2">Check Your Email</CardTitle>
          <CardDescription className="mb-6">
            We&apos;ve sent you a confirmation link at <span className="font-bold">{email}</span>
          </CardDescription>
          <button
            onClick={onBackToLogin}
            className="text-primary hover:text-primary-hover font-bold transition-colors"
          >
            Back to login
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="p-8">
        <CardHeader className="text-center p-0 mb-8">
          <CardTitle className="text-3xl">Join as AI Rookie</CardTitle>
          <CardDescription className="mt-2">Start your AI learning journey</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSignup} className="space-y-6">
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
              placeholder="Create a password"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-800 text-sm">
                <strong>AI Rookie Account:</strong> Perfect for beginners starting their AI journey. Get access to learning resources and beginner-friendly tools.
              </p>
            </div>

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
              Create Account
            </Button>
          </form>
        </CardContent>

        <CardFooter className="text-center p-0 pt-8">
          <p className="text-text-light">
            Already have an account?{' '}
            <button
              onClick={onBackToLogin}
              className="text-primary hover:text-primary-hover font-bold transition-colors"
            >
              Sign in
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}