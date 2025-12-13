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

    // Prevent duplicate calls - check window flag first (persists across re-renders)
    if ((window as any).__farcasterReadyCalled) {
      console.log('⚠️ SDK ready() already called (window flag), skipping duplicate call')
      setIsLoading(false)
      return
    }

    // If state says ready was called but window flag doesn't, sync them
    if (readyCalled && !(window as any).__farcasterReadyCalled) {
      ;(window as any).__farcasterReadyCalled = true
      setIsLoading(false)
      return
    }

    // CRITICAL: Try immediate ready() call if SDK is already available
    // BUT: Wait for UI to be rendered first (per Farcaster docs requirement)
    // Per Farcaster docs: "Call ready() only after your app's interface has fully rendered"
    const immediateSdk = sdk || (window as any).farcaster?.sdk || (window as any).farcaster
    if (immediateSdk?.actions?.ready && typeof immediateSdk.actions.ready === 'function') {
      console.log('⚡ SDK available immediately, will call ready() after UI renders...', {
        timestamp: new Date().toISOString(),
        readyState: document.readyState,
        url: window.location.href,
      })
      // Mark as called before actually calling to prevent duplicates
      ;(window as any).__farcasterReadyCalled = true
      setReadyCalled(true)
      
      // Wait for UI to be ready before calling ready()
      // Use requestAnimationFrame to ensure browser has painted the UI
      const callReadyAfterUI = async () => {
        // Wait for document to be ready
        if (document.readyState === 'loading') {
          await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true })
          })
        }
        
        // Wait for browser to paint (requestAnimationFrame ensures paint is complete)
        await new Promise(resolve => requestAnimationFrame(resolve))
        
        // Small delay to ensure React hydration is complete
        await new Promise(resolve => setTimeout(resolve, 50))
        
        console.log('✅ UI ready, calling ready() now...', {
          timestamp: new Date().toISOString(),
          readyState: document.readyState,
        })
        
        // Now call ready() after UI is rendered
        return immediateSdk.actions.ready({ disableNativeGestures: true })
        .then(() => {
          console.log('✅ Immediate ready() call succeeded', {
            timestamp: new Date().toISOString(),
          })
          // Initialize context after ready() succeeds
          initializeFarcaster()
            .then((initialized) => {
              if (initialized) {
                return getFarcasterContext()
              }
              return null
            })
            .then((context) => {
              if (context) {
                setContext(context as unknown as FarcasterContextData | null)
                setIsInitialized(true)
                console.log('✅ Farcaster context initialized after immediate ready()')
              }
            })
            .catch((err) => {
              console.error('❌ Failed to initialize context after immediate ready():', err)
            })
        })
        .catch((err: any) => {
          // Reset flags on error so retry logic can run
          ;(window as any).__farcasterReadyCalled = false
          setReadyCalled(false)
          console.warn('⚠️ Immediate ready() call failed, will retry with main logic:', err?.message)
        })
      }
      
      // Execute the async function to wait for UI and call ready()
      callReadyAfterUI()
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
      // Check if ready() was already called by immediate call above
      if ((window as any).__farcasterReadyCalled) {
        console.log('✅ ready() already called immediately, skipping main callReady()')
        // Still initialize context if not already done
        try {
          const initialized = await initializeFarcaster()
          if (initialized) {
            const farcasterContext = await getFarcasterContext()
            setContext(farcasterContext as unknown as FarcasterContextData | null)
            setIsInitialized(true)
            console.log('✅ Farcaster context initialized')
          }
        } catch (contextError) {
          console.error('❌ Failed to initialize Farcaster context:', contextError)
        }
        setIsLoading(false)
        return
      }

      // Wait for SDK to be available (with retry for preview environments)
      // Check multiple sources: imported SDK, window.farcaster.sdk, window.farcaster
      let sdkInstance = sdk || (window as any).farcaster?.sdk || (window as any).farcaster
      let attempts = 0
      const maxAttempts = 15 // Try for up to 3 seconds (15 * 200ms) - increased for slower environments
      
      console.log('🔍 Checking for SDK availability...', {
        sdkFromImport: !!sdk,
        sdkFromWindowFarcaster: !!(window as any).farcaster?.sdk,
        windowFarcaster: !!(window as any).farcaster,
        attempt: attempts,
        readyState: document.readyState,
      })
      
      // Wait for SDK to be injected (Farcaster client injects it asynchronously)
      while (!sdkInstance && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200))
        // Check all possible SDK locations
        sdkInstance = sdk || 
                     (window as any).farcaster?.sdk || 
                     (window as any).farcaster ||
                     (window as any).__farcasterSDK
        attempts++
        if (!sdkInstance && attempts < maxAttempts) {
          console.log(`⏳ Waiting for SDK... (attempt ${attempts}/${maxAttempts})`, {
            hasWindowFarcaster: !!(window as any).farcaster,
            readyState: document.readyState,
          })
        }
      }

      if (!sdkInstance) {
        console.warn('⚠️ SDK not found after retries - may not be in Farcaster context', {
          attempts,
          maxAttempts,
          windowFarcaster: !!(window as any).farcaster,
          readyState: document.readyState,
          userAgent: navigator.userAgent,
        })
        setIsLoading(false)
        return
      } else {
        console.log('✅ SDK instance found', {
          attempts,
          hasActions: !!sdkInstance.actions,
          hasReady: !!(sdkInstance.actions?.ready),
          sdkSource: sdkInstance === sdk ? 'imported' : 
                    (window as any).farcaster?.sdk ? 'window.farcaster.sdk' :
                    (window as any).farcaster ? 'window.farcaster' : 'unknown',
        })
      }

      try {
        // Check if SDK is available - check multiple ways and locations
        let readyFunction = null
        
        // Try standard location: sdkInstance.actions.ready
        if (sdkInstance?.actions?.ready && typeof sdkInstance.actions.ready === 'function') {
          readyFunction = sdkInstance.actions.ready
        }
        // Try alternative: sdkInstance.ready (some SDK versions)
        else if (sdkInstance && typeof (sdkInstance as any).ready === 'function') {
          readyFunction = (sdkInstance as any).ready
        }
        // Try window.farcaster.ready (fallback)
        else if ((window as any).farcaster?.ready && typeof (window as any).farcaster.ready === 'function') {
          readyFunction = (window as any).farcaster.ready
        }
        
        // Check if SDK is available
        if (!readyFunction || typeof readyFunction !== 'function') {
          // Not in Farcaster context (browser mode) - this is OK
          console.log('ℹ️ Farcaster SDK not available (browser mode) - app will work normally', {
            hasSdkInstance: !!sdkInstance,
            hasActions: !!sdkInstance?.actions,
            hasReady: !!(sdkInstance?.actions?.ready),
            hasDirectReady: !!(sdkInstance && typeof (sdkInstance as any).ready === 'function'),
            hasWindowReady: !!((window as any).farcaster?.ready),
            sdkKeys: sdkInstance ? Object.keys(sdkInstance) : [],
          })
          setIsLoading(false)
          return
        }

        // Ensure UI is rendered before calling ready()
        // Wait for document to be ready
        if (document.readyState === 'loading') {
          await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true })
          })
        }
        
        // Wait for browser to paint (requestAnimationFrame ensures paint is complete)
        await new Promise(resolve => requestAnimationFrame(resolve))
        
        // Small delay to ensure React hydration is complete
        await new Promise(resolve => setTimeout(resolve, 50))
        
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
            setContext(farcasterContext as unknown as FarcasterContextData | null)
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
  }, []) // Empty deps - effect should only run once on mount, window flag prevents duplicates

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

