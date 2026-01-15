import { NextRequest, NextResponse } from 'next/server'
import { safeJsonParse } from '@/lib/input-validation'
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * Neynar API endpoint for looking up Farcaster user by FID
 * This is more reliable than using custody address since we have FID from SDK context
 * 
 * Returns user data if Neynar API key is configured, otherwise returns 404
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.NEYNAR_API)
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

    if (!fid) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
        { status: 400 }
      )
    }

    // Check if Neynar API key is configured
    const neynarApiKey = process.env.NEXT_PUBLIC_FARCASTER_NEYNAR_KEY

    if (!neynarApiKey) {
      // Return 200 with empty response if Neynar key is not configured
      // This prevents 404 errors in console for optional feature
      return NextResponse.json(
        { message: 'Neynar API not configured - feature disabled' },
        { status: 200 }
      )
    }

    // Call Neynar API to get user by FID
    // Documentation: https://docs.neynar.com/reference/user-by-id
    // Using v2 API which supports fetching by FID
    const neynarUrl = `https://api.neynar.com/v2/farcaster/user/by_id?fid=${fid}`
    
    const response = await fetch(neynarUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api_key': neynarApiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Neynar API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch user from Neynar' },
        { status: response.status }
      )
    }

    const text = await response.text()
    // SECURITY: Validate JSON depth from external API response
    const userData = safeJsonParse(text, 10, {
      endpoint: '/api/neynar/user-by-fid',
      request,
    })
    return NextResponse.json(userData)
  } catch (error: any) {
    console.error('Error in user-by-fid endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

