import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'

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
        // Check user agent for legitimate mobile browsers (Safari iOS, Chrome Mobile, etc.)
        const userAgent = request.headers.get('user-agent') || ''
        const isSafariIOS = /iPhone|iPad|iPod/i.test(userAgent) && /Safari/i.test(userAgent) && !/CriOS|FxiOS|OPiOS/i.test(userAgent)
        const isChromeMobile = /Android.*Chrome|CriOS/i.test(userAgent)
        const isLegitimateMobile = isSafariIOS || isChromeMobile

        // Allow legitimate mobile browsers without bot check
        if (isLegitimateMobile) {
          console.log(`[Bot Protection] Allowing legitimate mobile browser: ${userAgent.substring(0, 50)}...`)
          return NextResponse.next()
        }

        // Verify request using Vercel Bot ID
        // This checks the x-vercel-bot-score header automatically
        const result = await checkBotId({
          developmentOptions: {
            isDevelopment: process.env.NODE_ENV !== 'production',
          },
        })

        // Only block if it's clearly a bot AND not human
        // Be more lenient - allow if there's any uncertainty or if isHuman is true
        if (result.isBot && !result.isHuman) {
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
          // In production, be more cautious but still allow on error
          // Better to allow legitimate users than block them
          console.warn('[Bot Protection] Allowing request due to verification error')
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

