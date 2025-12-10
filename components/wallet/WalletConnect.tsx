'use client'

import { useEffect, useState, useRef } from 'react'
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
  const [forceUpdate, setForceUpdate] = useState(0)
  const { isConnected, connector, address } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const { connect, connectors, isPending } = useConnect()
  const previousConnectedRef = useRef(false)
  const previousAddressRef = useRef<string | undefined>(undefined)

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Monitor connection state changes and force UI update when WalletConnect connects
  useEffect(() => {
    // Detect when connection state changes from disconnected to connected
    const justConnected = !previousConnectedRef.current && isConnected && address
    const addressChanged = previousAddressRef.current !== address && isConnected && address
    
    if (justConnected || addressChanged) {
      console.log('Wallet connection detected:', {
        connector: connector?.name,
        connectorId: connector?.id,
        chainId,
        address,
        justConnected,
        addressChanged,
      })
      
      // Force UI update by changing a state value
      // This ensures RainbowKit modal detects the connection and updates UI
      setForceUpdate(prev => prev + 1)
      
      // Small delay to ensure state propagates, then force another update
      setTimeout(() => {
        setForceUpdate(prev => prev + 1)
      }, 100)
    }
    
    // Update refs for next comparison
    previousConnectedRef.current = isConnected
    previousAddressRef.current = address
  }, [isConnected, connector?.name, connector?.id, chainId, address])

  // Show consistent initial state on server and client
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-700" />
      </div>
    )
  }

  // Use RainbowKit's ConnectButton.Custom to match brand design
  // Add key prop that changes on connection to force re-render when WalletConnect connects
  return (
    <div className="flex flex-col items-end gap-1" key={`wallet-connect-${forceUpdate}-${isConnected}-${address}`}>
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
              
              // Detect iOS Safari - it has issues with modals
              const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
              
              // For iOS Safari, skip modal and connect directly (modals don't work well)
              if (isIOSSafari) {
                console.log('iOS Safari detected, connecting directly...')
                handleDirectConnect()
                return
              }
              
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
              // Check for injected wallet (window.ethereum) even if connectors aren't ready yet
              const hasInjectedWallet = typeof window !== 'undefined' && 
                                       ((window as any).ethereum || (window as any).web3)
              
              // Detect mobile browsers (iOS Safari, Chrome Mobile, etc.)
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
              
              // On mobile, connectors may take longer to initialize, so wait and retry
              let availableConnectors = connectors.filter(c => c.ready)
              let connectorToUse
              
              // If no connectors ready but we detect injected wallet, wait and retry
              if (availableConnectors.length === 0 && hasInjectedWallet) {
                console.log('Mobile: Waiting for connectors to initialize...')
                // Wait longer on mobile (up to 2 seconds with retries)
                for (let attempt = 0; attempt < 4; attempt++) {
                  await new Promise(resolve => setTimeout(resolve, 500))
                  availableConnectors = connectors.filter(c => c.ready)
                  if (availableConnectors.length > 0) {
                    console.log(`Mobile: Connectors ready after ${(attempt + 1) * 500}ms`)
                    break
                  }
                }
              }
              
              if (availableConnectors.length > 0 || hasInjectedWallet) {
                try {
                  // For iOS Safari, prefer injected/MetaMask over WalletConnect (WalletConnect has issues on iOS)
                  if (isIOSSafari) {
                    // iOS Safari: Prefer MetaMask/injected, avoid WalletConnect
                    connectorToUse = availableConnectors.find(
                      c => (c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')) &&
                           !c.id.includes('walletConnect') && !c.name.toLowerCase().includes('walletconnect')
                    ) || availableConnectors.find(c => !c.id.includes('walletConnect'))
                    
                    if (connectorToUse) {
                      console.log('iOS Safari detected, using connector:', connectorToUse.name)
                    }
                  } else if (isMobile) {
                    // Other mobile browsers: Prefer MetaMask or injected wallet, avoid WalletConnect
                    connectorToUse = availableConnectors.find(
                      c => (c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')) &&
                           !c.id.includes('walletConnect')
                    ) || availableConnectors.find(c => !c.id.includes('walletConnect')) || availableConnectors[0]
                    console.log('Mobile browser detected, using connector:', connectorToUse?.name || 'first available')
                  } else {
                    // Desktop browsers: Prefer MetaMask or injected wallet
                    connectorToUse = availableConnectors.find(
                      c => c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')
                    ) || availableConnectors[0]
                    console.log('Connecting directly with:', connectorToUse?.name || 'first available')
                  }
                  
                  if (!connectorToUse) {
                    if (hasInjectedWallet) {
                      alert('Wallet detected but not ready. Please wait a moment and try again, or ensure your wallet is unlocked.')
                    } else {
                      alert('No wallets available. Please install MetaMask or another Web3 wallet to connect.')
                    }
                    return
                  }
                  
                  await connect({ connector: connectorToUse })
                } catch (connectError: any) {
                  console.error('Direct connect failed:', connectError)
                  const errorMsg = connectError?.message || String(connectError || 'Unknown error')
                  
                  // Don't show alert for user rejections
                  if (!errorMsg.toLowerCase().includes('rejected') && 
                      !errorMsg.toLowerCase().includes('denied') &&
                      !errorMsg.toLowerCase().includes('user cancelled')) {
                    // Last resort: show alert
                    alert('Connection failed. Please ensure your wallet is unlocked and try again.')
                  }
                }
              } else {
                alert('No wallets available. Please install MetaMask or another Web3 wallet to connect.')
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
          Use, when on web app. Base Sepolia
        </span>
      </div>
    </div>
  )
}
