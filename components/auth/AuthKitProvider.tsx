'use client'

import { AuthKitProvider as FarcasterAuthKitProvider } from '@farcaster/auth-kit'
import { ReactNode } from 'react'

// AuthKit configuration for Sign In With Farcaster (SIWF)
// This is separate from the miniapp SDK - it's for web-based authentication
const authKitConfig = {
  // Farcaster relay for authentication
  relay: 'https://relay.farcaster.xyz',
  // Optimism Mainnet RPC (Farcaster uses Optimism for identity)
  rpcUrl: process.env.NEXT_PUBLIC_AUTHKIT_RPC_URL || 'https://mainnet.optimism.io',
  // Domain must match where the app is hosted
  domain: process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost:3000',
  // SIWE URI for the authentication request
  siweUri: process.env.NEXT_PUBLIC_SIWE_URI || 'http://localhost:3000/login',
}

interface AuthKitProviderProps {
  children: ReactNode
}

/**
 * AuthKit Provider for Sign In With Farcaster (SIWF)
 *
 * This enables web users to authenticate using their Farcaster account
 * via QR code scanning in Warpcast. After authentication, users can be
 * redirected to the Farcaster miniapp.
 *
 * Note: This is different from the miniapp SDK which is used when
 * the app is already running inside Farcaster/Warpcast.
 */
export function AuthKitProvider({ children }: AuthKitProviderProps) {
  return (
    <FarcasterAuthKitProvider config={authKitConfig}>
      {children}
    </FarcasterAuthKitProvider>
  )
}

export default AuthKitProvider
