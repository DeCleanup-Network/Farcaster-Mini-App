import { NextRequest, NextResponse } from 'next/server'

// Configure runtime for longer execution time (Vercel serverless functions)
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * API Route to proxy IPFS uploads to Pinata
 * This avoids CORS issues and keeps API keys server-side
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: API keys MUST be server-side only
    // NEXT_PUBLIC_* variables are exposed to client-side JavaScript bundle
    const pinataApiKey = process.env.PINATA_API_KEY
    const pinataSecretKey = process.env.PINATA_SECRET_KEY

    if (!pinataApiKey || !pinataSecretKey) {
      const missingKeys = []
      if (!pinataApiKey) {
        missingKeys.push('PINATA_API_KEY (must be server-side only, NOT NEXT_PUBLIC_*)')
      }
      if (!pinataSecretKey) {
        missingKeys.push('PINATA_SECRET_KEY (must be server-side only, NOT NEXT_PUBLIC_*)')
      }
      
      const debugInfo = {
        missing: missingKeys,
        hasApiKey: !!pinataApiKey,
        hasSecretKey: !!pinataSecretKey,
        apiKeyLength: pinataApiKey?.length || 0,
        secretKeyLength: pinataSecretKey?.length || 0,
        envKeys: Object.keys(process.env).filter(k => k.includes('PINATA')),
        hasNextPublicApiKey: !!process.env.NEXT_PUBLIC_PINATA_API_KEY,
        hasNextPublicSecretKey: !!process.env.NEXT_PUBLIC_PINATA_SECRET_KEY,
        nodeEnv: process.env.NODE_ENV,
      }
      
      console.error('Pinata API keys not configured:', debugInfo)
      
      if (process.env.NEXT_PUBLIC_PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_SECRET_KEY) {
        console.error('SECURITY WARNING: NEXT_PUBLIC_PINATA_* variables are set. These expose keys to client-side! Use PINATA_API_KEY and PINATA_SECRET_KEY (server-side only) instead.')
      }
      
      return NextResponse.json(
        { 
          error: 'Pinata API keys not configured on server',
          details: `Missing: ${missingKeys.join(', ')}. Please set these as server-side environment variables (.env.local for local dev, or in your deployment platform settings). IMPORTANT: Do NOT use NEXT_PUBLIC_* variables for Pinata keys.`
        },
        { status: 500 }
      )
    }

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

    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Image size must be less than 10 MB per image. This image is ${(file.size / (1024 * 1024)).toFixed(2)} MB.` },
        { status: 400 }
      )
    }

    const pinataFormData = new FormData()
    pinataFormData.append('file', file)

    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr)
        pinataFormData.append('pinataMetadata', JSON.stringify(metadata))
      } catch (e) {
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
      const defaultMetadata = {
        name: file.name,
        keyvalues: {
          type: 'cleanup-photo',
          timestamp: new Date().toISOString(),
        },
      }
      pinataFormData.append('pinataMetadata', JSON.stringify(defaultMetadata))
    }

    if (optionsStr) {
      try {
        const options = JSON.parse(optionsStr)
        pinataFormData.append('pinataOptions', JSON.stringify(options))
      } catch (e) {
        const defaultOptions = {
          cidVersion: 1,
          wrapWithDirectory: false,
        }
        pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
      }
    } else {
      const defaultOptions = {
        cidVersion: 1,
        wrapWithDirectory: false,
      }
      pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 seconds
    
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

