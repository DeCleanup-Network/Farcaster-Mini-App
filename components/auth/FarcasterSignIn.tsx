'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSignIn, useProfile, StatusAPIResponse, AuthClientError } from '@farcaster/auth-kit'
import '@farcaster/auth-kit/styles.css'

// Farcaster miniapp URL for redirect after authentication
const FARCASTER_MINIAPP_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

// Web app URL fallback
const WEB_APP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'

interface FarcasterSignInProps {
  /** Where to redirect after successful authentication */
  redirectTo?: 'miniapp' | 'webapp' | 'none'
  /** Custom redirect URL (overrides redirectTo) */
  customRedirectUrl?: string
  /** Callback when authentication succeeds */
  onSuccess?: (data: StatusAPIResponse) => void
  /** Callback when authentication fails */
  onError?: (error?: AuthClientError) => void
  /** Show compact button style */
  compact?: boolean
}

/**
 * Farcaster Sign In Button Component
 *
 * Provides "Sign In With Farcaster" functionality for web users.
 * After successful authentication, can redirect to:
 * - Farcaster miniapp (default)
 * - Web app
 * - Custom URL
 * - No redirect (handle in onSuccess callback)
 */
export function FarcasterSignIn({
  redirectTo = 'miniapp',
  customRedirectUrl,
  onSuccess,
  onError,
  compact = false,
}: FarcasterSignInProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleSuccess = useCallback(
    (data: StatusAPIResponse) => {
      // Call custom success handler if provided
      onSuccess?.(data)

      // Determine redirect URL
      let redirectUrl: string | null = null

      if (customRedirectUrl) {
        redirectUrl = customRedirectUrl
      } else if (redirectTo === 'miniapp') {
        // Redirect to Farcaster miniapp with custody address as ref
        const custodyAddress = data.custody
        redirectUrl = custodyAddress
          ? `${FARCASTER_MINIAPP_URL}?ref=${custodyAddress}`
          : FARCASTER_MINIAPP_URL
      } else if (redirectTo === 'webapp') {
        // Redirect to web app with custody address as ref
        const custodyAddress = data.custody
        redirectUrl = custodyAddress
          ? `${WEB_APP_URL}?ref=${custodyAddress}`
          : WEB_APP_URL
      }

      // Perform redirect if URL is set
      if (redirectUrl) {
        setIsRedirecting(true)
        // Small delay to show success state
        setTimeout(() => {
          window.location.href = redirectUrl!
        }, 500)
      }
    },
    [redirectTo, customRedirectUrl, onSuccess]
  )

  const handleError = useCallback(
    (error?: AuthClientError) => {
      console.error('[FarcasterSignIn] Authentication error:', error)
      onError?.(error)
    },
    [onError]
  )

  const {
    signIn,
    signOut,
    connect,
    reconnect,
    isSuccess,
    isError,
    error,
    channelToken,
    url,
    data,
    validSignature,
  } = useSignIn({
    onSuccess: handleSuccess,
    onError: handleError,
  })

  const { isAuthenticated, profile } = useProfile()

  // Handle sign in click
  const handleSignIn = useCallback(async () => {
    console.log('[FarcasterSignIn] Button clicked, isAuthenticated:', isAuthenticated)
    if (isAuthenticated) {
      // Already authenticated, redirect directly
      console.log('[FarcasterSignIn] Already authenticated, redirecting...')
      if (profile?.custody) {
        handleSuccess({ custody: profile.custody } as StatusAPIResponse)
      }
    } else {
      console.log('[FarcasterSignIn] Starting sign in flow...')
      try {
        // First connect to create a channel, then sign in
        if (!channelToken) {
          console.log('[FarcasterSignIn] No channel token, calling connect()...')
          await connect()
        }
        console.log('[FarcasterSignIn] Calling signIn()...')
        await signIn()
        console.log('[FarcasterSignIn] signIn() called successfully')
      } catch (err) {
        console.error('[FarcasterSignIn] signIn() error:', err)
      }
    }
  }, [isAuthenticated, profile, signIn, connect, channelToken, handleSuccess])

  // Log state changes for debugging
  useEffect(() => {
    console.log('[FarcasterSignIn] State:', { url, isSuccess, isError, channelToken })
  }, [url, isSuccess, isError, channelToken])

  // If already authenticated on mount, show profile info
  if (isAuthenticated && profile) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3 p-3 bg-brand-green/10 rounded-lg border border-brand-green/30">
          {profile.pfpUrl && (
            <img
              src={profile.pfpUrl}
              alt={profile.displayName || profile.username || 'Profile'}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <p className="font-medium text-brand-green">
              {profile.displayName || profile.username}
            </p>
            {profile.username && (
              <p className="text-sm text-brand-green/70">
                @{profile.username}
              </p>
            )}
          </div>
        </div>
        {isRedirecting ? (
          <p className="text-sm text-muted-foreground">Redirecting to app...</p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => handleSuccess({ custody: profile.custody } as StatusAPIResponse)}
              className="px-4 py-2 bg-brand-green hover:bg-[#4a9a26] text-black rounded-lg text-sm font-medium transition-colors"
            >
              Open DeCleanup
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    )
  }

  // Show QR code if channel is active
  if (url && !isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Scan with Warpcast to sign in
        </p>
        <div className="p-4 bg-white rounded-lg shadow-lg">
          {/* QR code is rendered by AuthKit internally */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
            alt="Sign in with Farcaster QR code"
            className="w-48 h-48"
          />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand-green hover:text-[#4a9a26] underline"
        >
          Open in Warpcast
        </a>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-red-500">
          Sign in failed{error?.message ? `: ${error.message}` : ''}
        </p>
        <button
          onClick={handleSignIn}
          className="px-6 py-3 bg-brand-green hover:bg-[#4a9a26] text-black rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Default sign in button
  return (
    <button
      onClick={handleSignIn}
      className={`
        flex items-center justify-center gap-2
        bg-brand-green hover:bg-[#4a9a26]
        text-black font-medium rounded-lg
        transition-colors
        ${compact ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-base'}
      `}
    >
      <FarcasterIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      Sign in with Farcaster
    </button>
  )
}

// Farcaster icon component
function FarcasterIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z"
        fill="currentColor"
      />
      <path
        d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"
        fill="currentColor"
      />
      <path
        d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.444H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default FarcasterSignIn
