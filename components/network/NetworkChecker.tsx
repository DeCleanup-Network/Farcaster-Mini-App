'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle } from 'lucide-react'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
} from '@/lib/wagmi'
const NATIVE_SYMBOL = 'ETH'

export function NetworkChecker() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    // Only show warning if chainId is valid and different from required
    // Don't show warning if chainId is 0, null, or undefined (still loading)
    if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID) {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [isConnected, chainId])

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: REQUIRED_CHAIN_ID })
    } catch (error: any) {
      console.error('Failed to switch network:', error)
      // Show manual instructions if switch fails
      alert(
        `Please switch to ${REQUIRED_CHAIN_NAME} manually in MetaMask:\n\n` +
        `1. Click the network dropdown in MetaMask\n` +
        `2. Click "Add Network" or "Add a network manually"\n` +
        `3. Enter these details:\n` +
        `   - Network Name: ${REQUIRED_CHAIN_NAME}\n` +
        `   - RPC URL: ${REQUIRED_RPC_URL}\n` +
        `   - Chain ID: ${REQUIRED_CHAIN_ID}\n` +
        `   - Currency Symbol: ${NATIVE_SYMBOL}\n` +
        `   - Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
        `4. Click "Save" and switch to the network`
      )
    }
  }

  if (!isConnected || !showWarning) {
    return null
  }

  const isWrongNetwork = chainId !== REQUIRED_CHAIN_ID

  if (!isWrongNetwork) {
    return null
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-50 mx-auto max-w-4xl px-4 sm:top-20">
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-400" />
          <div className="flex-1">
            <h3 className="mb-1 font-semibold text-yellow-400">Wrong Network</h3>
            <p className="mb-3 text-sm text-gray-300">
              You're connected to the wrong network. Please switch to{' '}
              <span className="font-mono font-semibold">{REQUIRED_CHAIN_NAME}</span> to use this app.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSwitchNetwork}
                disabled={isPending}
                size="sm"
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {isPending ? 'Switching...' : `Switch to ${REQUIRED_CHAIN_NAME}`}
              </Button>
              <Button
                onClick={() => setShowWarning(false)}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300"
              >
                Dismiss
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Current network: Chain ID {chainId} | Required: Chain ID {REQUIRED_CHAIN_ID}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

