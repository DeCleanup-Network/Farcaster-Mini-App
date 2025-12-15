'use client'

import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

/**
 * Hook to ensure sdk.actions.ready() is called on main landing pages
 * This is a safety measure in addition to FarcasterProvider
 * 
 * Based on CeloBuild pattern: https://github.com/MarxMad/CeloBuild-/blob/main/FARCASTER_READY_IMPLEMENTATION.md
 * 
 * Call this in useEffect as soon as possible - don't wait for data to load
 */
export function useFarcasterReady() {
  useEffect(() => {
    const init = async () => {
      try {
        // Call ready() immediately - don't wait for anything
        await sdk.actions.ready()
        console.log('✅ Page-level ready() called successfully')
      } catch (error) {
        // Ignore errors if not in Farcaster context
        // This allows the app to work in regular browsers too
        console.log('ℹ️ Page-level ready() skipped (not in Farcaster context)')
      }
    }

    init()
  }, [])
}

