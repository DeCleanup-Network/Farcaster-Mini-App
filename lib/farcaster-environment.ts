/**
 * Farcaster Mini App Environment Detection
 * 
 * Uses the official @farcaster/miniapp-sdk to detect if the app is running
 * inside a Farcaster Mini App environment.
 * 
 * This is the ONLY correct way to detect the environment - do not use heuristics.
 */

import { sdk } from '@farcaster/miniapp-sdk'

export interface FarcasterEnvironment {
  isMiniApp: boolean
  context: Awaited<typeof sdk.context> | null
}

/**
 * Detect Farcaster Mini App environment using the official SDK
 * 
 * This function:
 * 1. Calls sdk.isInMiniApp() to detect the environment
 * 2. If in Mini App, calls sdk.actions.ready() (mandatory to avoid infinite loading)
 * 3. Returns environment info including context
 * 
 * Call this once at app startup and store the result in global state.
 */
export async function detectFarcasterEnvironment(): Promise<FarcasterEnvironment> {
  try {
    // Use the official SDK method - this is the ONLY correct way
    const isMiniApp = await sdk.isInMiniApp()
    
    if (isMiniApp) {
      // CRITICAL: Must call ready() when in Mini App to avoid infinite loading screen
      await sdk.actions.ready()
      
      // Get context (user info, location, client, etc.)
      const context = await sdk.context
      
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

