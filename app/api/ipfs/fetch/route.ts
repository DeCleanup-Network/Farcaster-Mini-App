import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route to proxy IPFS fetches
 * This bypasses CORS issues by fetching server-side
 */
export async function GET(request: NextRequest) {
  try {
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
          const data = await response.json()
          return NextResponse.json(data, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET',
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          })
        }
      } catch (error) {
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

