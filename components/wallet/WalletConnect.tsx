'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { REQUIRED_CHAIN_ID } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'
import { isFarcaster, isFarcasterWallet } from '@/lib/farcaster-detection'

/**
 * WalletConnect component with conditional rendering based on environment
 * 
 * Features:
 * - In Farcaster: Shows Farcaster wallet connect button (no RainbowKit)
 * - In Browser: Shows RainbowKit with full wallet support
 * - Custom styled button matching brand design (green with black text)
 * - Automatic chain switching via RainbowKit (browser only)
 * - Network validation display
 */
export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const [inFarcaster, setInFarcaster] = useState(false)
  const { isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false)

  // Get Farcaster wallet context (only available in Farcaster mode)
  // Use a safe hook wrapper to avoid errors when provider is not available
  const [farcasterWallet, setFarcasterWallet] = useState<{
    isConnected: boolean
    address: string | null
    connect: () => Promise<void>
    disconnect: () => void
  } | null>(null)

  useEffect(() => {
    if (inFarcaster && typeof window !== 'undefined') {
      // Try to get Farcaster wallet provider directly
      const provider = (window as any).farcaster?.sdk?.wallet?.ethProvider || (window as any).ethereum
      if (provider) {
        const checkConnection = async () => {
          try {
            const accounts = await provider.request({ method: 'eth_accounts' })
            if (accounts && accounts.length > 0) {
              setFarcasterWallet({
                isConnected: true,
                address: accounts[0],
                connect: async () => {
                  const newAccounts = await provider.request({ method: 'eth_requestAccounts' })
                  if (newAccounts && newAccounts.length > 0) {
                    setFarcasterWallet(prev => prev ? { ...prev, isConnected: true, address: newAccounts[0] } : null)
                  }
                },
                disconnect: () => {
                  setFarcasterWallet(prev => prev ? { ...prev, isConnected: false, address: null } : null)
                },
              })
            } else {
              setFarcasterWallet({
                isConnected: false,
                address: null,
                connect: async () => {
                  const newAccounts = await provider.request({ method: 'eth_requestAccounts' })
                  if (newAccounts && newAccounts.length > 0) {
                    setFarcasterWallet(prev => prev ? { ...prev, isConnected: true, address: newAccounts[0] } : null)
                  }
                },
                disconnect: () => {
                  setFarcasterWallet(prev => prev ? { ...prev, isConnected: false, address: null } : null)
                },
              })
            }
          } catch {
            setFarcasterWallet({
              isConnected: false,
              address: null,
              connect: async () => {
                try {
                  const provider = (window as any).farcaster?.sdk?.wallet?.ethProvider || (window as any).ethereum
                  if (provider) {
                    const accounts = await provider.request({ method: 'eth_requestAccounts' })
                    if (accounts && accounts.length > 0) {
                      setFarcasterWallet(prev => prev ? { ...prev, isConnected: true, address: accounts[0] } : null)
                    }
                  }
                } catch (error) {
                  console.error('Failed to connect Farcaster wallet:', error)
                }
              },
              disconnect: () => {
                setFarcasterWallet(prev => prev ? { ...prev, isConnected: false, address: null } : null)
              },
            })
          }
        }
        checkConnection()
      }
    }
  }, [inFarcaster])

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    setInFarcaster(isFarcaster())
  }, [])

  // Log connection state changes
  useEffect(() => {
    if (isConnected && mounted) {
      console.log('Connected wallet:', {
        connector: connector?.name,
        connectorId: connector?.id,
        chainId,
      })
    }
  }, [isConnected, connector?.name, connector?.id, chainId, mounted])

  // Show consistent initial state on server and client
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-700" />
      </div>
    )
  }

  // Farcaster Mode: Show Farcaster wallet connect button (NO RainbowKit)
  if (inFarcaster) {
    const isFarcasterConnected = farcasterWallet?.isConnected || isFarcasterWallet()
    const farcasterAddress = farcasterWallet?.address || (isConnected ? connector?.accounts?.[0] : null)

    if (!isFarcasterConnected) {
      return (
        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            onClick={farcasterWallet?.connect || (() => {})}
            className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Connect Farcaster Wallet</span>
          </Button>
          <span className="text-[10px] text-muted-foreground/70 text-right">
            Farcaster wallet only
          </span>
        </div>
      )
    }

    // Connected in Farcaster
    return (
      <div className="flex items-center gap-2">
        <div 
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 sm:px-3 sm:py-2"
          title={`Farcaster wallet: ${farcasterAddress}`}
        >
          <Wallet className="h-3 w-3 text-brand-green sm:h-4 sm:w-4" />
          <span className="text-xs font-medium text-white sm:text-sm">
            {farcasterAddress ? `${farcasterAddress.slice(0, 6)}...${farcasterAddress.slice(-4)}` : 'Connected'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            farcasterWallet?.disconnect()
            disconnect()
          }}
          className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
        >
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Disconnect</span>
        </Button>
      </div>
    )
  }

  // Browser Mode: Use RainbowKit's ConnectButton.Custom to match brand design
  return (
    <div className="flex flex-col items-end gap-1">
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted: rainbowKitMounted,
        }) => {
          const ready = rainbowKitMounted && authenticationStatus !== 'loading'
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus || authenticationStatus === 'authenticated')

          // Show loading state
          if (!ready) {
            return (
              <div className="flex items-center gap-2">
                <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-700" />
              </div>
            )
          }

          // Not connected - show connect button
          if (!connected) {
            return (
              <div className="flex flex-col items-end gap-1">
                <Button
                  size="sm"
                  onClick={openConnectModal}
                  className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
                >
                  <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Connect Wallet</span>
                </Button>
              </div>
            )
          }

          // Wrong network - show network switch button
          if (chain.unsupported || chain.id !== REQUIRED_CHAIN_ID) {
            return (
              <Button
                size="sm"
                onClick={openChainModal}
                className="gap-2 border-2 border-yellow-500 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 text-xs sm:text-sm"
              >
                <span>Wrong Network</span>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )
          }

          // Connected - show account button
          return (
            <div className="flex items-center gap-2">
              <div 
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 sm:px-3 sm:py-2 cursor-pointer hover:border-brand-green transition-colors"
                onClick={openAccountModal}
                title={`Click to view account details or disconnect. Full address: ${account.address}`}
              >
                <Wallet className="h-3 w-3 text-brand-green sm:h-4 sm:w-4" />
                <span className="text-xs font-medium text-white sm:text-sm">
                  {account.displayName}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setManuallyDisconnected(true)
                  try {
                    await disconnect()
                    console.log('Wallet disconnected successfully')
                  } catch (error) {
                    console.error('Error disconnecting wallet:', error)
                    // Fallback: try opening account modal which has disconnect option
                    openAccountModal()
                  }
                }}
                className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            </div>
          )
        }}
      </ConnectButton.Custom>
      
      {/* Base Sepolia note */}
      <span className="text-[10px] text-muted-foreground/70 text-right w-full">
        Base Sepolia
      </span>
    </div>
  )
}
