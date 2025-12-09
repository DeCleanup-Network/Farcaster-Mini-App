import { NextRequest, NextResponse } from 'next/server'

// Configure runtime for longer execution time (Vercel serverless functions)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large uploads

/**
 * API Route to proxy IPFS uploads to Pinata
 * This avoids CORS issues and keeps API keys server-side
 * 
 * Note: Vercel Hobby plan has 4.5MB body size limit
 * For larger files, consider upgrading to Pro plan or using direct client upload
 */
export async function POST(request: NextRequest) {
  try {
    // Get API keys from server-side environment variables ONLY
    // CRITICAL: Never use NEXT_PUBLIC_* for secrets - they are exposed to client-side
    const pinataApiKey = process.env.PINATA_API_KEY
    const pinataSecretKey = process.env.PINATA_SECRET_KEY

    if (!pinataApiKey || !pinataSecretKey) {
      console.error('Pinata API keys not configured - missing PINATA_API_KEY or PINATA_SECRET_KEY')
      return NextResponse.json(
        { error: 'Pinata API keys not configured on server' },
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

    // Validate file size: each image must be max 4MB to avoid Vercel body size limits
    // Vercel Hobby plan has 4.5MB limit, so we use 4MB to be safe
    const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB per image (Vercel limit is 4.5MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Image size must be less than 4 MB per image. This image is ${(file.size / (1024 * 1024)).toFixed(2)} MB. Please compress your image and try again.` },
        { status: 400 }
      )
    }

    // Validate file type - only allow images
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only image files (JPEG, PNG, WebP, GIF) are allowed.` },
        { status: 400 }
      )
    }

    // Also validate file extension as additional security layer
    const fileName = file.name.toLowerCase()
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))
    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file extension. Only image files are allowed.' },
        { status: 400 }
      )
    }

    // Create new FormData for Pinata
    const pinataFormData = new FormData()
    pinataFormData.append('file', file)

    // Parse and add metadata if provided
    // Validate metadata structure to prevent DoS and injection
    if (metadataStr) {
      try {
        // Limit metadata size to prevent DoS
        if (metadataStr.length > 10000) {
          throw new Error('Metadata too large')
        }
        
        const metadata = JSON.parse(metadataStr)
        
        // Validate metadata structure
        if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
          throw new Error('Invalid metadata structure')
        }
        
        // Ensure name is a string if present
        if (metadata.name && typeof metadata.name !== 'string') {
          throw new Error('Invalid metadata.name type')
        }
        
        // Validate keyvalues if present
        if (metadata.keyvalues && (typeof metadata.keyvalues !== 'object' || Array.isArray(metadata.keyvalues))) {
          throw new Error('Invalid metadata.keyvalues type')
        }
        
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
    // Validate options structure to prevent DoS and injection
    if (optionsStr) {
      try {
        // Limit options size to prevent DoS
        if (optionsStr.length > 5000) {
          throw new Error('Options too large')
        }
        
        const options = JSON.parse(optionsStr)
        
        // Validate options structure
        if (typeof options !== 'object' || options === null || Array.isArray(options)) {
          throw new Error('Invalid options structure')
        }
        
        // Only allow safe options
        const safeOptions: any = {}
        if (options.cidVersion !== undefined) {
          safeOptions.cidVersion = Number(options.cidVersion) === 1 ? 1 : 0
        }
        if (options.wrapWithDirectory !== undefined) {
          safeOptions.wrapWithDirectory = Boolean(options.wrapWithDirectory)
        }
        
        pinataFormData.append('pinataOptions', JSON.stringify(safeOptions))
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
    // Use AbortController for timeout (Vercel serverless functions have 10s timeout on Hobby plan)
    // Increased timeout to 45 seconds for larger files and slower connections
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 seconds timeout
    
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

