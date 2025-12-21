'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { AlertCircle, Loader2, Check } from 'lucide-react'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
} from '@/lib/wagmi'

type SwitchState = 'idle' | 'switching' | 'success' | 'error'

export function NetworkChecker() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending, isSuccess, isError } = useSwitchChain()
  const [showWarning, setShowWarning] = useState(false)
  const [switchState, setSwitchState] = useState<SwitchState>('idle')
  const [autoSwitchAttempted, setAutoSwitchAttempted] = useState(false)

  // Check if on wrong chain
  const isWrongChain = isConnected && chainId && chainId !== REQUIRED_CHAIN_ID

  // Update switch state based on wagmi hooks
  useEffect(() => {
    if (isPending) {
      setSwitchState('switching')
    } else if (isSuccess) {
      setSwitchState('success')
      // Hide after success
      setTimeout(() => {
        setShowWarning(false)
        setSwitchState('idle')
      }, 1500)
    } else if (isError) {
      setSwitchState('error')
    }
  }, [isPending, isSuccess, isError])

  // Auto-attempt switch when on wrong chain (only once per connection)
  useEffect(() => {
    if (isWrongChain && !autoSwitchAttempted && switchChain) {
      setAutoSwitchAttempted(true)
      setShowWarning(true)

      // Auto-switch with a small delay to let the user see what's happening
      const timer = setTimeout(() => {
        try {
          switchChain({ chainId: REQUIRED_CHAIN_ID })
        } catch (error) {
          console.error('Auto-switch failed:', error)
        }
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [isWrongChain, autoSwitchAttempted, switchChain])

  // Reset auto-switch flag when chain changes correctly
  useEffect(() => {
    if (!isWrongChain) {
      setAutoSwitchAttempted(false)
    }
  }, [isWrongChain])

  // Show warning when on wrong chain
  useEffect(() => {
    if (isWrongChain) {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [isWrongChain])

  // Handle manual switch
  const handleSwitch = useCallback(() => {
    if (switchChain && switchState !== 'switching') {
      setSwitchState('switching')
      try {
        switchChain({ chainId: REQUIRED_CHAIN_ID })
      } catch (error) {
        console.error('Switch failed:', error)
        setSwitchState('error')
      }
    }
  }, [switchChain, switchState])

  if (!showWarning) {
    return null
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-50 mx-auto max-w-md px-4 sm:top-20 animate-in slide-in-from-top-2 duration-300">
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-3">
          {switchState === 'switching' ? (
            <Loader2 className="h-5 w-5 flex-shrink-0 text-brand-green animate-spin" />
          ) : switchState === 'success' ? (
            <Check className="h-5 w-5 flex-shrink-0 text-brand-green" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-brand-green" />
          )}
          <div className="flex-1 min-w-0">
            {switchState === 'switching' ? (
              <p className="text-sm text-brand-green font-medium">
                Switching to {REQUIRED_CHAIN_NAME}...
              </p>
            ) : switchState === 'success' ? (
              <p className="text-sm text-brand-green font-medium">
                Connected to {REQUIRED_CHAIN_NAME}
              </p>
            ) : switchState === 'error' ? (
              <>
                <p className="text-sm text-brand-green font-medium">
                  Switch failed
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please approve in your wallet
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-brand-green font-medium">
                  Wrong Network
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please switch to {REQUIRED_CHAIN_NAME}
                </p>
              </>
            )}
          </div>
          {(switchState === 'idle' || switchState === 'error') && (
            <button
              onClick={handleSwitch}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-brand-green text-black rounded-lg hover:bg-[#4a9a26] transition-colors"
            >
              Switch
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
