const SHARE_IMAGE_URL =
  'https://gateway.pinata.cloud/ipfs/bafybeidcmqm6tz7gfcucbzevgxiqeriq55tvw3n5m7y5aoqmruxnrjvdxq?filename=DCUSocialNEW.png'
const TITLE = 'My Impact Product · Earn Tokens on Base | DeCleanup Rewards'
const DESCRIPTION = 'Track your cleanups, earn tokens, and trade on Base with DeCleanup Rewards.'

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
    </>
  )
}

