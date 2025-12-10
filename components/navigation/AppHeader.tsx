'use client'

import Link from 'next/link'
import Image from 'next/image'
import { WalletConnect } from '@/components/wallet/WalletConnect'

// DeCleanup logo image URL
const LOGO_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafkreidva4g2hrnmegqkkig4t743hprwk6g3or76foe25hyrvs4zngprja?filename=DCUHeaderLogo.png'

export function AppHeader() {
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
              src={LOGO_IMAGE_URL}
              alt="DeCleanup"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 640px) 64px, 80px"
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

