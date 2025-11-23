# Farcaster Embed Preview Image Fix

## Problem Analysis

Based on the [Farcaster Mini Apps documentation](https://miniapps.farcaster.xyz/docs/guides/manifest-vs-embed), images weren't showing when sharing links because:

### Key Findings

1. **Manifest vs Embed Confusion**
   - **Manifest** (`/.well-known/farcaster.json`) = App identity at domain level
   - **Embed** (`fc:miniapp` meta tag) = Page-level metadata for social sharing
   - **Both are required** for proper social sharing with preview images

2. **The Embed's `imageUrl` Controls Preview**
   - According to docs: "The embed's `imageUrl` is what shows as the preview image when sharing"
   - The `fc:miniapp` embed metadata's `imageUrl` field is what Farcaster uses for previews
   - This is different from `og:image` - Farcaster specifically looks for `fc:miniapp` embed

3. **Issues Identified**
   - ✅ We have `fc:miniapp` embed on share page
   - ✅ We have `imageUrl` set in embed
   - ⚠️ Redirect was too fast (100ms) - crawlers need more time
   - ⚠️ Embed's `action.url` should point to actual destination

## Fixes Applied

### 1. Updated Embed Action URL
**File**: `app/share/page.tsx`

Changed the embed's `action.url` to point to the actual app destination based on share type:
- Referral shares → FC app cleanup page with ref
- Claim shares → FC app profile page
- Default → FC app home

This ensures users are taken to the right place when clicking the preview card.

### 2. Increased Redirect Delay
**File**: `components/share/ShareRedirect.tsx`

Increased redirect delay from 100ms to 2000ms (2 seconds) to give Farcaster crawlers enough time to:
- Fetch the page HTML
- Parse the `fc:miniapp` embed metadata
- Extract the `imageUrl` for preview generation

### 3. Embed Structure Verification
**File**: `app/share/page.tsx`

Verified the embed structure matches Farcaster requirements:
```typescript
{
  version: "1",
  imageUrl: imageUrl, // Preview image URL
  button: {
    title: "Open DeCleanup Rewards",
    action: {
      type: "launch_frame",
      url: destinationUrl, // Where users go when clicking
      name: "DeCleanup Rewards",
      splashImageUrl: "...",
      splashBackgroundColor: "#000000",
    },
  },
}
```

## How It Works Now

1. User shares a referral/claim link → goes to `/share?ref=...&type=...`
2. Page renders HTML with:
   - `fc:miniapp` embed meta tag with `imageUrl`
   - OG tags for fallback
   - All required meta tags
3. Farcaster crawler fetches the page (has 2 seconds before redirect)
4. Crawler reads `fc:miniapp` embed and extracts `imageUrl`
5. Preview image appears in Farcaster compose modal
6. After 2 seconds, page redirects client-side to actual app

## Testing

To verify the fix works:

1. Share a referral link in Farcaster compose
2. Check if preview image appears (should show the image from `imageUrl`)
3. Verify the button text says "Open DeCleanup Rewards"
4. Click the preview card - should navigate to correct destination

## References

- [Farcaster Manifest vs Embed Guide](https://miniapps.farcaster.xyz/docs/guides/manifest-vs-embed)
- [Farcaster Share Extensions](https://miniapps.farcaster.xyz/docs/guides/share-extension)

## Key Takeaways

1. **Embeds are page-specific** - Each shareable page needs its own `fc:miniapp` embed
2. **`imageUrl` in embed = preview image** - This is what Farcaster uses, not just `og:image`
3. **Crawlers need time** - Don't redirect too quickly, give crawlers 1-2 seconds
4. **Action URL matters** - Should point to where users actually want to go

