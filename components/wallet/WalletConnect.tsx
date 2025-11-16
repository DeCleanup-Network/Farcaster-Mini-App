'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { isFarcasterContext } from '@/lib/farcaster'

const CELO_SEPOLIA_CHAIN_ID = 11142220

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
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
  
  const externalConnectors = connectors.filter(
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
  // Note: farcasterMiniApp() connector should auto-connect if wallet is already connected in Farcaster
  // This effect is a fallback to ensure connection happens
  useEffect(() => {
    if (mounted && isInFarcaster && !isConnected && farcasterConnector) {
      const timeout = setTimeout(() => {
        const attempt = async () => {
          if (!isConnected && farcasterConnector) {
            try {
              console.log('Auto-connecting Farcaster wallet...')
              await connectAsync({ connector: farcasterConnector })
            } catch (error) {
              console.error('Auto-connect failed:', error)
            }
          }
        }

        attempt()
      }, 500)

      return () => clearTimeout(timeout)
    }
  }, [mounted, isInFarcaster, isConnected, farcasterConnector, connectAsync])

  // Auto-switch to Celo Sepolia after connection
  useEffect(() => {
    if (isConnected && chainId !== CELO_SEPOLIA_CHAIN_ID && !hasSwitchedNetwork) {
      const attemptSwitch = async () => {
        try {
          console.log(`Auto-switching from chain ${chainId} to Celo Sepolia (${CELO_SEPOLIA_CHAIN_ID})...`)
          await switchChain({ chainId: CELO_SEPOLIA_CHAIN_ID })
          setHasSwitchedNetwork(true)
        } catch (error: any) {
          console.log('Auto network switch failed or was rejected:', error)
          // Don't set hasSwitchedNetwork so user can try again if needed
        }
      }
      // Wait a bit after connection before attempting switch
      const timeout = setTimeout(attemptSwitch, 1000)
      return () => clearTimeout(timeout)
    } else if (chainId === CELO_SEPOLIA_CHAIN_ID) {
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
    return (
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 sm:px-3 sm:py-2">
            <Wallet className="h-3 w-3 text-brand-green sm:h-4 sm:w-4" />
            <span className="text-xs font-medium text-white sm:text-sm">
              {isInFarcaster ? 'Farcaster' : 'Wallet'}: {address.slice(0, 4)}...{address.slice(-4)}
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
