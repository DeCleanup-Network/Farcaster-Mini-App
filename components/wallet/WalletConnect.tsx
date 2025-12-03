'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { getEnsName } from 'wagmi/actions'
import type { Connector } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut, QrCode, X } from 'lucide-react'
import { isFarcasterContext, MINIAPP_URL } from '@/lib/farcaster'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME, REQUIRED_RPC_URL, REQUIRED_BLOCK_EXPLORER_URL, config } from '@/lib/wagmi'
import { tryAddRequiredChain, switchToRequiredChainViaProvider } from '@/lib/network'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain()
  const { connectAsync, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const [isAutoSwitching, setIsAutoSwitching] = useState(false)
  const [showFarcasterQR, setShowFarcasterQR] = useState(false)
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false)
  const [ensName, setEnsName] = useState<string | null>(null)

  // Get Farcaster connector and external wallet connectors
  // The farcasterMiniApp connector might have different names, so we check by ID or type
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

  // Detect if we're in an in-app browser (no window.ethereum)
  const isInAppBrowser = typeof window !== 'undefined' && !(window as any)?.ethereum
  
  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  // Detect Safari (has WebSocket issues with WalletConnect)
  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  // Get all external connectors (Browser Wallet, WalletConnect)
  // According to Farcaster docs: filter out Farcaster connector when not in Farcaster context
  const externalConnectors = connectors
    .filter(c => {
      const name = c.name.toLowerCase()
      const id = c.id?.toLowerCase() || ''
      const isFarcaster = name.includes('farcaster') || name.includes('frame') || name.includes('miniapp') ||
        id.includes('farcaster') || id.includes('frame') || id.includes('miniapp')
      
      // Only show Farcaster connector if we're in Farcaster context
      if (isFarcaster) {
        return isInFarcaster
      }
      
      // Show all other connectors (Browser Wallet, WalletConnect)
      return true
    })
    .sort((a, b) => {
      // Simple sorting: Browser Wallet first, then WalletConnect
      const aIsInjected = a.name.toLowerCase() === 'injected' || a.id?.toLowerCase() === 'injected' ||
        a.name.toLowerCase().includes('browser') || a.id?.toLowerCase().includes('browser')
      const bIsInjected = b.name.toLowerCase() === 'injected' || b.id?.toLowerCase() === 'injected' ||
        b.name.toLowerCase().includes('browser') || b.id?.toLowerCase().includes('browser')
      const aIsWC = a.name.toLowerCase().includes('walletconnect') || a.id?.toLowerCase().includes('walletconnect')
      const bIsWC = b.name.toLowerCase().includes('walletconnect') || b.id?.toLowerCase().includes('walletconnect')
      
      // Prioritize Browser Wallet over WalletConnect (especially on Safari)
      if (aIsInjected && bIsWC) return -1
      if (bIsInjected && aIsWC) return 1
      return 0
    })

  const handleConnect = async (connector: Connector) => {
    try {
      // If trying to connect Farcaster wallet outside of Farcaster context, show QR code
      const isFarcasterConnector = connector.name?.toLowerCase().includes('farcaster') ||
        connector.id?.toLowerCase().includes('farcaster') ||
        connector.name?.toLowerCase().includes('frame') ||
        connector.name?.toLowerCase().includes('miniapp')
      
      if (isFarcasterConnector && !isInFarcaster) {
        setShowFarcasterQR(true)
        return
      }
      
      // Safari-specific: Pre-clear WalletConnect storage before connecting
      // Safari has WebSocket issues that can cause stale connections
      const isWalletConnect = connector.name?.toLowerCase().includes('walletconnect') ||
        connector.id?.toLowerCase().includes('walletconnect')
      
      if (isSafari && isWalletConnect && typeof window !== 'undefined') {
        console.log('Safari detected: Pre-clearing WalletConnect storage before connection...')
        try {
          // Clear any stale WalletConnect sessions
          const wcKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('wc@2:') || key.startsWith('walletconnect')
          )
          wcKeys.forEach(key => localStorage.removeItem(key))
          sessionStorage.removeItem('wallet_connected_this_session')
          console.log('WalletConnect storage cleared for Safari connection')
          
          // Small delay to ensure storage is cleared
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (e) {
          console.warn('Failed to pre-clear WalletConnect storage:', e)
        }
      }
      
      // Safari-specific: Add timeout for WalletConnect connections
      // Safari WebSocket connections can hang indefinitely
      if (isSafari && isWalletConnect) {
        let connectionTimeout: NodeJS.Timeout | null = null
        let timedOut = false
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          connectionTimeout = setTimeout(() => {
            timedOut = true
            reject(new Error('SAFARI_TIMEOUT'))
          }, 30000) // 30 second timeout for Safari
        })
        
        try {
          await Promise.race([connectAsync({ connector }), timeoutPromise])
          // Connection succeeded - clear timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout)
          }
        } catch (timeoutError: any) {
          // Clear timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout)
          }
          
          // If it's our timeout error, handle it gracefully without logging as error
          if (timeoutError?.message === 'SAFARI_TIMEOUT' || timedOut) {
            alert('⚠️ Safari WebSocket Issue\n\nSafari has known issues with WalletConnect WebSockets. Please try:\n\n1. Use the browser wallet (MetaMask extension) instead\n2. Or try connecting from Chrome/Firefox\n\nWalletConnect may work intermittently on Safari.')
            return
          }
          
          // Re-throw other errors to be handled below
          throw timeoutError
        }
      } else {
        await connectAsync({ connector })
      }
      
      // Mark as connected in this session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('wallet_connected_this_session', 'true')
      }
    } catch (error: any) {
      // Handle WalletConnect-specific errors gracefully
      const errorMessage = error?.message || String(error) || ''
      const errorName = error?.name || ''
      const errorString = String(error).toLowerCase()
      
      // Safari-specific: Provide helpful error message (skip console.error for timeout)
      if (isSafari && (connector.name?.toLowerCase().includes('walletconnect') || connector.id?.toLowerCase().includes('walletconnect'))) {
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('took too long') || errorMessage === 'SAFARI_TIMEOUT'
        const isWebSocketError = errorString.includes('websocket') || errorString.includes('socket') || errorString.includes('connection')
        
        if (isTimeout || isWebSocketError) {
          // Already handled above, just return silently
          if (errorMessage === 'SAFARI_TIMEOUT') {
            return
          }
          // For other WebSocket errors, show alert but don't log as error
          console.warn('Safari WalletConnect issue:', errorMessage)
          alert('⚠️ Safari WebSocket Issue\n\nSafari has known issues with WalletConnect WebSockets. Please try:\n\n1. Use the browser wallet (MetaMask extension) instead\n2. Or try connecting from Chrome/Firefox\n\nWalletConnect may work intermittently on Safari.')
          return
        }
      }
      
      // Log other errors normally
      console.error('Wallet connect failed:', error)
      
      // Check for stale session errors (WalletConnect v2)
      const isStaleSession = errorMessage.includes('session topic doesn\'t exist') ||
        errorMessage.includes('No matching key') ||
        errorMessage.includes('session topic') ||
        errorString.includes('session topic doesn\'t exist') ||
        errorString.includes('no matching key')
      
      // If it's a stale session error, disconnect and clear storage
      if (isStaleSession) {
        console.log('WalletConnect session expired or invalid. Disconnecting and clearing session data...')
        try {
          // Disconnect to clear the stale session
          await disconnect()
          
          // Clear WalletConnect storage
          if (typeof window !== 'undefined') {
            // Clear WalletConnect v2 storage
            try {
              const wcKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('wc@2:') || key.startsWith('walletconnect')
              )
              wcKeys.forEach(key => localStorage.removeItem(key))
            } catch (e) {
              console.warn('Failed to clear WalletConnect storage:', e)
            }
            
            // Clear session storage
            sessionStorage.removeItem('wallet_connected_this_session')
          }
          
          console.log('Stale session cleared. Please reconnect your wallet.')
          
          // Safari-specific: Suggest browser wallet
          if (isSafari) {
            alert('WalletConnect session expired. On Safari, consider using the browser wallet (MetaMask extension) for more reliable connections.')
          }
        } catch (disconnectError) {
          console.warn('Error during disconnect:', disconnectError)
        }
        return
      }
      
      // Check for connection reset or rejection errors
      const isConnectionReset = errorMessage.includes('Connection request reset') ||
        errorMessage.includes('request reset') ||
        errorName === 'UserRejectedRequestError'
      
      const isUserRejected = errorMessage.includes('User rejected') ||
        errorMessage.includes('rejected') ||
        error?.code === 4001
      
      // For connection resets, this is usually expected behavior:
      // - User closed the QR code modal
      // - Connection timed out
      // - User rejected in their wallet app
      // We don't need to show an alert - the user can simply try again
      if (isConnectionReset || isUserRejected) {
        console.log('Connection was reset or rejected. User can try connecting again.')
        // Silently handle - user can retry
      } else {
        // For unexpected errors, log them but don't spam the user
        console.warn('Unexpected connection error:', errorMessage)
        
        // Safari-specific: Show helpful message for unexpected errors
        if (isSafari && (connector.name?.toLowerCase().includes('walletconnect') || connector.id?.toLowerCase().includes('walletconnect'))) {
          console.warn('💡 Safari Tip: If WalletConnect continues to fail, try using the browser wallet (MetaMask extension) instead.')
        }
      }
    }
  }
  

  // Helper function to get display name for connector
  const getConnectorDisplayName = (connector: Connector | null | undefined): string => {
    if (!connector?.name) return 'Wallet'
    const name = connector.name
    if (name === 'Injected' || name?.toLowerCase().includes('injected')) {
      return 'Browser Wallet'
    }
    return name
  }
  
  // Generate Farcaster deep link
  const getFarcasterDeepLink = () => {
    // Try Warpcast first, then fallback to Farcaster protocol
    const currentUrl = typeof window !== 'undefined' ? window.location.href : MINIAPP_URL
    // Warpcast deep link format
    return `warpcast://deeplink?url=${encodeURIComponent(currentUrl)}`
  }
  
  // Generate QR code data URL (simple implementation)
  const generateQRCode = (text: string) => {
    // For now, we'll use a QR code API service
    // In production, you might want to use a library like qrcode.react
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  }

  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
    const inFarcaster = isFarcasterContext()
    setIsInFarcaster(inFarcaster)
    
    // Debug: Log available connectors
    if (typeof window !== 'undefined') {
      console.log('Available connectors:', connectors.map(c => ({ name: c.name, id: c.id })))
      console.log('Farcaster connector:', farcasterConnector?.name)
      console.log('External connectors:', externalConnectors.map(c => c.name))
    }
  }, [])

  // Fetch ENS name when address changes
  useEffect(() => {
    if (!address || !isConnected) {
      setEnsName(null)
      return
    }

    // Fetch ENS name (ENS resolution works cross-chain, queries Ethereum mainnet)
    const fetchEnsName = async () => {
      try {
        // getEnsName automatically queries Ethereum mainnet for ENS resolution
        // This works regardless of which chain the wallet is connected to
        const name = await getEnsName(config, { 
          address: address as `0x${string}`
        })
        if (name) {
          setEnsName(name)
        } else {
          setEnsName(null)
        }
      } catch (error) {
        // ENS lookup failed (no ENS name or network error), just use address
        // This is expected for most addresses, so we silently fail
        setEnsName(null)
      }
    }

    fetchEnsName()
  }, [address, isConnected])

  // Auto-connect Farcaster wallet when inside the mini app while still allowing manual switches
  useEffect(() => {
    if (!mounted || autoConnectAttempted || isConnected) return
    if (!isInFarcaster || !farcasterConnector) return

    const attemptAutoConnect = async () => {
      try {
        setAutoConnectAttempted(true)
        await connectAsync({ connector: farcasterConnector })
      } catch (error) {
        console.warn('Auto Farcaster connect failed:', error)
      }
    }

    attemptAutoConnect()
  }, [mounted, isInFarcaster, farcasterConnector, connectAsync, autoConnectAttempted, isConnected])
  
  // Handle WalletConnect stale session errors and fatal socket errors globally
  // Safari-specific: Safari has known WebSocket issues with WalletConnect
  useEffect(() => {
    if (!mounted) return
    
    // Safari-specific: More aggressive cleanup for Safari/WalletConnect WebSocket issues
    const isSafariWalletConnect = isSafari && isConnected && connector?.id?.includes('walletconnect')
    
    // Set up global error handler for WalletConnect errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || String(event.error || '')
      const errorString = errorMessage.toLowerCase()
      
      const isStaleSession = errorString.includes('session topic doesn\'t exist') ||
        errorString.includes('no matching key') ||
        errorString.includes('session topic') ||
        // Additional patterns for WalletConnect v2
        (event.error?.code === 3000 && errorString.includes('unauthorized')) ||
        (event.error?.reason?.toLowerCase().includes('session topic')) ||
        (event.error?.reason?.toLowerCase().includes('no matching key'))
      
      const isFatalSocketError = errorString.includes('fatal socket error') ||
        errorString.includes('unauthorized: invalid key') ||
        errorString.includes('websocket connection closed') ||
        (errorString.includes('code: 3000') && errorString.includes('unauthorized'))
      
      // On Safari, be more aggressive about handling WebSocket errors
      if ((isStaleSession || isFatalSocketError) && isConnected && connector?.id?.includes('walletconnect')) {
        console.log(`Detected WalletConnect error (${isSafari ? 'Safari' : 'browser'}): stale session or fatal socket. Disconnecting...`)
        try {
          // Force disconnect even if socket is broken
          disconnect().catch(() => {
            // If disconnect fails, just clear storage
            console.warn('Disconnect failed, clearing storage directly')
          })
        } catch (e) {
          // Ignore disconnect errors
          console.warn('Error during disconnect:', e)
        }
        
        // Always clear WalletConnect storage
        if (typeof window !== 'undefined') {
          try {
            const wcKeys = Object.keys(localStorage).filter(key => 
              key.startsWith('wc@2:') || key.startsWith('walletconnect')
            )
            wcKeys.forEach(key => localStorage.removeItem(key))
            sessionStorage.removeItem('wallet_connected_this_session')
            console.log('WalletConnect storage cleared')
            
            // Safari-specific: If on Safari and socket is broken, suggest using browser wallet instead
            if (isSafari && isFatalSocketError) {
              console.warn('Safari WebSocket issue detected. Consider using browser wallet (MetaMask extension) instead of WalletConnect on Safari.')
            }
          } catch (e) {
            console.warn('Failed to clear WalletConnect storage:', e)
          }
        }
      }
    }
    
    // Also listen for console errors (WalletConnect logs fatal socket errors to console)
    // Safari-specific: More aggressive monitoring on Safari
    const originalConsoleError = console.error
    const handleConsoleError = (...args: any[]) => {
      const errorString = args.map(arg => String(arg)).join(' ').toLowerCase()
      const isFatalSocketError = errorString.includes('fatal socket error') ||
        errorString.includes('unauthorized: invalid key') ||
        (errorString.includes('code: 3000') && errorString.includes('unauthorized'))
      
      if (isFatalSocketError && isConnected && connector?.id?.includes('walletconnect')) {
        console.log(`Detected WalletConnect fatal socket error from console (${isSafari ? 'Safari' : 'browser'}). Disconnecting...`)
        // Clear storage and disconnect
        if (typeof window !== 'undefined') {
          try {
            const wcKeys = Object.keys(localStorage).filter(key => 
              key.startsWith('wc@2:') || key.startsWith('walletconnect')
            )
            wcKeys.forEach(key => localStorage.removeItem(key))
            sessionStorage.removeItem('wallet_connected_this_session')
            disconnect().catch(() => {})
            
            // Safari-specific: Log helpful message
            if (isSafari) {
              console.warn('💡 Safari WebSocket Tip: Safari has known issues with WalletConnect WebSockets. Try using the browser wallet (MetaMask extension) instead.')
            }
          } catch (e) {
            console.warn('Failed to handle WalletConnect error:', e)
          }
        }
      }
      
      // Still log the original error
      originalConsoleError.apply(console, args)
    }
    
    window.addEventListener('error', handleError)
    console.error = handleConsoleError
    
    return () => {
      window.removeEventListener('error', handleError)
      console.error = originalConsoleError
    }
  }, [mounted, isConnected, connector, disconnect, isSafari])

  // Mark connection in session storage (but don't auto-disconnect Farcaster)
  useEffect(() => {
    if (!mounted) return
    
    if (typeof window !== 'undefined' && isConnected) {
      const sessionKey = 'wallet_connected_this_session'
      sessionStorage.setItem(sessionKey, 'true')
    }
  }, [mounted, isConnected])
  

  // Auto-switch to required chain after connection
  useEffect(() => {
    if (!isConnected) {
      setIsAutoSwitching(false)
      return
    }

    if (!chainId || chainId === REQUIRED_CHAIN_ID || isAutoSwitching) {
      return
    }

    // Detect Safari/WalletConnect for longer delays
    const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    const isWalletConnect = connector?.id?.includes('walletConnect') || 
                            connector?.name?.toLowerCase().includes('walletconnect')
    const isSafariWalletConnect = isSafari && isWalletConnect

    let cancelled = false

    const attemptSwitch = async () => {
      setIsAutoSwitching(true)
      try {
        console.log(
          `Auto-switching from chain ${chainId} to ${REQUIRED_CHAIN_NAME} (${REQUIRED_CHAIN_ID})...`,
          { isSafari, isWalletConnect, isSafariWalletConnect }
        )
        
        // First, try to add the required chain
        await tryAddRequiredChain(REQUIRED_CHAIN_ID)
        
        // For Safari/WalletConnect, use longer delay
        const delay = isSafariWalletConnect ? 3000 : 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        
        // Then request the network switch
        await switchChain({ chainId: REQUIRED_CHAIN_ID })
        
        // For Safari/WalletConnect, wait longer to ensure switch completes
        if (isSafariWalletConnect) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          console.log('Safari/WalletConnect: Chain switch completed, waiting for confirmation...')
        }
        
        return
      } catch (error: any) {
        const message = (error?.message || '').toLowerCase()
        const code = error?.code
        const isChainMissing =
          message.includes('not configured') ||
          message.includes('unrecognized chain') ||
          message.includes('unknown chain') ||
          message.includes('chain not configured') ||
          code === 4902

        if (isChainMissing) {
          const added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
          if (added) {
            const delay = isSafariWalletConnect ? 3000 : 2000
            await new Promise((resolve) => setTimeout(resolve, delay))
            try {
              await switchChain({ chainId: REQUIRED_CHAIN_ID })
              return
            } catch (retryError) {
              console.warn('Switch failed after auto-adding network:', retryError)
            }
          }
        }

        console.log('Auto network switch via wagmi failed, attempting provider request...', error)
        try {
          const switched = await switchToRequiredChainViaProvider()
          if (switched) {
            return
          }
        } catch (providerError) {
          console.warn('Provider switch attempt failed:', providerError)
        }
      } finally {
        if (!cancelled) {
          setIsAutoSwitching(false)
        }
      }
    }

    // For Safari/WalletConnect, use longer initial delay
    const initialDelay = isSafariWalletConnect ? 1500 : 500
    const timeout = setTimeout(attemptSwitch, initialDelay)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [isConnected, chainId, switchChain, isAutoSwitching, connector])

  // Show consistent initial state on server and client
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Button
          disabled
          size="sm"
          className="gap-2 border-2 border-gray-700 bg-black text-white text-xs sm:text-sm"
        >
          <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Wallet</span>
        </Button>
      </div>
    )
  }

  // Connected state
  if (isConnected && address) {
    // Log the connected wallet for debugging
    if (typeof window !== 'undefined') {
      console.log('Connected wallet:', {
        address,
        connector: connector?.name,
        connectorId: connector?.id,
        isFarcaster: connector?.name?.toLowerCase().includes('farcaster'),
      })
    }

    return (
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 sm:px-3 sm:py-2">
            <Wallet className="h-3 w-3 text-brand-green sm:h-4 sm:w-4" />
            <span className="text-xs font-medium text-white sm:text-sm" title={`Full address: ${address}`}>
              {ensName || `${address.slice(0, 6)}...${address.slice(-4)}`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                console.log(`Disconnecting wallet... (${isSafari ? 'Safari' : 'browser'})`)
                
                // Always clear storage first (especially important for Safari/WalletConnect with socket errors)
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('wallet_connected_this_session')
                  
                  // Clear WalletConnect storage if it was WalletConnect
                  if (connector?.id?.includes('walletconnect')) {
                    try {
                      const wcKeys = Object.keys(localStorage).filter(key => 
                        key.startsWith('wc@2:') || key.startsWith('walletconnect')
                      )
                      wcKeys.forEach(key => localStorage.removeItem(key))
                      console.log('WalletConnect storage cleared')
                      
                      // Safari-specific: More aggressive cleanup
                      if (isSafari) {
                        // Also clear any related session data
                        try {
                          const allKeys = Object.keys(localStorage)
                          allKeys.forEach(key => {
                            if (key.toLowerCase().includes('wallet') || key.toLowerCase().includes('wc')) {
                              localStorage.removeItem(key)
                            }
                          })
                        } catch (e) {
                          // Ignore cleanup errors
                        }
                      }
                    } catch (e) {
                      console.warn('Failed to clear WalletConnect storage:', e)
                    }
                  }
                }
                
                // Try to disconnect (may fail if socket is broken, but storage is already cleared)
                // Safari-specific: Use shorter timeout for Safari since WebSocket is likely broken
                try {
                  if (isSafari && connector?.id?.includes('walletconnect')) {
                    // On Safari with WalletConnect, don't wait long - socket is likely broken
                    const disconnectPromise = disconnect()
                    const timeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Disconnect timeout')), 2000)
                    )
                    await Promise.race([disconnectPromise, timeoutPromise])
                  } else {
                    await disconnect()
                  }
                  console.log('Wallet disconnected successfully')
                } catch (disconnectError) {
                  console.warn('Disconnect call failed (storage already cleared):', disconnectError)
                  // Storage is already cleared, so the disconnect is effectively done
                  // Safari-specific: Always reload on Safari to reset state
                  if (isSafari || isConnected) {
                    console.log('Forcing state reset...')
                    window.location.reload()
                  }
                }
              } catch (error) {
                console.error('Error in disconnect handler:', error)
                // Last resort: clear everything and reload
                // Safari-specific: Always reload on Safari
                try {
                  if (typeof window !== 'undefined') {
                    sessionStorage.clear()
                    const wcKeys = Object.keys(localStorage).filter(key => 
                      key.startsWith('wc@2:') || key.startsWith('walletconnect')
                    )
                    wcKeys.forEach(key => localStorage.removeItem(key))
                    window.location.reload()
                  }
                } catch (e) {
                  console.error('Failed to recover from disconnect error:', e)
                }
              }
            }}
            className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
          >
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>

        {/* Farcaster QR Code Modal */}
        {showFarcasterQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6">
              <button
                onClick={() => setShowFarcasterQR(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="text-center">
                <QrCode className="mx-auto mb-4 h-12 w-12 text-brand-green" />
                <h3 className="mb-2 text-xl font-bold text-white">Open in Farcaster</h3>
                <p className="mb-6 text-sm text-gray-400">
                  Scan this QR code with your Farcaster app (Warpcast) to connect your wallet
                </p>
                
                <div className="mb-6 flex justify-center">
                  <img
                    src={generateQRCode(MINIAPP_URL)}
                    alt="Farcaster QR Code"
                    className="rounded-lg border-2 border-gray-700"
                  />
                </div>
                
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      const deepLink = getFarcasterDeepLink()
                      window.location.href = deepLink
                    }}
                    className="w-full bg-brand-green text-black hover:bg-brand-green/90"
                  >
                    Open in Warpcast
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(MINIAPP_URL)
                      alert('Link copied! Paste it in Warpcast to open the app.')
                    }}
                    className="w-full border-gray-700 text-white hover:bg-gray-800"
                  >
                    Copy Link
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowFarcasterQR(false)}
                    className="w-full border-gray-700 text-gray-400 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                </div>
                
                <p className="mt-4 text-xs text-gray-500">
                  Or use another wallet option below
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Not connected - show connection options
  // According to Farcaster docs: show all available connectors from wagmi
  // externalConnectors already includes Farcaster if in Farcaster context
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Show all available connectors (matches Farcaster docs pattern) */}
        {externalConnectors.length > 0 ? (
          externalConnectors.map((connector, index) => (
            <Button
              key={connector.uid}
              size="sm"
              onClick={() => handleConnect(connector)}
              disabled={isPending}
              className={index === 0
                ? "gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
                : "gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
              }
            >
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">
                {isPending ? 'Connecting...' : getConnectorDisplayName(connector)}
              </span>
              <span className="sm:hidden">
                {isPending ? '...' : (getConnectorDisplayName(connector) === 'Browser Wallet' ? 'Browser' : getConnectorDisplayName(connector))}
              </span>
            </Button>
          ))
        ) : (
          <Button
            size="sm"
            disabled
            className="gap-2 bg-gray-700 text-gray-400 text-xs sm:text-sm"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>No Wallet Available</span>
          </Button>
        )}
      </div>

      {/* Farcaster QR Code Modal */}
      {showFarcasterQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6">
            <button
              onClick={() => setShowFarcasterQR(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="text-center">
              <QrCode className="mx-auto mb-4 h-12 w-12 text-brand-green" />
              <h3 className="mb-2 text-xl font-bold text-white">Open in Farcaster</h3>
              <p className="mb-6 text-sm text-gray-400">
                Scan this QR code with your Farcaster app (Warpcast) to connect your wallet
              </p>
              
              <div className="mb-6 flex justify-center">
                <img
                  src={generateQRCode(MINIAPP_URL)}
                  alt="Farcaster QR Code"
                  className="rounded-lg border-2 border-gray-700"
                />
              </div>
              
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    const deepLink = getFarcasterDeepLink()
                    window.location.href = deepLink
                  }}
                  className="w-full bg-brand-green text-black hover:bg-brand-green/90"
                >
                  Open in Warpcast
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(MINIAPP_URL)
                    alert('Link copied! Paste it in Warpcast to open the app.')
                  }}
                  className="w-full border-gray-700 text-white hover:bg-gray-800"
                >
                  Copy Link
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowFarcasterQR(false)}
                  className="w-full border-gray-700 text-gray-400 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
              
              <p className="mt-4 text-xs text-gray-500">
                Or use another wallet option below
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

