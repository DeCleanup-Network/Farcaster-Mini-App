import { NextRequest, NextResponse } from 'next/server'

// Configure runtime for longer execution time (Vercel serverless functions)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large uploads

/**
 * API Route to proxy IPFS uploads to Pinata
 * This avoids CORS issues and keeps API keys server-side
 */
export async function POST(request: NextRequest) {
  try {
    // Get API keys from server-side environment variables
    // Support both PINATA_API_KEY (preferred) and NEXT_PUBLIC_PINATA_API_KEY (fallback for compatibility)
    // NOTE: NEXT_PUBLIC_* variables are exposed to client-side, so PINATA_API_KEY is more secure
    const pinataApiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY
    const pinataSecretKey = process.env.PINATA_SECRET_KEY || process.env.NEXT_PUBLIC_PINATA_SECRET_KEY

    if (!pinataApiKey || !pinataSecretKey) {
      // Better error logging to help debug
      const missingKeys = []
      if (!pinataApiKey) missingKeys.push('PINATA_API_KEY (or NEXT_PUBLIC_PINATA_API_KEY)')
      if (!pinataSecretKey) missingKeys.push('PINATA_SECRET_KEY (or NEXT_PUBLIC_PINATA_SECRET_KEY)')
      
      // Debug: Check actual values (without exposing them)
      const debugInfo = {
        missing: missingKeys,
        hasApiKey: !!pinataApiKey,
        hasSecretKey: !!pinataSecretKey,
        apiKeyLength: pinataApiKey?.length || 0,
        secretKeyLength: pinataSecretKey?.length || 0,
        envKeys: Object.keys(process.env).filter(k => k.includes('PINATA')),
        hasNextPublicApiKey: !!process.env.NEXT_PUBLIC_PINATA_API_KEY,
        hasNextPublicSecretKey: !!process.env.NEXT_PUBLIC_PINATA_SECRET_KEY,
        nextPublicApiKeyLength: process.env.NEXT_PUBLIC_PINATA_API_KEY?.length || 0,
        nextPublicSecretKeyLength: process.env.NEXT_PUBLIC_PINATA_SECRET_KEY?.length || 0,
        nodeEnv: process.env.NODE_ENV,
      }
      
      console.error('Pinata API keys not configured:', debugInfo)
      
      return NextResponse.json(
        { 
          error: 'Pinata API keys not configured on server',
          details: `Missing: ${missingKeys.join(', ')}. Please set these in your environment variables (.env.local for local dev, or in your deployment platform settings).`
        },
        { status: 500 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    const file = formData.get('file') as File
    const metadataStr = formData.get('metadata') as string | null
    const optionsStr = formData.get('options') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size: each image must be max 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per image
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Image size must be less than 10 MB per image. This image is ${(file.size / (1024 * 1024)).toFixed(2)} MB.` },
        { status: 400 }
      )
    }

    // Create new FormData for Pinata
    const pinataFormData = new FormData()
    pinataFormData.append('file', file)

    // Parse and add metadata if provided
    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr)
        pinataFormData.append('pinataMetadata', JSON.stringify(metadata))
      } catch (e) {
        // If metadata is invalid, create default metadata
        const defaultMetadata = {
          name: file.name,
          keyvalues: {
            type: 'cleanup-photo',
            timestamp: new Date().toISOString(),
          },
        }
        pinataFormData.append('pinataMetadata', JSON.stringify(defaultMetadata))
      }
    } else {
      // Default metadata if not provided
      const defaultMetadata = {
        name: file.name,
        keyvalues: {
          type: 'cleanup-photo',
          timestamp: new Date().toISOString(),
        },
      }
      pinataFormData.append('pinataMetadata', JSON.stringify(defaultMetadata))
    }

    // Parse and add options if provided
    if (optionsStr) {
      try {
        const options = JSON.parse(optionsStr)
        pinataFormData.append('pinataOptions', JSON.stringify(options))
      } catch (e) {
        // Default options if invalid
        const defaultOptions = {
          cidVersion: 1,
          wrapWithDirectory: false,
        }
        pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
      }
    } else {
      // Default options
      const defaultOptions = {
        cidVersion: 1,
        wrapWithDirectory: false,
      }
      pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
    }

    // Upload to Pinata via server (no CORS issues)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds timeout
    
    let response: Response
    try {
      response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretKey,
        },
        body: pinataFormData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Upload timeout - file may be too large. Please try a smaller image or try again.' },
          { status: 408 }
        )
      }
      throw error
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Pinata upload error:', errorData)
      return NextResponse.json(
        { error: errorData.error?.reason || response.statusText || 'Failed to upload to IPFS' },
        { status: response.status || 500 }
      )
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash || data.hash || data.cid

    if (!ipfsHash) {
      return NextResponse.json(
        { error: 'No IPFS hash returned from Pinata' },
        { status: 500 }
      )
    }

    // Construct IPFS URL
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
    const ipfsUrl = `${gateway}${ipfsHash}`

    return NextResponse.json({
      hash: ipfsHash,
      url: ipfsUrl,
    })
  } catch (error: any) {
    console.error('IPFS upload API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to upload to IPFS' },
      { status: 500 }
    )
  }
}

