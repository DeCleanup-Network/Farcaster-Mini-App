'use client'

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
    
    const RainbowKitProviderWithCustomTheme = ({ children, ...props }: any) => (
      <mod.RainbowKitProvider 
        chains={rainbowKitChains}
        theme={customTheme} 
        modalSize="compact"
        initialChain={undefined}
        showRecentTransactions={true}
        appInfo={{
          appName: 'DeCleanup Rewards',
          learnMoreUrl: 'https://decleanup.net',
        }}
        {...props}
      >
        {children}
      </mod.RainbowKitProvider>
    )
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

