import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME, REQUIRED_RPC_URL, config } from './wagmi'
import { getAccount } from 'wagmi/actions'

const NATIVE_CURRENCY = { name: 'Ether', symbol: 'ETH', decimals: 18 }

/**
 * Attempts to add the required Base network to the connected wallet
 * Works with both injected wallets (MetaMask) and WalletConnect
 * @returns true if the wallet reports success, false otherwise
 */
export async function tryAddRequiredChain(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  const chainParams = {
    chainId: `0x${REQUIRED_CHAIN_ID.toString(16)}`,
    chainName: REQUIRED_CHAIN_NAME,
    nativeCurrency: NATIVE_CURRENCY,
    rpcUrls: [REQUIRED_RPC_URL],
    blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL],
  }

  // Try method 1: Direct provider (works for MetaMask and other injected wallets)
  const provider = (window as any)?.ethereum
  if (provider?.request) {
    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [chainParams],
      })
      console.log('✅ Added Base network via wallet_addEthereumChain')
      return true
    } catch (error: any) {
      // If it's a user rejection, don't try other methods
      if (error?.code === 4001 || error?.message?.includes('rejected')) {
        console.log('User rejected chain addition')
        return false
      }
      console.warn('wallet_addEthereumChain failed, trying alternative method:', error)
    }
  }

  // Try method 2: Through wagmi connector (works for WalletConnect)
  try {
    const account = await getAccount(config)
    if (account.connector) {
      // Some connectors support adding chains directly
      const connector = account.connector as any
      
      // Try connector's addChain method if available
      if (connector.addChain) {
        try {
          await connector.addChain({
            id: REQUIRED_CHAIN_ID,
            name: REQUIRED_CHAIN_NAME,
            nativeCurrency: NATIVE_CURRENCY,
            rpcUrls: {
              default: { http: [REQUIRED_RPC_URL] },
            },
            blockExplorers: {
              default: { url: REQUIRED_BLOCK_EXPLORER_URL },
            },
          })
          console.log('✅ Added Base network via connector.addChain')
          return true
        } catch (connectorError) {
          console.warn('Connector addChain failed:', connectorError)
        }
      }

      // Try getting provider from connector
      const connectorProvider = await connector.getProvider?.()
      if (connectorProvider?.request) {
        try {
          await connectorProvider.request({
            method: 'wallet_addEthereumChain',
            params: [chainParams],
          })
          console.log('✅ Added Base network via connector provider')
          return true
        } catch (providerError) {
          console.warn('Connector provider request failed:', providerError)
        }
      }
    }
  } catch (wagmiError) {
    console.warn('Wagmi connector method failed:', wagmiError)
  }

  // If all methods failed, return false
  console.warn('Could not add chain - all methods failed. User may need to add manually.')
  return false
}
