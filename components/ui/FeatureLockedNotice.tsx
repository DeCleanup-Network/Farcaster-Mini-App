'use client'

import { isFeatureLocked } from '@/lib/farcaster-detection'
import { AlertCircle } from 'lucide-react'

/**
 * Component to show a notice when a feature is locked
 * Only appears when in Farcaster without Farcaster wallet connected
 */
export function FeatureLockedNotice() {
  if (!isFeatureLocked()) {
    return null
  }

  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <p className="text-yellow-400 text-sm">
        This feature is only available with a Farcaster Wallet inside the mini app.
      </p>
    </div>
  )
}

