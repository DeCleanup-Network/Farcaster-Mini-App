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
  'https://gateway.pinata.cloud/ipfs/bafybeieny7btv4icyd5oqhbtiafbdvpxtebxjmxqfv6vajly6ggwqpisde?filename=DCUIconNEW.png'

// Wagmi configuration with RainbowKit and Farcaster wallet support
// CRITICAL: Connectors must be created 100% statically (NO conditionals, NO try/catch, NO fallbacks)
// Wagmi + RainbowKit maintainers: "Never create connectors inside conditionals or inside useEffect"
// Any conditional logic causes SSR → hydration mismatch → WalletConnect transport breaks

// Get WalletConnect project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Validate WalletConnect Project ID - throw error on module load if missing
// This prevents SSR from generating invalid connector config
if (!walletConnectProjectId) {
  throw new Error(
    'WalletConnect Project ID is required. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. ' +
    'Get your Project ID at https://cloud.reown.com'
  )
}

// Get default RainbowKit connectors (MetaMask, WalletConnect, Coinbase Wallet, etc.)
// MUST be static - NO try/catch, NO conditionals, NO fallbacks to []
// If this throws during SSR, that's GOOD - it means misconfiguration is caught early
const { connectors: defaultConnectors } = getDefaultWallets({
  appName: APP_NAME,
  projectId: walletConnectProjectId,
})

// CRITICAL: Only load Farcaster connector when actually inside Farcaster environment
// Farcaster connector MUST be last (never first) to prevent wagmi from auto-selecting it
// When Farcaster connector is first, wagmi tries to use it for WalletConnect → QR hangs
// Detection: Check for Farcaster-specific query params or window.farcaster
const isFarcasterEnv = typeof window !== 'undefined' && 
  (window.location.search.includes('fc_wallet=1') || 
   (window as any).farcaster?.sdk !== undefined)

// Add Farcaster Mini App connector ONLY when in Farcaster environment
// MUST be last in array to prevent auto-selection outside Farcaster
// If not in Farcaster, this connector is not included (prevents semi-implemented connector)
const farcasterConnector = isFarcasterEnv ? farcasterMiniApp() : null

// Include all connectors - Farcaster LAST (never first) to prevent auto-selection
// CRITICAL: Default connectors first, Farcaster only when in FC environment
// This ensures WalletConnect is always available and not overridden by Farcaster connector
const connectors = [
  ...defaultConnectors,
  ...(farcasterConnector ? [farcasterConnector] : []),
]

export const config = createConfig({
  chains: configuredChains,
  connectors,
  transports: {
    [baseMainnet.id]: http(baseMainnetRpcUrl),
    [baseSepoliaChain.id]: http(baseSepoliaRpcUrl),
  },
  // CRITICAL: autoConnect is false by default in wagmi v2
  // This prevents wagmi from auto-selecting Farcaster connector outside FC environment
  // Auto-connect would cause Farcaster connector to be selected → WalletConnect QR hangs
})

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

