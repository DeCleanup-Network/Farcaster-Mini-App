'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useChainId, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { isFarcasterContext } from '@/lib/farcaster'
import { REQUIRED_CHAIN_ID } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'

/**
 * WalletConnect component using RainbowKit with custom design
 * 
 * Features:
 * - Custom styled button matching brand design (green with black text)
 * - Beautiful wallet connection UI via RainbowKit modals
 * - Automatic chain switching via RainbowKit
 * - Farcaster connector auto-connect support
 * - Network validation display
 */
export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false)

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

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    const inFarcaster = isFarcasterContext()
    setIsInFarcaster(inFarcaster)
    
    // Debug: Log available connectors
    if (typeof window !== 'undefined') {
      console.log('Available connectors:', connectors.map(c => ({ name: c.name, id: c.id })))
      console.log('Farcaster connector:', farcasterConnector?.name)
      console.log('Is in Farcaster context:', inFarcaster)
    }
  }, [])

  // REMOVED: Aggressive auto-connect logic
  // Let RainbowKit handle connector selection naturally
  // Farcaster connector will still be available in the wallet selection modal
  // Users can choose their preferred wallet, including Farcaster if they want

  // Log connection state changes
  useEffect(() => {
    if (isConnected && mounted) {
      console.log('Connected wallet:', {
        connector: connector?.name,
        connectorId: connector?.id,
        isFarcaster: connector?.name?.toLowerCase().includes('farcaster'),
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

  // Use RainbowKit's ConnectButton.Custom to match brand design
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
              <Button
                size="sm"
                onClick={openConnectModal}
                className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
              >
                <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Connect Wallet</span>
              </Button>
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
