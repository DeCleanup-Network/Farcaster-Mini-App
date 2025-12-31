/**
 * Farcaster SDK Ready Detection with Retries
 * 
 * Ensures Farcaster SDK is properly initialized with retries and readiness checks.
 */

import { sdk } from '@farcaster/miniapp-sdk'

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second
const READY_TIMEOUT = 5000 // 5 seconds

/**
 * Check if Farcaster SDK is available
 */
export function isFarcasterSDKAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!(window as any).farcaster?.sdk || !!(window as any).farcaster
  } catch {
    return false
  }
}

/**
 * Wait for Farcaster SDK to be available with retries
 */
export async function waitForFarcasterSDK(maxRetries = MAX_RETRIES): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (isFarcasterSDKAvailable()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
  }
  return false
}

/**
 * Check if we're in a Farcaster Mini App with retries
 */
export async function checkIsInMiniAppWithRetry(maxRetries = MAX_RETRIES): Promise<boolean> {
  try {
    // Wait for SDK to be available first
    const sdkAvailable = await waitForFarcasterSDK(maxRetries)
    if (!sdkAvailable) {
      return false
    }

    // Try to detect Mini App environment
    for (let i = 0; i < maxRetries; i++) {
      try {
        const isMiniApp = await Promise.race([
          sdk.isInMiniApp(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), READY_TIMEOUT)
          ),
        ])
        return isMiniApp
      } catch (error) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          continue
        }
        console.warn('[farcaster-ready] Failed to detect Mini App environment:', error)
        return false
      }
    }
  } catch (error) {
    console.warn('[farcaster-ready] Error checking Mini App environment:', error)
    return false
  }
  return false
}

/**
 * Call sdk.actions.ready() with retries and timeout
 */
export async function callFarcasterReady(maxRetries = MAX_RETRIES): Promise<boolean> {
  try {
    // Wait for SDK to be available first
    const sdkAvailable = await waitForFarcasterSDK(maxRetries)
    if (!sdkAvailable) {
      console.warn('[farcaster-ready] SDK not available after retries')
      return false
    }

    // Try to call ready() with retries
    for (let i = 0; i < maxRetries; i++) {
      try {
        await Promise.race([
          sdk.actions.ready(),
          new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error('Ready timeout')), READY_TIMEOUT)
          ),
        ])
        console.log('✅ Farcaster SDK ready() called successfully')
        return true
      } catch (error) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          continue
        }
        console.warn('[farcaster-ready] Failed to call ready() after retries:', error)
        return false
      }
    }
  } catch (error) {
    console.warn('[farcaster-ready] Error calling ready():', error)
    return false
  }
  return false
}

/**
 * Get Farcaster context with retries
 */
export async function getFarcasterContextWithRetry(maxRetries = MAX_RETRIES): Promise<Awaited<typeof sdk.context> | null> {
  try {
    const sdkAvailable = await waitForFarcasterSDK(maxRetries)
    if (!sdkAvailable) {
      return null
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        const context = await Promise.race([
          sdk.context,
          new Promise<Awaited<typeof sdk.context>>((_, reject) => 
            setTimeout(() => reject(new Error('Context timeout')), READY_TIMEOUT)
          ),
        ])
        return context
      } catch (error) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          continue
        }
        console.warn('[farcaster-ready] Failed to get context after retries:', error)
        return null
      }
    }
  } catch (error) {
    console.warn('[farcaster-ready] Error getting context:', error)
    return null
  }
  return null
}

