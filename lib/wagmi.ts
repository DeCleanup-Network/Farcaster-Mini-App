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
  'https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png'

// Wagmi configuration with RainbowKit and Farcaster wallet support
// IMPORTANT: Only initialize connectors on client side to avoid SSR errors
// All wallet connectors require browser APIs and will fail during server-side rendering

// Get WalletConnect project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Get default RainbowKit connectors (MetaMask, WalletConnect, Coinbase Wallet, etc.)
// This only works on client side, so we check for window
const { connectors: defaultConnectors } = typeof window !== 'undefined' && walletConnectProjectId
  ? getDefaultWallets({
      appName: APP_NAME,
      projectId: walletConnectProjectId,
    })
  : { connectors: [] }

// Add Farcaster Mini App connector (priority connector - must be first)
// This ensures Farcaster wallet is prioritized when running inside Farcaster/Warpcast
const farcasterConnector = typeof window !== 'undefined' ? farcasterMiniApp() : null

// Combine connectors: Farcaster first (priority), then default RainbowKit wallets
// This ensures Farcaster connector is always available and prioritized
const connectors = typeof window !== 'undefined'
  ? [
      ...(farcasterConnector ? [farcasterConnector] : []),
      ...defaultConnectors,
    ]
  : []

// Warn if WalletConnect Project ID is missing (but don't fail - Farcaster and injected wallets still work)
if (typeof window !== 'undefined' && !walletConnectProjectId) {
  console.warn('WalletConnect Project ID not configured. WalletConnect will not be available. Get your Project ID at https://cloud.reown.com')
}

export const config = createConfig({
  chains: configuredChains,
  connectors,
  transports: {
    [baseMainnet.id]: http(baseMainnetRpcUrl),
    [baseSepoliaChain.id]: http(baseSepoliaRpcUrl),
  },
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

