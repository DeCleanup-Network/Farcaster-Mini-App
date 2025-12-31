/**
 * Chain Detection with Caching
 * 
 * Prevents race conditions by caching chain detection results and ensuring
 * all chain checks are awaited properly.
 */

import { getChainId, getAccount } from 'wagmi/actions'
import { getWagmiConfig, REQUIRED_CHAIN_ID } from './wagmi'

// Cache for chain ID to prevent multiple simultaneous lookups
let chainIdCache: {
  value: number | null
  timestamp: number
  promise: Promise<number | null> | null
} = {
  value: null,
  timestamp: 0,
  promise: null,
}

const CACHE_TTL = 2000 // 2 seconds cache

/**
 * Get current chain ID with caching and race condition prevention
 */
export async function getCurrentChainIdCached(forceRefresh = false): Promise<number | null> {
  const now = Date.now()
  
  // Return cached value if still valid and not forcing refresh
  if (!forceRefresh && chainIdCache.value !== null && (now - chainIdCache.timestamp) < CACHE_TTL) {
    return chainIdCache.value
  }

  // If there's already a pending promise, return it to prevent race conditions
  if (chainIdCache.promise) {
    return chainIdCache.promise
  }

  // Create new promise for chain detection
  chainIdCache.promise = (async () => {
    try {
      const account = getAccount(getWagmiConfig())
      
      // If not connected, return null
      if (account.status !== 'connected' || !account.address) {
        chainIdCache.value = null
        chainIdCache.timestamp = now
        chainIdCache.promise = null
        return null
      }

      // Get chain ID
      const chainId = await getChainId(getWagmiConfig())
      
      // Update cache
      chainIdCache.value = chainId
      chainIdCache.timestamp = now
      chainIdCache.promise = null
      
      return chainId
    } catch (error) {
      console.error('[chain-detection] Error getting chain ID:', error)
      chainIdCache.value = null
      chainIdCache.timestamp = now
      chainIdCache.promise = null
      return null
    }
  })()

  return chainIdCache.promise
}

/**
 * Clear chain ID cache (useful after chain switches)
 */
export function clearChainIdCache(): void {
  chainIdCache = {
    value: null,
    timestamp: 0,
    promise: null,
  }
}

/**
 * Check if wallet is on required chain (with caching)
 */
export async function isOnRequiredChain(forceRefresh = false): Promise<boolean> {
  const chainId = await getCurrentChainIdCached(forceRefresh)
  return chainId === REQUIRED_CHAIN_ID
}

