'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { initializeFarcaster, getFarcasterContext } from '@/lib/farcaster'
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
      try {
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

    init()
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading }}>
      {children}
    </FarcasterContext.Provider>
  )
}

