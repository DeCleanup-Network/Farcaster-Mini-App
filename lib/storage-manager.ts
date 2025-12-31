/**
 * Centralized localStorage Manager
 * 
 * Manages all localStorage keys with per-address scoping and cleanup.
 * Prevents localStorage pollution by ensuring keys are properly scoped and cleaned up.
 */

import { Address } from 'viem'

// Storage key prefixes
const PREFIXES = {
  PENDING_CLEANUP: 'pending_cleanup_id_',
  PENDING_LOCATION: 'pending_cleanup_location_',
  REFERRER: 'referrer_',
  VERIFIER: 'verified_verifier_',
  POINTS: 'points_',
  STAKED_POINTS: 'staked_points_',
  LAST_CLEANUP_LOCATION: 'last_cleanup_location',
} as const

// Legacy global keys (for backward compatibility cleanup)
const LEGACY_KEYS = [
  'pending_cleanup_id',
  'pending_cleanup_location',
  'referrer_pending',
] as const

/**
 * Get a scoped storage key for a specific address
 */
function getScopedKey(prefix: string, address: Address): string {
  return `${prefix}${address.toLowerCase()}`
}

/**
 * Clean up all storage keys for a specific address
 */
export function cleanupAddressStorage(address: Address): void {
  if (typeof window === 'undefined') return

  const addressLower = address.toLowerCase()
  const keysToRemove: string[] = []

  // Find all keys for this address
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue

    // Check if key is scoped to this address
    if (
      key.startsWith(PREFIXES.PENDING_CLEANUP) ||
      key.startsWith(PREFIXES.PENDING_LOCATION) ||
      key.startsWith(PREFIXES.REFERRER) ||
      key.startsWith(PREFIXES.VERIFIER) ||
      key.startsWith(PREFIXES.POINTS) ||
      key.startsWith(PREFIXES.STAKED_POINTS)
    ) {
      if (key.includes(addressLower)) {
        keysToRemove.push(key)
      }
    }
  }

  // Remove all scoped keys
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn(`Failed to remove storage key ${key}:`, e)
    }
  })

  // Also clean up legacy global keys
  LEGACY_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn(`Failed to remove legacy key ${key}:`, e)
    }
  })

  console.log(`🧹 Cleaned up ${keysToRemove.length} storage keys for address ${addressLower}`)
}

/**
 * Clean up all storage keys (for debugging/admin use)
 */
export function cleanupAllStorage(): void {
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []

  // Find all app-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue

    if (
      key.startsWith('pending_cleanup') ||
      key.startsWith('last_cleanup') ||
      key.startsWith('referrer_') ||
      key.startsWith('verified_verifier_') ||
      key.startsWith('points_') ||
      key.startsWith('staked_points_') ||
      LEGACY_KEYS.includes(key as any)
    ) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn(`Failed to remove storage key ${key}:`, e)
    }
  })

  console.log(`🧹 Cleaned up ${keysToRemove.length} storage keys`)
}

/**
 * Set pending cleanup ID for an address
 */
export function setPendingCleanupId(address: Address, cleanupId: bigint): void {
  if (typeof window === 'undefined') return
  const key = getScopedKey(PREFIXES.PENDING_CLEANUP, address)
  localStorage.setItem(key, cleanupId.toString())
}

/**
 * Get pending cleanup ID for an address
 */
export function getPendingCleanupId(address: Address): string | null {
  if (typeof window === 'undefined') return null
  const key = getScopedKey(PREFIXES.PENDING_CLEANUP, address)
  return localStorage.getItem(key)
}

/**
 * Remove pending cleanup ID for an address
 */
export function removePendingCleanupId(address: Address): void {
  if (typeof window === 'undefined') return
  const key = getScopedKey(PREFIXES.PENDING_CLEANUP, address)
  localStorage.removeItem(key)
  // Also remove location key
  const locationKey = getScopedKey(PREFIXES.PENDING_LOCATION, address)
  localStorage.removeItem(locationKey)
}

/**
 * Set pending cleanup location for an address
 */
export function setPendingCleanupLocation(address: Address, location: { lat: number; lng: number }): void {
  if (typeof window === 'undefined') return
  const key = getScopedKey(PREFIXES.PENDING_LOCATION, address)
  localStorage.setItem(key, JSON.stringify(location))
}

/**
 * Get pending cleanup location for an address
 */
export function getPendingCleanupLocation(address: Address): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null
  const key = getScopedKey(PREFIXES.PENDING_LOCATION, address)
  const value = localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * Set referrer for an address
 */
export function setReferrer(address: Address, referrerAddress: Address): void {
  if (typeof window === 'undefined') return
  const key = getScopedKey(PREFIXES.REFERRER, address)
  localStorage.setItem(key, referrerAddress)
  // Clean up legacy key
  localStorage.removeItem('referrer_pending')
}

/**
 * Get referrer for an address
 */
export function getReferrer(address: Address): Address | null {
  if (typeof window === 'undefined') return null
  const key = getScopedKey(PREFIXES.REFERRER, address)
  const value = localStorage.getItem(key)
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null
  return value as Address
}

/**
 * Remove referrer for an address
 */
export function removeReferrer(address: Address): void {
  if (typeof window === 'undefined') return
  const key = getScopedKey(PREFIXES.REFERRER, address)
  localStorage.removeItem(key)
  // Clean up legacy key
  localStorage.removeItem('referrer_pending')
}

/**
 * Check if address has any pending cleanup data
 */
export function hasPendingCleanupData(address: Address): boolean {
  if (typeof window === 'undefined') return false
  return getPendingCleanupId(address) !== null
}

