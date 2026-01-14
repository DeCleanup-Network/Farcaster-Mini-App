/**
 * IPFS Upload Utility
 * Handles photo uploads to IPFS using Pinata
 */

import { logIPFSUploadAttempt, logIPFSUploadSuccess, logIPFSUploadError } from './structured-logging'

export interface IPFSUploadResult {
  hash: string
  url: string
}

/**
 * Upload file to IPFS using Pinata
 * @param file File to upload
 * @returns IPFS hash (CID) and URL
 */
export async function uploadToIPFS(file: File, retries: number = 2): Promise<IPFSUploadResult> {
  await logIPFSUploadAttempt(file.name, file.size)
  
  const attemptUpload = async (attempt: number): Promise<IPFSUploadResult> => {
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
    // Add timeout for large files (90 seconds to match server timeout)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 seconds
    
    let response: Response
    try {
      console.log('Starting IPFS upload for file:', file.name, 'size:', file.size, 'bytes')
      response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Add headers to help with debugging
        headers: {
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
      })
      clearTimeout(timeoutId)
      console.log('IPFS upload response status:', response.status, response.statusText)
    } catch (error: any) {
      clearTimeout(timeoutId)
      console.error('IPFS upload fetch error:', error)
      
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout - file may be too large. Please try a smaller image (max 10MB) or check your internet connection.')
      }
      
      // More specific error messages for different failure types
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Network error: Cannot reach upload server. Please check your internet connection and try again. If the problem persists, the server may be temporarily unavailable.')
      }
      
      if (error.message?.includes('CORS')) {
        throw new Error('CORS error: Upload blocked by browser security. Please try again or contact support.')
      }
      
      // Re-throw with more context
      throw new Error(`Upload failed: ${error.message || error.toString() || 'Unknown network error'}`)
    }

    if (!response.ok) {
      let errorData: any = {}
      try {
        const text = await response.text()
        errorData = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
        errorData = { error: response.statusText || 'Unknown error' }
      }
      
      console.error('IPFS upload error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      })
      
      // Handle specific status codes
      if (response.status === 408) {
        throw new Error('Upload timeout - file may be too large. Please try a smaller image (max 10MB per image) or check your internet connection.')
      }
      
      if (response.status === 400) {
        throw new Error(errorData.error || 'Invalid file. Please check the file size (max 10MB) and format.')
      }
      
      if (response.status === 500) {
        throw new Error(errorData.error || 'Server error during upload. Please try again in a few moments.')
      }
      
      if (response.status === 503) {
        throw new Error('Upload service temporarily unavailable. Please try again in a few moments.')
      }
      
      // Generic error with details from server
      const errorMessage = errorData.error || errorData.details || response.statusText || 'Network error'
      throw new Error(`Failed to upload to IPFS: ${errorMessage}`)
    }

    const data = await response.json()
    const ipfsHash = data.hash
    const ipfsUrl = data.url

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from upload')
    }

      await logIPFSUploadSuccess(file.name, ipfsHash)

      return {
        hash: ipfsHash,
        url: ipfsUrl,
      }
    } catch (error) {
      // Retry logic for network errors
      if (attempt < retries && error instanceof Error) {
        const isRetryableError = 
          error.message.includes('Network') || 
          error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('timeout') ||
          error.message.includes('temporarily unavailable')
        
        if (isRetryableError) {
          console.log(`Retrying upload (attempt ${attempt + 1}/${retries})...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))) // Exponential backoff
          return attemptUpload(attempt + 1)
        }
      }
      
      // If no retries left or non-retryable error, throw
      throw error
    }
  }
  
  try {
    return await attemptUpload(0)
  } catch (error) {
    console.error('IPFS upload error:', error)
    await logIPFSUploadError(file.name, error)
    
    if (error instanceof Error) {
      // If error message already contains specific details, preserve it
      if (error.message && !error.message.includes('Network error: Please check')) {
        throw error
      }
      
      // Provide more helpful error messages for generic network errors
      if (error.message.includes('Network') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Network error: Cannot reach upload server. Please check your internet connection and try again. If the problem persists, the server may be temporarily unavailable.')
      }
      
      throw error
    }
    throw new Error('Failed to upload to IPFS: Unknown error occurred')
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

