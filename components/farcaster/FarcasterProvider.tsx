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
        // Following CeloBuild pattern: call as early as possible, don't wait for data
        await sdk.actions.ready()
        console.log('✅ Farcaster MiniApp ready() called successfully')

        // 2. Initialize context after ready() succeeds (optional)
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
        // Ignore errors if not in Farcaster context
        // This allows the app to work in regular browsers too
        console.log('ℹ️ Farcaster SDK init skipped (not in frame context)')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

