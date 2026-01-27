import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME, REQUIRED_RPC_URL, getWagmiConfig } from './wagmi'
import { getAccount, switchChain } from 'wagmi/actions'
import { clearChainIdCache } from './chain-detection'

const NATIVE_CURRENCY = { name: 'Ether', symbol: 'ETH', decimals: 18 }
const CHAIN_ID_HEX = `0x${REQUIRED_CHAIN_ID.toString(16)}`
const CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: REQUIRED_CHAIN_NAME,
  nativeCurrency: NATIVE_CURRENCY,
  rpcUrls: [REQUIRED_RPC_URL],
  blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL],
}

type EIP1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }

/**
 * Prefer MetaMask when multiple wallets (e.g. Phantom) overwrite window.ethereum.
 * Use window.ethereum.providers to find isMetaMask and avoid isPhantom so we don't
 * hit Phantom's "connect Phantom or MetaMask" or read Phantom's chain as the active one.
 */
function findMetaMaskProvider(): EIP1193 | null {
  if (typeof window === 'undefined') return null
  const we = (window as any)?.ethereum
  if (!we?.request) return null
  if (Array.isArray(we.providers)) {
    const m = we.providers.find((p: any) => p?.request && p?.isMetaMask && !p?.isPhantom)
    if (m) return m
  }
  if (we.isMetaMask && !(we as any).isPhantom) return we
  return null
}

function getFallbackEthereumProvider(): EIP1193 | null {
  const mm = findMetaMaskProvider()
  if (mm) return mm
  const we = (window as any)?.ethereum
  if (we?.request) return we
  return null
}

/**
 * Resolve the provider for switch/add/verify. Uses the connector's provider but, when it
 * is Phantom, prefers MetaMask from window.ethereum.providers so we don't trigger
 * Phantom's "Phantom or MetaMask" and we verify the wallet we actually switch (MetaMask).
 */
async function resolveProviderForSwitchAndVerify(): Promise<EIP1193 | null> {
  if (typeof window === 'undefined') return null
  try {
    const account = await getAccount(getWagmiConfig())
    const connector = (account as any)?.connector
    if (!connector?.getProvider) return null
    const p = await connector.getProvider()
    if (!p?.request) return null
    // Phantom or aggregator that prompts "Phantom or MetaMask": prefer MetaMask from .providers
    if ((p as any).isPhantom || p === (window as any).phantom?.ethereum ||
        ((p as any).providers && Array.isArray((p as any).providers))) {
      const mm = findMetaMaskProvider()
      if (mm) {
        console.warn('[network] Resolved MetaMask from .providers (connector was Phantom or aggregator)')
        return mm
      }
    }
    return p
  } catch {
    return null
  }
}

async function getProviderForSwitchAndVerify(): Promise<EIP1193 | null> {
  return (await resolveProviderForSwitchAndVerify()) ?? getFallbackEthereumProvider()
}

/**
 * Attempts to add the required Base network to the connected wallet.
 * When preferredProvider is set (e.g. from runWalletSwitch on 4902), add to that provider only.
 * @returns true if the wallet reports success, false otherwise
 */
export async function tryAddRequiredChain(chainId?: number, preferredProvider?: EIP1193 | null): Promise<boolean> {
  const targetChainId = chainId || REQUIRED_CHAIN_ID
  if (typeof window === 'undefined') return false

  const chainParams = {
    chainId: `0x${targetChainId.toString(16)}`,
    chainName: REQUIRED_CHAIN_NAME,
    nativeCurrency: NATIVE_CURRENCY,
    rpcUrls: [REQUIRED_RPC_URL],
    blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL],
  }

  // When called from runWalletSwitch(4902), add to the same provider we're switching
  if (preferredProvider?.request) {
    try {
      await preferredProvider.request({ method: 'wallet_addEthereumChain', params: [chainParams] })
      console.log('✅ Added Base network via preferred provider (same as switch)')
      return true
    } catch (e: any) {
      if (e?.code === 4001 || e?.message?.includes('rejected')) return false
      console.warn('preferred provider wallet_addEthereumChain failed:', e)
    }
  }

  // Connector-first (with Phantom->MetaMask resolution)
  try {
    const p = await resolveProviderForSwitchAndVerify()
    if (p?.request) {
      try {
        await p.request({ method: 'wallet_addEthereumChain', params: [chainParams] })
        console.log('✅ Added Base network via connector provider')
        return true
      } catch (e: any) {
        if (e?.code === 4001 || e?.message?.includes('rejected')) return false
        console.warn('connector provider wallet_addEthereumChain failed:', e)
      }
    }
  } catch (_) {}

  // Fallback: MetaMask from .providers or window.ethereum (avoids using Phantom when MetaMask exists)
  const provider = getFallbackEthereumProvider()
  if (provider?.request) {
    try {
      await provider.request({ method: 'wallet_addEthereumChain', params: [chainParams] })
      console.log('✅ Added Base network via wallet_addEthereumChain')
      return true
    } catch (error: any) {
      if (error?.code === 4001 || error?.message?.includes('rejected')) return false
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

/** Run wallet_switchEthereumChain on a provider; on 4902 tries add+retry on the same provider. Throws on reject/error. */
async function runWalletSwitch(provider: EIP1193): Promise<void> {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
  } catch (e: any) {
    if (e?.code === 4902) {
      const added = await tryAddRequiredChain(undefined, provider)
      if (added) {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
        return
      }
    }
    throw e
  }
}

export async function switchToRequiredChainViaProvider(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const provider = (window as any)?.ethereum
  if (!provider?.request) return false
  await runWalletSwitch(provider)
  return true
}

/**
 * Try wallet_switchEthereumChain via getProviderForSwitchAndVerify (connector with
 * Phantom->MetaMask resolution, then MetaMask from .providers or window.ethereum).
 * Avoids Phantom intercepting when user connected with MetaMask.
 * @returns true on success, false if no usable provider, throws on reject/error.
 */
export async function switchToRequiredChainViaConnectorOrProvider(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const p = await getProviderForSwitchAndVerify()
  if (!p?.request) return false
  await runWalletSwitch(p)
  return true
}

/**
 * Get the current chain ID from getProviderForSwitchAndVerify (same provider order as
 * switch). Avoids reading Phantom's chain when user connected with MetaMask.
 */
export async function getActiveChainId(): Promise<number | null> {
  if (typeof window === 'undefined') return null
  const p = await getProviderForSwitchAndVerify()
  if (!p?.request) return null
  try {
    const hex = await p.request({ method: 'eth_chainId' })
    const n = typeof hex === 'string' ? parseInt(hex, 16) : NaN
    return Number.isNaN(n) ? null : n
  } catch {
    return null
  }
}

/**
 * After a switch, verify via eth_chainId; if correct, clear cache and reload.
 * If not, show alert and try to open in new tab.
 * @returns true if we reloaded, false if we showed the alert
 */
export async function verifyChainAndReload(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 300))
  const actual = await getActiveChainId()
  if (actual === REQUIRED_CHAIN_ID) {
    clearChainIdCache()
    window.location.reload()
    return true
  }
  alert("The app requested a network switch, but the wallet is still on another network. If you're in an in-app browser or embed, open this app in a new tab and switch there.")
  try { window.open(window.location.href, '_blank') } catch (_) {}
  return false
}

/**
 * Shared flow: try raw provider/connector, then wagmi switchChain, with needsAdd
 * and provider fallback. Verifies with eth_chainId before reload.
 * Use from NetworkBlockingScreen or WalletConnect "Wrong Network" button.
 * @returns { success: true } if we reloaded or switched; { success: false } on reject or when we showed an alert
 */
export async function attemptSwitchToRequiredChain(): Promise<{ success: boolean }> {
  if (typeof window === 'undefined') return { success: false }
  clearChainIdCache()
  try {
    const ok = await switchToRequiredChainViaConnectorOrProvider()
    if (ok) {
      const reloaded = await verifyChainAndReload()
      return { success: reloaded }
    }
  } catch (e) {
    if (String((e as any)?.message || '').toLowerCase().includes('rejected')) return { success: false }
  }
  try {
    await switchChain(getWagmiConfig(), { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
    await new Promise((r) => setTimeout(r, 800))
    const reloaded = await verifyChainAndReload()
    return { success: reloaded }
  } catch (err: unknown) {
    const msg = String(err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : err || '').toLowerCase()
    const code = (err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : undefined) as number | undefined
    const needsAdd = msg.includes('not configured') || msg.includes('unrecognized chain') || msg.includes('unknown chain') || code === 4902
    if (needsAdd) {
      const added = await tryAddRequiredChain()
      if (added) {
        await new Promise((r) => setTimeout(r, 1200))
        try {
          await switchChain(getWagmiConfig(), { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
          await new Promise((r) => setTimeout(r, 500))
          const reloaded = await verifyChainAndReload()
          return { success: reloaded }
        } catch (_) {
          alert(`${REQUIRED_CHAIN_NAME} was added. Please switch to it in your wallet, then refresh.`)
        }
      } else {
        alert(`${REQUIRED_CHAIN_NAME} is not in your wallet. Please add it manually:\n\nNetwork: ${REQUIRED_CHAIN_NAME}\nChain ID: ${REQUIRED_CHAIN_ID}\nRPC: ${REQUIRED_RPC_URL}`)
      }
    } else if (msg.includes('rejected')) {
      return { success: false }
    } else {
      try {
        const ok = await switchToRequiredChainViaConnectorOrProvider()
        if (ok) {
          await new Promise((r) => setTimeout(r, 800))
          const reloaded = await verifyChainAndReload()
          return { success: reloaded }
        }
      } catch (_) {}
      alert(`Could not switch to ${REQUIRED_CHAIN_NAME}. Please switch manually in your wallet.`)
    }
  }
  return { success: false }
}
