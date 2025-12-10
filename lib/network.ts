import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME, REQUIRED_RPC_URL, getWagmiConfig } from './wagmi'
import { getAccount } from 'wagmi/actions'

const NATIVE_CURRENCY = { name: 'Ether', symbol: 'ETH', decimals: 18 }
const CHAIN_ID_HEX = `0x${REQUIRED_CHAIN_ID.toString(16)}`
const CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: REQUIRED_CHAIN_NAME,
  nativeCurrency: NATIVE_CURRENCY,
  rpcUrls: [REQUIRED_RPC_URL],
  blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL],
}

/**
 * Attempts to add the required Base network to the connected wallet
 * Works with both injected wallets (MetaMask) and WalletConnect
 * @returns true if the wallet reports success, false otherwise
 */
export async function tryAddRequiredChain(chainId?: number): Promise<boolean> {
  // Use provided chainId or fall back to REQUIRED_CHAIN_ID
  const targetChainId = chainId || REQUIRED_CHAIN_ID
  if (typeof window === 'undefined') {
    return false
  }

  const chainParams = {
    chainId: `0x${targetChainId.toString(16)}`,
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

  // Method 2: Through wagmi connector (WalletConnect)
  // This is especially important for Safari mobile where WalletConnect is used
  try {
    const account = await getAccount(getWagmiConfig())
    if (account.connector) {
      const connector = account.connector as any
      
      // Check if it's WalletConnect connector
      const isWalletConnect = connector.id?.includes('walletConnect') || 
                              connector.name?.toLowerCase().includes('walletconnect')
      
      if (isWalletConnect) {
        // For WalletConnect, try to get the provider first
        const connectorProvider = await connector.getProvider?.()
        if (connectorProvider?.request) {
          try {
            await connectorProvider.request({
              method: 'wallet_addEthereumChain',
              params: [chainParams],
            })
            console.log('✅ Added Base network via WalletConnect provider')
            return true
          } catch (wcError: any) {
            // If user rejected, don't try other methods
            if (wcError?.code === 4001 || wcError?.message?.includes('rejected')) {
              console.log('User rejected chain addition via WalletConnect')
              return false
            }
            console.warn('WalletConnect provider request failed:', wcError)
          }
        }
      }
      
      // Try connector's addChain method if available (for other connector types)
      if (connector.addChain) {
        try {
          await connector.addChain({
            id: targetChainId,
            name: REQUIRED_CHAIN_NAME,
            nativeCurrency: NATIVE_CURRENCY,
            rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
            blockExplorers: { default: { url: REQUIRED_BLOCK_EXPLORER_URL } },
          })
          console.log('✅ Added Base network via connector.addChain')
          return true
        } catch (connectorError) {
          console.warn('Connector addChain failed:', connectorError)
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

export async function switchToRequiredChainViaProvider(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const provider = (window as any)?.ethereum
  if (!provider?.request) {
    return false
  }
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    })
    return true
  } catch (error: any) {
    if (error?.code === 4902) {
      const added = await tryAddRequiredChain()
      if (added) {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CHAIN_ID_HEX }],
        })
        return true
      }
    }
    throw error
  }
}
