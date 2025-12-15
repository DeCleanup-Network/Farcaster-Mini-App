'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, User, ShieldCheck } from 'lucide-react'
import { useAccount } from 'wagmi'
import { isVerifier } from '@/lib/contracts'
import { useState, useEffect } from 'react'

// Keep this key in sync with verifier page
const VERIFIED_VERIFIER_KEY = 'decleanup_verified_verifier'

export function BottomNav() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const [isVerifierWallet, setIsVerifierWallet] = useState(false)

  // Check if wallet is verifier
  useEffect(() => {
    if (!(isConnected && address)) {
      setIsVerifierWallet(false)
      return
    }

    let cancelled = false

    async function checkVerifier() {
      try {
        // 1) Fast path: reuse localStorage flag set by verifier dashboard
        if (typeof window !== 'undefined') {
          try {
            const stored = window.localStorage.getItem(VERIFIED_VERIFIER_KEY)
            if (stored) {
              const parsed = JSON.parse(stored) as {
                verifiedAddress?: string
                timestamp?: number
              }
              const isExpired =
                typeof parsed.timestamp === 'number' &&
                Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000
              if (
                !isExpired &&
                parsed.verifiedAddress &&
                address &&
                parsed.verifiedAddress.toLowerCase() === address.toLowerCase()
              ) {
                if (!cancelled) setIsVerifierWallet(true)
                return
              }
            }
          } catch {
            // Ignore localStorage errors and fall back to on-chain check
          }
        }

        // 2) Fallback: on-chain check
        const result = await isVerifier(address as `0x${string}`)
        if (!cancelled) setIsVerifierWallet(result)
      } catch (error) {
        console.warn('Failed to check verifier status for bottom nav:', error)
        if (!cancelled) setIsVerifierWallet(false)
      }
    }

    checkVerifier()

    return () => {
      cancelled = true
    }
  }, [isConnected, address])

  const showVerifierTab = isVerifierWallet || pathname === '/verifier'

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
    ...(showVerifierTab
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
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="container mx-auto">
        <div className={`flex items-center ${navItems.length === 3 ? 'justify-around' : 'justify-evenly'} px-2 py-3`}>
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
                <Icon className="h-6 w-6" />
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

