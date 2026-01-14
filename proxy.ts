import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
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
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

