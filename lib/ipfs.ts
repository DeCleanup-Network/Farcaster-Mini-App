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
    const pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY
    const pinataSecretKey = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY

    if (!pinataApiKey || !pinataSecretKey) {
      throw new Error('Pinata API keys not configured. Please set NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_SECRET_KEY in .env.local')
    }

    // Create FormData for Pinata
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
    formData.append('pinataMetadata', metadata)

    // Add options
    const options = JSON.stringify({
      cidVersion: 1,
      wrapWithDirectory: false,
    })
    formData.append('pinataOptions', options)

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Pinata upload error:', errorData)
      throw new Error(`Failed to upload to IPFS: ${errorData.error?.reason || response.statusText}`)
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash || data.hash || data.cid

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from Pinata')
    }

    // Construct IPFS URL
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    const ipfsUrl = `${gateway}${ipfsHash}`

    return {
      hash: ipfsHash,
      url: ipfsUrl,
    }
  } catch (error) {
    console.error('IPFS upload error:', error)
    if (error instanceof Error) {
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
 * Get IPFS URL from hash
 * @param hash IPFS hash
 * @returns Full IPFS URL
 */
export function getIPFSUrl(hash: string): string {
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
  return `${gateway}${hash}`
}

