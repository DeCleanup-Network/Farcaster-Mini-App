'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isFarcaster } from '@/lib/farcaster-detection'
import { useAccount } from 'wagmi'

/**
 * Farcaster Login Banner
 *
 * Shows a banner prompting users to sign in with Farcaster
 * when they are:
 * - Not in the Farcaster environment (regular browser)
 * - Not connected with a wallet
 *
 * Hidden when:
 * - User is inside Farcaster/Warpcast
 * - User has connected a wallet
 * - User has dismissed the banner
 */
export function FarcasterLoginBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { isConnected } = useAccount()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem('fc-login-banner-dismissed')
    if (dismissed) {
      setIsDismissed(true)
      return
    }

    // Check if in Farcaster environment
    const inFarcaster = isFarcaster()

    // Show banner if not in Farcaster and not connected
    setIsVisible(!inFarcaster && !isConnected)
  }, [isConnected])

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem('fc-login-banner-dismissed', 'true')
  }

  if (!isVisible || isDismissed) return null

  return (
    <div className="fixed top-24 sm:top-28 left-0 right-0 z-40 px-4">
      <div className="max-w-lg mx-auto bg-gradient-to-r from-brand-green to-[#4a9a26] rounded-xl shadow-lg p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {/* Farcaster Icon */}
          <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-black/20 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-black font-medium text-sm">
              Have a Farcaster account?
            </p>
            <p className="text-black/70 text-xs">
              Sign in for seamless rewards tracking
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/login"
              className="px-3 py-1.5 bg-black text-brand-green rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
            >
              Log In
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1 text-black/50 hover:text-black transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FarcasterLoginBanner
