'use client'

import { useEffect, useState, useRef } from 'react'
import { useAccount, useChainId, useDisconnect, useConnect } from 'wagmi'
import { ConnectButton, useConnectModal, useAccountModal, useChainModal } from '@rainbow-me/rainbowkit'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { REQUIRED_CHAIN_ID } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { lookupENS } from '@/lib/ens'

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
  const { isMiniApp } = useFarcaster()
  const previousConnectedRef = useRef(false)
  const previousAddressRef = useRef<string | undefined>(undefined)
  const [ensName, setEnsName] = useState<string | null>(null)
  
  // Use RainbowKit modal hooks for programmatic control
  // These hooks provide access to modal state and open functions
  const { openConnectModal, connectModalOpen } = useConnectModal()
  const { openAccountModal, accountModalOpen } = useAccountModal()
  const { openChainModal, chainModalOpen } = useChainModal()

  // Lookup ENS name for connected address (web flow only)
  useEffect(() => {
    if (!isMiniApp && isConnected && address) {
      lookupENS(address).then(name => {
        if (name) {
          setEnsName(name)
        } else {
          setEnsName(null)
        }
      }).catch(() => {
        setEnsName(null)
      })
    } else {
      setEnsName(null)
    }
  }, [isMiniApp, isConnected, address])

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    
    // Log connector status for debugging
    if (isMiniApp) {
      console.log('🔵 Farcaster environment detected in WalletConnect')
      console.log('Available connectors:', connectors.map(c => ({
        id: c.id,
        name: c.name,
        ready: c.ready,
        type: c.type,
      })))
      
      const farcasterConnector = connectors.find(c => {
        const name = c.name.toLowerCase()
        const id = c.id?.toLowerCase() || ''
        return name.includes('farcaster') || 
               name.includes('frame') || 
               name.includes('miniapp') ||
               id.includes('farcaster') || 
               id.includes('frame') || 
               id.includes('miniapp')
      })
      
      if (farcasterConnector) {
        console.log('✅ Farcaster connector found:', {
          id: farcasterConnector.id,
          name: farcasterConnector.name,
          ready: farcasterConnector.ready,
        })
      } else {
        console.warn('⚠️ Farcaster environment but no Farcaster connector found!')
      }
    }
  }, [connectors])

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
              
              // Detect mobile browsers
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
              
              // Check if we have ready connectors first
              const readyConnectors = connectors.filter(c => c.ready)
              const hasReadyConnectors = readyConnectors.length > 0
              
              console.log('🔌 Connect button clicked:', {
                isMobile,
                isIOSSafari,
                readyConnectors: readyConnectors.length,
                hasModal: !!openConnectModal,
              })
              
              // On mobile, prefer direct connect if connectors are ready
              // RainbowKit modal works on mobile, but direct connect is more reliable
              if (isMobile && hasReadyConnectors) {
                console.log('Mobile with ready connectors: using direct connect')
                handleDirectConnect()
                return
              }
              
              // Try RainbowKit modal first (works well on desktop and some mobile browsers)
              // Use the hook-provided function for better reliability
              if (openConnectModal) {
                try {
                  console.log('Opening RainbowKit connect modal...')
                  openConnectModal()
                  // On mobile, also set up a fallback in case modal doesn't work
                  if (isMobile) {
                    setTimeout(() => {
                      // Check if connection happened after modal opened
                      // If not, try direct connect as fallback
                      if (!isConnected) {
                        console.log('Modal opened but no connection detected, will try direct connect if user cancels')
                      }
                    }, 2000)
                  }
                } catch (error) {
                  console.warn('RainbowKit modal failed:', error)
                  // Fallback: Try connecting directly
                  handleDirectConnect()
                }
              } else {
                // Fallback if modal function not available
                console.log('Modal function not available, using direct connect')
                handleDirectConnect()
              }
            }

            const handleDirectConnect = async () => {
              // CRITICAL: Use proper environment detection from FarcasterProvider
              // In Farcaster Mini App, we MUST use the Farcaster connector, not injected wallets
              const isFarcasterEnv = isMiniApp
              
              // Detect mobile browsers (iOS Safari, Chrome Mobile, etc.)
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
              
              // Check for injected wallet (window.ethereum) - but NOT in Farcaster
              // On mobile, this might not be available immediately
              const hasInjectedWallet = !isFarcasterEnv && typeof window !== 'undefined' && 
                                       ((window as any).ethereum || (window as any).web3)
              
              console.log('🔍 Mobile wallet detection:', {
                isMobile,
                isIOSSafari,
                isFarcasterEnv,
                hasInjectedWallet,
                totalConnectors: connectors.length,
                readyConnectors: connectors.filter(c => c.ready).length,
                connectorDetails: connectors.map(c => ({
                  id: c.id,
                  name: c.name,
                  ready: c.ready,
                  type: c.type,
                })),
              })
              
              let availableConnectors = connectors.filter(c => c.ready)
              let connectorToUse
              
              // PRIORITY 1: If in Farcaster environment, MUST use Farcaster connector
              if (isFarcasterEnv) {
                console.log('🔵 Farcaster environment detected, looking for Farcaster connector...')
                
                // Find Farcaster connector
                const farcasterConnector = connectors.find(c => {
                  const name = c.name.toLowerCase()
                  const id = c.id?.toLowerCase() || ''
                  return name.includes('farcaster') || 
                         name.includes('frame') || 
                         name.includes('miniapp') ||
                         id.includes('farcaster') || 
                         id.includes('frame') || 
                         id.includes('miniapp')
                })
                
                if (farcasterConnector) {
                  // Wait for Farcaster connector to be ready (it may take time to initialize)
                  if (!farcasterConnector.ready) {
                    console.log('⏳ Farcaster connector not ready yet, waiting...')
                    // Wait up to 3 seconds for Farcaster connector to be ready
                    for (let attempt = 0; attempt < 6; attempt++) {
                      await new Promise(resolve => setTimeout(resolve, 500))
                      if (farcasterConnector.ready) {
                        console.log(`✅ Farcaster connector ready after ${(attempt + 1) * 500}ms`)
                        break
                      }
                    }
                  }
                  
                  if (farcasterConnector.ready) {
                    connectorToUse = farcasterConnector
                    console.log('✅ Using Farcaster connector:', farcasterConnector.name)
                  } else {
                    console.warn('⚠️ Farcaster connector not ready after waiting')
                    alert('Farcaster wallet is not ready. Please wait a moment and try again.')
                    return
                  }
                } else {
                  console.error('❌ Farcaster environment detected but no Farcaster connector found!')
                  alert('Farcaster wallet connector not available. Please refresh the page.')
                  return
                }
              } else {
                // NOT in Farcaster - use standard wallet connection logic
                // CRITICAL: On mobile, connectors take longer to initialize
                // Wait for connectors to become ready, especially on mobile
                if (availableConnectors.length === 0) {
                  console.log('⏳ No ready connectors found, waiting for initialization...')
                  // Wait longer on mobile (up to 5 seconds with retries)
                  const maxAttempts = isMobile ? 10 : 6
                  const delay = isMobile ? 500 : 300
                  
                  for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, delay))
                    availableConnectors = connectors.filter(c => c.ready)
                    console.log(`Attempt ${attempt + 1}/${maxAttempts}: ${availableConnectors.length} ready connectors`, {
                      connectors: availableConnectors.map(c => ({ id: c.id, name: c.name, ready: c.ready })),
                    })
                    if (availableConnectors.length > 0) {
                      console.log(`✅ Connectors ready after ${(attempt + 1) * delay}ms`)
                      break
                    }
                  }
                }
                
                // If still no connectors, check if we have injected wallet
                // On mobile Safari, injected wallets might not show up as connectors immediately
                if (availableConnectors.length === 0 && hasInjectedWallet) {
                  console.log('⚠️ No ready connectors but injected wallet detected, waiting a bit more...')
                  // Give it one more second for mobile wallets
                  await new Promise(resolve => setTimeout(resolve, isMobile ? 1000 : 500))
                  availableConnectors = connectors.filter(c => c.ready)
                }
                
                if (availableConnectors.length > 0) {
                  // For iOS Safari, prefer injected/MetaMask over WalletConnect (WalletConnect has issues on iOS)
                  if (isIOSSafari) {
                    // iOS Safari: Prefer MetaMask/injected, avoid WalletConnect
                    connectorToUse = availableConnectors.find(
                      c => (c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')) &&
                           !c.id.includes('walletConnect') && !c.name.toLowerCase().includes('walletconnect')
                    ) || availableConnectors.find(c => !c.id.includes('walletConnect'))
                    
                    if (connectorToUse) {
                      console.log('✅ iOS Safari detected, using connector:', connectorToUse.name)
                    }
                  } else if (isMobile) {
                    // Other mobile browsers: Prefer MetaMask or injected wallet, avoid WalletConnect
                    connectorToUse = availableConnectors.find(
                      c => (c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')) &&
                           !c.id.includes('walletConnect')
                    ) || availableConnectors.find(c => !c.id.includes('walletConnect')) || availableConnectors[0]
                    console.log('✅ Mobile browser detected, using connector:', connectorToUse?.name || 'first available')
                  } else {
                    // Desktop browsers: Prefer MetaMask or injected wallet
                    connectorToUse = availableConnectors.find(
                      c => c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')
                    ) || availableConnectors[0]
                    console.log('✅ Desktop browser, using connector:', connectorToUse?.name || 'first available')
                  }
                } else if (hasInjectedWallet) {
                  // Last resort: try to find injected connector even if not ready
                  // On mobile, sometimes connectors aren't marked as ready but still work
                  const injectedConnector = connectors.find(
                    c => c.id === 'injected' || c.id === 'metaMask' || c.name.toLowerCase().includes('metamask')
                  )
                  if (injectedConnector) {
                    console.log('⚠️ Using injected connector even though not marked as ready:', injectedConnector.name)
                    connectorToUse = injectedConnector
                  }
                }
              }
              
              if (!connectorToUse) {
                console.error('❌ No connector available:', {
                  isFarcasterEnv,
                  hasInjectedWallet,
                  availableConnectors: availableConnectors.length,
                  allConnectors: connectors.map(c => ({ id: c.id, name: c.name, ready: c.ready })),
                })
                
                if (isFarcasterEnv) {
                  alert('Farcaster wallet is not ready. Please wait a moment and try again.')
                } else if (hasInjectedWallet) {
                  alert('Wallet detected but not ready. Please wait a moment and try again, or ensure your wallet is unlocked.')
                } else if (isMobile) {
                  alert('No wallets found. On mobile, please:\n\n1. Install MetaMask or another Web3 wallet app\n2. Open the wallet app and unlock it\n3. Return to this page and try again\n\nOr use the "Connect Wallet" button to scan a QR code with WalletConnect.')
                } else {
                  alert('No wallets available. Please install MetaMask or another Web3 wallet to connect.')
                }
                return
              }
              
              try {
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
                onClick={() => {
                  // Use hook-provided function for better reliability
                  if (openAccountModal) {
                    openAccountModal()
                  } else if (accountModalOpen === false) {
                    // Fallback to the render prop function if hook not available
                    openAccountModal()
                  }
                }}
                title={`Click to view account details or disconnect. Full address: ${account.address}`}
              >
                <Wallet className="h-3 w-3 text-brand-green sm:h-4 sm:w-4" />
                <span className="text-xs font-medium text-white sm:text-sm">
                  {ensName || account.displayName}
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
                    if (openAccountModal) {
                      openAccountModal()
                    }
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
      
    </div>
  )
}
