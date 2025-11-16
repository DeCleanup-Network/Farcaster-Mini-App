import { celo } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { defineChain } from 'viem'

// Celo chain configuration
const celoMainnet = {
  ...celo,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org'],
    },
  },
}

// Celo Sepolia Testnet configuration
const celoSepolia = defineChain({
  id: 11142220,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_CELO_TESTNET_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'CeloScan Sepolia',
      url: 'https://sepolia.celoscan.io',
    },
  },
  testnet: true,
})

const celoTestnet = celoSepolia

// Wagmi configuration with Farcaster wallet support
// Note: Using injected() instead of metaMask() to avoid SSR issues
// injected() connector automatically detects MetaMask and other injected wallets
const connectors = [
  // Farcaster wallet connector (prioritized when in Farcaster context)
  farcasterMiniApp(),
  // injected() connector handles MetaMask, Coinbase Wallet, and other injected wallets
  injected(),
]

// Only add WalletConnect if Project ID is configured
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
if (walletConnectProjectId && walletConnectProjectId.trim() !== '') {
  try {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
      })
    )
  } catch (error) {
    console.warn('WalletConnect connector initialization failed:', error)
  }
} else {
  console.warn('WalletConnect Project ID not configured. WalletConnect will not be available. Get your Project ID at https://cloud.reown.com')
}

export const config = createConfig({
  chains: [celoTestnet, celoMainnet], // Put testnet first so it's the default
  connectors,
  transports: {
    [celoMainnet.id]: http(),
    [celoTestnet.id]: http(),
  },
})

// Default chain ID (Celo Sepolia)
export const DEFAULT_CHAIN_ID = celoSepolia.id

// Contract addresses (update with actual addresses)
export const CONTRACT_ADDRESSES = {
  IMPACT_PRODUCT: process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT || '',
  VERIFICATION: process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT || '',
  REWARD_DISTRIBUTOR: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT || '',
  RECYCLABLES: process.env.NEXT_PUBLIC_RECYCLABLES_CONTRACT || '',
} as const

