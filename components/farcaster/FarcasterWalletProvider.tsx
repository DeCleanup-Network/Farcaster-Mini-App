'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { isFarcaster, isFarcasterWallet } from '@/lib/farcaster-detection'

interface FarcasterWalletContextType {
  isConnected: boolean
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const FarcasterWalletContext = createContext<FarcasterWalletContextType | null>(null)

export function useFarcasterWallet() {
  const context = useContext(FarcasterWalletContext)
  if (!context) {
    throw new Error('useFarcasterWallet must be used within FarcasterWalletProvider')
  }
  return context
}

interface FarcasterWalletProviderProps {
  children: ReactNode
}

/**
 * Farcaster Wallet Provider
 * Only used when app is running inside Farcaster Mini App
 * Provides Farcaster wallet connection without RainbowKit
 */
export function FarcasterWalletProvider({ children }: FarcasterWalletProviderProps) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { connect, connectors } = useConnect()
  
  // Find Farcaster connector
  const farcasterConnector = connectors.find(
    c => {
      const name = c.name.toLowerCase()
      const id = c.id?.toLowerCase() || ''
      return name.includes('farcaster') ||
        name.includes('frame') ||
        name.includes('miniapp') ||
        id.includes('farcaster') ||
        id.includes('frame') ||
        id.includes('miniapp')
    }
  )

  // Check connection status on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkConnection = async () => {
      try {
        const provider = (window as any).ethereum || (window as any).farcaster?.sdk?.wallet?.ethProvider
        if (provider) {
          const accounts = await provider.request({ method: 'eth_accounts' })
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0])
            setIsConnected(true)
          }
        }
      } catch (error) {
        console.debug('No Farcaster wallet connected:', error)
      }
    }

    checkConnection()

    // Listen for account changes
    const provider = (window as any).ethereum || (window as any).farcaster?.sdk?.wallet?.ethProvider
    if (provider?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0])
          setIsConnected(true)
        } else {
          setAddress(null)
          setIsConnected(false)
        }
      }

      provider.on('accountsChanged', handleAccountsChanged)

      return () => {
        if (provider.removeListener) {
          provider.removeListener('accountsChanged', handleAccountsChanged)
        }
      }
    }
  }, [])

  const connectWallet = async () => {
    try {
      if (farcasterConnector) {
        // Use wagmi connector if available
        await connect({ connector: farcasterConnector })
      } else {
        // Fallback to direct provider access
        const provider = (window as any).ethereum || (window as any).farcaster?.sdk?.wallet?.ethProvider
        if (provider) {
          const accounts = await provider.request({ method: 'eth_requestAccounts' })
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0])
            setIsConnected(true)
          }
        } else {
          throw new Error('Farcaster wallet not available')
        }
      }
    } catch (error: any) {
      console.error('Failed to connect Farcaster wallet:', error)
      if (error.code !== 4001) { // Not user rejection
        alert('Failed to connect Farcaster wallet. Please try again.')
      }
    }
  }

  const disconnectWallet = () => {
    setAddress(null)
    setIsConnected(false)
  }

  const value: FarcasterWalletContextType = {
    isConnected,
    address,
    connect: connectWallet,
    disconnect: disconnectWallet,
  }

  return (
    <FarcasterWalletContext.Provider value={value}>
      {children}
    </FarcasterWalletContext.Provider>
  )
}

