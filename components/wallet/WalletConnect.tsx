'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useDisconnect, useConnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { REQUIRED_CHAIN_ID } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'

/**
 * WalletConnect component using RainbowKit
 * 
 * Features:
 * - Custom styled button matching brand design (green with black text)
 * - Beautiful wallet connection UI via RainbowKit modals
 * - Automatic chain switching via RainbowKit
 * - Network validation display
 */
export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const { connect, connectors, isPending } = useConnect()

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
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
            const handleConnect = (e: React.MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              
              // Try RainbowKit modal first (must be synchronous for Safari)
              if (openConnectModal && typeof openConnectModal === 'function') {
                try {
                  console.log('Opening RainbowKit connect modal...')
                  openConnectModal()
                } catch (error) {
                  console.warn('RainbowKit modal failed:', error)
                  // Fallback: Try connecting directly (async, but triggered from sync handler)
                  handleDirectConnect()
                }
              } else {
                // Fallback if modal function not available
                handleDirectConnect()
              }
            }

            const handleDirectConnect = async () => {
              // Fallback: Try connecting directly with first available connector
              // This works better in Safari when modal fails
              const availableConnectors = connectors.filter(c => c.ready)
              if (availableConnectors.length > 0) {
                try {
                  // Prefer MetaMask or injected wallet for Safari
                  const metaMaskConnector = availableConnectors.find(
                    c => c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')
                  )
                  const connectorToUse = metaMaskConnector || availableConnectors[0]
                  console.log('Connecting directly with:', connectorToUse.name)
                  await connect({ connector: connectorToUse })
                } catch (connectError) {
                  console.error('Direct connect failed:', connectError)
                  // Last resort: show alert
                  alert('Please install MetaMask or another Web3 wallet to connect.')
                }
              } else {
                alert('No wallets available. Please install MetaMask or another Web3 wallet.')
              }
            }

            return (
              <div className="flex flex-col items-end gap-1">
                <Button
                  size="sm"
                  onClick={handleConnect}
                  disabled={isPending}
                  className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm disabled:opacity-50"
                >
                  <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{isPending ? 'Connecting...' : 'Connect Wallet'}</span>
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
      
      {/* Network info */}
      <div className="flex flex-col items-end gap-0.5 w-full">
        <span className="text-[10px] text-muted-foreground/70 text-right">
          Use it for browser app
        </span>
        <span className="text-[10px] text-muted-foreground/70 text-right">
          Base Sepolia
        </span>
      </div>
    </div>
  )
}
