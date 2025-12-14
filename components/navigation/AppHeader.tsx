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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3">
        {/* Left side - Logo */}
        <Link 
          href="/" 
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <div className="relative h-16 w-16 sm:h-20 sm:w-20">
            <Image
              src={logoUrl}
              alt="DeCleanup"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 640px) 64px, 80px"
              onError={handleImageError}
            />
          </div>
        </Link>
        
        {/* Center - Tagline */}
        <div className="flex-1 flex justify-center">
          <span className="text-[9px] font-light text-muted-foreground/70 sm:text-[10px] uppercase tracking-wide">
            Clean Up, Snap, Earn
          </span>
        </div>
        
        {/* Right side - Wallet Connect */}
        <div className="flex items-center justify-end">
          <WalletConnect />
        </div>
      </div>
    </header>
  )
}

