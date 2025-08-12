'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { RefreshCwIcon, AlertCircleIcon } from 'lucide-react'

export default function ConnectRefreshPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect back to the connect page after a short delay
    const timer = setTimeout(() => {
      router.push('/expert/connect')
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className=\"min-h-screen bg-surface flex items-center justify-center\">
      <div className=\"max-w-md mx-auto px-4\">
        <Card className=\"bg-warning-bg border-warning-text/20\">
          <CardHeader>
            <CardTitle className=\"flex items-center gap-2 text-warning-text text-center justify-center\">
              <RefreshCwIcon className=\"w-6 h-6 animate-spin\" />
              Refreshing Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent className=\"text-center space-y-4\">
            <p className=\"text-warning-text/80\">
              There was an issue with your onboarding session. 
              We're redirecting you back to continue the process.
            </p>
            
            <Button
              variant=\"primary\"
              onClick={() => router.push('/expert/connect')}
              className=\"w-full\"
            >
              Continue Onboarding
            </Button>
            
            <p className=\"text-xs text-warning-text/60\">
              You will be redirected automatically in a few seconds...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}