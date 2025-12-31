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
    // CRITICAL: Call ready() IMMEDIATELY - this must happen before ANY other logic
    // Base Build preview checks for ready() synchronously, so we must call it immediately
    // Following Base migration guide pattern: https://docs.base.org/mini-apps/quickstart/migrate-existing-apps
    
    // Priority 1: Base MiniKit (for Base Apps) - call synchronously if available
    try {
      if (typeof window !== 'undefined' && (window as any).minikit?.setFrameReady) {
        (window as any).minikit.setFrameReady()
        console.log('✅ Base MiniKit setFrameReady() called immediately')
      }
    } catch (minikitError) {
      // Base MiniKit not available - continue to Farcaster SDK
      console.debug('ℹ️ Base MiniKit not available, trying Farcaster SDK')
    }
    
    // Priority 2: Farcaster SDK (for Farcaster Mini Apps)
    // Base migration guide shows calling it directly in useEffect (not in async function)
    // This ensures Base Build preview can detect it synchronously
    try {
      // Call directly (synchronously) - Base Build preview checks for this
      sdk.actions.ready()
      console.log('✅ Farcaster SDK ready() called synchronously (Base Build compatible)')
    } catch (error) {
      // If SDK not available, we're likely not in Mini App context (browser mode)
      // This is OK - detectFarcasterEnvironment and useFarcasterReady will also try
      console.log('ℹ️ Farcaster SDK ready() call skipped (will retry elsewhere):', error)
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

        // Base MiniKit setFrameReady is already called at the start of useEffect
        // No need to call it again here
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

