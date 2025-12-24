'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { getWagmiConfig } from './wagmi'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import RainbowKitProvider and theme to avoid SSR issues with Node.js modules
const RainbowKitProviderWithTheme = dynamic(
  () => import('@rainbow-me/rainbowkit').then(async (mod) => {
    // Import theme utilities
    const { darkTheme } = mod
    
    // Create enhanced custom theme matching DeCleanup brand
    // Using darkTheme as base and extending with custom colors
    const customTheme = darkTheme({
      accentColor: '#58B12F', // Brand green
      accentColorForeground: '#000000', // Black text on green
      borderRadius: 'medium',
      fontStack: 'system',
      overlayBlur: 'small',
    })
    
    // Enhanced theme with additional customizations
    // Type is inferred from darkTheme return value
    const enhancedTheme = {
      ...customTheme,
      colors: {
        ...customTheme.colors,
        // Enhance modal colors for better contrast
        modalBackground: '#0a0a0a',
        modalBorder: '#1a1a1a',
        modalText: '#ffffff',
        modalTextDim: '#9ca3af',
        // Improve connect button styling
        connectButtonBackground: '#58B12F',
        connectButtonText: '#000000',
        connectButtonInnerBackground: '#4a9a26',
        // Better action buttons
        actionButtonSecondaryBackground: '#1a1a1a',
        profileForeground: '#0a0a0a',
        profileAction: '#58B12F',
        profileActionHover: '#4a9a26',
      },
      shadows: {
        ...customTheme.shadows,
        connectButton: '0 4px 12px rgba(88, 177, 47, 0.3)',
        dialog: '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
    }
    
    // Return provider component with enhanced theme and advanced features
    const RainbowKitProviderWithCustomTheme = ({ children, ...props }: any) => (
      <mod.RainbowKitProvider 
        theme={enhancedTheme} 
        modalSize="compact"
        initialChain={undefined}
        showRecentTransactions={true}
        // Enable cool mode for a more engaging wallet selection experience
        // This adds emoji explosions when users select wallets
        coolMode={process.env.NEXT_PUBLIC_ENABLE_COOL_MODE === 'true'}
        appInfo={{
          appName: 'DeCleanup Rewards',
          learnMoreUrl: 'https://decleanup.net',
          disclaimer: ({ Text, Link }) => (
            <Text>
              By connecting your wallet, you agree to the{' '}
              <Link href="https://decleanup.net/terms">Terms of Service</Link> and{' '}
              <Link href="https://decleanup.net/privacy">Privacy Policy</Link>.
            </Text>
          ),
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

