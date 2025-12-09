'use client'

import { isFeatureLocked, isFarcaster, isFarcasterWallet } from '@/lib/farcaster-detection'

/**
 * Hook to check if a feature is locked
 * Returns true when in Farcaster but Farcaster wallet is not connected
 */
export function useFeatureLock() {
  const locked = isFeatureLocked()
  const inFarcaster = isFarcaster()
  const hasFarcasterWallet = isFarcasterWallet()

  return {
    isLocked: locked,
    inFarcaster,
    hasFarcasterWallet,
    // Helper to get lock message
    lockMessage: locked
      ? 'This feature is only available with a Farcaster Wallet inside the mini app.'
      : null,
  }
}

