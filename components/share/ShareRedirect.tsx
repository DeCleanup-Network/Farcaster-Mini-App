'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface ShareRedirectProps {
  redirectUrl: string
}

export function ShareRedirect({ redirectUrl }: ShareRedirectProps) {
  useEffect(() => {
    // Small delay to ensure crawlers can read meta tags
    // Then redirect client-side
    const timer = setTimeout(() => {
      window.location.href = redirectUrl
    }, 100)

    return () => clearTimeout(timer)
  }, [redirectUrl])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand-green" />
        <p className="text-white">Redirecting to DeCleanup Rewards...</p>
      </div>
    </div>
  )
}

