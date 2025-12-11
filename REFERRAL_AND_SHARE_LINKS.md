# Referral Links, Share Links, and Preview Images

This document contains all code snippets related to referral links, share links, and their preview images.

## Preview Images Used

### 1. Share Page Preview Image (OG Image - 1200x630)
**Used for:** Referral and claim share links on `/share` page
**File:** `app/share/page.tsx`
```typescript
const SHARE_IMAGE_URL =
  'https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png'
```

### 2. Root Layout OG Image (1200x630)
**Used for:** Default site-wide Open Graph image
**File:** `app/layout.tsx`
```typescript
const OG_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png"
```

### 3. Profile Page Preview Image (1200x630)
**Used for:** Profile page sharing
**File:** `app/profile/layout.tsx` and `app/profile/head.tsx`
```typescript
const PROFILE_IMAGE_URL = 'https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png'
```

### 4. Cleanup Page Preview Image (1200x630)
**Used for:** Cleanup page sharing
**File:** `app/cleanup/head.tsx`
```typescript
const SHARE_IMAGE_URL =
  'https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png'
```

### 5. Farcaster Splash Image
**Used for:** Farcaster miniapp splash screen when launching
**Files:** Multiple (appears in all Farcaster embed metadata)
```typescript
splashImageUrl: 'https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png'
```

---

## Referral Link Generation

### Function: `generateReferralLink`
**File:** `lib/farcaster.ts`
**Lines:** 293-316

```typescript
export const generateReferralLink = (
  walletAddress: string, 
  type: 'farcaster' | 'web' | 'copy' = 'web',
  useSharePage: boolean = true
): string => {
  const sanitizedAddress = walletAddress?.trim()
  if (!sanitizedAddress) {
    return type === 'farcaster' ? FARCASTER_MINIAPP_URL : WEB_APP_URL
  }

  if (type === 'farcaster') {
    // For Farcaster, use Farcaster miniapp URL with referral parameter
    // Note: Farcaster miniapp URLs don't support query params directly, but we can append them
    // The share page will handle redirecting properly
    return `${FARCASTER_MINIAPP_URL}?ref=${sanitizedAddress}`
  }

  // For web and copy, use web app URL
  if (useSharePage && type !== 'copy') {
    return buildUrl(WEB_APP_URL, 'share', { ref: sanitizedAddress, type: 'referral' })
  }

  return buildUrl(WEB_APP_URL, 'cleanup', { ref: sanitizedAddress })
}
```

**Constants:**
```typescript
const FARCASTER_MINIAPP_URL =
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'
const WEB_APP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
```

**Usage Examples:**

1. **Main Page - Share on Farcaster** (`app/page.tsx`, lines 520-525)
```typescript
const { generateReferralLink, shareCast, formatReferralMessage } = await import('@/lib/farcaster')
// Use Farcaster miniapp URL for Farcaster sharing
const referralLink = generateReferralLink(address, 'farcaster', false)
const message = formatReferralMessage(referralLink, 'farcaster')
await shareCast(message, referralLink)
```

2. **Main Page - Share on X** (`app/page.tsx`, lines 539-543)
```typescript
const { generateReferralLink, formatReferralMessage } = await import('@/lib/farcaster')
const referralLink = generateReferralLink(address, 'web', true)
const text = formatReferralMessage(referralLink, 'web')
const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
window.open(xUrl, '_blank')
```

3. **Main Page - Copy Link** (`app/page.tsx`, lines 556-564)
```typescript
const { generateReferralLink, formatReferralMessage } = await import('@/lib/farcaster')
const referralLink = generateReferralLink(address, 'copy', true)
try {
  const copyText = formatReferralMessage(referralLink, 'copy')
  await navigator.clipboard.writeText(copyText)
  alert('Referral message copied to clipboard!')
} catch (error) {
  alert(formatReferralMessage(referralLink, 'copy'))
}
```

---

## Claim Share Link Generation

### Function: `generateClaimShareLink`
**File:** `lib/farcaster.ts`
**Lines:** 319-355

```typescript
export const generateClaimShareLink = (
  walletAddress: string,
  level: number,
  type: 'farcaster' | 'web' | 'copy' = 'web',
  useSharePage: boolean = true
): string => {
  const sanitizedAddress = walletAddress?.trim()
  if (!sanitizedAddress) {
    return type === 'farcaster' ? FARCASTER_MINIAPP_URL : WEB_APP_URL
  }

  const levelParam = typeof level === 'number' && !Number.isNaN(level) ? level : undefined

  if (type === 'farcaster') {
    // For Farcaster, use Farcaster miniapp URL with referral parameter
    // Note: Farcaster miniapp URLs don't support query params directly, but we can append them
    const params = new URLSearchParams()
    params.set('ref', sanitizedAddress)
    if (levelParam) {
      params.set('level', String(levelParam))
    }
    return `${FARCASTER_MINIAPP_URL}?${params.toString()}`
  }

  if (useSharePage && type !== 'copy') {
    return buildUrl(WEB_APP_URL, 'share', {
      ref: sanitizedAddress,
      type: 'claim',
      level: levelParam,
    })
  }

  return buildUrl(WEB_APP_URL, 'profile', {
    ref: sanitizedAddress,
    level: levelParam,
  })
}
```

**Usage Examples:**

1. **Profile Page - Share on Farcaster** (`app/profile/page.tsx`, lines 1329-1331)
```typescript
// Use Farcaster miniapp URL for Farcaster sharing (with referral)
const claimLink = generateClaimShareLink(address, profileData.level, 'farcaster', false)
const text = formatImpactShareMessage(profileData.level, claimLink, 'farcaster')
await shareCast(text, claimLink)
```

2. **Profile Page - Share on X** (`app/profile/page.tsx`, lines 1356-1359)
```typescript
const link = generateClaimShareLink(address, profileData.level, 'web', true)
const text = formatImpactShareMessage(profileData.level, link, 'web')
const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
window.open(xUrl, '_blank')
```

3. **Profile Page - Copy Link** (`app/profile/page.tsx`, lines 1372-1379)
```typescript
const link = generateClaimShareLink(address, profileData.level, 'copy', true)
const message = formatImpactShareMessage(profileData.level, link, 'copy')
try {
  await navigator.clipboard.writeText(message)
  alert('Share message copied to clipboard!')
} catch (error) {
  alert(message)
}
```

---

## Share Page Metadata (Preview Generation)

### File: `app/share/page.tsx`
**Lines:** 33-115

This page generates dynamic Open Graph metadata for referral and claim shares:

```typescript
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; type?: string; level?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const ref = params.ref
  const type = params.type || 'referral' // 'referral' or 'claim'
  const level = params.level

  let title = 'DeCleanup Rewards - Earn Tokens for Cleanups'
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

  const farcasterActionUrl = buildFarcasterActionUrl(type, ref, level)
  
  const EMBED_METADATA = {
    version: '1',
    imageUrl,
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
      'og:image:secure_url': imageUrl,
      'og:url': shareUrl,
      'twitter:image': imageUrl,
      'twitter:image:alt': title,
      'twitter:card': 'summary_large_image',
      'fc:miniapp': JSON.stringify(EMBED_METADATA),
      'fc:frame': JSON.stringify(EMBED_METADATA),
    },
  }
}
```

---

## Share Cast Function

### Function: `shareCast`
**File:** `lib/farcaster.ts`
**Lines:** 159-272

This function handles sharing to Farcaster/Warpcast:

```typescript
export const shareCast = async (text: string, url?: string): Promise<boolean> => {
  try {
    // Try Web Share API first if available (mobile native share sheet)
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: APP_NAME,
          text,
          url,
        })
        return true
      } catch (shareError: any) {
        // User cancelled (code 0) is fine, but other errors should fall through
        if (shareError?.code === 0 || shareError?.name === 'AbortError') {
          return false // User cancelled
        }
        // Other errors, fall back to other methods
        console.log('Web Share API failed, falling back:', shareError)
      }
    }

    // Build Warpcast compose URL with pre-filled text and embed
    // Warpcast compose URL format: https://warpcast.com/~/compose?text=...&embeds[]=...
    let farcasterUrl: string
    if (url) {
      // Include both text and embed URL
      farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`
    } else {
      // Just text, no embed
      farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
    }

    // Check if we are in Farcaster context
    let inFarcaster = false
    try {
      inFarcaster = isFarcasterContext()
    } catch (error) {
      console.log('Error checking Farcaster context, assuming browser:', error)
      inFarcaster = false
    }
    
    if (inFarcaster) {
      try {
        // In Farcaster, use SDK's openUrl
        await openUrl(farcasterUrl)
        return true
      } catch (openUrlError) {
        console.warn('openUrl failed in Farcaster context, trying window.open:', openUrlError)
        // Fallback to window.open even in Farcaster context
      }
    }

    // For browser (not in Farcaster), open Warpcast compose in new tab
    if (typeof window !== 'undefined') {
      console.log('Opening Warpcast compose in browser:', farcasterUrl)
      try {
        // Use window.open with noopener for security
        const newWindow = window.open(farcasterUrl, '_blank', 'noopener,noreferrer')
        if (newWindow) {
          // Successfully opened
          console.log('Successfully opened Warpcast compose window')
          return true
        } else {
          // Popup blocked - fall through to clipboard
          console.warn('Popup blocked by browser, falling back to clipboard')
          throw new Error('Popup blocked')
        }
      } catch (openError) {
        console.error('window.open failed:', openError)
        throw new Error('Failed to open share window')
      }
    }

    // Last resort: copy to clipboard
    throw new Error('No sharing method available')
  } catch (error) {
    console.error('Failed to share cast:', error)
    // Fallback: try to copy to clipboard
    try {
      const fullText = text + (url ? ` ${url}` : '')
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText)
        if (typeof window !== 'undefined') {
          alert('Share popup was blocked. Message copied to clipboard! Paste it into Warpcast to share.')
        }
        return true
      } else {
        throw new Error('Clipboard API not available')
      }
    } catch (clipboardError) {
      console.error('Failed to copy to clipboard:', clipboardError)
      // ... additional fallback logic ...
      return false
    }
  }
}
```

---

## Farcaster Embed Metadata

### Root Layout (`app/layout.tsx`, lines 28-41)
```typescript
const FARCASTER_MINIAPP_URL = "https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards";
const EMBED_METADATA = {
  version: "1",
  imageUrl: "https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png",
  button: {
    title: "Open DeCleanup Rewards",
    action: {
      type: "launch_frame",
      url: FARCASTER_MINIAPP_URL,
      name: "DeCleanup Rewards",
      splashImageUrl: "https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png",
      splashBackgroundColor: "#000000",
    },
  },
};
```

### Profile Layout (`app/profile/layout.tsx`, lines 34-47)
```typescript
'fc:miniapp': JSON.stringify({
  version: '1',
  imageUrl: PROFILE_IMAGE_URL,
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
```

### Cleanup Page Head (`app/cleanup/head.tsx`, lines 7-20)
```typescript
const EMBED_METADATA = {
  version: '1',
  imageUrl: SHARE_IMAGE_URL,
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
```

---

## Message Formatting Functions

### `formatReferralMessage`
**File:** `lib/farcaster.ts`
**Lines:** 18-38

```typescript
export const formatReferralMessage = (
  referralLink: string,
  type: 'farcaster' | 'web' | 'copy' = 'copy'
) => {
  const copy =
    type === 'farcaster'
      ? REFERRAL_COPY_FARCASTER
      : type === 'web'
      ? REFERRAL_COPY_WEB
      : REFERRAL_COPY_COPY
  
  // Add tip message only for Farcaster app referrals
  const tip = type === 'farcaster' ? FARCASTER_WALLET_TIP : ''
  
  // For Farcaster, add "Referral link for Farcaster mini app" before the link
  if (type === 'farcaster') {
    return `${copy}Referral link for Farcaster mini app\n\n${referralLink}${tip}`
  }
  
  return `${copy}${referralLink}${tip}`
}
```

### `formatImpactShareMessage`
**File:** `lib/farcaster.ts`
**Lines:** 41-69

```typescript
export const formatImpactShareMessage = (
  level: number | string | null | undefined,
  link?: string,
  type: 'farcaster' | 'web' | 'copy' = 'copy'
) => {
  const normalizedLink = (link && link.trim().length > 0 ? link : MINIAPP_URL).trim()
  const parsedLevel =
    typeof level === 'string'
      ? Number(level)
      : typeof level === 'number'
      ? level
      : null
  const hasLevel = typeof parsedLevel === 'number' && Number.isFinite(parsedLevel) && parsedLevel > 0
  const levelLabel = hasLevel ? `Level ${parsedLevel} Impact Product` : 'an Impact Product'
  
  let message: string
  if (type === 'farcaster') {
    message = `Just minted ${levelLabel} by @decleanupnet! Earn tokens for cleanups and trade on @base: ${normalizedLink}`
  } else if (type === 'web') {
    message = `Just minted ${levelLabel} by @DeCleanupNet! Earn tokens for cleanups and trade on @base: ${normalizedLink}`
  } else {
    message = `Just minted ${levelLabel} by @DeCleanupNet! Earn tokens for cleanups and trade on @base: ${normalizedLink}`
  }
  
  // Add tip message only for Farcaster app sharing
  const tip = type === 'farcaster' ? FARCASTER_WALLET_TIP : ''
  
  return `${message}${tip}`
}
```

---

## Summary of Image URLs

| Image Type | URL | Used In |
|------------|-----|---------|
| **OG Image (Share Page)** | `https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png` | `/share` page (referral & claim) |
| **OG Image (Root)** | `https://gateway.pinata.cloud/ipfs/bafybeib7mxbtcc4kr3gp4wl5jhf3bpump4zywvz22msuymhf5nmrq3axk4?filename=DCUOgNEW.png` | Root layout |
| **Social Image (Profile)** | `https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png` | Profile layout, cleanup head |
| **Splash Image (Farcaster)** | `https://gateway.pinata.cloud/ipfs/bafkreic5tpnu533jemlcwpy4gplg6thjeqmdwgveaapw3iv7tupzlvy5i4?filename=DCUSplashNEW.png` | All Farcaster embed metadata |

---

## Link Generation Summary

| Link Type | Farcaster Type | Web Type | Copy Type |
|-----------|---------------|----------|-----------|
| **Referral** | `https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards?ref={address}` | `https://miniapp.decleanup.net/share?ref={address}&type=referral` | `https://miniapp.decleanup.net/share?ref={address}&type=referral` |
| **Claim** | `https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards?ref={address}&level={level}` | `https://miniapp.decleanup.net/share?ref={address}&type=claim&level={level}` | `https://miniapp.decleanup.net/share?ref={address}&type=claim&level={level}` |

