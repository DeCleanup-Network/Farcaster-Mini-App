'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './wagmi'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import RainbowKitProvider to avoid SSR issues with Node.js modules
const RainbowKitProvider = dynamic(
  () => import('@rainbow-me/rainbowkit').then((mod) => mod.RainbowKitProvider),
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
          <RainbowKitProvider>
            {children}
          </RainbowKitProvider>
        ) : (
          // Render children without RainbowKit during SSR
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

