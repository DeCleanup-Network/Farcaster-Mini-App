import { base, baseSepolia } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { injected, walletConnect, metaMask, coinbaseWallet } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { defineChain } from 'viem'

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

const configuredChains = [baseSepoliaChain, baseMainnet] as const
const requiredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || baseSepoliaChain.id)
const requiredChain =
  configuredChains.find((chain) => chain.id === requiredChainId) ?? baseSepoliaChain
const requiredChainLabel = requiredChain.testnet ? 'Base Sepolia Testnet' : 'Base Mainnet'
const requiredBlockExplorerUrl = requiredChain.testnet
  ? 'https://sepolia.basescan.org'
  : 'https://basescan.org'
const requiredRpcUrl = requiredChain.id === baseMainnet.id ? baseMainnetRpcUrl : baseSepoliaRpcUrl

// Wagmi configuration with Farcaster wallet support
// Note: Using explicit connectors (metaMask, coinbaseWallet) instead of injected() to avoid VeChain
// VeChain (chain ID 11142220) injects itself into window.ethereum and causes chain mismatch errors
// By using explicit connectors, we bypass VeChain and only connect to supported wallets
const connectors = [
  // Farcaster wallet connector (prioritized when in Farcaster context)
  farcasterMiniApp(),
  // Explicit MetaMask connector (filters out VeChain automatically)
  metaMask(),
  // Explicit Coinbase Wallet connector
  coinbaseWallet({ appName: 'DeCleanup Network' }),
  // Fallback to injected() only if explicit connectors aren't available
  // This will be used as a last resort for other browser wallets
  injected(),
]

// Only add WalletConnect if Project ID is configured
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
if (walletConnectProjectId && walletConnectProjectId.trim() !== '') {
  try {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
      }) as any // Type assertion needed due to WalletConnect type incompatibility
    )
  } catch (error) {
    console.warn('WalletConnect connector initialization failed:', error)
  }
} else {
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
  REWARD_DISTRIBUTOR:
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
    '',
} as const

