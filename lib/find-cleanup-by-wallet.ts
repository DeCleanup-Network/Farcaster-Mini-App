/**
 * Helper function to find cleanup submissions by wallet address
 * This is useful for debugging when a cleanup doesn't appear in the verifier dashboard
 * Uses contract reads on the configured Base chain (getCleanupCounter, getCleanupStatus, getCleanupDetails).
 */

import { Address } from 'viem'
import {
  CONTRACT_ADDRESSES,
  getCleanupCounter,
  getCleanupStatus,
  getCleanupDetails,
} from './contracts'

/**
 * Find all cleanups submitted by a specific wallet address
 * Supports full addresses or partial matches (e.g., "2493" to find addresses ending in 2493)
 * Searches through cleanup IDs to find matches
 */
export async function findCleanupsByWallet(
  walletAddressOrPartial: string,
  maxSearchRange: number = 100
): Promise<Array<{ cleanupId: bigint; verified: boolean; claimed: boolean; level: number; user: Address }>> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not configured')
  }

  const results: Array<{ cleanupId: bigint; verified: boolean; claimed: boolean; level: number; user: Address }> = []
  
  // Normalize search term - remove 0x if present, convert to lowercase
  const searchTerm = walletAddressOrPartial.trim().toLowerCase().replace(/^0x/, '')

  try {
    // Get the cleanup counter to know the range (uses configured Base chain RPC)
    const counter = await getCleanupCounter()

    const maxCleanupId = Number(counter) > 0 ? Number(counter) - 1 : 0
    const searchRange = Math.min(maxCleanupId, maxSearchRange)
    
    console.log(`Searching for cleanups by wallet "${walletAddressOrPartial}" (search term: "${searchTerm}")...`)
    console.log(`Counter: ${counter.toString()}, Searching IDs 1 to ${searchRange}`)

    // Search from 1 to the search range (getCleanupStatus uses configured Base chain RPC)
    for (let i = 1; i <= searchRange; i++) {
      try {
        const status = await getCleanupStatus(BigInt(i))

        const user = status.user
        if (!user || user === '0x0000000000000000000000000000000000000000') {
          continue
        }

        // Normalize the user address for comparison
        const userAddressLower = (user as string).toLowerCase().replace(/^0x/, '')

        // Check if this cleanup belongs to the wallet (full match or partial match)
        const isMatch = searchTerm.length >= 4 
          ? userAddressLower.endsWith(searchTerm) || userAddressLower.includes(searchTerm)
          : userAddressLower === searchTerm

        if (isMatch) {
          const { verified, claimed, level } = status
          
          console.log(`Found cleanup ID ${i} for wallet ${user}`)
          results.push({
            cleanupId: BigInt(i),
            verified,
            claimed,
            level,
            user: user as Address,
          })
        }
      } catch (error: any) {
        // Skip if cleanup doesn't exist
        const errorMessage = error?.message || String(error)
        if (!errorMessage.includes('revert') && 
            !errorMessage.includes('does not exist') &&
            !errorMessage.includes('Invalid cleanup ID')) {
          console.warn(`Error checking cleanup ${i}:`, errorMessage)
        }
        // Continue searching
      }
    }

    console.log(`Found ${results.length} cleanup(s) matching "${walletAddressOrPartial}"`)
    return results
  } catch (error) {
    console.error('Error searching for cleanups:', error)
    throw error
  }
}

/**
 * Get full cleanup details by ID (uses configured Base chain RPC via getCleanupDetails).
 */
export async function getCleanupById(cleanupId: bigint) {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not configured')
  }

  try {
    const details = await getCleanupDetails(cleanupId)
    return { id: cleanupId, ...details }
  } catch (error) {
    console.error(`Error getting cleanup ${cleanupId.toString()}:`, error)
    throw error
  }
}

