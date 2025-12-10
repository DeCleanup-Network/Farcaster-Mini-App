import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// New domain manifest (for miniapp.decleanup.net)
const newDomainManifest = {
  accountAssociation: {
    header: "eyJmaWQiOjM3OTUzMywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGM5NjBFNTEzMjFiNUU3YTk3MDM5Yjk3ZjU3MTdjM2RCZDJiODdmODAifQ",
    payload: "eyJkb21haW4iOiJtaW5pYXBwLmRlY2xlYW51cC5uZXQifQ",
    signature: "7NVO5bQDmhbkB+HujppHIqS5t8buSzHdFGdROFnZl8gscUFTybMd5zjXdVMVklFCqvGETUExHf0ADcunkIKi3hs="
  },
  baseBuilder: {
    ownerAddress: "0x54e2bC746Cf63469A0ca1e3c6647BB3cfCE48978"
  },
  miniapp: {
    version: "1",
    name: "DeCleanup Rewards",
    homeUrl: "https://miniapp.decleanup.net",
    iconUrl: "https://gateway.pinata.cloud/ipfs/bafkreig6ctmk5it4ppu67ljtmxjcrv2zug7rvccj5i52ji5s2qli5nww7a?filename=DCUIconNEW.png",
    castShareUrl: "https://miniapp.decleanup.net",
    canonicalDomain: "miniapp.decleanup.net",
    imageUrl: "https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png",
    buttonTitle: "Open DeCleanup Rewards",
    splashImageUrl: "https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png",
    splashBackgroundColor: "#000000",
    subtitle: "Tokenize Cleanup Impact",
    description: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
    screenshotUrls: [
      "https://gateway.pinata.cloud/ipfs/bafkreibxivkhsrf54rz26a6p7jehxs36gugz5fywhwxd5axvgungj7v26y?filename=screenshot1.png",
      "https://gateway.pinata.cloud/ipfs/bafkreihbfrmyviu62uf4nngbno3hwuuvkpt6xvtun52je7ojyps4xvcpky?filename=screenshot2.png",
      "https://gateway.pinata.cloud/ipfs/bafkreibkfxo2myeu46sv3yxxdmhix27ul34ec6c4dwm5hjplewelsgpedi?filename=screenshot3.png"
    ],
    primaryCategory: "social",
    tags: [
      "environment",
      "cleanup",
      "impact",
      "nft",
      "base"
    ],
    heroImageUrl: "https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png",
    tagline: "Clean Up, Snap, Earn",
    ogTitle: "DeCleanup Rewards",
    ogDescription: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
    ogImageUrl: "https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png",
    noindex: false
  }
}

// Old domain manifest (for farcaster-mini-app-umber.vercel.app)
const oldDomainManifest = {
  accountAssociation: {
    header: "eyJmaWQiOjM3OTUzMywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGM5NjBFNTEzMjFiNUU3YTk3MDM5Yjk3ZjU3MTdjM2RCZDJiODdmODAifQ",
    payload: "eyJkb21haW4iOiJmYXJjYXN0ZXItbWluaS1hcHAtdW1iZXIudmVyY2VsLmFwcCJ9",
    signature: "f8stEhv+Q/F6hgDZseKFZI3n1xzNx3Spv7J/lkfHqRZbJtGCJx5XKt0UQjHk34eeL93qCcHv/gAVRw9Xnyw8nhw="
  },
  baseBuilder: {
    ownerAddress: "0x54e2bC746Cf63469A0ca1e3c6647BB3cfCE48978"
  },
  miniapp: {
    version: "1",
    name: "DeCleanup Rewards",
    homeUrl: "https://farcaster-mini-app-umber.vercel.app",
    iconUrl: "https://gateway.pinata.cloud/ipfs/bafkreig6ctmk5it4ppu67ljtmxjcrv2zug7rvccj5i52ji5s2qli5nww7a?filename=DCUIconNEW.png",
    castShareUrl: "https://farcaster-mini-app-umber.vercel.app",
    canonicalDomain: "miniapp.decleanup.net",
    imageUrl: "https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png",
    buttonTitle: "Open DeCleanup Rewards",
    splashImageUrl: "https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png",
    splashBackgroundColor: "#000000",
    subtitle: "Tokenize Cleanup Impact",
    description: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
    screenshotUrls: [
      "https://gateway.pinata.cloud/ipfs/bafkreibxivkhsrf54rz26a6p7jehxs36gugz5fywhwxd5axvgungj7v26y?filename=screenshot1.png",
      "https://gateway.pinata.cloud/ipfs/bafkreihbfrmyviu62uf4nngbno3hwuuvkpt6xvtun52je7ojyps4xvcpky?filename=screenshot2.png",
      "https://gateway.pinata.cloud/ipfs/bafkreibkfxo2myeu46sv3yxxdmhix27ul34ec6c4dwm5hjplewelsgpedi?filename=screenshot3.png"
    ],
    primaryCategory: "social",
    tags: [
      "environment",
      "cleanup",
      "impact",
      "nft",
      "base"
    ],
    heroImageUrl: "https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png",
    tagline: "Clean Up, Snap, Earn",
    ogTitle: "DeCleanup Rewards",
    ogDescription: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
    ogImageUrl: "https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png",
    noindex: false
  }
}

export async function GET(request: NextRequest) {
  // Get the hostname from the request
  const hostname = request.headers.get('host') || ''
  
  // Determine which manifest to serve based on domain
  const isOldDomain = 
    hostname.includes('farcaster-mini-app-umber') ||
    hostname.includes('vercel.app')
  
  const manifest = isOldDomain ? oldDomainManifest : newDomainManifest
  
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

