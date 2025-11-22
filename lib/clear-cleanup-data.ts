/**
 * Utility functions to clear pending cleanup data from localStorage
 * Useful when a cleanup submission glitched or needs to be cleared
 */

import { Address } from 'viem'

/**
 * Clear all pending cleanup data for a specific wallet address
 */
export function clearPendingCleanupData(userAddress: Address): void {
  if (typeof window === 'undefined') return

  const addressLower = userAddress.toLowerCase()
  const pendingKey = `pending_cleanup_id_${addressLower}`
  const locationKey = `pending_cleanup_location_${addressLower}`

  localStorage.removeItem(pendingKey)
  localStorage.removeItem(locationKey)

  // Also clear old global keys for backward compatibility
  localStorage.removeItem('pending_cleanup_id')
  localStorage.removeItem('pending_cleanup_location')

  console.log('Cleared pending cleanup data for:', userAddress)
}

/**
 * Clear all cleanup-related localStorage data (for debugging)
 */
export function clearAllCleanupData(): void {
  if (typeof window === 'undefined') return

  // Clear all keys that start with pending_cleanup
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('pending_cleanup') || key.startsWith('last_cleanup'))) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log('Cleared all cleanup data:', keysToRemove)
}

/**
 * Check if there's pending cleanup data for a user
 */
export function hasPendingCleanupData(userAddress: Address): boolean {
  if (typeof window === 'undefined') return false

  const addressLower = userAddress.toLowerCase()
  const pendingKey = `pending_cleanup_id_${addressLower}`
  return !!localStorage.getItem(pendingKey)
}

/**
 * Get pending cleanup ID for a user (if exists)
 */
export function getPendingCleanupId(userAddress: Address): string | null {
  if (typeof window === 'undefined') return null

  const addressLower = userAddress.toLowerCase()
  const pendingKey = `pending_cleanup_id_${addressLower}`
  return localStorage.getItem(pendingKey)
}

