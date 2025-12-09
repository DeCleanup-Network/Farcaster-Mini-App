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
        // Call ready() immediately - this is critical for Farcaster/Base Build
        // According to docs: "After your app loads, you must call sdk.actions.ready()"
        // This hides the splash screen and displays your content
        try {
          await sdk.actions.ready()
          console.log('✅ Farcaster SDK ready() called successfully')
        } catch (readyError) {
          // If ready() fails, it might not be in Farcaster context (e.g., regular browser)
          // This is OK - we'll continue anyway
          console.log('Farcaster SDK ready() not available (likely not in Farcaster context):', readyError)
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

    // Call init after a short delay to ensure DOM is ready
    // This is especially important for Next.js SSR/hydration
    const timer = setTimeout(() => {
      init()
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

