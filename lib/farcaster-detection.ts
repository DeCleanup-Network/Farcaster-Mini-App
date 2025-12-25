/**
 * Farcaster environment detection utilities
 * 
 * DEPRECATED: Use detectFarcasterEnvironment() from @/lib/farcaster-environment instead.
 * This file is kept for backward compatibility but uses the official SDK method.
 */

import { sdk } from '@farcaster/miniapp-sdk'

/**
 * Check if the app is running inside Farcaster Mini App
 * 
 * DEPRECATED: Use detectFarcasterEnvironment() for accurate async detection.
 * This function provides a synchronous fallback check.
 */
export const isFarcaster = (): boolean => {
  if (typeof window === 'undefined') return false

  try {
    // Use SDK check if available (most reliable)
    if ((window as any).farcaster?.sdk) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Check if Farcaster Wallet is available and connected
 * 
 * Uses the official SDK to check for wallet provider availability.
 */
export const isFarcasterWallet = (): boolean => {
  if (typeof window === 'undefined') return false

  try {
    // Check Farcaster SDK wallet provider (official method)
    if (sdk.wallet?.ethProvider) {
      return true
    }

    // Fallback: Check window.ethereum for Farcaster wallet
    const eth = (window as any).ethereum
    if (eth?.isFarcaster === true || eth?.provider?.isFarcaster === true) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Check if a feature should be locked
 * Features are locked when in Farcaster but Farcaster wallet is not connected
 */
export const isFeatureLocked = (): boolean => {
  return isFarcaster() && !isFarcasterWallet()
}

/**
 * Get the current environment type
 */
export const getEnvironment = (): 'farcaster' | 'browser' => {
  return isFarcaster() ? 'farcaster' : 'browser'
}

