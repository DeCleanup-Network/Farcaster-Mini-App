'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, User, ShieldCheck } from 'lucide-react'
import { useAccount } from 'wagmi'
import { isVerifier } from '@/lib/contracts'
import { useState, useEffect } from 'react'

export function BottomNav() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const [isVerifierWallet, setIsVerifierWallet] = useState(false)

  // Check if wallet is verifier
  useEffect(() => {
    if (isConnected && address) {
      isVerifier(address as `0x${string}`)
        .then((result) => setIsVerifierWallet(result))
        .catch(() => setIsVerifierWallet(false))
    } else {
      setIsVerifierWallet(false)
    }
  }, [isConnected, address])

  const navItems = [
    {
      href: '/',
      icon: Home,
      label: 'Home',
      active: pathname === '/',
    },
    {
      href: '/profile',
      icon: User,
      label: 'My Profile',
      active: pathname === '/profile',
    },
    ...(isVerifierWallet
      ? [
          {
            href: '/verifier',
            icon: ShieldCheck,
            label: 'Verify Cleanups',
            active: pathname === '/verifier',
          },
        ]
      : []),
  ]
  
  // Don't show on verifier page if not a verifier
  if (pathname === '/verifier' && !isVerifierWallet) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="container mx-auto">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors touch-manipulation ${
                  item.active
                    ? 'bg-brand-green/20 text-brand-green'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium uppercase leading-tight">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

