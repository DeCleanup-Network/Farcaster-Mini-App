import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import { safeJsonParse } from '@/lib/input-validation'

/**
 * Verify Cloudflare Turnstile CAPTCHA token
 * 
 * This endpoint verifies CAPTCHA tokens server-side to prevent abuse.
 * Always verify CAPTCHA on the server - client-side verification can be bypassed.
 */
export async function POST(request: NextRequest) {
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

    // Parse request body with input validation
    const body = await request.text()
    const data = safeJsonParse<{ token: string }>(
      body,
      5, // Max depth: 5 (simple object)
      { endpoint: '/api/captcha/verify', request }
    )

    const { token } = data

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'CAPTCHA token is required', success: false },
        { status: 400 }
      )
    }

    // Get secret key from environment
    const secretKey = process.env.TURNSTILE_SECRET_KEY

    if (!secretKey) {
      console.error('Turnstile secret key not configured')
      // In development, allow test tokens
      if (process.env.NODE_ENV === 'development') {
        // Cloudflare test secret key always returns success
        if (token.startsWith('1x')) {
          return NextResponse.json({ success: true })
        }
        // Cloudflare test secret key always returns failure
        if (token.startsWith('2x')) {
          return NextResponse.json({ success: false })
        }
      }
      return NextResponse.json(
        { error: 'CAPTCHA verification not configured', success: false },
        { status: 500 }
      )
    }

    // Verify token with Cloudflare Turnstile API
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        // Optional: Include remote IP for additional security
        // remoteip: getClientIP(request),
      }),
    })

    if (!verifyResponse.ok) {
      console.error('Turnstile API error:', verifyResponse.statusText)
      return NextResponse.json(
        { error: 'CAPTCHA verification service unavailable', success: false },
        { status: 503 }
      )
    }

    const verifyData = await verifyResponse.json()

    // Check if verification was successful
    if (verifyData.success === true) {
      return NextResponse.json({
        success: true,
        // Optional: Include additional data from Turnstile
        // challenge_ts: verifyData.challenge_ts,
        // hostname: verifyData.hostname,
      })
    }

    // Verification failed
    return NextResponse.json({
      success: false,
      error: 'CAPTCHA verification failed',
      // Optional: Include error codes for debugging
      // errorCodes: verifyData['error-codes'],
    })
  } catch (error) {
    console.error('Error in CAPTCHA verification:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        success: false,
      },
      { status: 500 }
    )
  }
}

