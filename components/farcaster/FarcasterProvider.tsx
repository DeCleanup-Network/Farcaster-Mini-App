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
  const [readyCalled, setReadyCalled] = useState(false)

  // Call ready() once after React component mount and UI is rendered
  // Following Farcaster SDK docs: call ready() in useEffect after mount, as soon as possible
  // but only after UI has loaded enough to avoid reflows/jitter
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false)
      return
    }

    // Prevent duplicate calls
    if (readyCalled) {
      return
    }

    async function callReady() {
      try {
        // Get SDK instance (from import or window)
        const sdkInstance = sdk || (window as any).farcaster?.sdk
        const readyFunction = sdkInstance?.actions?.ready
        
        // Check if SDK is available
        if (!readyFunction || typeof readyFunction !== 'function') {
          // Not in Farcaster context (browser mode) - this is OK
          setIsLoading(false)
          return
        }

        // Call ready() once - this hides the splash screen and shows content
        // Using disableNativeGestures to prevent gesture conflicts
        await readyFunction({ disableNativeGestures: true })
        
        setReadyCalled(true)
        console.log('✅ sdk.actions.ready() called successfully - splash screen hidden')
        
        // Initialize Farcaster context after ready() completes
        try {
          const initialized = await initializeFarcaster()
          if (initialized) {
            const farcasterContext = await getFarcasterContext()
            setContext(farcasterContext as FarcasterContextData | null)
            setIsInitialized(true)
          }
        } catch (contextError) {
          console.error('Failed to initialize Farcaster context:', contextError)
        }
      } catch (readyError: any) {
        const errorMessage = readyError?.message || String(readyError || '')
        const isContextError = errorMessage.includes('not available') || 
                               errorMessage.includes('context') || 
                               errorMessage.includes('undefined')
        
        if (isContextError) {
          // Not in Farcaster context - this is expected in browser mode
          console.log('ℹ️ Not in Farcaster context (browser mode)')
        } else {
          console.error('❌ sdk.actions.ready() failed:', {
            message: errorMessage,
            error: readyError,
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Call ready() after React mount - small delay to ensure UI is stable
    // This matches the recommended pattern: call as soon as possible after UI loads
    callReady()
  }, [readyCalled])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

