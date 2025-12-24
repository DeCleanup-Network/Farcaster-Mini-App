/**
 * Farcaster FID (Farcaster ID) resolution utilities
 * For Farcaster flow - resolve FID to address
 */

import type { Address } from 'viem'

// Farcaster Hub API endpoint (public)
const FARCASTER_HUB_API = 'https://hubs.airstack.xyz'

/**
 * Resolve FID to address using Farcaster Hub API
 */
export async function resolveFID(fid: string | number): Promise<Address | null> {
  try {
    const fidNumber = typeof fid === 'string' ? parseInt(fid, 10) : fid
    
    if (isNaN(fidNumber) || fidNumber <= 0) {
      return null
    }

    // Use Airstack API for Farcaster data
    const response = await fetch('https://api.airstack.xyz/gql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.NEXT_PUBLIC_AIRSTACK_API_KEY || '',
      },
      body: JSON.stringify({
        query: `
          query GetFarcasterUser($fid: String!) {
            Socials(
              input: {
                filter: {
                  dappName: { _eq: farcaster }
                  userId: { _eq: $fid }
                }
                blockchain: ethereum
              }
            ) {
              Social {
                userAssociatedAddresses
              }
            }
          }
        `,
        variables: {
          fid: fidNumber.toString(),
        },
      }),
    })

    if (!response.ok) {
      // Fallback to direct Hub API if Airstack fails
      return await resolveFIDFromHub(fidNumber)
    }

    const data = await response.json()
    
    if (data?.data?.Socials?.Social?.[0]?.userAssociatedAddresses?.[0]) {
      return data.data.Socials.Social[0].userAssociatedAddresses[0] as Address
    }

    // Fallback to Hub API
    return await resolveFIDFromHub(fidNumber)
  } catch (error) {
    console.error('Error resolving FID:', error)
    // Try fallback
    try {
      const fidNumber = typeof fid === 'string' ? parseInt(fid, 10) : fid
      return await resolveFIDFromHub(fidNumber)
    } catch (fallbackError) {
      console.error('Fallback FID resolution failed:', fallbackError)
      return null
    }
  }
}

/**
 * Fallback: Resolve FID using Farcaster Hub API directly
 */
async function resolveFIDFromHub(fid: number): Promise<Address | null> {
  try {
    // Use Neynar API as fallback (public endpoint)
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/by_id?fid=${fid}`, {
      headers: {
        'api_key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    // Neynar returns custody_address or verifications
    if (data?.result?.user?.custody_address) {
      return data.result.user.custody_address as Address
    }
    
    // Try verifications array
    if (data?.result?.user?.verifications?.[0]) {
      return data.result.user.verifications[0] as Address
    }

    return null
  } catch (error) {
    console.error('Error resolving FID from Hub:', error)
    return null
  }
}

/**
 * Validate if a string is a valid FID format
 */
export function isValidFIDFormat(input: string): boolean {
  // FID is a positive integer
  const fidRegex = /^\d+$/
  return fidRegex.test(input) && parseInt(input, 10) > 0
}

/**
 * Get FID from Farcaster username (optional helper)
 */
export async function getFIDFromUsername(username: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/by_username?username=${username.replace('@', '')}`, {
      headers: {
        'api_key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data?.result?.user?.fid || null
  } catch (error) {
    console.error('Error getting FID from username:', error)
    return null
  }
}

