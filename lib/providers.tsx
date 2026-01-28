'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { getWagmiConfig } from './wagmi'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import RainbowKitProvider and theme to avoid SSR issues with Node.js modules
const RainbowKitProviderWithTheme = dynamic(
  () => Promise.all([
    import('@rainbow-me/rainbowkit'),
    import('./wagmi').then(m => m.getRainbowKitChains)
  ]).then(([mod, getRainbowKitChains]) => {
    // Simple custom theme matching DeCleanup brand
    const { darkTheme } = mod
    const customTheme = darkTheme({
      accentColor: '#58B12F', // Brand green
      accentColorForeground: '#000000', // Black text on green
      borderRadius: 'medium',
      fontStack: 'system',
      overlayBlur: 'small',
    })
    
    // Get chains for RainbowKit (excludes mainnet - only Base chains)
    // Mainnet is kept in wagmi config for ENS resolution but hidden from chain switcher
    const rainbowKitChains = getRainbowKitChains()

    // Custom avatar that does NOT use ensImage to avoid CORS from euc.li (no Access-Control-Allow-Origin).
    // Renders a simple circle with a letter derived from the address.
    const NoEnsAvatar: React.ComponentType<{ address: string; ensImage?: string | null; size: number }> = ({ address, size }) => {
      const letter = (address || '?').slice(2, 4).toUpperCase() || '?'
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: 'rgba(88, 177, 47, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.max(10, size * 0.4),
            fontWeight: 600,
            color: '#58B12F',
          }}
        >
          {letter}
        </div>
      )
    }
    
    const RainbowKitProviderWithCustomTheme = ({ children, ...props }: any) => {
      // Debug: Log viewport and provider mount
      if (typeof window !== 'undefined') {
        console.log('✅ RainbowKitProviderWithCustomTheme mounted')
        console.log('Viewport:', window.innerWidth, window.innerHeight)
        console.log('Is Farcaster:', window.location !== window.parent.location)
      }
      
      return (
        <mod.RainbowKitProvider 
          chains={rainbowKitChains}
          theme={customTheme}
          initialChain={undefined}
          showRecentTransactions={true}
          modalSize="wide"
          coolMode
          avatar={NoEnsAvatar}
          appInfo={{
            appName: 'DeCleanup Rewards',
            learnMoreUrl: 'https://decleanup.net',
          }}
          {...props}
        >
          {children}
        </mod.RainbowKitProvider>
      )
    }
    RainbowKitProviderWithCustomTheme.displayName = 'RainbowKitProviderWithCustomTheme'
    return RainbowKitProviderWithCustomTheme
  }),
  { 
    ssr: false,
    loading: () => null, // Don't show loading state during SSR
  }
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get wagmi config - will create minimal config for SSR, full config for client
  // This ensures WagmiProvider always has a valid config
  const wagmiConfig = getWagmiConfig()

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {mounted ? (
          // Always use RainbowKit - it handles all wallet connections
          <RainbowKitProviderWithTheme>
            {children}
          </RainbowKitProviderWithTheme>
        ) : (
          // Render children without RainbowKit during SSR
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

