'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { getAccount } from 'wagmi/actions'
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getWagmiConfig, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { attemptSwitchToRequiredChain } from '@/lib/network'

/**
 * NetworkBlockingScreen - Blocks app usage when on wrong network
 * 
 * This component should be used to block app actions when the user
 * is connected but on the wrong network. It provides a clear, focused
 * message to switch networks.
 * 
 * IMPORTANT: In Farcaster Mini Apps, programmatic chain switching is NOT allowed.
 * The wallet_switchEthereumChain method is ignored or rejected silently.
 * We must show instructions instead of a switch button.
 */
export function NetworkBlockingScreen() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { isMiniApp } = useFarcaster()
  const [switching, setSwitching] = useState(false)

  // Detect Farcaster environment (check both hook and window.farcaster as fallback)
  const isFarcaster = isMiniApp || (
    typeof window !== 'undefined' &&
    (window as any).farcaster !== undefined
  )

  // In iframe/embed, programmatic switch often fails; prioritize "Open in new tab"
  const inIframe = typeof window !== 'undefined' && window.self !== window.top

  // Only show if connected and on wrong network
  const isWrongNetwork = isConnected && typeof chainId === 'number' && chainId !== REQUIRED_CHAIN_ID

  if (!isWrongNetwork) {
    return null
  }

  const handleSwitchClick = async () => {
    console.warn('[NetworkBlockingScreen] handleSwitchClick: isFarcaster=', isFarcaster, 'inIframe=', inIframe)
    setSwitching(true)
    try {
      const account = await getAccount(getWagmiConfig())
      const conn = (account as any)?.connector
      console.warn('[NetworkBlockingScreen] hasWindowEthereum=', !!(typeof window !== 'undefined' && (window as any)?.ethereum), 'connectorId=', conn?.id ?? conn?.name)
      const { success } = await attemptSwitchToRequiredChain()
      console.warn('[NetworkBlockingScreen] attemptSwitchToRequiredChain returned', { success })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/95 backdrop-blur-sm safe-area-inset">
      <div className="mx-4 w-full max-w-md rounded-lg border-2 border-yellow-500/50 bg-gray-900 p-6 text-center shadow-2xl">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-yellow-500/20 p-4">
            <AlertCircle className="h-12 w-12 text-yellow-500" />
          </div>
        </div>
        
        <h2 className="mb-2 text-2xl font-bold uppercase tracking-wide text-white">
          Wrong Network
        </h2>
        
        <p className="mb-4 text-gray-300">
          Please switch to <span className="font-semibold text-yellow-400">{REQUIRED_CHAIN_NAME}</span> to continue using DeCleanup Rewards.
        </p>
        
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-left">
          <p className="mb-2 text-sm font-semibold text-gray-400">Current Network:</p>
          <p className="font-mono text-sm text-white">
            Chain ID: {chainId}
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-400">Required Network:</p>
          <p className="font-mono text-sm text-white">
            {REQUIRED_CHAIN_NAME} (Chain ID: {REQUIRED_CHAIN_ID})
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          {isFarcaster ? (
            // Farcaster: Cannot switch chains programmatically - show instructions
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm text-gray-300 text-center">
                This app requires <b className="text-yellow-400">{REQUIRED_CHAIN_NAME}</b>.<br />
                <br />
                Please switch networks in your wallet settings outside of Farcaster, then reopen the app.
              </p>
            </div>
          ) : (
            // Web: Can switch chains programmatically - show button(s)
            <>
              {inIframe ? (
                // In iframe/embed: prioritize "Open in new tab" (switch often fails here)
                <>
                  <p className="text-xs text-gray-500">
                    Opening in a new tab often works when this app is embedded.
                  </p>
                  <Button
                    onClick={() => { try { window.open(window.location.href, '_blank') } catch (_) {} }}
                    className="w-full bg-brand-green text-black hover:bg-brand-green/90"
                    size="lg"
                  >
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Open in new tab
                  </Button>
                  <Button
                    onClick={handleSwitchClick}
                    disabled={switching}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-200 hover:bg-gray-800"
                    size="lg"
                  >
                    {switching ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Switching…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5" />
                        Try switch here
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleSwitchClick}
                    disabled={switching}
                    className="w-full bg-brand-green text-black hover:bg-brand-green/90"
                    size="lg"
                  >
                    {switching ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Switching…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5" />
                        Switch to {REQUIRED_CHAIN_NAME}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">
                    You won't be able to use the app until you switch networks.
                  </p>
                  <button
                    type="button"
                    onClick={() => { try { window.open(window.location.href, '_blank') } catch (_) {} }}
                    className="text-xs text-yellow-400/90 underline hover:text-yellow-300"
                  >
                    Open in new tab
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

