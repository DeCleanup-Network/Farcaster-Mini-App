'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { AlertCircle } from 'lucide-react'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
} from '@/lib/wagmi'

export function NetworkChecker() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID) {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [isConnected, chainId])

  if (!isConnected || !showWarning) {
    return null
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-50 mx-auto max-w-4xl px-4 sm:top-20">
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm text-yellow-400">
              Please open your wallet on <span className="font-mono font-semibold">{REQUIRED_CHAIN_NAME}</span> and connect
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

