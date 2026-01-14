import { NextRequest, NextResponse } from 'next/server'

// Configure runtime for longer execution time (Vercel serverless functions)
export const runtime = 'nodejs'
export const maxDuration = 90 // Match the timeout in the upload function

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
      } catch {
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
      } catch {
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
      console.log('Uploading to Pinata, file size:', file.size, 'bytes')
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
      console.log('Pinata response status:', response.status, response.statusText)
    } catch (error: any) {
      clearTimeout(timeoutId)
      console.error('Pinata fetch error:', error)
      
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Upload timeout - file may be too large. Please try a smaller image or try again.' },
          { status: 408 }
        )
      }
      
      // More specific error handling
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return NextResponse.json(
          { error: 'Network error: Cannot reach Pinata API. Please check your internet connection and try again.' },
          { status: 503 }
        )
      }
      
      return NextResponse.json(
        { error: `Upload failed: ${error.message || error.toString() || 'Unknown network error'}` },
        { status: 500 }
      )
    }

    if (!response.ok) {
      let errorData: any = {}
      try {
        const text = await response.text()
        errorData = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('Failed to parse Pinata error response:', parseError)
        errorData = {}
      }
      
      console.error('Pinata upload error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      })
      
      // Handle specific Pinata error codes
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: 'Pinata API authentication failed. Please contact support.' },
          { status: 500 }
        )
      }
      
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Upload rate limit exceeded. Please try again in a few moments.' },
          { status: 503 }
        )
      }
      
      const errorMessage = errorData.error?.reason || errorData.error || response.statusText || 'Failed to upload to IPFS'
      return NextResponse.json(
        { error: errorMessage },
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
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload to IPFS'
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.toString) {
      errorMessage = error.toString()
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    )
  }
}

