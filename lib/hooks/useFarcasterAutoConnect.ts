'use client'

import { useEffect } from 'react'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { useAccount, useConnect } from 'wagmi'

/**
 * Hook to auto-connect Farcaster wallet and account when in Mini App
 * 
 * This hook:
 * 1. Auto-connects Farcaster wallet when in Mini App
 * 2. Optionally gets Quick Auth token for account authentication
 */
export function useFarcasterAutoConnect() {
  const { isMiniApp, context, isLoading } = useFarcaster()
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    // Only auto-connect if:
    // 1. In Mini App
    // 2. Not loading
    // 3. Not already connected
    // 4. Farcaster connector is available
    if (!isMiniApp || isLoading || isConnected) {
      return
    }

    const autoConnect = async () => {
      try {
        // Find Farcaster connector
        const farcasterConnector = connectors.find((c) => {
          const name = c.name.toLowerCase()
          const id = c.id?.toLowerCase() || ''
          return (
            name.includes('farcaster') ||
            name.includes('frame') ||
            name.includes('miniapp') ||
            id.includes('farcaster') ||
            id.includes('frame') ||
            id.includes('miniapp')
          )
        })

        if (farcasterConnector && farcasterConnector.ready) {
          console.log('🔵 Auto-connecting Farcaster wallet...')
          await connect({ connector: farcasterConnector })
          console.log('✅ Farcaster wallet auto-connected')
        } else {
          console.log('⏳ Farcaster connector not ready yet, will retry...')
          // Retry after a short delay
          setTimeout(() => {
            if (!isConnected) {
              autoConnect()
            }
          }, 1000)
        }
      } catch (error) {
        console.error('Failed to auto-connect Farcaster wallet:', error)
        // Don't show error to user - silent fail, user can connect manually
      }
    }

    // Small delay to ensure connectors are initialized
    const timeoutId = setTimeout(autoConnect, 500)

    return () => clearTimeout(timeoutId)
  }, [isMiniApp, isLoading, isConnected, connectors, connect])

  // Quick Auth token is now managed by FarcasterProvider
  // Access it via: const { quickAuthToken } = useFarcaster()
}

