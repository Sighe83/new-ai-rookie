'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

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
    <div>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-text">Welcome Back</h2>
        <p className="text-text-light mt-2">
          Sign in to continue your AI journey
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
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
          Sign In
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-base text-text-light">New to AI Rookie?</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={onSignupClick}
          className="w-full"
        >
          Create Account
        </Button>
      </form>
    </div>
  )
}