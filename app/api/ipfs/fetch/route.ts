import { NextRequest, NextResponse } from 'next/server'
import { safeJsonParse } from '@/lib/input-validation'
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import { isIPBlocked, getClientIP } from '@/lib/security-monitoring'
import { getCorsHeaders } from '@/lib/cors'

/**
 * API Route to proxy IPFS fetches
 * This bypasses CORS issues by fetching server-side
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Check if IP is blocked
    const clientIP = getClientIP(request)
    if (clientIP && isIPBlocked(clientIP)) {
      return NextResponse.json(
        { error: 'Too many security violations. Please try again later.' },
        { status: 429 }
      )
    }

    // SECURITY: Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.IPFS_FETCH)
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

    const searchParams = request.nextUrl.searchParams
    const ipfsPath = searchParams.get('path')

    if (!ipfsPath) {
      return NextResponse.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      )
    }

    // Clean the path
    let cleanPath = ipfsPath.replace(/^ipfs:\/\//, '').replace(/\/+/g, '/')
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1)

    // Try multiple gateways
    const gateways = [
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ]

    for (const gateway of gateways) {
      try {
        const url = `${gateway}${cleanPath}`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DeCleanup-Rewards/1.0',
          },
          // Server-side fetch doesn't have CORS restrictions
          next: { revalidate: 3600 }, // Cache for 1 hour
        })

        if (response.ok) {
          const text = await response.text()
          // SECURITY: Validate JSON depth to prevent DoS attacks from malicious IPFS content
          const data = safeJsonParse(text, 20, {
            endpoint: '/api/ipfs/fetch',
            request,
          })
          // Use secure CORS headers (only allow trusted origins)
          const corsHeaders = getCorsHeaders(request)
          
          return NextResponse.json(data, {
            headers: {
              ...corsHeaders,
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          })
        }
      } catch {
        // Try next gateway
        continue
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch from all IPFS gateways' },
      { status: 503 }
    )
  } catch (error: any) {
    console.error('IPFS fetch API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch IPFS content' },
      { status: 500 }
    )
  }
}

