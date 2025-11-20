'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { isFarcasterContext } from '@/lib/farcaster'
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
          !id.includes('miniapp')
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
      await connectAsync({ connector })
      setShowOtherWallets(false)
    } catch (error) {
      console.error('Wallet connect failed:', error)
    }
  }

  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
    setIsInFarcaster(isFarcasterContext())
  }, [])

  // Auto-connect Farcaster wallet when in Farcaster context
  // BUT: Don't auto-connect if user has already manually connected a different wallet
  // Note: farcasterMiniApp() connector should auto-connect if wallet is already connected in Farcaster
  // This effect is a fallback to ensure connection happens
  useEffect(() => {
    if (!mounted || !isInFarcaster || isConnected || isPending || !farcasterConnector) {
      return
    }

    // Check if user has manually connected a non-Farcaster wallet
    // If so, don't auto-connect Farcaster wallet
    const currentConnector = connector
    if (currentConnector && currentConnector.id !== farcasterConnector.id) {
      console.log('User has manually connected a different wallet, skipping Farcaster auto-connect')
      return
    }

    const attemptConnect = async () => {
      try {
        console.log('Auto-connecting Farcaster wallet...')
        await connectAsync({ connector: farcasterConnector })
      } catch (error: any) {
        // Ignore user rejection or if already processing
        if (error?.code !== 4001 && !error?.message?.includes('already pending')) {
          console.error('Auto-connect failed:', error)
        }
      }
    }

    // Small delay to allow initial state to settle
    const timer = setTimeout(attemptConnect, 500)
    return () => clearTimeout(timer)
  }, [mounted, isInFarcaster, isConnected, isPending, farcasterConnector, connectAsync, connector])

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
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-lg">
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
        {isInFarcaster && farcasterConnector ? (
          <Button
            size="sm"
            onClick={() => handleConnect(farcasterConnector)}
            disabled={isPending}
            className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">
              {isPending ? 'Connecting...' : 'Connect Farcaster Wallet'}
            </span>
            <span className="sm:hidden">
              {isPending ? '...' : 'Farcaster'}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-lg">
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
    </div>
  )
}
