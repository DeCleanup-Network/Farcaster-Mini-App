'use client'

import { useEffect, useState, useCallback } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useSignIn } from '@farcaster/auth-kit'
import { isFarcaster } from '@/lib/farcaster-detection'
import { Button } from '@/components/ui/button'
import { Wallet, X } from 'lucide-react'
import { AuthKitProvider } from './AuthKitProvider'

interface SmartWalletConnectProps {
  /** Called when successfully connected */
  onConnect?: (address: string) => void
  /** Custom button text */
  buttonText?: string
}

// Farcaster miniapp URL for redirect after authentication
const FARCASTER_MINIAPP_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

/**
 * Smart Wallet Connect Component
 *
 * Shows a single "Log In" button that opens a modal with:
 * - Sign in with Farcaster (SIWF) option for web users
 * - Standard wallet options via RainbowKit
 */
export function SmartWalletConnect({
  onConnect,
  buttonText = 'Log In',
}: SmartWalletConnectProps) {
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const { address, isConnected } = useAccount()

  useEffect(() => {
    setMounted(true)
    setIsInFarcaster(isFarcaster())
  }, [])

  useEffect(() => {
    if (isConnected && address) {
      onConnect?.(address)
      setShowModal(false)
    }
  }, [isConnected, address, onConnect])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-md">
        <Button size="lg" disabled className="w-full gap-2 bg-brand-green text-black">
          <Wallet className="h-5 w-5" />
          {buttonText}
        </Button>
      </div>
    )
  }

  if (isConnected) {
    return null
  }

  return (
    <>
      <div className="mx-auto max-w-md">
        <Button
          size="lg"
          onClick={() => setShowModal(true)}
          className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
        >
          <Wallet className="h-5 w-5" />
          {buttonText}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground text-center">
          Connect to get started
        </p>
      </div>

      {/* Login Modal */}
      {showModal && (
        <AuthKitProvider>
          <LoginModal
            isInFarcaster={isInFarcaster}
            onClose={() => setShowModal(false)}
          />
        </AuthKitProvider>
      )}
    </>
  )
}

// Separate modal component that uses AuthKit hooks
function LoginModal({
  isInFarcaster,
  onClose,
}: {
  isInFarcaster: boolean
  onClose: () => void
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
          {/* Farcaster option - only show on web */}
          {!isInFarcaster && (
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
          )}

          {/* Wallet options via RainbowKit */}
          <ConnectButton.Custom>
            {({ openConnectModal, mounted: rkMounted }) => {
              const ready = rkMounted
              return (
                <button
                  onClick={() => { onClose(); openConnectModal(); }}
                  disabled={!ready}
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
              )
            }}
          </ConnectButton.Custom>
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

export default SmartWalletConnect
