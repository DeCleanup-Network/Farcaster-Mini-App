import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME, REQUIRED_RPC_URL } from './wagmi'

const NATIVE_CURRENCY = { name: 'Ether', symbol: 'ETH', decimals: 18 }

/**
 * Attempts to add the required Base network to the connected wallet via wallet_addEthereumChain
 * @returns true if the wallet reports success, false otherwise
 */
export async function tryAddRequiredChain(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  const provider = (window as any)?.ethereum
  if (!provider?.request) {
    console.warn('No injected wallet available to add networks')
    return false
  }

  const chainParams = {
    chainId: `0x${REQUIRED_CHAIN_ID.toString(16)}`,
    chainName: REQUIRED_CHAIN_NAME,
    nativeCurrency: NATIVE_CURRENCY,
    rpcUrls: [REQUIRED_RPC_URL],
    blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL],
  }

  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [chainParams],
    })
    console.log('✅ Added Base network to wallet via wallet_addEthereumChain')
    return true
  } catch (error) {
    console.error('wallet_addEthereumChain failed:', error)
    return false
  }
}
