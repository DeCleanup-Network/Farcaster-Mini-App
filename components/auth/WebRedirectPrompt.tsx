'use client'

import { useEffect, useState } from 'react'
import { isFarcaster } from '@/lib/farcaster-detection'
import { X } from 'lucide-react'

const FARCASTER_MINIAPP_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

/**
 * Web Redirect Prompt
 *
 * Shows a modal on web (not in Farcaster) asking if user wants
 * to be redirected to the Farcaster miniapp for the best experience.
 *
 * Only shows once per session.
 */
export function WebRedirectPrompt() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem('web-redirect-prompt-dismissed')
    if (dismissed) return

    // Check if in Farcaster environment - don't show if already there
    const inFarcaster = isFarcaster()
    if (inFarcaster) return

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem('web-redirect-prompt-dismissed', 'true')
  }

  const handleRedirect = () => {
    sessionStorage.setItem('web-redirect-prompt-dismissed', 'true')
    window.location.href = FARCASTER_MINIAPP_URL
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Farcaster icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-brand-green"
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
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-foreground mb-2">
            Open in Farcaster?
          </h2>
          <p className="text-sm text-muted-foreground">
            For the best experience, open DeCleanup Rewards in the Farcaster app.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleRedirect}
            className="w-full py-3 bg-brand-green hover:bg-[#4a9a26] text-black font-medium rounded-xl transition-colors"
          >
            Open in Farcaster
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-3 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-colors"
          >
            Continue on Web
          </button>
        </div>
      </div>
    </div>
  )
}

export default WebRedirectPrompt
