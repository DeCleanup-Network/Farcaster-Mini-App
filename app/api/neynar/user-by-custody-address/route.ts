import { NextRequest, NextResponse } from 'next/server'

/**
 * Neynar API endpoint for looking up Farcaster user by custody address
 * This endpoint is called by Base Build/Farcaster SDK to resolve user information
 * 
 * Returns user data if Neynar API key is configured, otherwise returns 404
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      )
    }

    // Check if Neynar API key is configured
    const neynarApiKey = process.env.NEXT_PUBLIC_FARCASTER_NEYNAR_KEY

    if (!neynarApiKey) {
      // Return 200 with empty response if Neynar key is not configured
      // This prevents 404 errors in console for optional feature
      // The Farcaster/Base SDK will handle the empty response gracefully
      return NextResponse.json(
        { message: 'Neynar API not configured - feature disabled' },
        { status: 200 }
      )
    }

    // Call Neynar API to get user by custody address
    // Documentation: https://docs.neynar.com/reference/user-by-custody-address
    const neynarUrl = `https://api.neynar.com/v2/farcaster/user/by_custody_address?custody_address=${address}`
    
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

    const userData = await response.json()
    return NextResponse.json(userData)
  } catch (error: any) {
    console.error('Error in user-by-custody-address endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

