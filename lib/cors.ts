/**
 * CORS (Cross-Origin Resource Sharing) utilities
 * 
 * Provides secure CORS configuration for API routes.
 * Only allows trusted origins to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Allowed origins for CORS
 * Add your production domains here
 */
const ALLOWED_ORIGINS = [
  // Production domains
  process.env.NEXT_PUBLIC_MINIAPP_URL,
  'https://miniapp.decleanup.net',
  'https://decleanup.net',
  
  // Farcaster domains (for Mini App embedding)
  'https://warpcast.com',
  'https://client.warpcast.com',
  'https://farcaster.xyz',
  'https://client.farcaster.xyz',
  'https://app.farcaster.xyz',
  'https://www.farcaster.xyz',
  'https://www.warpcast.com',
  'https://app.warpcast.com',
  
  // Base domains (for Mini App embedding)
  'https://base.org',
  'https://www.base.org',
  'https://base.dev',
  'https://www.base.dev',
  'https://app.base.org',
  'https://app.base.dev',
  
  // Development (only in development mode)
  ...(process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : []
  ),
].filter((origin): origin is string => Boolean(origin))

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (origin === allowed) return true
    // Subdomain match (e.g., *.decleanup.net)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2)
      return origin.endsWith(`.${domain}`) || origin === domain
    }
    return false
  })
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin')
  const isAllowed = isOriginAllowed(origin)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  }

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  } else {
    // For public endpoints that need CORS, use null origin (no credentials)
    // For private endpoints, don't set CORS headers
    headers['Access-Control-Allow-Origin'] = 'null'
  }

  return headers
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflight(request: NextRequest): NextResponse | null {
  if (request.method === 'OPTIONS') {
    const headers = getCorsHeaders(request)
    return new NextResponse(null, {
      status: 204,
      headers,
    })
  }
  return null
}

/**
 * Add CORS headers to a response
 */
export function withCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const headers = getCorsHeaders(request)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

/**
 * Create a CORS-enabled response
 */
export function corsResponse(
  data: any,
  status: number,
  request: NextRequest
): NextResponse {
  const response = NextResponse.json(data, { status })
  return withCorsHeaders(response, request)
}

