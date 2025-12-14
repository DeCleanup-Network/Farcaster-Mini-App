'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useFarcasterReady } from '@/lib/hooks/useFarcasterReady'

interface ShareRedirectProps {
  redirectUrl: string
}

export function ShareRedirect({ redirectUrl }: ShareRedirectProps) {
  // Ensure ready() is called even on redirect pages
  useFarcasterReady()
  
  useEffect(() => {
    // Longer delay to ensure crawlers can read meta tags and embed data
    // Farcaster crawlers need time to fetch the page and parse fc:miniapp embed
    // Then redirect client-side
    // Note: For Farcaster embeds, we actually want to stay on this page so the embed metadata is available
    // Only redirect if user navigates away or if this is a direct visit (not an embed fetch)
    const isCrawler = /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|farcaster/i.test(navigator.userAgent) || 
                      !navigator.userAgent // Some crawlers don't send user agent
    
    if (!isCrawler) {
      // Only redirect actual users, not crawlers
      // For Safari, use window.location.replace to preserve referrer info
      const timer = setTimeout(() => {
        // Use replace instead of href to avoid adding to history
        // This helps preserve URL parameters in Safari
        // Longer delay to ensure crawlers have time to read metadata
        window.location.replace(redirectUrl)
      }, 2000) // 2 seconds - gives crawlers more time to read metadata

      return () => clearTimeout(timer)
    }
    // For crawlers, don't redirect - let them read the metadata
  }, [redirectUrl])

  return (
    <>
      {/* Explicit meta tags for crawlers that might not read Next.js metadata */}
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand-green" />
          <p className="text-white">Redirecting to DeCleanup Rewards...</p>
        </div>
      </div>
    </>
  )
}

