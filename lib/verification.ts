import { Address } from 'viem'
import { getCleanupStatus } from './contracts'

/**
 * Verification Status Utilities
 * Check cleanup verification status
 */

export interface VerificationStatus {
  cleanupId: bigint
  verified: boolean
  claimed: boolean
  level: number
  canClaim: boolean
}

/**
 * Get user's pending cleanups
 */
export async function getPendingCleanups(userAddress: Address): Promise<VerificationStatus[]> {
  // TODO: Fetch from backend API or contract events
  // For now, return empty array
  return []
}

/**
 * Find user's cleanup by checking recent cleanup IDs on-chain
 * This is a fallback when localStorage doesn't have the cleanup ID
 */
async function findUserCleanupOnChain(
  userAddress: Address
): Promise<VerificationStatus | null> {
  try {
    const { getCleanupCounter, getCleanupStatus } = await import('./contracts')
    
    // Get the current cleanup counter
    const counter = await getCleanupCounter()
    if (counter <= BigInt(1)) {
      // No cleanups exist yet
      return null
    }
    
    // Check recent cleanups (last 50 to avoid too many calls)
    // Start from the most recent and work backwards
    const maxCheck = 50
    const startId = counter > BigInt(maxCheck) ? counter - BigInt(maxCheck) : BigInt(1)
    
    for (let id = counter - BigInt(1); id >= startId; id--) {
      try {
        const status = await getCleanupStatus(id)
        
        // Check if this cleanup belongs to the user
        if (status.user.toLowerCase() === userAddress.toLowerCase()) {
          console.log(`Found user's cleanup on-chain: ${id.toString()}`)
          
          // Update localStorage with the found cleanup ID
          if (typeof window !== 'undefined') {
            const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
            localStorage.setItem(pendingKey, id.toString())
          }
          
          return {
            cleanupId: id,
            verified: status.verified,
            claimed: status.claimed,
            level: status.level,
            canClaim: status.verified && !status.claimed,
          }
        }
      } catch (error: any) {
        // Skip if cleanup doesn't exist or other error
        const errorMessage = error?.message || String(error)
        if (!errorMessage.includes('does not exist')) {
          console.warn(`Error checking cleanup ${id.toString()}:`, errorMessage)
        }
        // Continue checking other IDs
      }
    }
    
    return null
  } catch (error) {
    console.error('Error finding cleanup on-chain:', error)
    return null
  }
}

/**
 * Get user's latest cleanup status
 * Checks localStorage first, then falls back to on-chain search
 */
export async function getLatestCleanupStatus(
  userAddress: Address
): Promise<VerificationStatus | null> {
  try {
    // First, check localStorage for quick access
    if (typeof window !== 'undefined' && userAddress) {
      const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
      const pendingCleanupId = localStorage.getItem(pendingKey)
      
      if (pendingCleanupId) {
        try {
          const { getCleanupStatus } = await import('./contracts')
          const status = await getCleanupStatus(BigInt(pendingCleanupId))
          
          // Verify this cleanup belongs to the current user
          if (status.user.toLowerCase() !== userAddress.toLowerCase()) {
            console.log('Cleanup belongs to different user, clearing localStorage')
            localStorage.removeItem(pendingKey)
            localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
            // Fall through to on-chain search
          } else {
            // Found valid cleanup in localStorage
            return {
              cleanupId: BigInt(pendingCleanupId),
              verified: status.verified,
              claimed: status.claimed,
              level: status.level,
              canClaim: status.verified && !status.claimed,
            }
          }
        } catch (error: any) {
          // If cleanup doesn't exist, clear localStorage and search on-chain
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('does not exist')) {
            console.log('Cleanup not found in localStorage, searching on-chain...')
            localStorage.removeItem(pendingKey)
            localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
          }
        }
      }
      
      // Also check and clear old global keys for backward compatibility
      const oldPendingId = localStorage.getItem('pending_cleanup_id')
      if (oldPendingId) {
        localStorage.removeItem('pending_cleanup_id')
        localStorage.removeItem('pending_cleanup_location')
      }
    }
    
    // If not found in localStorage, search on-chain
    console.log('Searching for user cleanup on-chain...')
    return await findUserCleanupOnChain(userAddress)
  } catch (error) {
    console.error('Error getting cleanup status:', error)
    return null
  }
}

/**
 * Get user's cleanup and claim status in a single call
 * Returns all information needed for the UI
 */
export async function getUserCleanupStatus(
  userAddress: Address
): Promise<{
  hasPendingCleanup: boolean
  canClaim: boolean
  cleanupId?: bigint
  reason?: string
  verified?: boolean
  claimed?: boolean
  level?: number
}> {
  try {
    const latest = await getLatestCleanupStatus(userAddress)
    
    if (!latest) {
      // Clear any stale localStorage data when no cleanup is found
      if (typeof window !== 'undefined' && userAddress) {
        const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
        const oldPendingId = localStorage.getItem(pendingKey)
        if (oldPendingId) {
          console.log('Clearing stale localStorage cleanup data')
          localStorage.removeItem(pendingKey)
          localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
        }
        // Also clear old global keys
        localStorage.removeItem('pending_cleanup_id')
        localStorage.removeItem('pending_cleanup_location')
      }
      
      return {
        hasPendingCleanup: false,
        canClaim: false,
        reason: 'No cleanup submissions found. Submit a cleanup first.',
      }
    }
    
    const hasPending = !latest.verified
    const canClaim = latest.verified && !latest.claimed
    
    return {
      hasPendingCleanup: hasPending,
      canClaim,
      cleanupId: latest.cleanupId,
      verified: latest.verified,
      claimed: latest.claimed,
      level: latest.level,
      reason: hasPending
        ? 'Your cleanup is still under review. Please wait for verification.'
        : latest.claimed
        ? 'This cleanup has already been claimed.'
        : canClaim
        ? undefined
        : 'No cleanup ready to claim.',
    }
  } catch (error) {
    console.error('Error checking cleanup status:', error)
    return {
      hasPendingCleanup: false,
      canClaim: false,
      reason: 'Error checking cleanup status. Please try again.',
    }
  }
}

/**
 * Check if user can claim level
 */
export async function canClaimLevel(
  userAddress: Address,
  cleanupId?: bigint
): Promise<{ canClaim: boolean; reason?: string }> {
  try {
    if (!cleanupId) {
      // Get latest cleanup
      const latest = await getLatestCleanupStatus(userAddress)
      if (!latest) {
        return {
          canClaim: false,
          reason: 'No cleanup submissions found. Submit a cleanup first.',
        }
      }
      
      if (!latest.verified) {
        return {
          canClaim: false,
          reason: 'Your cleanup is still under review. Please wait for verification.',
        }
      }
      
      if (latest.claimed) {
        return {
          canClaim: false,
          reason: 'This cleanup has already been claimed.',
        }
      }
      
      return {
        canClaim: true,
      }
    }
    
    // Check specific cleanup
    const status = await getCleanupStatus(cleanupId)
    
    if (!status.verified) {
      return {
        canClaim: false,
        reason: 'Your cleanup is still under review. Please wait for verification.',
      }
    }
    
    if (status.claimed) {
      return {
        canClaim: false,
        reason: 'This cleanup has already been claimed.',
      }
    }
    
    return {
      canClaim: true,
    }
  } catch (error) {
    console.error('Error checking claim status:', error)
    return {
      canClaim: false,
      reason: 'Error checking claim status. Please try again.',
    }
  }
}

