import { base, baseSepolia } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  injectedWallet,
  safeWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { defineChain, type Chain } from 'viem'

const baseMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org'
const baseSepoliaRpcUrl = process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://sepolia.base.org'

// Enhanced Base Mainnet chain configuration with custom metadata
const baseMainnet = {
  ...base,
  rpcUrls: {
    default: {
      http: [baseMainnetRpcUrl],
    },
    public: {
      http: [baseMainnetRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://basescan.org',
    },
  },
  // Add icon for better UI display in RainbowKit
  iconUrl: 'https://base.org/favicon.ico',
  iconBackground: '#0052FF',
}

const baseSepoliaChain = defineChain({
  id: baseSepolia.id,
  name: 'Base Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [baseSepoliaRpcUrl],
    },
    public: {
      http: [baseSepoliaRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Basescan Sepolia',
      url: 'https://sepolia.basescan.org',
    },
  },
  contracts: baseSepolia.contracts,
  testnet: true,
  // Add icon for better UI display in RainbowKit
  iconUrl: 'https://base.org/favicon.ico',
  iconBackground: '#0052FF',
})

// Chains for wagmi and RainbowKit (Base only).
// Mainnet was removed to fix CORS: ENS avatar resolution (euc.li) was blocked by CORS when
// miniapp.decleanup.net fetched from euc.li. Without mainnet, no ENS name/avatar is resolved.
const configuredChains: [Chain, ...Chain[]] = [baseSepoliaChain, baseMainnet]
// Default to Base Mainnet (8453). Set NEXT_PUBLIC_CHAIN_ID=84532 for Base Sepolia testnet.
const requiredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || baseMainnet.id)
const requiredChain =
  configuredChains.find((chain) => chain.id === requiredChainId) ?? baseMainnet
const requiredChainLabel = requiredChain.testnet ? 'Base Sepolia Testnet' : 'Base Mainnet'
const requiredBlockExplorerUrl = requiredChain.testnet
  ? 'https://sepolia.basescan.org'
  : 'https://basescan.org'
const requiredRpcUrl = requiredChain.id === baseMainnet.id ? baseMainnetRpcUrl : baseSepoliaRpcUrl

const APP_NAME = 'DeCleanup Rewards'
const MINIAPP_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
const APP_DESCRIPTION = 'Clean up, share proof, and earn tokenized environmental rewards on Base.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_MINIAPP_ICON_URL ||
  'https://gateway.pinata.cloud/ipfs/bafkreig6ctmk5it4ppu67ljtmxjcrv2zug7rvccj5i52ji5s2qli5nww7a?filename=DCUIconNEW.png'

// Wagmi configuration with RainbowKit and Farcaster wallet support
// CRITICAL: Use lazy initialization to ensure wagmi config is created AFTER:
// 1. Window APIs are available
// 2. Farcaster SDK is injected (100-300ms after page load)
// 3. WalletConnect mobile bridge is ready
// This prevents "wallet detected but not ready" errors on mobile/Farcaster

// Get WalletConnect project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Validate WalletConnect Project ID - throw error on module load if missing
if (!walletConnectProjectId) {
  throw new Error(
    'WalletConnect Project ID is required. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. ' +
    'Get your Project ID at https://cloud.reown.com'
  )
}

// Lazy wagmi config - initialized only when getWagmiConfig() is called
// This ensures initialization happens AFTER browser APIs and wallet providers are ready
let _config: ReturnType<typeof createConfig> | null = null

// Cached SSR config: createConfig is called once per Node process instead of every SSR getWagmiConfig().
// Prevents WagmiProvider from receiving a new config reference on each SSR render (H2 fix).
let _ssrConfig: ReturnType<typeof createConfig> | null = null

/**
 * Get wagmi config with lazy initialization
 * 
 * This function ensures wagmi config is created AFTER:
 * - Window APIs are available
 * - Farcaster SDK is injected (if in Farcaster environment)
 * - WalletConnect mobile bridge is ready
 * 
 * This prevents "wallet detected but not ready" errors on mobile Safari and Farcaster.
 * 
 * For SSR, returns a minimal config that won't cause errors but won't work for actual wallet operations.
 */
export function getWagmiConfig() {
  // Return cached config if already initialized
  if (_config) {
    return _config
  }

  // For SSR, create a minimal config that satisfies type requirements
  // This won't work for actual wallet operations, but prevents build errors
  if (typeof window === 'undefined') {
    if (_ssrConfig) {
      return _ssrConfig
    }
    // Create minimal config for SSR - connectors will be empty but config structure is valid
    // Use connectorsForWallets for consistency with client-side config
    let defaultConnectors: any[] = []
    try {
      const result = connectorsForWallets(
        [
          {
            groupName: 'Recommended',
            wallets: [
              // Wallet factories must be passed as function references (not invoked)
              // connectorsForWallets will call them with options from the second parameter
              // We wrap them to merge shared options with wallet-specific options like chains
              (options: any) => metaMaskWallet({ ...options, chains: configuredChains }),
              (options: any) => walletConnectWallet({ ...options, projectId: walletConnectProjectId!, chains: configuredChains }),
              (options: any) => coinbaseWallet({ ...options, appName: APP_NAME, chains: configuredChains }),
              () => injectedWallet(),
            ],
          },
        ],
        {
          appName: APP_NAME,
          projectId: walletConnectProjectId!,
        }
      )
      
      // connectorsForWallets in v2 may return a function that must be called, or an array directly
      // Handle both cases for compatibility
      if (typeof result === 'function') {
        defaultConnectors = (result as () => any[])()
      } else if (Array.isArray(result)) {
        defaultConnectors = result
      } else {
        defaultConnectors = []
      }
    } catch (error) {
      console.error('Error creating connectors for SSR:', error)
      defaultConnectors = []
    }
    
    // Final safety check - ensure defaultConnectors is an array
    if (!Array.isArray(defaultConnectors)) {
      defaultConnectors = []
    }
    
    _ssrConfig = createConfig({
      chains: configuredChains,
      connectors: defaultConnectors,
      transports: {
        [baseMainnet.id]: http(baseMainnetRpcUrl),
        [baseSepoliaChain.id]: http(baseSepoliaRpcUrl),
      },
    })
    return _ssrConfig
  }

  // Use custom wallet list with connectorsForWallets for better control
  // This allows us to specify exact wallets and their order
  let defaultConnectors: any[] = []
  try {
    const result = connectorsForWallets(
      [
        {
          groupName: 'Recommended',
          wallets: [
            // Wallet factories must be passed as function references (not invoked)
            // connectorsForWallets will call them with options from the second parameter
            // We wrap them to merge shared options with wallet-specific options like chains
            (options: any) => metaMaskWallet({ ...options, chains: configuredChains }),
            (options: any) => walletConnectWallet({ ...options, projectId: walletConnectProjectId!, chains: configuredChains }),
            (options: any) => coinbaseWallet({ ...options, appName: APP_NAME, chains: configuredChains }),
            () => injectedWallet(),
            () => safeWallet(),
          ],
        },
      ],
      {
        appName: APP_NAME,
        projectId: walletConnectProjectId!,
      }
    )

    // connectorsForWallets in v2 may return a function that must be called, or an array directly
    // Handle both cases for compatibility
    if (typeof result === 'function') {
      defaultConnectors = (result as () => any[])()
    } else if (Array.isArray(result)) {
      defaultConnectors = result
    } else {
      console.warn('connectorsForWallets returned unexpected structure:', typeof result)
      defaultConnectors = []
    }
  } catch (error) {
    console.error('Error creating connectors with connectorsForWallets:', error)
    // Fallback: return empty array if connectorsForWallets fails
    defaultConnectors = []
  }

  // Final safety check - ensure defaultConnectors is an array
  if (!Array.isArray(defaultConnectors)) {
    defaultConnectors = []
  }

  // CRITICAL: Check for Farcaster environment using official SDK method
  // We need to check synchronously here, but the proper detection happens in FarcasterProvider
  // This is a fallback check - the FarcasterProvider will have already detected the environment
  // and called ready() by the time this config is used
  let isFarcasterEnv = false
  try {
    // Check if SDK is available (synchronous check)
    // The proper async check (sdk.isInMiniApp()) happens in FarcasterProvider
    if ((window as any).farcaster?.sdk) {
      isFarcasterEnv = true
    }
  } catch {
    // SDK not available - not in Farcaster environment
    isFarcasterEnv = false
  }

  // Farcaster: only the Farcaster wallet. Web: all standard wallets (MetaMask, WalletConnect, Coinbase, injected, Safe).
  const farcasterConnector = isFarcasterEnv ? farcasterMiniApp() : null

  const connectors =
    isFarcasterEnv && farcasterConnector
      ? [farcasterConnector]
      : [...defaultConnectors]

  // Create config with all connectors
  // Using createConfig directly is valid in v2 when you need custom connector logic
  _config = createConfig({
    chains: configuredChains,
    connectors,
    transports: {
      [baseMainnet.id]: http(baseMainnetRpcUrl),
      [baseSepoliaChain.id]: http(baseSepoliaRpcUrl),
    },
    // CRITICAL: autoConnect is false by default in wagmi v2
    // This prevents wagmi from auto-selecting Farcaster connector outside FC environment
  })

  return _config
}

// Export config for backward compatibility (but prefer getWagmiConfig() for new code)
// This will throw on SSR, which is expected - use getWagmiConfig() in client components
// Type assertion needed because config can be null during SSR
export const config: ReturnType<typeof createConfig> = typeof window !== 'undefined' ? getWagmiConfig() : ({} as ReturnType<typeof createConfig>)

// Export chains for RainbowKit (Base only)
// Mainnet is kept in wagmi config for ENS resolution but hidden from chain switcher
export function getRainbowKitChains(): [Chain, ...Chain[]] {
  return configuredChains
}

// Default/Base chain metadata exports
export const DEFAULT_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_NAME = requiredChainLabel
export const REQUIRED_BLOCK_EXPLORER_URL = requiredBlockExplorerUrl
export const REQUIRED_RPC_URL = requiredRpcUrl
export const REQUIRED_CHAIN_IS_TESTNET = Boolean(requiredChain.testnet)

// Contract addresses (update with actual addresses)
export const CONTRACT_ADDRESSES = {
  IMPACT_PRODUCT:
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    '',
  VERIFICATION:
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    '',
} as const

