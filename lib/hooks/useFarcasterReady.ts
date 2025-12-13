'use client'

import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

/**
 * Hook to ensure sdk.actions.ready() is called on main landing pages
 * This is a safety measure in addition to FarcasterProvider
 * Call this in useEffect as soon as possible to avoid jitter and content reflows
 */
export function useFarcasterReady() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    // Prevent duplicate calls - check window flag first
    if ((window as any).__farcasterReadyCalled) {
      return
    }

    async function callReady() {
      try {
        // Check for SDK availability
        let sdkInstance = sdk || (window as any).farcaster?.sdk || (window as any).farcaster
        
        // Wait briefly for SDK to be injected if not immediately available
        if (!sdkInstance) {
          await new Promise(resolve => setTimeout(resolve, 100))
          sdkInstance = sdk || (window as any).farcaster?.sdk || (window as any).farcaster
        }

        if (!sdkInstance) {
          // Not in Farcaster context - this is expected in browser mode
          return
        }

        // Find the ready function
        let readyFunction = null
        if (sdkInstance?.actions?.ready && typeof sdkInstance.actions.ready === 'function') {
          readyFunction = sdkInstance.actions.ready
        } else if (sdkInstance && typeof (sdkInstance as any).ready === 'function') {
          readyFunction = (sdkInstance as any).ready
        } else if ((window as any).farcaster?.ready && typeof (window as any).farcaster.ready === 'function') {
          readyFunction = (window as any).farcaster.ready
        }

        if (readyFunction && typeof readyFunction === 'function') {
          // Mark as called before actually calling to prevent duplicates
          ;(window as any).__farcasterReadyCalled = true
          
          await readyFunction({ disableNativeGestures: true })
          console.log('✅ Page-level sdk.actions.ready() called successfully')
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error || '')
        const isContextError = errorMessage.includes('not available') ||
                             errorMessage.includes('context') ||
                             errorMessage.includes('undefined')

        if (!isContextError) {
          console.warn('⚠️ Page-level ready() call failed (non-fatal):', errorMessage)
        }
        // Don't throw - this is a safety measure, FarcasterProvider is the primary handler
      }
    }

    // Call ready as soon as possible
    callReady()
  }, [])
}

