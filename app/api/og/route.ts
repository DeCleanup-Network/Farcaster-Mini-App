import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import React from 'react'

export const runtime = 'edge'

// Validate Ethereum address format
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')

    // Default values
    let subtitle = 'Earn tokens for cleanups'
    let referrerText = ''

    // If referral address is provided and valid, customize the image
    if (ref && isValidAddress(ref)) {
      const shortAddress = `${ref.slice(0, 6)}…${ref.slice(-4)}`
      referrerText = `Referred by ${shortAddress}`
      subtitle = `Join DeCleanup and earn rewards`
    }

    return new ImageResponse(
      React.createElement(
        'div',
        {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a', // slate-900
            backgroundImage: 'linear-gradient(to bottom, #0f172a, #1e293b)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
        [
          // Main Title
          React.createElement(
            'div',
            {
              key: 'title',
              style: {
                display: 'flex',
                fontSize: 72,
                fontWeight: 'bold',
                color: '#22c55e', // brand-green
                marginBottom: 20,
                textAlign: 'center',
              },
            },
            '🌍 DeCleanup'
          ),
          // Subtitle
          React.createElement(
            'div',
            {
              key: 'subtitle',
              style: {
                display: 'flex',
                fontSize: 36,
                color: '#ffffff',
                marginBottom: 30,
                textAlign: 'center',
              },
            },
            subtitle
          ),
          // Referrer Text (conditional)
          referrerText &&
            React.createElement(
              'div',
              {
                key: 'referrer',
                style: {
                  display: 'flex',
                  fontSize: 28,
                  color: '#94a3b8', // slate-400
                  marginTop: 20,
                  textAlign: 'center',
                },
              },
              referrerText
            ),
          // Call to Action
          React.createElement(
            'div',
            {
              key: 'cta',
              style: {
                display: 'flex',
                fontSize: 24,
                color: '#cbd5e1', // slate-300
                marginTop: 40,
                textAlign: 'center',
              },
            },
            'Clean • Verify • Earn'
          ),
        ].filter(Boolean)
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    console.error('Error generating OG image:', error)
    
    // Return a simple fallback image
    return new ImageResponse(
      React.createElement(
        'div',
        {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontSize: 48,
          },
        },
        'DeCleanup Rewards'
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  }
}

