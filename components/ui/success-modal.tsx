'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, ExternalLink, Share2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  transactionHash?: string
  explorerUrl?: string
  explorerName?: string
  onShare?: () => void
  showShare?: boolean
  level?: number
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  transactionHash,
  explorerUrl,
  explorerName = 'Explorer',
  onShare,
  showShare = false,
  level,
}: SuccessModalProps) {
  const [sharing, setSharing] = useState(false)
  const { isMiniApp } = useFarcaster()
  
  // Only show share button in Farcaster Mini App
  const shouldShowShare = showShare && isMiniApp && level && level > 0

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle share (client-agnostic)
  const handleShare = async () => {
    if (!level || sharing) return
    setSharing(true)
    try {
      const { generateClaimShareLink, formatImpactShareMessage, shareCast } = await import('@/lib/farcaster')
      // Use miniapp URL for sharing (no referral, just achievement sharing)
      const claimLink = generateClaimShareLink(level, 'farcaster')
      const text = formatImpactShareMessage(level, claimLink, 'farcaster')
      const success = await shareCast(text, claimLink)
      if (success) {
        console.log('✅ Successfully shared')
      } else {
        console.warn('⚠️ Share returned false')
      }
    } catch (error: any) {
      console.error('Failed to share:', error)
      const errorMsg = error?.message || 'Unknown error'
      alert(`Failed to share: ${errorMsg}\n\nPlease try again or share manually.`)
    } finally {
      setSharing(false)
    }
  }


  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overscroll-contain"
      onClick={(e) => {
        // Prevent closing on backdrop click - user must click close button
        e.stopPropagation()
      }}
    >
      <div 
        className="relative mx-4 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border-2 border-brand-green bg-gray-900 p-6 shadow-2xl overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Success icon */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-brand-green/20 p-3">
            <CheckCircle className="h-12 w-12 text-brand-green" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-3 text-center text-xl font-bold uppercase tracking-wide text-white">
          {title}
        </h2>

        {/* Message */}
        <p className="mb-6 text-center text-sm text-gray-300 leading-relaxed break-words">
          {message}
        </p>

        {/* Transaction hash */}
        {transactionHash && (
          <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <p className="mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Transaction Hash:</p>
            <p className="break-all font-mono text-xs text-white">
              {transactionHash}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-brand-green bg-brand-green/10 px-4 py-3 text-sm font-semibold text-brand-green hover:bg-brand-green/20 transition-colors"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View on {explorerName}
            </a>
          )}

          {/* Share buttons - only show in Farcaster Mini App after minting impact product */}
          {shouldShowShare && (
            <div className="space-y-2">
              <p className="text-center text-xs text-gray-400">
                Share your achievement!
              </p>
                <Button
                onClick={handleShare}
                  disabled={sharing}
                className="w-full gap-2 bg-purple-600 text-white hover:bg-purple-700"
                >
                  {sharing ? (
                    <>
                      <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                      <span>Sharing…</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                    Share Achievement
                    </>
                  )}
                </Button>
            </div>
          )}
          
          <Button
            onClick={onClose}
            className="w-full border-2 border-gray-700 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

