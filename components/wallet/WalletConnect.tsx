'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut, ChevronDown, QrCode, X } from 'lucide-react'
import { isFarcasterContext, MINIAPP_URL } from '@/lib/farcaster'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { tryAddRequiredChain } from '@/lib/network'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { connectAsync, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const [showOtherWallets, setShowOtherWallets] = useState(false)
  const [hasSwitchedNetwork, setHasSwitchedNetwork] = useState(false)
  const [showFarcasterQR, setShowFarcasterQR] = useState(false)

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

  // Prioritize WalletConnect for in-app browsers (mobile webviews, etc.)
  const externalConnectors = connectors
    .filter(
      c => {
        const name = c.name.toLowerCase()
        const id = c.id?.toLowerCase() || ''
        return !name.includes('farcaster') &&
          !name.includes('frame') &&
          !name.includes('miniapp') &&
          !id.includes('farcaster') &&
          !id.includes('frame') &&
          !id.includes('miniapp') &&
          !name.includes('metamask') &&
          !id.includes('metamask')
      }
    )
    .sort((a, b) => {
      // If in-app browser, prioritize WalletConnect
      if (isInAppBrowser) {
        const aIsWC = a.name.toLowerCase().includes('walletconnect') || a.id?.toLowerCase().includes('walletconnect')
        const bIsWC = b.name.toLowerCase().includes('walletconnect') || b.id?.toLowerCase().includes('walletconnect')
        if (aIsWC && !bIsWC) return -1
        if (!aIsWC && bIsWC) return 1
      }
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
      
      await connectAsync({ connector })
      setShowOtherWallets(false)
    } catch (error) {
      console.error('Wallet connect failed:', error)
    }
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
    setIsInFarcaster(isFarcasterContext())
  }, [])

  // Auto-switch to required chain after connection
  useEffect(() => {
    if (isConnected && chainId !== REQUIRED_CHAIN_ID && !hasSwitchedNetwork) {
      const attemptSwitch = async () => {
        try {
          console.log(
            `Auto-switching from chain ${chainId} to ${REQUIRED_CHAIN_NAME} (${REQUIRED_CHAIN_ID})...`
          )

          await switchChain({ chainId: REQUIRED_CHAIN_ID })
          setHasSwitchedNetwork(true)
        } catch (error: any) {
          const message = (error?.message || '').toLowerCase()
          const code = error?.code
          const isChainMissing =
            message.includes('not configured') ||
            message.includes('unrecognized chain') ||
            message.includes('unknown chain') ||
            code === 4902

          if (isChainMissing) {
            const added = await tryAddRequiredChain()
            if (added) {
              // Wait for wallet to process the add request
              await new Promise(resolve => setTimeout(resolve, 1000))
              try {
                await switchChain({ chainId: REQUIRED_CHAIN_ID })
                setHasSwitchedNetwork(true)
                return
              } catch (retryError) {
                console.warn('Switch failed after auto-adding network:', retryError)
              }
            }
          }

          console.log('Auto network switch failed or was rejected:', error)
          // Don't keep retrying automatically to avoid spamming the user
          setHasSwitchedNetwork(true) // Mark as "attempted" to stop loop
        }
      }

      // Wait a bit after connection before attempting switch
      const timeout = setTimeout(attemptSwitch, 1000)
      return () => clearTimeout(timeout)
    } else if (chainId === REQUIRED_CHAIN_ID) {
      setHasSwitchedNetwork(true)
    }
  }, [isConnected, chainId, hasSwitchedNetwork, switchChain])

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
            <span className="text-xs font-medium text-white sm:text-sm" title={`Full address: ${address}\nConnector: ${connector?.name || 'Unknown'}`}>
              {connector?.name?.toLowerCase().includes('farcaster') ? 'Farcaster' : connector?.name || 'Wallet'}: {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          {externalConnectors.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOtherWallets(!showOtherWallets)}
              className="gap-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showOtherWallets ? 'rotate-180' : ''}`} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
            className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
          >
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>

        {/* External wallet options dropdown */}
        {showOtherWallets && externalConnectors.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-lg sm:left-auto sm:right-0">
            <p className="mb-2 text-xs font-medium text-gray-400">Connect External Wallet</p>
            {externalConnectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                disabled={isPending}
                className="w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Not connected - show connection options
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Primary: Farcaster wallet if in Farcaster context, otherwise first external */}
        {farcasterConnector ? (
          <Button
            size="sm"
            onClick={() => handleConnect(farcasterConnector)}
            disabled={isPending}
            className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">
              {isPending ? 'Connecting...' : isInFarcaster ? 'Connect Farcaster Wallet' : 'Open in Farcaster'}
            </span>
            <span className="sm:hidden">
              {isPending ? '...' : isInFarcaster ? 'Farcaster' : 'Farcaster'}
            </span>
          </Button>
        ) : externalConnectors.length > 0 ? (
          <Button
            size="sm"
            onClick={() => handleConnect(externalConnectors[0])}
            disabled={isPending}
            className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">
              {isPending ? 'Connecting...' : `Connect ${externalConnectors[0].name === 'Injected' ? 'Browser Wallet' : externalConnectors[0].name}`}
            </span>
            <span className="sm:hidden">
              {isPending ? '...' : (externalConnectors[0].name === 'Injected' ? 'Browser' : externalConnectors[0].name)}
            </span>
          </Button>
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

        {/* Show other wallets button if multiple options */}
        {externalConnectors.length > (isInFarcaster && farcasterConnector ? 0 : 1) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOtherWallets(!showOtherWallets)}
            className="gap-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showOtherWallets ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>

      {/* External wallet options dropdown */}
      {showOtherWallets && (
        <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-lg sm:left-auto sm:right-0">
          <p className="mb-2 text-xs font-medium text-gray-400">
            {isInFarcaster ? 'Other Wallets' : 'Choose Wallet'}
          </p>
          {isInFarcaster && farcasterConnector && (
            <button
              onClick={() => handleConnect(farcasterConnector)}
              disabled={isPending}
              className="w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Farcaster Wallet
            </button>
          )}
          {externalConnectors.slice(isInFarcaster && farcasterConnector ? 0 : 1).map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              disabled={isPending}
              className="w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {connector.name === 'Injected' ? 'Browser Wallet' : connector.name}
            </button>
          ))}
        </div>
      )}

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
