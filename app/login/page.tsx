'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFarcaster } from '@/lib/farcaster-detection'
import { AuthKitProvider } from '@/components/auth/AuthKitProvider'
import { FarcasterSignIn } from '@/components/auth/FarcasterSignIn'

// Farcaster miniapp URL
const FARCASTER_MINIAPP_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

/**
 * Login Page
 *
 * This page handles Farcaster authentication for web users.
 * - If already inside Farcaster/Warpcast, redirects to the main app
 * - If in a regular browser, shows "Sign In With Farcaster" option
 */
export default function LoginPage() {
  const router = useRouter()
  const [environment, setEnvironment] = useState<'loading' | 'farcaster' | 'browser'>('loading')
  const [redirectTarget, setRedirectTarget] = useState<'miniapp' | 'webapp'>('miniapp')

  // Detect environment on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if we're inside Farcaster
    const inFarcaster = isFarcaster()

    if (inFarcaster) {
      // Already in Farcaster, redirect to main app
      setEnvironment('farcaster')
      router.replace('/')
    } else {
      setEnvironment('browser')
    }
  }, [router])

  // Loading state
  if (environment === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-green/30" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  // Farcaster environment - redirecting
  if (environment === 'farcaster') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full" />
          <p className="text-muted-foreground">
            Detected Farcaster environment, redirecting...
          </p>
        </div>
      </div>
    )
  }

  // Browser environment - show sign in
  return (
    <AuthKitProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="p-4 flex justify-center">
          <div className="flex items-center gap-2">
            <img
              src="https://gateway.pinata.cloud/ipfs/bafkreig6ctmk5it4ppu67ljtmxjcrv2zug7rvccj5i52ji5s2qli5nww7a"
              alt="DeCleanup Logo"
              className="w-10 h-10 rounded-full"
            />
            <span className="text-xl font-bold text-foreground">
              DeCleanup Rewards
            </span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-xl p-8">
            {/* Hero */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Welcome to DeCleanup
              </h1>
              <p className="text-muted-foreground">
                Sign in with your Farcaster account to join the global cleanup movement
              </p>
            </div>

            {/* Sign in button */}
            <div className="flex flex-col items-center gap-6">
              <FarcasterSignIn
                redirectTo={redirectTarget}
                onSuccess={(data) => {
                  console.log('[LoginPage] Auth success:', data)
                }}
                onError={(error) => {
                  console.error('[LoginPage] Auth error:', error)
                }}
              />

              {/* Redirect target toggle */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Open in:</span>
                <button
                  onClick={() => setRedirectTarget('miniapp')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    redirectTarget === 'miniapp'
                      ? 'bg-brand-green/20 text-brand-green'
                      : 'hover:bg-muted'
                  }`}
                >
                  Farcaster
                </button>
                <button
                  onClick={() => setRedirectTarget('webapp')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    redirectTarget === 'webapp'
                      ? 'bg-brand-green/20 text-brand-green'
                      : 'hover:bg-muted'
                  }`}
                >
                  Web App
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="my-8 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Alternative options */}
            <div className="flex flex-col gap-3">
              <a
                href={FARCASTER_MINIAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg text-foreground font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Warpcast
              </a>

              <button
                onClick={() => router.push('/')}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-border hover:bg-muted rounded-lg text-muted-foreground font-medium transition-colors"
              >
                Continue as Guest
              </button>
            </div>
          </div>

          {/* Info text */}
          <p className="mt-6 text-sm text-muted-foreground text-center max-w-sm">
            Sign in with Farcaster to earn rewards, track your cleanups, and connect with the community.
          </p>
        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-sm text-muted-foreground">
          <p>Clean up, snap, earn. Powered by Base.</p>
        </footer>
      </div>
    </AuthKitProvider>
  )
}
