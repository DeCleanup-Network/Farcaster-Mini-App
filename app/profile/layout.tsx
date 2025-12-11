import type { Metadata } from 'next'

const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
// Use local hosted image for OG/Twitter/Telegram previews
const PROFILE_IMAGE_URL = `${SITE_URL}/og/default.png`
// IPFS image for Farcaster embeds
const FARCASTER_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png'

export const metadata: Metadata = {
  title: 'My Profile - DeCleanup Rewards',
  description: 'View your Impact Products, $bDCU balance, and cleanup history on DeCleanup Rewards.',
  openGraph: {
    title: 'My Profile - DeCleanup Rewards',
    description: 'View your Impact Products, $bDCU balance, and cleanup history on DeCleanup Rewards.',
    url: `${SITE_URL}/profile`,
    siteName: 'DeCleanup Rewards',
    images: [
      {
        url: PROFILE_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'DeCleanup Rewards Profile',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Profile - DeCleanup Rewards',
    description: 'View your Impact Products, $bDCU balance, and cleanup history on DeCleanup Rewards.',
    images: [PROFILE_IMAGE_URL],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: FARCASTER_IMAGE_URL, // IPFS for Farcaster
      button: {
        title: 'Open DeCleanup Rewards',
        action: {
          type: 'launch_frame',
          url: FARCASTER_MINIAPP_URL,
          name: 'DeCleanup Rewards',
          splashImageUrl: 'https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png',
          splashBackgroundColor: '#000000',
        },
      },
    }),
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: FARCASTER_IMAGE_URL, // IPFS for Farcaster
      button: {
        title: 'Open DeCleanup Rewards',
        action: {
          type: 'launch_frame',
          url: FARCASTER_MINIAPP_URL,
          name: 'DeCleanup Rewards',
          splashImageUrl: 'https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png',
          splashBackgroundColor: '#000000',
        },
      },
    }),
  },
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

