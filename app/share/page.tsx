import type { Metadata } from 'next'
import { ShareRedirect } from '@/components/share/ShareRedirect'

const OG_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png"
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || "https://farcaster-mini-app-umber.vercel.app"
const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/njiQzfqas3yN/decleanup-rewards'

// This page handles sharing with proper OG tags for social media previews
// It renders HTML with meta tags so crawlers can read them, then redirects client-side
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; type?: string; level?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const ref = params.ref
  const type = params.type || 'referral' // 'referral' or 'claim'
  const level = params.level

  let title = "DeCleanup Rewards - Tokenize Your Environmental Impact"
  let description = "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference."
  let imageUrl = OG_IMAGE_URL

  if (type === 'claim' && level) {
    title = `Just minted Level ${level} Impact Product! - DeCleanup Rewards`
    description = `Join DeCleanup Rewards on @base.base.eth to turn your actions into Impact Products.`
  } else if (type === 'referral') {
    title = "Join DeCleanup Rewards - Clean Up, Snap, Earn"
    description = "Join me in DeCleanup Rewards app! Clean up, share the proof, earn Impact Products, and tokenize your environmental impact on @base.base.eth"
  }

  const shareUrl = `${SITE_URL}/share${ref ? `?ref=${ref}` : ''}${type ? `&type=${type}` : ''}${level ? `&level=${level}` : ''}`

  // Farcaster Mini App embed metadata
  // The imageUrl in the embed is what shows as the preview image when sharing
  // The action.url should point to where users go when they click the button
  const EMBED_METADATA = {
    version: "1",
    imageUrl: imageUrl, // This is the preview image that shows in feeds
    button: {
      title: "Open DeCleanup Rewards",
      action: {
        type: "launch_frame",
        url: type === 'referral' && ref 
          ? `${FARCASTER_MINIAPP_URL}/cleanup?ref=${ref}`
          : type === 'claim' && ref
          ? `${FARCASTER_MINIAPP_URL}/profile`
          : FARCASTER_MINIAPP_URL, // Point to the actual app destination
        name: "DeCleanup Rewards",
        splashImageUrl: "https://gateway.pinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy?filename=splash.png",
        splashBackgroundColor: "#000000",
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
      siteName: "DeCleanup Rewards",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
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
      // Farcaster mini app metadata for proper embed recognition
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

  // Build redirect URL
  let redirectUrl = SITE_URL
  if (type === 'referral' && ref) {
    redirectUrl = `${FARCASTER_MINIAPP_URL}/cleanup?ref=${ref}`
  } else if (type === 'claim' && ref) {
    redirectUrl = `${FARCASTER_MINIAPP_URL}/profile`
  } else {
    redirectUrl = FARCASTER_MINIAPP_URL
  }

  // Render page with meta tags, then redirect client-side
  // This allows crawlers to read the OG tags before redirect
  return <ShareRedirect redirectUrl={redirectUrl} />
}

