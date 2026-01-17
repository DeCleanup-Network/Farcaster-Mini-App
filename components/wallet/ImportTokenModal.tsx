'use client'

import { useState } from 'react'
import { X, Copy, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import { REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/wagmi'

interface ImportTokenModalProps {
  type: 'token' | 'nft'
  tokenId?: string | number
  onCopy?: (text: string, label: string) => void
}

export function ImportTokenModal({ type, tokenId, onCopy }: ImportTokenModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tokenAddress = CONTRACT_ADDRESSES.BDCU_TOKEN
  const nftAddress = CONTRACT_ADDRESSES.IMPACT_PRODUCT
  const tokenExplorerUrl = tokenAddress ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${tokenAddress}` : null
  const nftExplorerUrl = nftAddress ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${nftAddress}` : null

  const handleCopy = (text: string, label: string) => {
    if (onCopy) {
      onCopy(text, label)
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  if (type === 'token' && !tokenAddress) {
    return null // Don't show if token address not configured
  }

  if (type === 'nft' && !nftAddress) {
    return null // Don't show if NFT address not configured
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        title={type === 'token' ? 'How to add $bDCU to your wallet' : 'How to import Impact Product NFT'}
        aria-label={type === 'token' ? 'How to add $bDCU to your wallet' : 'How to import Impact Product NFT'}
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overscroll-contain" onClick={() => setIsOpen(false)}>
          <div className="relative w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl overscroll-contain" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <h2 className="mb-4 text-xl font-bold text-white">
              {type === 'token' ? 'Add $bDCU Token to Your Wallet' : 'Import Impact Product NFT to Your Wallet'}
            </h2>

            {type === 'token' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  To view your $bDCU tokens in your wallet, you need to add the token contract address manually.
                </p>

                <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                    <span>Token Contract Address</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(tokenAddress!, 'Token address')}
                      className="flex items-center gap-1 text-brand-green hover:text-brand-yellow transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy
                    </button>
                  </div>
                  {tokenExplorerUrl ? (
                    <a
                      href={tokenExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-white underline-offset-2 hover:underline"
                    >
                      {tokenAddress}
                    </a>
                  ) : (
                    <p className="break-all font-mono text-xs text-white">
                      {tokenAddress}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-400">
                    Token Details
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    <p><span className="text-gray-400">Symbol:</span> bDCU</p>
                    <p><span className="text-gray-400">Decimals:</span> 18</p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                  <p className="mb-2 text-xs font-semibold text-gray-400">Instructions:</p>
                  <ol className="list-decimal space-y-2 pl-4 text-xs text-gray-300">
                    <li>Open your wallet (MetaMask, Coinbase Wallet, etc.)</li>
                    <li>Go to <strong>Tokens</strong> or <strong>Assets</strong> tab</li>
                    <li>Click <strong>Import tokens</strong> or <strong>Add custom token</strong></li>
                    <li>Paste the contract address above</li>
                    <li>Confirm the token details (Symbol: bDCU, Decimals: 18)</li>
                    <li>Click <strong>Add</strong> or <strong>Import</strong></li>
                  </ol>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Wallets now require adding collectibles manually. Copy these details to import your Impact Product NFT.
                </p>

                {nftAddress && (
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                      <span>Contract Address</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(nftAddress, 'Contract address')}
                        className="flex items-center gap-1 text-brand-green hover:text-brand-yellow transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                    {nftExplorerUrl ? (
                      <a
                        href={nftExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-xs text-white underline-offset-2 hover:underline"
                      >
                        {nftAddress}
                      </a>
                    ) : (
                      <p className="break-all font-mono text-xs text-white">
                        {nftAddress}
                      </p>
                    )}
                  </div>
                )}

                {tokenId && (
                  <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                      <span>Collectible ID</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(tokenId.toString(), 'Collectible ID')}
                        className="flex items-center gap-1 text-brand-green hover:text-brand-yellow transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                    <p className="font-mono text-xs text-white">{tokenId.toString()}</p>
                  </div>
                )}

                <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                  <p className="mb-2 text-xs font-semibold text-gray-400">Instructions:</p>
                  <ol className="list-decimal space-y-2 pl-4 text-xs text-gray-300">
                    <li>Open your wallet → <strong>NFTs</strong> / <strong>Collectibles</strong> → <strong>Import</strong> or <strong>Add manually</strong></li>
                    <li>Paste the contract address above</li>
                    <li>Enter the collectible ID and confirm to view your Impact Product</li>
                  </ol>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

