'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { CheckCircleIcon, AlertCircleIcon } from 'lucide-react'

export default function ConnectReturnPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Processing your onboarding...')

  useEffect(() => {
    // In a real implementation, you might want to verify the account status here
    // and update your database with the onboarding completion
    
    const timer = setTimeout(() => {
      setMessage('Onboarding completed successfully!')
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className=\"min-h-screen bg-surface flex items-center justify-center\">
      <div className=\"max-w-md mx-auto px-4\">
        <Card className=\"bg-success-bg border-success-text/20\">
          <CardHeader>
            <CardTitle className=\"flex items-center gap-2 text-success-text text-center justify-center\">
              <CheckCircleIcon className=\"w-6 h-6\" />
              Welcome Back!
            </CardTitle>
          </CardHeader>
          <CardContent className=\"text-center space-y-4\">
            <p className=\"text-success-text/80\">{message}</p>
            
            <div className=\"space-y-3\">
              <Button
                variant=\"primary\"
                onClick={() => router.push('/expert/connect')}
                className=\"w-full\"
              >
                Check Account Status
              </Button>
              
              <Button
                variant=\"secondary\"
                onClick={() => router.push('/expert/dashboard')}
                className=\"w-full\"
              >
                Go to Dashboard
              </Button>
            </div>
            
            <p className=\"text-xs text-success-text/60\">
              You can now start accepting payments from customers. 
              Check your account status to ensure everything is set up correctly.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}