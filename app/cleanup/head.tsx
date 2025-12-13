const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
const SHARE_IMAGE_URL = `${SITE_URL}/og/default.png` // Local hosted image for OG/Twitter/Telegram
const FARCASTER_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png' // IPFS for Farcaster
const TITLE = 'Submit Cleanups · Earn Tokens on Base | DeCleanup Rewards'
const DESCRIPTION = 'Clean up, share proof, earn tokens, and trade on Base with DeCleanup Rewards.'
const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'

const EMBED_METADATA = {
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
}

export default function Head() {
  return (
    <>
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:image" content={SHARE_IMAGE_URL} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content="website" />
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:title" content={TITLE} />
      <meta property="twitter:description" content={DESCRIPTION} />
      <meta property="twitter:image" content={SHARE_IMAGE_URL} />
      {/* Use fc:miniapp for new Mini Apps (not fc:frame per Farcaster docs) */}
      <meta name="fc:miniapp" content={JSON.stringify(EMBED_METADATA)} />
    </>
  )
}

