'use client'

import { useAccount, useChainId } from 'wagmi'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { useChainModal } from '@rainbow-me/rainbowkit'

/**
 * NetworkBlockingScreen - Blocks app usage when on wrong network
 * 
 * This component should be used to block app actions when the user
 * is connected but on the wrong network. It provides a clear, focused
 * message to switch networks.
 */
export function NetworkBlockingScreen() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { openChainModal } = useChainModal()
  
  // Only show if connected and on wrong network
  const isWrongNetwork = isConnected && typeof chainId === 'number' && chainId !== REQUIRED_CHAIN_ID
  
  if (!isWrongNetwork) {
    return null
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
          <Button
            onClick={openChainModal}
            className="w-full bg-brand-green text-black hover:bg-brand-green/90"
            size="lg"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            Switch to {REQUIRED_CHAIN_NAME}
          </Button>
          
          <p className="text-xs text-gray-500">
            You won't be able to use the app until you switch networks.
          </p>
        </div>
      </div>
    </div>
  )
}

