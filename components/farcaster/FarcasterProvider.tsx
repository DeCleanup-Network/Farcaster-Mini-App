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

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false)
      return
    }

    const isBaseDev = window.location.hostname.includes('base.dev') || 
                      window.location.hostname.includes('basebuild.org') ||
                      window.location.hostname.includes('base.org')

    async function callReadyOnce() {
      if (readyCalled) {
        if (isBaseDev || process.env.NODE_ENV === 'development') {
          console.warn('⚠️ ready() already called, skipping duplicate call')
        }
        return
      }

      try {
        console.log('🔄 Calling sdk.actions.ready() after React mount...')
        
        const sdkInstance = sdk || (window as any).farcaster?.sdk
        const readyFunction = sdkInstance?.actions?.ready
        
        if (!readyFunction || typeof readyFunction !== 'function') {
          const debugInfo = {
            hasSdk: !!sdk,
            hasWindowSdk: !!(window as any).farcaster?.sdk,
            hasActions: !!sdkInstance?.actions,
            hasReady: !!readyFunction
          }
          if (isBaseDev || process.env.NODE_ENV === 'development') {
            console.warn('⚠️ SDK actions.ready() not available:', debugInfo)
          }
          setIsLoading(false)
          return
        }

        await readyFunction({ disableNativeGestures: true })
        
        setReadyCalled(true)
        console.log('✅ sdk.actions.ready() called successfully - splash screen hidden', isBaseDev ? '(Base.dev)' : '')
        
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
          if (isBaseDev || process.env.NODE_ENV === 'development') {
            console.log('ℹ️ Not in Farcaster context (browser mode):', errorMessage)
          }
        } else {
          console.error('❌ sdk.actions.ready() failed:', {
            message: errorMessage,
            error: readyError,
            stack: readyError?.stack
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    const readyState = document.readyState as 'loading' | 'interactive' | 'complete'
    
    if (readyState === 'complete') {
      setTimeout(() => {
        callReadyOnce()
      }, 100)
    } else if (readyState === 'interactive') {
      setTimeout(() => {
        callReadyOnce()
      }, 150)
    } else {
      const handleDOMReady = () => {
        setTimeout(() => {
          callReadyOnce()
        }, 100)
      }
      window.addEventListener('DOMContentLoaded', handleDOMReady, { once: true })
      window.addEventListener('load', handleDOMReady, { once: true })
      
      return () => {
        window.removeEventListener('DOMContentLoaded', handleDOMReady)
        window.removeEventListener('load', handleDOMReady)
      }
    }
  }, [readyCalled])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

