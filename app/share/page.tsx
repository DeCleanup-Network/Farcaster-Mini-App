import type { Metadata } from 'next'
import { ShareRedirect } from '@/components/share/ShareRedirect'

// Force SSR to prevent metadata caching without params
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Preview image for sharing (used for both referral and claim)
const SHARE_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png'
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

function buildQueryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value)
    }
  })
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}


// This page handles sharing with proper OG tags for social media previews
// It renders HTML with meta tags so crawlers can read them, then redirects client-side
// Override static metadata only if params exist
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; type?: string; level?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const ref = params.ref
  const type = params.type || 'referral' // 'referral' or 'claim'
  const level = params.level

  let title = 'DeCleanup Rewards - Earn Tokens for Cleanups on Base'
  let description = 'Clean up, share proof, earn tokens, and trade on Base.'
  const imageUrl = SHARE_IMAGE_URL // Same preview image for both referral and claim

  if (type === 'claim' && level) {
    title = `Just minted Level ${level} Impact Product! - DeCleanup Rewards`
    description = `Just minted Level ${level} Impact Product for my recent cleanup. Earn tokens and trade on Base with DeCleanup Rewards.`
  } else if (type === 'referral') {
    title = 'Join DeCleanup Rewards - Clean Up, Snap, Earn'
    description = 'Join me in DeCleanup Rewards! Clean up, share proof, earn tokens, and trade on Base.'
  }

  const shareQuery = buildQueryString({ ref, type, level })
  const shareUrl = `${SITE_URL}/share${shareQuery}`

  // Build Farcaster action URL with proper params
  let farcasterActionUrl = FARCASTER_MINIAPP_URL
  if (type === 'referral' && ref) {
    farcasterActionUrl = `${FARCASTER_MINIAPP_URL}?ref=${encodeURIComponent(ref)}`
  }

  // Farcaster embed metadata
  const EMBED_METADATA = {
    version: '1',
    imageUrl: SHARE_IMAGE_URL,
    button: {
      title: 'Open DeCleanup Rewards',
      action: {
        type: 'launch_frame',
        url: farcasterActionUrl,
        name: 'DeCleanup Rewards',
        splashImageUrl: 'https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png',
        splashBackgroundColor: '#000000',
      },
    },
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: 'DeCleanup Rewards',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    // Add explicit meta tags for better crawler support
    other: {
      'og:image': imageUrl,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
      'twitter:image': imageUrl,
      'twitter:image:alt': title,
      // Farcaster uses IPFS (reads fc:miniapp metadata separately)
      'fc:miniapp': JSON.stringify(EMBED_METADATA),
    },
  }
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; type?: string; level?: string }>
}) {
  const params = await searchParams
  const ref = params.ref
  const type = params.type || 'referral'
  const level = params.level

  const redirectUrl = (() => {
    const url = new URL(SITE_URL)

  if (type === 'referral' && ref) {
      url.pathname = '/cleanup'
      url.searchParams.set('ref', ref)
      return url.toString()
    }

    if (type === 'claim') {
      url.pathname = '/profile'
      // Preserve ref parameter for referral tracking from claim shares
      if (ref) {
        url.searchParams.set('ref', ref)
      }
      // Preserve level parameter if provided
      if (level) {
        url.searchParams.set('level', level)
      }
      return url.toString()
    }

    return url.toString()
  })()

  // Render page with meta tags, then redirect client-side
  // The generateMetadata function injects meta tags into <head>
  // ShareRedirect component delays redirect for crawlers to read metadata
  return <ShareRedirect redirectUrl={redirectUrl} />
}

