'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { initializeFarcaster, getFarcasterContext } from '@/lib/farcaster'
import { sdk } from '@farcaster/miniapp-sdk'
import type { FarcasterContext as FarcasterContextData } from '@/types/farcaster'

interface FarcasterContextType {
  context: FarcasterContextData | null
  isInitialized: boolean
  isLoading: boolean
}

const FarcasterContext = createContext<FarcasterContextType>({
  context: null,
  isInitialized: false,
  isLoading: true,
})

export function useFarcaster() {
  return useContext(FarcasterContext)
}

/**
 * FarcasterProvider - Initializes the Farcaster MiniApp SDK
 * 
 * Based on CeloBuild pattern: https://github.com/MarxMad/CeloBuild-/blob/main/FARCASTER_READY_IMPLEMENTATION.md
 * 
 * IMPORTANT: Must call sdk.actions.ready() as early as possible after component mount
 * to avoid infinite loading screen in Farcaster clients.
 */
export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<FarcasterContextData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Call ready() immediately - this is critical to remove the loading spinner
        // Following Base docs: call as early as possible, don't wait for data
        // Check if SDK and ready function exist before calling
        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
          try {
            await sdk.actions.ready()
            console.log('✅ Farcaster MiniApp ready() called successfully')
          } catch (readyError: any) {
            // Log but don't fail - some contexts might not support ready()
            console.log('ℹ️ Farcaster SDK ready() call:', readyError?.message || 'not available in this context')
          }
        } else {
          console.log('ℹ️ Farcaster SDK not available (running in browser mode)')
        }

        // 2. Try Base MiniKit setFrameReady if available (for Base Mini Apps)
        try {
          // Check if Base MiniKit is available via window object
          if (typeof window !== 'undefined' && (window as any).minikit?.setFrameReady) {
            (window as any).minikit.setFrameReady()
            console.log('✅ Base MiniKit setFrameReady() called successfully')
          }
        } catch (minikitError) {
          // Base MiniKit not available - this is OK
          console.debug('ℹ️ Base MiniKit not available')
        }

        // 3. Initialize context after ready() succeeds (optional)
        try {
          const initialized = await initializeFarcaster()
          if (initialized) {
            const farcasterContext = await getFarcasterContext()
            if (farcasterContext) {
              setContext(farcasterContext as unknown as FarcasterContextData | null)
              setIsInitialized(true)
              console.log('✅ Farcaster context initialized')
            }
          }
        } catch (contextError) {
          console.error('❌ Failed to initialize Farcaster context:', contextError)
        }
      } catch (error) {
        // Ignore errors if not in Farcaster/Base context
        // This allows the app to work in regular browsers too
        console.log('ℹ️ Mini App SDK init skipped (not in frame context)')
      } finally {
        setIsLoading(false)
      }
    }

    // Call immediately - don't wait for anything
    init()
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

