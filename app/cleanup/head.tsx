// Embed image (3:2 aspect ratio) used in fc:miniapp meta tags for sharing
const SHARE_IMAGE_URL =
  'https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png'
const TITLE = 'Submit Cleanups · Earn Tokens on Base | DeCleanup Rewards'
const DESCRIPTION = 'Clean up, share proof, earn tokens, and trade on Base with DeCleanup Rewards.'
const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/njiQzfqas3yN/decleanup-rewards'

// Farcaster embed metadata for cleanup page
// Per Farcaster docs: https://miniapps.farcaster.xyz/docs/guides/sharing
const EMBED_METADATA = {
  version: '1',
  imageUrl: SHARE_IMAGE_URL,
  button: {
    title: 'Open DeCleanup Rewards',
    action: {
      type: 'launch_miniapp', // Use "launch_miniapp" for new implementations
      url: FARCASTER_MINIAPP_URL,
      name: 'DeCleanup Rewards',
      splashImageUrl: 'https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png',
      splashBackgroundColor: '#000000',
    },
  },
}
// Backward compatibility metadata (for older Farcaster clients)
const EMBED_METADATA_FRAME = {
  ...EMBED_METADATA,
  button: {
    ...EMBED_METADATA.button,
    action: {
      ...EMBED_METADATA.button.action,
      type: 'launch_frame', // Backward compatibility
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
      {/* Farcaster embed metadata - makes this page shareable as rich card */}
      <meta name="fc:miniapp" content={JSON.stringify(EMBED_METADATA)} />
      {/* For backward compatibility with older Farcaster clients */}
      <meta name="fc:frame" content={JSON.stringify(EMBED_METADATA_FRAME)} />
    </>
  )
}

