'use client'

import { useEffect } from 'react'
import { X, CheckCircle, ExternalLink, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shareCast, generateReferralLink, isFarcasterContext } from '@/lib/farcaster'

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
  userAddress?: string
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
  userAddress,
  level,
}: SuccessModalProps) {
  const isInFarcaster = isFarcasterContext()
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

  if (!isOpen) return null

  const handleShare = () => {
    if (onShare) {
      onShare()
    } else if (transactionHash && explorerUrl) {
      const shareText = `${title}\n\n${message}\n\nView on ${explorerName}: ${explorerUrl}`
      if (navigator.share) {
        navigator.share({
          title,
          text: shareText,
          url: explorerUrl,
        }).catch(() => {
          // Fallback to clipboard
          navigator.clipboard.writeText(shareText)
        })
      } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareText)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-lg border-2 border-brand-green bg-gray-900 p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Success icon */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-brand-green/20 p-3">
            <CheckCircle className="h-12 w-12 text-brand-green" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-3 text-center text-2xl font-bold uppercase tracking-wide text-white">
          {title}
        </h2>

        {/* Message */}
        <p className="mb-6 text-center text-sm text-gray-300 leading-relaxed">
          {message}
        </p>

        {/* Transaction hash */}
        {transactionHash && (
          <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800 p-3">
            <p className="mb-1 text-xs text-gray-400">Transaction Hash:</p>
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
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-brand-green bg-brand-green/10 px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/20 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View on {explorerName}
            </a>
          )}
          
          {showShare && (
            <div className="flex flex-col gap-2">
              {isInFarcaster && userAddress && (
                <Button
                  onClick={async () => {
                    if (onShare) {
                      onShare()
                    } else {
                      const referralLink = generateReferralLink(userAddress)
                      const shareText = `🎉 I just minted my DeCleanup Impact Product NFT${level ? ` (Level ${level})` : ''}!\n\nClean up, snap, earn! Join me: ${referralLink}\n\n${explorerUrl ? `View on ${explorerName}: ${explorerUrl}\n\n` : ''}#DeCleanup #ImpactProduct #Base`
                      await shareCast(shareText, referralLink)
                    }
                  }}
                  className="w-full gap-2 bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Share2 className="h-4 w-4" />
                  Share on Farcaster
                </Button>
              )}
              <Button
                onClick={() => {
                  if (onShare) {
                    onShare()
                  } else if (transactionHash && explorerUrl) {
                    const referralLink = userAddress ? generateReferralLink(userAddress) : ''
                    const shareText = `🎉 I just minted my DeCleanup Impact Product NFT${level ? ` (Level ${level})` : ''}!\n\nClean up, snap, earn!${referralLink ? ` Join me: ${referralLink}\n\n` : '\n\n'}View on ${explorerName}: ${explorerUrl}\n\n#DeCleanup #ImpactProduct #Base`
                    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
                    window.open(twitterUrl, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="w-full gap-2 bg-brand-yellow text-black hover:bg-[#e6e600]"
              >
                <Share2 className="h-4 w-4" />
                Share on X
              </Button>
            </div>
          )}
          
          <Button
            onClick={onClose}
            className="w-full border-2 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

