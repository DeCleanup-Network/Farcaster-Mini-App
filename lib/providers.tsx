'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './wagmi'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import RainbowKitProvider and theme to avoid SSR issues with Node.js modules
const RainbowKitProviderWithTheme = dynamic(
  () => import('@rainbow-me/rainbowkit').then((mod) => {
    // Import theme and create custom theme matching DeCleanup brand
    const { darkTheme } = mod
    const customTheme = darkTheme({
      accentColor: '#58B12F', // Brand green
      accentColorForeground: '#000000', // Black text on green
      borderRadius: 'medium',
      fontStack: 'system',
      overlayBlur: 'small',
    })
    // Return provider component with custom theme
    return ({ children, ...props }: any) => (
      <mod.RainbowKitProvider theme={customTheme} {...props}>
        {children}
      </mod.RainbowKitProvider>
    )
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

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted ? (
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

