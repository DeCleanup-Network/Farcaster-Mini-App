'use client'

import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

/**
 * Hook to ensure sdk.actions.ready() is called on main landing pages
 * This is a safety measure in addition to FarcasterProvider
 * 
 * Based on Base docs: https://docs.base.org/mini-apps/quickstart/migrate-existing-apps
 * 
 * Call this in useEffect as soon as possible - don't wait for data to load
 * Prevents infinite loading screen by calling ready() immediately
 */
export function useFarcasterReady() {
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Call Farcaster SDK ready() if available
        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          try {
            await sdk.actions.ready()
            console.log('✅ Page-level Farcaster SDK ready() called successfully')
          } catch (readyError: any) {
            console.log('ℹ️ Page-level Farcaster SDK ready() call:', readyError?.message || 'not available')
          }
        }

        // 2. Try Base MiniKit setFrameReady if available (for Base Mini Apps)
        try {
          // Check if Base MiniKit is available via window object
          if (typeof window !== 'undefined' && (window as any).minikit?.setFrameReady) {
            (window as any).minikit.setFrameReady()
            console.log('✅ Page-level Base MiniKit setFrameReady() called successfully')
          }
        } catch (minikitError) {
          // Base MiniKit not available - this is OK
          console.debug('ℹ️ Base MiniKit not available on this page')
        }
      } catch (error) {
        // Ignore errors if not in Farcaster/Base context
        // This allows the app to work in regular browsers too
        console.log('ℹ️ Page-level ready() skipped (not in Mini App context)')
      }
    }

    // Call immediately - don't wait for anything
    init()
  }, [])
}

