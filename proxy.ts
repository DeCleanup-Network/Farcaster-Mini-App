import { NextRequest, NextResponse } from 'next/server'
import { verifyRequest } from 'botid'

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Check if we're on the old domain
  const isOldDomain = 
    hostname.includes('farcaster-mini-app-umber') ||
    (hostname.includes('vercel.app') && !hostname.includes('miniapp.decleanup.net'))
  
  // Redirect all old domain traffic (including manifest) to new domain
  if (isOldDomain) {
    const newUrl = new URL(pathname, 'https://miniapp.decleanup.net')
    newUrl.search = request.nextUrl.search
    
    return NextResponse.redirect(newUrl, 301) // Permanent redirect
  }
  
  // Bot Protection: Protect sensitive routes from bot traffic
  // Skip bot protection for static files, images, and public assets
  if (
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api/og') &&
    !pathname.startsWith('/og') &&
    !pathname.startsWith('/.well-known') &&
    !pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
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

    if (isProtectedRoute) {
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
      } catch (error) {
        // If verification fails (e.g., in development), log and allow request
        // In production, you may want to be more strict
        console.error('[Bot Protection] Verification error:', error)
        
        // In development, allow requests to proceed
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Bot Protection] Allowing request in development mode')
        } else {
          // In production, be more cautious
          // You can choose to block or allow based on your security requirements
        }
      }
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static file extensions
     * 
     * Note: We include API routes here so Bot Protection can work on them
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
}

