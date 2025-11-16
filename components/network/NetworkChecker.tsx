'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { DEFAULT_CHAIN_ID } from '@/lib/wagmi'

const CELO_SEPOLIA_CHAIN_ID = 11142220

export function NetworkChecker() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    if (isConnected && chainId !== CELO_SEPOLIA_CHAIN_ID) {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [isConnected, chainId])

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: CELO_SEPOLIA_CHAIN_ID })
    } catch (error: any) {
      console.error('Failed to switch network:', error)
      // Show manual instructions if switch fails
      alert(
        `Please switch to Celo Sepolia Testnet manually in MetaMask:\n\n` +
        `1. Click the network dropdown in MetaMask\n` +
        `2. Click "Add Network" or "Add a network manually"\n` +
        `3. Enter these details:\n` +
        `   - Network Name: Celo Sepolia Testnet\n` +
        `   - RPC URL: https://forno.celo-sepolia.celo-testnet.org\n` +
        `   - Chain ID: 11142220\n` +
        `   - Currency Symbol: CELO\n` +
        `   - Block Explorer: https://sepolia.celoscan.io\n` +
        `4. Click "Save" and switch to the network`
      )
    }
  }

  if (!isConnected || !showWarning) {
    return null
  }

  const isWrongNetwork = chainId !== CELO_SEPOLIA_CHAIN_ID

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
              <span className="font-mono font-semibold">Celo Sepolia Testnet</span> to use this app.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSwitchNetwork}
                disabled={isPending}
                size="sm"
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {isPending ? 'Switching...' : 'Switch to Celo Sepolia'}
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
              Current network: Chain ID {chainId} | Required: Chain ID {CELO_SEPOLIA_CHAIN_ID}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

