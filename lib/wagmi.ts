import { base, baseSepolia } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { walletConnect, coinbaseWallet, injected } from 'wagmi/connectors'
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
const MINIAPP_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://farcaster-mini-app-umber.vercel.app'
const APP_DESCRIPTION = 'Clean up, share proof, and earn tokenized environmental rewards on Base.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_MINIAPP_ICON_URL ||
  'https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png'

// Wagmi configuration with Farcaster wallet support
// Note: Using explicit connectors to avoid VeChain hijacking window.ethereum.
// IMPORTANT: Only initialize connectors on client side to avoid SSR errors
// All wallet connectors require browser APIs and will fail during server-side rendering
const connectors = typeof window !== 'undefined'
  ? [
  farcasterMiniApp(),
      coinbaseWallet({
        appName: APP_NAME,
      }),
      // Add injected connector (Browser wallet/MetaMask) for desktop users
      // This will be filtered out on mobile in WalletConnect component
      injected({
        shimDisconnect: true, // Keep connection state after disconnect
      }),
]
  : []

// Only add WalletConnect if Project ID is configured and on client side
// Use dynamic URL to avoid metadata mismatch warnings (localhost vs production)
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
if (typeof window !== 'undefined' && walletConnectProjectId && walletConnectProjectId.trim() !== '') {
  try {
    // Get current URL dynamically to match the actual page URL
    // This fixes the "metadata.url differs from actual page url" warning
    const currentUrl = window.location.origin
    
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: APP_NAME,
          description: APP_DESCRIPTION,
          url: currentUrl, // Use current URL (localhost in dev, production in prod)
          icons: [APP_ICON_URL],
        },
        showQrModal: true, // Show QR code for mobile wallet connections
      }) as any // Type assertion needed due to WalletConnect type incompatibility
    )
  } catch (error) {
    console.warn('WalletConnect connector initialization failed:', error)
  }
} else if (typeof window !== 'undefined') {
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

