'use client'

import { useEffect } from 'react'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { useAccount, useConnect } from 'wagmi'
import { sdk } from '@farcaster/miniapp-sdk'

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

  // Get Quick Auth token if in Mini App and context is available
  useEffect(() => {
    if (!isMiniApp || !context?.user) {
      return
    }

    const getQuickAuthToken = async () => {
      try {
        // Quick Auth provides a JWT token for the user
        // This is optional - only needed if you want to authenticate the user account
        const token = await sdk.quickAuth.getToken()
        console.log('✅ Quick Auth token obtained:', token ? 'Token received' : 'No token')
        // Store token if needed for API calls
        // You can store it in state or context if needed
      } catch (error) {
        // Quick Auth might not be available or user might not be signed in
        // This is OK - it's optional
        console.log('ℹ️ Quick Auth not available:', error)
      }
    }

    getQuickAuthToken()
  }, [isMiniApp, context])
}

