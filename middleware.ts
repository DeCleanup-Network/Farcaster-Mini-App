import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyRequest } from 'botid'

/**
 * Vercel Bot ID Middleware
 * 
 * Protects sensitive routes from bot traffic using Vercel's Bot Protection.
 * Bot scores range from 0 (definitely a bot) to 100 (definitely human).
 * 
 * This middleware runs at the Edge level, providing protection before
 * requests reach your application code.
 */
export async function middleware(request: NextRequest) {
  // Only protect sensitive API routes and verifier pages
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for static files, images, and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/og') ||
    pathname.startsWith('/og') ||
    pathname.startsWith('/.well-known') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  // Protect sensitive routes
  const protectedRoutes = [
    '/api/cleanup/submit',
    '/api/cleanup/verify',
    '/api/points',
    '/verifier',
  ]

  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  try {
    // Verify request using Vercel Bot ID
    // This checks the x-vercel-bot-score header automatically
    const isValid = await verifyRequest(request)

    if (!isValid) {
      // Bot detected - block the request
      console.warn(`[Bot Protection] Blocked bot request to ${pathname}`)
      return new NextResponse(
        JSON.stringify({ 
          error: 'Access denied: Bot activity detected',
          message: 'Please ensure you are using a supported browser and try again.'
        }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Request is valid - allow it to proceed
    return NextResponse.next()
  } catch (error) {
    // If verification fails (e.g., in development), log and allow request
    // In production, you may want to be more strict
    console.error('[Bot Protection] Verification error:', error)
    
    // In development, allow requests to proceed
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Bot Protection] Allowing request in development mode')
      return NextResponse.next()
    }

    // In production, be more cautious
    // You can choose to block or allow based on your security requirements
    return NextResponse.next()
  }
}

// Configure which routes should run this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
}

