import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

const OG_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png"
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || "https://farcaster-mini-app-umber.vercel.app"
const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/njiQzfqas3yN/decleanup-rewards'

// This page handles sharing with proper OG tags for social media previews
// It redirects to the actual app while providing rich previews for referral and claim links
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

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/share${ref ? `?ref=${ref}` : ''}${type ? `&type=${type}` : ''}${level ? `&level=${level}` : ''}`,
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

  // Redirect to the actual app
  redirect(redirectUrl)
}

