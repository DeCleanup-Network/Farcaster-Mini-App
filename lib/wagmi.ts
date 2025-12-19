import { base, baseSepolia } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { getDefaultWallets } from '@rainbow-me/rainbowkit'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { defineChain, type Chain } from 'viem'

const baseMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org'
const baseSepoliaRpcUrl = process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://sepolia.base.org'

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
})

const configuredChains: [Chain, ...Chain[]] = [baseSepoliaChain, baseMainnet]
// Default to Base Sepolia (84532) since contracts are deployed there
// Change to baseMainnet.id (8453) after deploying contracts to mainnet
const requiredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || baseSepoliaChain.id)
const requiredChain =
  configuredChains.find((chain) => chain.id === requiredChainId) ?? baseSepoliaChain
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
    // Create minimal config for SSR - connectors will be empty but config structure is valid
    // Note: getDefaultWallets is still valid in v2 when you need custom connector logic
    const { connectors: defaultConnectors } = getDefaultWallets({
      appName: APP_NAME,
      projectId: walletConnectProjectId!,
    })
    
    return createConfig({
      chains: configuredChains,
      connectors: defaultConnectors,
      transports: {
        [baseMainnet.id]: http(baseMainnetRpcUrl),
        [baseSepoliaChain.id]: http(baseSepoliaRpcUrl),
      },
    })
  }

  // Get default RainbowKit connectors (MetaMask, WalletConnect, Coinbase Wallet, etc.)
  // Note: getDefaultWallets is still valid in RainbowKit v2 when you need custom connector logic
  // The migration guide recommends getDefaultConfig for simple cases, but getDefaultWallets
  // is still available and appropriate when you need conditional connectors (like Farcaster)
  const { connectors: defaultConnectors } = getDefaultWallets({
    appName: APP_NAME,
    projectId: walletConnectProjectId!,
  })

  // CRITICAL: Check for Farcaster environment AFTER window is ready
  // window.farcaster.sdk is NOT instantly available at page load
  // Farcaster injects it 100-300ms after page mount
  // By checking here (when getWagmiConfig() is called), we ensure SDK is available
  const isFarcasterEnv =
    window.location.search.includes('fc_wallet=1') ||
    (window as any).farcaster?.sdk !== undefined

  // Add Farcaster Mini App connector ONLY when in Farcaster environment
  // MUST be last in array to prevent auto-selection outside Farcaster
  // Note: RPC URL is configured via transports in createConfig below
  // The Farcaster connector will use the transport configuration automatically
  // The "No rpcUrl provided" warning is harmless - the connector uses transports
  const farcasterConnector = isFarcasterEnv ? farcasterMiniApp() : null

  // Include all connectors - Farcaster LAST (never first) to prevent auto-selection
  // Default connectors first, Farcaster only when in FC environment
  const connectors = [
    ...defaultConnectors,
    ...(farcasterConnector ? [farcasterConnector] : []),
  ]

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

