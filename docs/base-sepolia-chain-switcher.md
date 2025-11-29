# Chain Switcher Code for Base Sepolia

This document contains the chain switcher code that works well for switching between networks (e.g., Base Sepolia to other chains).

## Main Chain Switcher Function

**File:** `lib/contracts.ts`

The main function is `ensureWalletOnRequiredChain()` which:

1. Checks current chain
2. Adds the chain if not configured (prevents "Chain not configured" errors)
3. Switches to the required chain
4. Handles WalletConnect and MetaMask

```typescript
async function ensureWalletOnRequiredChain(context = 'transaction', providedChainId?: number | null): Promise<void> {
  // If providedChainId is valid and matches required, trust it and return early
  if (providedChainId !== undefined && providedChainId !== null && providedChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain (from provided chainId: ${providedChainId})`)
    return
  }

  // Use provided chainId if available, otherwise try to get it
  let currentChainId: number | null = providedChainId !== undefined ? providedChainId : await getCurrentChainId()
  console.log(`[${context}] Current chain ID: ${currentChainId}, required: ${REQUIRED_CHAIN_ID}`)

  // If we can't determine chain (e.g., WalletConnect), try to add the chain first
  if (currentChainId === null) {
    console.log(`[${context}] Chain ID is null, attempting to add chain for WalletConnect...`)
    try {
      const added = await tryAddRequiredChain()
      if (added) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        currentChainId = await getCurrentChainId()
        if (currentChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and switched successfully`)
          return
        }
      }
      console.log(`[${context}] ⚠️ Could not determine chain ID, but proceeding - wallet will validate on transaction`)
      return
    } catch (addError) {
      console.error(`[${context}] Failed to add chain:`, addError)
      return
    }
  }

  // Already on correct chain
  if (currentChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain`)
    return
  }

  // Force switch if on wrong chain
  if (currentChainId !== REQUIRED_CHAIN_ID) {
    console.log(`[${context}] Wrong chain (${currentChainId}), attempting to switch to ${REQUIRED_CHAIN_NAME} (${REQUIRED_CHAIN_ID})`)

    // ALWAYS try adding the chain FIRST before switching to prevent "Chain not configured" errors
    try {
      console.log(`[${context}] Attempting to add chain first (required for WalletConnect compatibility)...`)
      const added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
      if (added) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        const checkChainId = await getCurrentChainId()
        if (checkChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and automatically switched`)
          return
        }
        console.log(`[${context}] Chain added but not switched automatically, attempting manual switch...`)
      }
    } catch (addError) {
      console.warn(`[${context}] Pre-add chain attempt failed:`, addError)
    }

    // Now try to switch
    try {
      console.log(`[${context}] Attempting to switch chain - wallet should prompt...`)
      await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })

      // Poll for chain update
      let retries = 0
      while (retries < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const newChainId = await getCurrentChainId()
        if (newChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Successfully switched to ${REQUIRED_CHAIN_NAME}`)
          return
        }
        retries++
      }

      throw new Error(`Failed to switch network. Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet.`)
    } catch (error: any) {
      // Handle "Chain not configured" errors
      if (errorMessage.includes('Chain not configured') || error?.code === 4902) {
        const added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
        if (added) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
          // ... retry logic
        }
      }
      // ... more error handling
    }
  }
}
```

## Chain Addition Function

**File:** `lib/network.ts`

This function adds the chain to the wallet (works with MetaMask and WalletConnect):

```typescript
export async function tryAddRequiredChain(chainId?: number): Promise<boolean> {
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

  // Method 1: Direct provider (MetaMask and other injected wallets)
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
      if (error?.code === 4001 || error?.message?.includes('rejected')) {
        return false
      }
    }
  }

  // Method 2: Through wagmi connector (WalletConnect)
  try {
    const account = await getAccount(config)
    if (account.connector) {
      const connector = account.connector as any
      
      if (connector.addChain) {
        await connector.addChain({
          id: targetChainId,
          name: REQUIRED_CHAIN_NAME,
          nativeCurrency: NATIVE_CURRENCY,
          rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
          blockExplorers: { default: { url: REQUIRED_BLOCK_EXPLORER_URL } },
        })
        return true
      }

      const connectorProvider = await connector.getProvider?.()
      if (connectorProvider?.request) {
        await connectorProvider.request({
          method: 'wallet_addEthereumChain',
          params: [chainParams],
        })
        return true
      }
    }
  } catch (wagmiError) {
    console.warn('Wagmi connector method failed:', wagmiError)
  }

  return false
}
```

## Auto-Switch on Wallet Connect

**File:** `components/wallet/WalletConnect.tsx`

Auto-switches when wallet connects:

```typescript
useEffect(() => {
  if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID && !hasSwitchedNetwork) {
    const attemptSwitch = async () => {
      try {
        // First, try to add the required chain
        await tryAddRequiredChain(REQUIRED_CHAIN_ID)
        // Then request the network switch
        await switchChain({ chainId: REQUIRED_CHAIN_ID })
        setHasSwitchedNetwork(true)
      } catch (error: any) {
        // Handle errors...
      }
    }
    const timeout = setTimeout(attemptSwitch, 1000)
    return () => clearTimeout(timeout)
  }
}, [isConnected, chainId])
```

## Key Points:

1. **Always add chain first** - This prevents "Chain not configured" errors
2. **Wait after adding** - Give the wallet time to process (2-3 seconds)
3. **Poll for confirmation** - Check if switch actually happened
4. **Handle WalletConnect** - Use connector methods for WalletConnect
5. **Handle MetaMask** - Use direct provider.request for MetaMask
6. **User-friendly errors** - Provide clear instructions if auto-switch fails

## Base Sepolia Network Details:

- **Chain ID:** 84532
- **Network Name:** Base Sepolia Testnet
- **RPC URL:** https://sepolia.base.org
- **Block Explorer:** https://sepolia.basescan.org
- **Currency Symbol:** ETH
- **Currency Decimals:** 18

## Usage:

```typescript
// Before any transaction
await ensureWalletOnRequiredChain('my transaction', chainId)

// Or use the helper
await tryAddRequiredChain(REQUIRED_CHAIN_ID)
await switchChain(config, { chainId: REQUIRED_CHAIN_ID })
```

