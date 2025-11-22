/**
 * Helper function to find cleanup submissions by wallet address
 * This is useful for debugging when a cleanup doesn't appear in the verifier dashboard
 */

import { Address } from 'viem'
import { readContract } from 'wagmi/actions'
import { config } from './wagmi'
import { CONTRACT_ADDRESSES, VERIFICATION_ABI } from './contracts'

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
    // Get the cleanup counter to know the range
    const counter = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'cleanupCounter',
    })

    const maxCleanupId = Number(counter) > 0 ? Number(counter) - 1 : 0
    const searchRange = Math.min(maxCleanupId, maxSearchRange)
    
    console.log(`Searching for cleanups by wallet "${walletAddressOrPartial}" (search term: "${searchTerm}")...`)
    console.log(`Counter: ${counter.toString()}, Searching IDs 1 to ${searchRange}`)

    // Search from 1 to the search range
    for (let i = 1; i <= searchRange; i++) {
      try {
        const status = await readContract(config, {
          address: CONTRACT_ADDRESSES.VERIFICATION,
          abi: VERIFICATION_ABI,
          functionName: 'getCleanupStatus',
          args: [BigInt(i)],
        })

        // getCleanupStatus returns a tuple: [user, verified, claimed, level]
        const user = Array.isArray(status) ? status[0] : (status as any).user
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
          // Extract status fields from tuple
          const verified = Array.isArray(status) ? status[1] : (status as any).verified
          const claimed = Array.isArray(status) ? status[2] : (status as any).claimed
          const level = Array.isArray(status) ? Number(status[3]) : Number((status as any).level)
          
          console.log(`Found cleanup ID ${i} for wallet ${user}`)
          results.push({
            cleanupId: BigInt(i),
            verified: verified as boolean,
            claimed: claimed as boolean,
            level: level,
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
 * Get full cleanup details by ID
 */
export async function getCleanupById(cleanupId: bigint) {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not configured')
  }

  try {
    const details = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'getCleanup',
      args: [cleanupId],
    })

    // Handle both tuple and object return types
    if (Array.isArray(details)) {
      return {
        id: cleanupId,
        user: details[0] as Address,
        beforePhotoHash: details[1] as string,
        afterPhotoHash: details[2] as string,
        timestamp: details[3] as bigint,
        latitude: details[4] as bigint,
        longitude: details[5] as bigint,
        verified: details[6] as boolean,
        claimed: details[7] as boolean,
        rejected: details[8] as boolean,
        level: Number(details[9]),
        referrer: details[10] as Address,
        hasImpactForm: details[11] as boolean,
        impactReportHash: details[12] as string,
      }
    } else {
      // Object return type
      return {
        id: cleanupId,
        user: (details as any).user as Address,
        beforePhotoHash: (details as any).beforePhotoHash as string,
        afterPhotoHash: (details as any).afterPhotoHash as string,
        timestamp: (details as any).timestamp as bigint,
        latitude: (details as any).latitude as bigint,
        longitude: (details as any).longitude as bigint,
        verified: (details as any).verified as boolean,
        claimed: (details as any).claimed as boolean,
        rejected: (details as any).rejected as boolean,
        level: Number((details as any).level),
        referrer: (details as any).referrer as Address,
        hasImpactForm: (details as any).hasImpactForm as boolean,
        impactReportHash: (details as any).impactReportHash as string,
      }
    }
  } catch (error) {
    console.error(`Error getting cleanup ${cleanupId.toString()}:`, error)
    throw error
  }
}

