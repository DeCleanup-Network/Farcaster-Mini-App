'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface ShareRedirectProps {
  redirectUrl: string
}

export function ShareRedirect({ redirectUrl }: ShareRedirectProps) {
  useEffect(() => {
    // Longer delay to ensure crawlers can read meta tags and embed data
    // Farcaster crawlers need time to fetch the page and parse fc:miniapp embed
    // Then redirect client-side
    const timer = setTimeout(() => {
      window.location.href = redirectUrl
    }, 2000) // Increased from 100ms to 2 seconds for better crawler support

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

