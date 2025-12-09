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

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<FarcasterContextData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Wait for DOM to be ready
      if (typeof window === 'undefined') {
        setIsLoading(false)
        return
      }

      try {
        // According to Farcaster docs: "After your app loads, you must call sdk.actions.ready()"
        // This hides the splash screen and displays your content
        // Important: Call ready() as early as possible, but after DOM is ready
        // We check if SDK is available before calling to avoid errors in non-Farcaster contexts
        if (typeof window !== 'undefined' && (window as any).farcaster?.sdk) {
          try {
            await sdk.actions.ready()
            console.log('✅ Farcaster SDK ready() called successfully - splash screen hidden')
          } catch (readyError: any) {
            // If ready() fails, it might not be in Farcaster context (e.g., regular browser)
            // This is OK - we'll continue anyway
            if (readyError?.message?.includes('not available') || readyError?.message?.includes('context')) {
              console.log('Farcaster SDK not in Farcaster context (browser mode)')
            } else {
              console.warn('Farcaster SDK ready() failed:', readyError?.message || readyError)
            }
          }
        } else {
          // SDK not available - likely not in Farcaster context
          console.log('Farcaster SDK not available (likely not in Farcaster context)')
        }

        // Then initialize and get context
        const initialized = await initializeFarcaster()
        if (initialized) {
          const farcasterContext = await getFarcasterContext()
          // Type assertion needed as SDK types may not match exactly
          setContext(farcasterContext as FarcasterContextData | null)
          setIsInitialized(true)
        }
      } catch (error) {
        console.error('Failed to initialize Farcaster:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Wait for DOM to be fully ready before calling ready()
    // This ensures the app is fully loaded and ready to display
    // For Next.js, we need to wait for hydration to complete
    const readyState = document.readyState as 'loading' | 'interactive' | 'complete'
    
    const handleReady = () => {
      // Small delay to ensure React hydration is complete
      setTimeout(() => {
        init()
      }, 50)
    }
    
    if (readyState === 'complete' || readyState === 'interactive') {
      // DOM already loaded or interactive, call immediately
      handleReady()
    } else {
      // Still loading, wait for DOM to be ready
      window.addEventListener('DOMContentLoaded', handleReady, { once: true })
      window.addEventListener('load', handleReady, { once: true })
      
      return () => {
        window.removeEventListener('DOMContentLoaded', handleReady)
        window.removeEventListener('load', handleReady)
      }
    }
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

