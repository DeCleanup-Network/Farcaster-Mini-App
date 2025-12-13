import type { Metadata } from 'next'
import { ShareRedirect } from '@/components/share/ShareRedirect'

// Force SSR to prevent metadata caching without params
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Preview image URLs
// Use local image for OG/Twitter/Telegram/WhatsApp (faster, more reliable)
// Keep IPFS for Farcaster only (Farcaster reads fc:miniapp metadata separately)
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
const OG_IMAGE_URL = `${SITE_URL}/og/default.png` // Local image for X, Telegram, WhatsApp
const FARCASTER_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png' // IPFS for Farcaster
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

function buildFarcasterActionUrl(type: string, ref?: string, level?: string) {
  // For Farcaster embeds, the action URL should point to the share page
  // which has proper metadata and will redirect to the miniapp with params
  // This ensures the embed preview shows correctly and launches with the right params
  // If no params, just use base miniapp URL (no share page needed)
  if (!ref && !level) {
    return FARCASTER_MINIAPP_URL
  }
  const shareQuery = buildQueryString({ ref, type, level })
  return `${SITE_URL}/share${shareQuery}`
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

  // Static metadata fallback for Twitter, Telegram, Discord, etc.
  // This ensures OG tags are always present even without URL params
  const defaultTitle = 'DeCleanup Rewards'
  const defaultDescription = 'Earn tokens for cleanups'

  // If no params, return static metadata fallback
  if (!ref && !level) {
    // For base URLs without params, use direct miniapp URL
    const farcasterActionUrl = FARCASTER_MINIAPP_URL
    const EMBED_METADATA = {
      version: '1',
      imageUrl: FARCASTER_IMAGE_URL, // IPFS for Farcaster
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
      title: defaultTitle,
      description: defaultDescription,
      openGraph: {
        title: defaultTitle,
        description: defaultDescription,
        images: [OG_IMAGE_URL], // Local for X, Telegram, WhatsApp
        url: SITE_URL,
        siteName: 'DeCleanup Rewards',
        locale: 'en_US',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: defaultTitle,
        description: defaultDescription,
        images: [OG_IMAGE_URL], // Local for X
      },
      other: {
        'og:image': OG_IMAGE_URL, // Local for OG
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:type': 'image/png',
        'og:image:secure_url': OG_IMAGE_URL, // Required for Telegram
        'og:url': SITE_URL,
        'og:site_name': 'DeCleanup Rewards',
        'twitter:image': OG_IMAGE_URL, // Local for Twitter
        'twitter:card': 'summary_large_image',
        // Telegram-specific meta tags
        'telegram:image': OG_IMAGE_URL,
        // Farcaster uses IPFS (reads fc:miniapp metadata separately)
        'fc:miniapp': JSON.stringify(EMBED_METADATA),
        'fc:frame': JSON.stringify(EMBED_METADATA),
      },
    }
  }

  // Override metadata when params exist
  let title = 'DeCleanup Rewards - Earn Tokens for Cleanups'
  let description = 'Clean up, share proof, earn tokens, and trade on Base.'

  if (type === 'claim' && level) {
    title = `Just minted Level ${level} Impact Product! - DeCleanup Rewards`
    description = `Just minted Level ${level} Impact Product for my recent cleanup. Earn tokens and trade on Base with DeCleanup Rewards.`
  } else if (type === 'referral') {
    title = 'Join DeCleanup Rewards - Clean Up, Snap, Earn'
    description = 'Join me in DeCleanup Rewards! Clean up, share proof, earn tokens, and trade on Base.'
  }

  const shareQuery = buildQueryString({ ref, type, level })
  const shareUrl = `${SITE_URL}/share${shareQuery}`

  const farcasterActionUrl = buildFarcasterActionUrl(type, ref, level)
  
  // Farcaster embed metadata - uses IPFS image
  const EMBED_METADATA = {
    version: '1',
    imageUrl: FARCASTER_IMAGE_URL, // IPFS for Farcaster
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
          url: OG_IMAGE_URL, // Local for X, Telegram, WhatsApp
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
      images: [OG_IMAGE_URL], // Local for X
    },
    // Add explicit meta tags for better crawler support (including Telegram)
    other: {
      'og:image': OG_IMAGE_URL, // Local for OG
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
      'og:image:secure_url': OG_IMAGE_URL, // Required for Telegram
      'og:url': shareUrl,
      'og:site_name': 'DeCleanup Rewards',
      'twitter:image': OG_IMAGE_URL, // Local for Twitter
      'twitter:image:alt': title,
      'twitter:card': 'summary_large_image',
      // Telegram-specific meta tags
      'telegram:image': OG_IMAGE_URL,
      // Farcaster uses IPFS (reads fc:miniapp metadata separately)
      'fc:miniapp': JSON.stringify(EMBED_METADATA),
      'fc:frame': JSON.stringify(EMBED_METADATA),
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

