/**
 * ENS (Ethereum Name Service) resolution utilities
 * For web flow - resolve ENS names to addresses
 */

import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'

// Create public client for ENS resolution (mainnet only)
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'), // Public RPC for ENS
})

/**
 * Resolve ENS name to address
 */
export async function resolveENS(ensName: string): Promise<Address | null> {
  try {
    // Remove .eth suffix if present and normalize
    const normalizedName = ensName.toLowerCase().replace(/\.eth$/, '') + '.eth'
    
    const address = await publicClient.getEnsAddress({
      name: normalizedName,
    })
    
    return address as Address | null
  } catch (error) {
    console.error('Error resolving ENS:', error)
    return null
  }
}

/**
 * Reverse resolve address to ENS name
 */
export async function lookupENS(address: Address): Promise<string | null> {
  try {
    const name = await publicClient.getEnsName({
      address,
    })
    
    return name || null
  } catch (error) {
    console.error('Error looking up ENS:', error)
    return null
  }
}

/**
 * Validate if a string is a valid ENS name format
 */
export function isValidENSFormat(input: string): boolean {
  // Basic ENS validation: alphanumeric, hyphens, dots, ends with .eth
  const ensRegex = /^[a-z0-9-]+\.eth$/i
  return ensRegex.test(input) || ensRegex.test(input + '.eth')
}

