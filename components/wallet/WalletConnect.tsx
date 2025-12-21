'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAccount, useChainId, useDisconnect, useConnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useSignIn } from '@farcaster/auth-kit'
import { Wallet, LogOut, ChevronDown, X } from 'lucide-react'
import { REQUIRED_CHAIN_ID } from '@/lib/wagmi'
import { Button } from '@/components/ui/button'
import { isFarcaster } from '@/lib/farcaster-detection'
import { AuthKitProvider } from '@/components/auth/AuthKitProvider'

// Farcaster miniapp URL for redirect after authentication
const FARCASTER_MINIAPP_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

/**
 * WalletConnect component using RainbowKit + Farcaster Auth
 *
 * Features:
 * - Custom styled button matching brand design (green with black text)
 * - Shows modal with Farcaster SIWF + wallet options on web
 * - Direct wallet connection in Farcaster environment
 * - Automatic chain switching via RainbowKit
 */
export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const { isConnected, connector, address } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const { connect, connectors, isPending } = useConnect()
  const previousConnectedRef = useRef(false)
  const previousAddressRef = useRef<string | undefined>(undefined)

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    setIsInFarcaster(isFarcaster())

    // Log connector status for debugging
    const isFarcasterEnv =
      typeof window !== 'undefined' && (
        window.location.search.includes('fc_wallet=1') ||
        (window as any).farcaster?.sdk !== undefined
      )

    if (isFarcasterEnv) {
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

  // Close modal when connected
  useEffect(() => {
    if (isConnected && address) {
      setShowLoginModal(false)
    }
  }, [isConnected, address])

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
      setForceUpdate(prev => prev + 1)

      // Small delay to ensure state propagates
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

  // Store openConnectModal ref for use outside render prop
  const [openConnectModalFn, setOpenConnectModalFn] = useState<(() => void) | null>(null)

  return (
    <>
      {/* Login Modal - Rendered outside header for proper centering */}
      {showLoginModal && openConnectModalFn && (
        <AuthKitProvider>
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onOpenWalletModal={() => {
              setShowLoginModal(false)
              openConnectModalFn()
            }}
          />
        </AuthKitProvider>
      )}

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
            // Store openConnectModal for use outside this render prop
            if (openConnectModal && openConnectModalFn !== openConnectModal) {
              // Use setTimeout to avoid state update during render
              setTimeout(() => setOpenConnectModalFn(() => openConnectModal), 0)
            }

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

                // In Farcaster, use direct wallet connection
                if (isInFarcaster) {
                  openConnectModal()
                  return
                }

                // On web, show our custom modal with Farcaster option
                setShowLoginModal(true)
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
            Base Sepolia
          </span>
        </div>
      </div>
    </>
  )
}

// Login Modal with Farcaster SIWF + Wallet options
function LoginModal({
  onClose,
  onOpenWalletModal,
}: {
  onClose: () => void
  onOpenWalletModal: () => void
}) {
  const [showQR, setShowQR] = useState(false)

  const {
    signIn,
    connect,
    url,
    isSuccess,
    isError,
    error,
    channelToken,
  } = useSignIn({
    onSuccess: (data) => {
      console.log('[LoginModal] SIWF success:', data)
      // Redirect to Farcaster miniapp after successful auth
      const redirectUrl = data.custody
        ? `${FARCASTER_MINIAPP_URL}?ref=${data.custody}`
        : FARCASTER_MINIAPP_URL
      window.location.href = redirectUrl
    },
    onError: (err) => {
      console.error('[LoginModal] SIWF error:', err)
    },
  })

  const handleFarcasterLogin = useCallback(async () => {
    console.log('[LoginModal] Starting Farcaster login...')
    try {
      if (!channelToken) {
        await connect()
      }
      await signIn()
      setShowQR(true)
    } catch (err) {
      console.error('[LoginModal] Error:', err)
    }
  }, [connect, signIn, channelToken])

  // Show QR code if URL is available
  if (showQR && url && !isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl p-6">
          <button
            onClick={() => { setShowQR(false); onClose(); }}
            className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-foreground">Scan with Warpcast</h2>
            <p className="text-sm text-muted-foreground">
              Open Warpcast and scan this QR code
            </p>
          </div>

          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
                alt="Sign in with Farcaster"
                className="w-48 h-48"
              />
            </div>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 text-center bg-brand-green hover:bg-[#4a9a26] text-black font-medium rounded-xl transition-colors"
          >
            Open in Warpcast
          </a>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          <p className="text-center text-red-500 mb-4">
            Sign in failed{error?.message ? `: ${error.message}` : ''}
          </p>
          <button
            onClick={handleFarcasterLogin}
            className="w-full py-3 bg-brand-green hover:bg-[#4a9a26] text-black font-medium rounded-xl"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Main modal with options
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-foreground">Connect</h2>
          <p className="text-sm text-muted-foreground">
            Choose how to connect
          </p>
        </div>

        <div className="space-y-3">
          {/* Farcaster option */}
          <button
            onClick={handleFarcasterLogin}
            className="w-full flex items-center gap-3 p-4 bg-[#855DCD] hover:bg-[#7349b8] text-white rounded-xl transition-colors"
          >
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <FarcasterIcon className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-medium">Sign in with Farcaster</p>
              <p className="text-xs text-white/70">Scan QR with Warpcast</p>
            </div>
          </button>

          {/* Wallet option */}
          <button
            onClick={onOpenWalletModal}
            className="w-full flex items-center gap-3 p-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-colors"
          >
            <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-brand-green" />
            </div>
            <div className="text-left">
              <p className="font-medium">Connect Wallet</p>
              <p className="text-xs text-muted-foreground">MetaMask, WalletConnect, etc.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// Farcaster icon
function FarcasterIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" fill="currentColor"/>
      <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z" fill="currentColor"/>
      <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.444H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z" fill="currentColor"/>
    </svg>
  )
}
