import { NextRequest, NextResponse } from 'next/server'
import { safeJsonParse } from '@/lib/input-validation'
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * Snapchain API endpoint for looking up Farcaster user data by FID
 * 
 * Uses Snapchain HTTP API: https://snapchain.farcaster.xyz/reference/httpapi/userdata
 * 
 * NOTE: Snapchain requires self-hosting (16GB RAM, 4 CPU, 2TB storage).
 * For most apps, Neynar API is recommended instead (just needs API key).
 * This endpoint is used as an optional fallback if Neynar fails.
 * 
 * User data types:
 * - USER_DATA_TYPE_PFP (1): Profile Picture
 * - USER_DATA_TYPE_DISPLAY (2): Display Name
 * - USER_DATA_TYPE_BIO (3): Bio
 * - USER_DATA_TYPE_USERNAME (6): Username
 * 
 * If no user_data_type is specified, returns all user data for the FID
 * 
 * Setup: Add NEXT_PUBLIC_SNAPCHAIN_ENDPOINT=http://your-server:3381 to .env.local
 * See SNAPCHAIN_SETUP.md for detailed setup instructions
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.GENERAL)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const fid = searchParams.get('fid')
    const userDataType = searchParams.get('user_data_type') // Optional: 1=PFP, 2=Display, 3=Bio, 6=Username

    if (!fid) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
        { status: 400 }
      )
    }

    // Get Snapchain endpoint from env
    // Note: Snapchain requires self-hosting (see SNAPCHAIN_SETUP.md)
    // If not configured, this endpoint returns 503 and caller should use Neynar instead
    const snapchainEndpoint = process.env.NEXT_PUBLIC_SNAPCHAIN_ENDPOINT
    
    if (!snapchainEndpoint) {
      return NextResponse.json(
        { error: 'Snapchain endpoint not configured. Use Neynar API instead (easier setup).' },
        { status: 503 } // Service Unavailable - indicates fallback should be used
      )
    }
    
    // Build URL - if user_data_type is specified, include it
    let snapchainUrl = `${snapchainEndpoint}/v1/userDataByFid?fid=${fid}`
    if (userDataType) {
      snapchainUrl += `&user_data_type=${userDataType}`
    }

    const response = await fetch(snapchainUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Snapchain API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch user data from Snapchain' },
        { status: response.status }
      )
    }

    const text = await response.text()
    // SECURITY: Validate JSON depth from external API response
    const data = safeJsonParse(text, 15, {
      endpoint: '/api/snapchain/user-by-fid',
      request,
    })
    
    // Transform Snapchain response to our expected format
    // Snapchain can return:
    // 1. Single message: { data: { userDataBody: {...} }, ... }
    // 2. Array of messages: [{ data: { userDataBody: {...} }, ... }, ...]
    // 3. Paginated response: { messages: [...], nextPageToken: ... }
    
    let messages: any[] = []
    
    if (Array.isArray(data)) {
      messages = data
    } else if (data.messages && Array.isArray(data.messages)) {
      // Paginated response
      messages = data.messages
    } else if (data.data) {
      // Single message
      messages = [data]
    } else {
      // Try to extract from root level
      messages = [data]
    }
    
    // Extract user data from messages
    const userData: {
      pfp?: string
      displayName?: string
      bio?: string
      username?: string
    } = {}
    
    for (const message of messages) {
      // Handle different response structures
      const userDataBody = message.userDataBody || message.data?.userDataBody || message
      if (!userDataBody || !userDataBody.value) continue
      
      const type = userDataBody.type
      const value = userDataBody.value
      
      // Handle both string and numeric types
      if (type === 'USER_DATA_TYPE_PFP' || type === 1) {
        userData.pfp = value
      } else if (type === 'USER_DATA_TYPE_DISPLAY' || type === 2) {
        userData.displayName = value
      } else if (type === 'USER_DATA_TYPE_BIO' || type === 3) {
        userData.bio = value
      } else if (type === 'USER_DATA_TYPE_USERNAME' || type === 6) {
        userData.username = value
      }
    }
    
    return NextResponse.json({
      fid: parseInt(fid, 10),
      ...userData,
    })
  } catch (error: any) {
    console.error('Error in snapchain user-by-fid endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

