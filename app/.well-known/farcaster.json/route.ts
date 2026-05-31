import { NextResponse } from 'next/server'
import { FARCASTER_MANIFEST } from '@/lib/farcaster-manifest'

export async function GET() {
  return NextResponse.json(FARCASTER_MANIFEST, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
