'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Badge } from '@/components/ui'

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
            role: 'learner'
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
      <div className="text-center">
        <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-text mb-2">Check Your Email</h2>
        <p className="text-text-light mb-6">
          We&apos;ve sent a confirmation link to
          <span className="block font-semibold text-text mt-1">{email}</span>
        </p>
        <Button
          variant="secondary"
          onClick={onBackToLogin}
          className="w-full"
        >
          Back to Login
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-text">Join AI Rookie</h2>
        <p className="text-text-light mt-2">
          Start your personalized AI learning journey
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
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
          placeholder="Create a password (min. 6 characters)"
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

        <div className="bg-secondary/50 border border-primary/10 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Badge variant="primary" className="mt-0.5">Learner</Badge>
            <div className="flex-1">
              <p className="text-text text-sm font-medium mb-1">AI Rookie Account</p>
              <p className="text-text-light text-sm">
                Perfect for beginners starting their AI journey. Get access to expert sessions and learning resources.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-error-bg border border-error/20 rounded-lg p-3">
            <p className="text-error-text text-sm">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          Create Account
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-base text-text-light">Already have an account?</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={onBackToLogin}
          className="w-full"
        >
          Sign In
        </Button>
      </form>
    </div>
  )
}