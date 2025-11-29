import type { Metadata } from 'next'

const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/njiQzfqas3yN/decleanup-rewards'
const PROFILE_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png'
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'

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
      imageUrl: PROFILE_IMAGE_URL,
      button: {
        title: 'Open DeCleanup Rewards',
        action: {
          type: 'launch_frame',
          url: FARCASTER_MINIAPP_URL,
          name: 'DeCleanup Rewards',
          splashImageUrl: 'https://gateway.pinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy?filename=splash.png',
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

