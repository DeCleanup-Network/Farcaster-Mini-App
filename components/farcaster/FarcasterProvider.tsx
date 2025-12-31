'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { detectFarcasterEnvironment } from '@/lib/farcaster-environment'
import { sdk } from '@farcaster/miniapp-sdk'
import type { FarcasterContext as FarcasterContextData } from '@/types/farcaster'

export interface FarcasterContextType {
  context: FarcasterContextData | null
  isInitialized: boolean
  isLoading: boolean
  isMiniApp: boolean
}

const FarcasterContext = createContext<FarcasterContextType>({
  context: null,
  isInitialized: false,
  isLoading: true,
  isMiniApp: false,
})

export function useFarcaster(): FarcasterContextType {
  return useContext(FarcasterContext)
}

/**
 * FarcasterProvider - Initializes the Farcaster MiniApp SDK
 * 
 * Uses the official SDK method (sdk.isInMiniApp()) to detect environment.
 * 
 * IMPORTANT: 
 * - Must call sdk.actions.ready() when in Mini App to avoid infinite loading screen
 * - Environment detection happens once at startup
 * - All UI logic should branch based on isMiniApp flag
 */
export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<FarcasterContextData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMiniApp, setIsMiniApp] = useState(false)

  useEffect(() => {
    // CRITICAL: Call ready() immediately like the user's other app
    // This must be called as early as possible to prevent infinite loading
    try {
      sdk.actions.ready()
      console.log('✅ Farcaster SDK ready() called directly')
    } catch (error) {
      // If SDK not available, we're likely not in Farcaster context (browser mode)
      // This is OK - continue with initialization
      console.log('ℹ️ ready() call skipped (not in Farcaster context):', error)
    }

    const init = async () => {
      try {
        // Use official SDK method to detect environment
        const env = await detectFarcasterEnvironment()
        
        setIsMiniApp(env.isMiniApp)
        
        if (env.isMiniApp && env.context) {
          // We're in a Mini App
          setContext(env.context as unknown as FarcasterContextData | null)
          setIsInitialized(true)
          console.log('✅ Farcaster Mini App environment detected and initialized')
        } else {
          // We're in browser mode
          console.log('ℹ️ Running in browser mode (not in Farcaster Mini App)')
          setIsInitialized(true)
        }

        // Try Base MiniKit setFrameReady if available (for Base Mini Apps)
        try {
          if (typeof window !== 'undefined' && (window as any).minikit?.setFrameReady) {
            (window as any).minikit.setFrameReady()
            console.log('✅ Base MiniKit setFrameReady() called successfully')
          }
        } catch (minikitError) {
          // Base MiniKit not available - this is OK
          console.debug('ℹ️ Base MiniKit not available')
        }
      } catch (error) {
        // Ignore errors if not in Farcaster/Base context
        // This allows the app to work in regular browsers too
        console.log('ℹ️ Mini App SDK init skipped (not in frame context):', error)
        setIsInitialized(true)
      } finally {
        setIsLoading(false)
      }
    }

    // Call immediately - don't wait for anything
    init()
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading, isMiniApp }}>
      {children}
    </FarcasterContext.Provider>
  )
}

