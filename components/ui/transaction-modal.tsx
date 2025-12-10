'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Loader2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'

export type TransactionModalType = 'success' | 'error' | 'info' | 'warning' | 'loading'

export interface TransactionModalProps {
  open: boolean
  onClose: () => void
  type: TransactionModalType
  title: string
  message: string
  transactionHash?: string
  onViewTransaction?: () => void
  actionLabel?: string
  onAction?: () => void
}

export function TransactionModal({
  open,
  onClose,
  type,
  title,
  message,
  transactionHash,
  onViewTransaction,
  actionLabel,
  onAction,
}: TransactionModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyHash = async () => {
    if (transactionHash) {
      await navigator.clipboard.writeText(transactionHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-brand-green" />
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-6 w-6 text-yellow-400" />
      case 'loading':
        return <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
      default:
        return <AlertCircle className="h-6 w-6 text-gray-400" />
    }
  }

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-brand-green/50 bg-brand-green/20'
      case 'error':
        return 'border-red-500/50 bg-red-500/20'
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/20'
      case 'loading':
        return 'border-brand-green/50 bg-brand-green/20'
      default:
        return 'border-gray-800 bg-gray-900'
    }
  }

  const transactionUrl = transactionHash
    ? `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${transactionHash}`
    : null
  
  // Get block explorer name (Basescan or Basescan Sepolia)
  const blockExplorerName = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
    ? 'Basescan (Sepolia)'
    : 'Basescan'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn('border-gray-800 bg-gray-900/95 backdrop-blur-sm text-white', getBorderColor())}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className="text-xl font-bold uppercase tracking-wide text-white">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="text-gray-300">
              <div className="space-y-3">
                <p className="whitespace-pre-line">{message}</p>
                
                {transactionHash && (
                  <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400">Transaction Hash</span>
                      <button
                        onClick={handleCopyHash}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
                      >
                        <Copy className="h-3 w-3" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="mb-2 break-all font-mono text-xs text-gray-300">
                      {transactionHash}
                    </p>
                    {transactionUrl && (
                      <a
                        href={transactionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-green hover:text-[#4a9a26]"
                      >
                        View on {blockExplorerName}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {onViewTransaction && transactionUrl && (
            <Button
              variant="outline"
              onClick={() => {
                window.open(transactionUrl, '_blank')
                onViewTransaction()
              }}
              className="w-full border-gray-700 bg-gray-800 text-white hover:bg-gray-700 sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Transaction
            </Button>
          )}
          {onAction && actionLabel && (
            <Button
              onClick={onAction}
              className={cn(
                'w-full sm:w-auto',
                type === 'success'
                  ? 'bg-brand-green text-black hover:bg-[#4a9a26]'
                  : type === 'error'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-brand-yellow text-black hover:bg-[#e6e600]'
              )}
            >
              {actionLabel}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-gray-700 bg-gray-800 text-white hover:bg-gray-700 sm:w-auto"
          >
            {type === 'loading' ? 'Cancel' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easy modal management
export function useTransactionModal() {
  const [modal, setModal] = useState<{
    open: boolean
    type: TransactionModalType
    title: string
    message: string
    transactionHash?: string
    actionLabel?: string
    onAction?: () => void
  }>({
    open: false,
    type: 'info',
    title: '',
    message: '',
  })

  const showModal = (
    type: TransactionModalType,
    title: string,
    message: string,
    options?: {
      transactionHash?: string
      actionLabel?: string
      onAction?: () => void
    }
  ) => {
    setModal({
      open: true,
      type,
      title,
      message,
      transactionHash: options?.transactionHash,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    })
  }

  const hideModal = () => {
    setModal((prev) => ({ ...prev, open: false }))
  }

  return {
    modal,
    showModal,
    hideModal,
    showSuccess: (title: string, message: string, options?: { transactionHash?: string; actionLabel?: string; onAction?: () => void }) =>
      showModal('success', title, message, options),
    showError: (title: string, message: string, options?: { transactionHash?: string; actionLabel?: string; onAction?: () => void }) =>
      showModal('error', title, message, options),
    showInfo: (title: string, message: string, options?: { transactionHash?: string; actionLabel?: string; onAction?: () => void }) =>
      showModal('info', title, message, options),
    showWarning: (title: string, message: string, options?: { transactionHash?: string; actionLabel?: string; onAction?: () => void }) =>
      showModal('warning', title, message, options),
    showLoading: (title: string, message: string, options?: { transactionHash?: string }) =>
      showModal('loading', title, message, options),
  }
}

