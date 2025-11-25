'use client'

import { Leaf } from 'lucide-react'
import { WalletConnect } from '@/components/wallet/WalletConnect'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green">
            <Leaf className="h-5 w-5 text-black" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-lg uppercase tracking-wide text-foreground sm:text-2xl">
              DeCleanup Network
            </span>
            <span className="hidden text-[10px] font-medium text-muted-foreground sm:block sm:text-xs">
              Clean Up, Snap, Earn
            </span>
          </div>
        </div>
        <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
          <WalletConnect />
        </div>
      </div>
    </header>
  )
}

