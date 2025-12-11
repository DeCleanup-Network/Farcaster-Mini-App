'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { initializeFarcaster, getFarcasterContext } from '@/lib/farcaster'
import { sdk } from '@farcaster/miniapp-sdk'
import type { FarcasterContext as FarcasterContextData } from '@/types/farcaster'
import { runFarcasterDiagnostic } from '@/lib/farcaster-diagnostic'

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

    // Prevent duplicate calls - check both state and window flag
    if (readyCalled || (window as any).__farcasterReadyCalled) {
      console.log('⚠️ SDK ready() already called, skipping duplicate call')
      return
    }

    // Log initialization start for debugging
    console.log('🚀 FarcasterProvider: Starting SDK initialization', {
      url: window.location.href,
      hostname: window.location.hostname,
      search: window.location.search,
      readyState: document.readyState,
    })

    // Run comprehensive diagnostic (only once, in development or on first load)
    if (process.env.NODE_ENV === 'development' || !(window as any).__farcasterDiagnosticRun) {
      runFarcasterDiagnostic().catch((err) => {
        console.error('❌ Diagnostic failed:', err)
      })
      ;(window as any).__farcasterDiagnosticRun = true
    }

    async function callReady() {
      // Wait for SDK to be available (with retry for preview environments)
      let sdkInstance = sdk || (window as any).farcaster?.sdk
      let attempts = 0
      const maxAttempts = 10 // Try for up to 2 seconds (10 * 200ms)
      
      console.log('🔍 Checking for SDK availability...', {
        sdkFromImport: !!sdk,
        sdkFromWindow: !!(window as any).farcaster?.sdk,
        attempt: attempts,
      })
      
      while (!sdkInstance && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200))
        sdkInstance = sdk || (window as any).farcaster?.sdk
        attempts++
        if (!sdkInstance && attempts < maxAttempts) {
          console.log(`⏳ Waiting for SDK... (attempt ${attempts}/${maxAttempts})`)
        }
      }

      if (!sdkInstance) {
        console.warn('⚠️ SDK not found after retries - may not be in Farcaster context', {
          attempts,
          maxAttempts,
          windowFarcaster: !!(window as any).farcaster,
        })
      } else {
        console.log('✅ SDK instance found', {
          attempts,
          hasActions: !!sdkInstance.actions,
          hasReady: !!(sdkInstance.actions?.ready),
        })
      }

      try {
        // Check if SDK is available - check multiple ways
        const readyFunction = sdkInstance?.actions?.ready || 
                             (sdkInstance && typeof (sdkInstance as any).ready === 'function' ? (sdkInstance as any).ready : null)
        
        // Check if SDK is available
        if (!readyFunction || typeof readyFunction !== 'function') {
          // Not in Farcaster context (browser mode) - this is OK
          console.log('ℹ️ Farcaster SDK not available (browser mode) - app will work normally', {
            hasSdkInstance: !!sdkInstance,
            hasActions: !!sdkInstance?.actions,
            hasReady: !!(sdkInstance?.actions?.ready),
          })
          setIsLoading(false)
          return
        }

        // Log before calling ready() - critical for debugging
        console.log('📞 About to call sdk.actions.ready()...', {
          timestamp: new Date().toISOString(),
          readyState: document.readyState,
          sdkType: sdkInstance === sdk ? 'imported' : 'window',
        })

        // Call ready() once - this hides the splash screen and shows content
        // Using disableNativeGestures to prevent gesture conflicts
        await readyFunction({ disableNativeGestures: true })
        
        setReadyCalled(true)
        // Set window flag to prevent duplicate calls across re-renders
        ;(window as any).__farcasterReadyCalled = true
        console.log('✅ sdk.actions.ready() called successfully - splash screen hidden', {
          timestamp: new Date().toISOString(),
        })
        
        // Initialize Farcaster context after ready() completes
        try {
          const initialized = await initializeFarcaster()
          if (initialized) {
            const farcasterContext = await getFarcasterContext()
            setContext(farcasterContext as FarcasterContextData | null)
            setIsInitialized(true)
            console.log('✅ Farcaster context initialized successfully')
          }
        } catch (contextError) {
          console.error('❌ Failed to initialize Farcaster context:', contextError)
        }
      } catch (readyError: any) {
        const errorMessage = readyError?.message || String(readyError || '')
        const isContextError = errorMessage.includes('not available') || 
                               errorMessage.includes('context') || 
                               errorMessage.includes('undefined')
        
        if (isContextError) {
          // Not in Farcaster context - this is expected in browser mode
          console.log('ℹ️ Not in Farcaster context (browser mode) - this is expected outside Farcaster')
        } else {
          console.error('❌ sdk.actions.ready() failed:', {
            message: errorMessage,
            error: readyError,
            stack: readyError?.stack,
            timestamp: new Date().toISOString(),
          })
        }
      } finally {
        setIsLoading(false)
        console.log('🏁 SDK initialization complete', {
          readyCalled,
          isLoading: false,
        })
      }
    }

    // Check for uncaught errors that might prevent ready() from being called
    const errorHandler = (event: ErrorEvent) => {
      console.error('🚨 Uncaught error before ready() call:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      })
    }
    
    window.addEventListener('error', errorHandler)

    // Call ready() after React mount - small delay to ensure UI is stable
    // This matches the recommended pattern: call as soon as possible after UI loads
    callReady().catch((error) => {
      console.error('🚨 Fatal error in callReady():', error)
      setIsLoading(false)
    })

    // Cleanup error handler
    return () => {
      window.removeEventListener('error', errorHandler)
    }
  }, []) // Empty dependency array - run only once on mount (per Farcaster SDK docs)

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

