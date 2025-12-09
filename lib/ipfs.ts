/**
 * IPFS Upload Utility
 * Handles photo uploads to IPFS using Pinata
 */

export interface IPFSUploadResult {
  hash: string
  url: string
}

/**
 * Upload file to IPFS using Pinata
 * @param file File to upload
 * @returns IPFS hash (CID) and URL
 */
export async function uploadToIPFS(file: File): Promise<IPFSUploadResult> {
  try {
    // Use API route to avoid CORS issues
    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: 'cleanup-photo',
        timestamp: new Date().toISOString(),
      },
    })
    formData.append('metadata', metadata)

    // Add options
    const options = JSON.stringify({
      cidVersion: 1,
      wrapWithDirectory: false,
    })
    formData.append('options', options)

    // Upload via our API route (avoids CORS)
    // Add timeout for large files (50 seconds to match server timeout)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000) // 50 seconds
    
    let response: Response
    try {
      response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout - file may be too large. Please try a smaller image (max 10MB) or check your internet connection.')
      }
      throw error
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('IPFS upload error:', errorData)
      
      // Handle timeout specifically
      if (response.status === 408) {
        throw new Error('Upload timeout - file may be too large. Please try a smaller image (max 10MB per image) or check your internet connection.')
      }
      
      throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText || 'Network error'}`)
    }

    const data = await response.json()
    const ipfsHash = data.hash
    const ipfsUrl = data.url

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from upload')
    }

    return {
      hash: ipfsHash,
      url: ipfsUrl,
    }
  } catch (error) {
    console.error('IPFS upload error:', error)
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Please check your internet connection and try again.')
      }
      throw error
    }
    throw new Error('Failed to upload to IPFS')
  }
}

/**
 * Upload multiple files to IPFS
 * @param files Array of files to upload
 * @returns Array of IPFS hashes and URLs
 */
export async function uploadMultipleToIPFS(files: File[]): Promise<IPFSUploadResult[]> {
  const uploadPromises = files.map(file => uploadToIPFS(file))
  return Promise.all(uploadPromises)
}

/**
 * Upload JSON data to IPFS using Pinata
 * @param data JSON data to upload
 * @param name Name for the metadata
 * @returns IPFS hash (CID) and URL
 */
export async function uploadJSONToIPFS(data: any, name: string = 'data'): Promise<IPFSUploadResult> {
  try {
    // Create JSON blob
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const jsonFile = new File([jsonBlob], `${name}.json`, { type: 'application/json' })

    // Use the same upload function (which uses API route)
    return await uploadToIPFS(jsonFile)
  } catch (error) {
    console.error('IPFS JSON upload error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload JSON to IPFS')
  }
}

/**
 * Get IPFS URL from hash with fallback gateways
 * @param hash IPFS hash (may include ipfs:// prefix)
 * @returns Full IPFS URL (uses first gateway, fallbacks handled in image onError)
 */
export function getIPFSUrl(hash: string): string | null {
  if (!hash || hash === '' || hash === '0x' || hash.length === 0) return null
  
  // Remove ipfs:// prefix if present
  let cleanHash = hash.replace(/^ipfs:\/\//, '')
  
  // Clean hash (remove any query params or fragments)
  cleanHash = cleanHash.split('?')[0].split('#')[0].trim()
  
  if (!cleanHash || cleanHash.length === 0) return null
  
  // Use configured gateway or default to ipfs.io (better CORS support)
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
  return `${gateway}${cleanHash}`
}

/**
 * Get fallback IPFS gateways for a hash
 * @param hash IPFS hash (may include ipfs:// prefix)
 * @returns Array of fallback gateway URLs
 */
export function getIPFSFallbackUrls(hash: string): string[] {
  if (!hash || hash === '' || hash === '0x' || hash.length === 0) return []
  
  // Remove ipfs:// prefix if present
  let cleanHash = hash.replace(/^ipfs:\/\//, '')
  
  // Clean hash (remove any query params or fragments)
  cleanHash = cleanHash.split('?')[0].split('#')[0].trim()
  
  if (!cleanHash || cleanHash.length === 0) return []
  
  // List of IPFS gateways that support CORS
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ]
  
  return gateways.map(gateway => `${gateway}${cleanHash}`)
}

