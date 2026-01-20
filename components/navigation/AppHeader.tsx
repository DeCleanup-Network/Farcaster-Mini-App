'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { WalletConnect } from '@/components/wallet/WalletConnect'

// DeCleanup logo image URLs with fallbacks
const IPFS_HASH = 'bafkreidva4g2hrnmegqkkig4t743hprwk6g3or76foe25hyrvs4zngprja'
const LOGO_IMAGE_URLS = [
  `https://gateway.pinata.cloud/ipfs/${IPFS_HASH}?filename=DCUHeaderLogo.png`,
  `https://ipfs.io/ipfs/${IPFS_HASH}?filename=DCUHeaderLogo.png`,
  `https://cloudflare-ipfs.com/ipfs/${IPFS_HASH}?filename=DCUHeaderLogo.png`,
  `https://dweb.link/ipfs/${IPFS_HASH}?filename=DCUHeaderLogo.png`,
]

export function AppHeader() {
  const [logoUrl, setLogoUrl] = useState(LOGO_IMAGE_URLS[0])
  const [fallbackIndex, setFallbackIndex] = useState(0)

  const handleImageError = () => {
    // Try next fallback gateway
    const nextIndex = fallbackIndex + 1
    if (nextIndex < LOGO_IMAGE_URLS.length) {
      setFallbackIndex(nextIndex)
      setLogoUrl(LOGO_IMAGE_URLS[nextIndex])
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full max-w-full border-b border-border bg-background/95 backdrop-blur-sm safe-area-inset-top">
      <div className="mx-auto flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 max-w-full overflow-hidden">
        {/* Left side - Logo */}
        <Link 
          href="/" 
          className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <div className="relative h-12 w-12 sm:h-16 sm:w-16">
            <Image
              src={logoUrl}
              alt="DeCleanup"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 640px) 48px, 64px"
              onError={handleImageError}
            />
          </div>
        </Link>
        
        {/* Center - Tagline */}
        <div className="flex flex-1 justify-center items-center px-2 min-w-0">
          <span className="text-[10px] sm:text-xs font-light text-muted-foreground/70 uppercase tracking-wide text-center truncate">
            Clean Up, Snap, Earn
          </span>
        </div>
        
        {/* Right side - Wallet Connect */}
        <div className="flex items-center justify-end flex-shrink-0 ml-2">
          <WalletConnect />
        </div>
      </div>
    </header>
  )
}

