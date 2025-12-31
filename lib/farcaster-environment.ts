/**
 * Farcaster Mini App Environment Detection
 * 
 * Uses the official @farcaster/miniapp-sdk to detect if the app is running
 * inside a Farcaster Mini App environment.
 * 
 * This is the ONLY correct way to detect the environment - do not use heuristics.
 */

import { sdk } from '@farcaster/miniapp-sdk'
import { checkIsInMiniAppWithRetry, callFarcasterReady, getFarcasterContextWithRetry } from './farcaster-ready'

export interface FarcasterEnvironment {
  isMiniApp: boolean
  context: Awaited<typeof sdk.context> | null
}

/**
 * Detect Farcaster Mini App environment using the official SDK with retries
 * 
 * This function:
 * 1. Calls sdk.isInMiniApp() to detect the environment (with retries)
 * 2. If in Mini App, calls sdk.actions.ready() (mandatory to avoid infinite loading)
 * 3. Returns environment info including context
 * 
 * Call this once at app startup and store the result in global state.
 */
export async function detectFarcasterEnvironment(): Promise<FarcasterEnvironment> {
  try {
    // Use retry-enabled detection
    const isMiniApp = await checkIsInMiniAppWithRetry()
    
    if (isMiniApp) {
      // CRITICAL: Must call ready() when in Mini App to avoid infinite loading screen
      const readySuccess = await callFarcasterReady()
      if (!readySuccess) {
        console.warn('[farcaster-environment] Failed to call ready() after retries, but continuing...')
      }
      
      // Get context with retries
      const context = await getFarcasterContextWithRetry()
      
      return {
        isMiniApp: true,
        context,
      }
    }
  } catch (e) {
    // If SDK throws, we're not in a Mini App (or SDK not available)
    // Treat errors as browser environment
    console.log('Not in Farcaster Mini App environment:', e)
  }

  return {
    isMiniApp: false,
    context: null,
  }
}

/**
 * Synchronous check for Mini App environment
 * 
 * This is a fallback that checks if SDK is available.
 * For accurate detection, use detectFarcasterEnvironment() instead.
 */
export function isInFarcasterMiniAppSync(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    // Check if SDK is available and has isInMiniApp method
    // Note: This is a synchronous check and may not be 100% accurate
    // The SDK may not be injected immediately on page load
    return !!(window as any).farcaster?.sdk
  } catch {
    return false
  }
}

