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
import { tryAddRequiredChain } from '@/lib/network'
const NATIVE_SYMBOL = 'ETH'
const NETWORK_DETAILS = [
  `Network Name: ${REQUIRED_CHAIN_NAME}`,
  `RPC URL: ${REQUIRED_RPC_URL}`,
  `Chain ID: ${REQUIRED_CHAIN_ID}`,
  `Currency Symbol: ${NATIVE_SYMBOL}`,
  `Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}`,
].join('\n')

export function NetworkChecker() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const [showWarning, setShowWarning] = useState(false)
  const [isAddingNetwork, setIsAddingNetwork] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [autoSwitchAttempted, setAutoSwitchAttempted] = useState(false)

  // Automatically attempt to switch when wrong network is detected
  useEffect(() => {
    if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID && !autoSwitchAttempted && !isPending) {
      setShowWarning(true)
      
      // Auto-switch after a brief delay to show the banner
      const autoSwitchTimer = setTimeout(async () => {
        try {
          setAutoSwitchAttempted(true)
          console.log('NetworkChecker: Auto-switching to', REQUIRED_CHAIN_NAME)
          
          // First try to add the chain if needed
          const added = await tryAddRequiredChain()
          if (added) {
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
          
          // Then attempt to switch
          await switchChain({ chainId: REQUIRED_CHAIN_ID })
        } catch (error: any) {
          console.warn('NetworkChecker: Auto-switch failed, user may need to switch manually:', error)
          // Don't reset autoSwitchAttempted - let user see the banner and switch manually
        }
      }, 1000) // Wait 1 second before auto-switching
      
      return () => clearTimeout(autoSwitchTimer)
    } else if (isConnected && chainId === REQUIRED_CHAIN_ID) {
      setShowWarning(false)
      setAutoSwitchAttempted(false) // Reset when on correct chain
    } else {
      setShowWarning(false)
    }
  }, [isConnected, chainId, autoSwitchAttempted, isPending, switchChain])

  const handleSwitchNetwork = async () => {
    try {
      setAutoSwitchAttempted(true) // Prevent auto-switch from interfering
      
      // First try to add the chain if needed
      const added = await tryAddRequiredChain()
      if (added) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      
      await switchChain({ chainId: REQUIRED_CHAIN_ID })
    } catch (error: any) {
      console.error('Failed to switch network:', error)
      const message = (error?.message || '').toLowerCase()
      const requiresImport =
        message.includes('not configured') ||
        message.includes('unrecognized chain') ||
        message.includes('unknown chain') ||
        error?.code === 4902

      if (requiresImport) {
        const added = await tryAddRequiredChain()
        if (added) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          try {
            await switchChain({ chainId: REQUIRED_CHAIN_ID })
            return
          } catch (retryError) {
            console.warn('Switch failed after adding network:', retryError)
          }
        }
      }

      // Show manual instructions if switch fails
      alert(
        `Please switch to ${REQUIRED_CHAIN_NAME} manually:\n\n${NETWORK_DETAILS}`
      )
    }
  }

  const handleAddNetwork = async () => {
    if (isAddingNetwork) return
    setIsAddingNetwork(true)
    try {
      const added = await tryAddRequiredChain()
      if (added) {
        alert(`${REQUIRED_CHAIN_NAME} has been added to your wallet. Approve the prompt in your wallet and then tap "Switch Network".`)
      } else {
        alert(
          `We couldn't add ${REQUIRED_CHAIN_NAME} automatically. Please add it manually:\n\n${NETWORK_DETAILS}`
        )
      }
    } finally {
      setIsAddingNetwork(false)
    }
  }

  const handleCopyDetails = async () => {
    try {
      await navigator.clipboard.writeText(NETWORK_DETAILS)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      alert(`Copy failed. Details:\n\n${NETWORK_DETAILS}`)
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
              {isPending ? (
                <>Switching to <span className="font-mono font-semibold">{REQUIRED_CHAIN_NAME}</span> automatically...</>
              ) : autoSwitchAttempted ? (
                <>Auto-switch failed. Please switch to <span className="font-mono font-semibold">{REQUIRED_CHAIN_NAME}</span> manually.</>
              ) : (
                <>Switching to <span className="font-mono font-semibold">{REQUIRED_CHAIN_NAME}</span> automatically...</>
              )}
            </p>
            {!isPending && (
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
                  onClick={handleAddNetwork}
                  disabled={isAddingNetwork}
                  variant="secondary"
                  size="sm"
                  className="bg-black/40 text-white hover:bg-black/60"
                >
                  {isAddingNetwork ? 'Adding...' : 'Add Network'}
                </Button>
                <Button
                  onClick={handleCopyDetails}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300"
                >
                  {copySuccess ? 'Copied!' : 'Copy Details'}
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Current network: Chain ID {chainId} | Required: Chain ID {REQUIRED_CHAIN_ID}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

