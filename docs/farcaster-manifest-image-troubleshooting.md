# Farcaster Manifest Image Troubleshooting Guide

## Problem
The DeCleanup Rewards mini-app doesn't display icon and preview images in Farcaster, while other apps (like Working Routine Advisor) do.

## Analysis: Working App vs DeCleanup

### Working App (Working Routine Advisor)
```json
{
  "iconUrl": "https://gateway.pinata.cloud/ipfs/bafybeihklipunixc2233umdxmrm5hryq7lrqx2zga7zng54iwze2to6fya?filename=iconWRA.png",
  "splashImageUrl": "https://gateway.pinata.cloud/ipfs/bafybeiansw55tjsxnng3i7njc2mttba4ccw64a3uwjwlvfhva2uud54ai4?filename=splashWRA.png",
  "heroImageUrl": "https://gateway.pinata.cloud/ipfs/bafybeiansw55tjsxnng3i7njc2mttba4ccw64a3uwjwlvfhva2uud54ai4?filename=ogImageWRA.png",
  "ogImageUrl": "https://gateway.pinata.cloud/ipfs/bafybeiansw55tjsxnng3i7njc2mttba4ccw64a3uwjwlvfhva2uud54ai4?filename=ogImageWRA.png"
}
```

### DeCleanup Rewards (Current)
```json
{
  "iconUrl": "https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png",
  "splashImageUrl": "https://gateway.pinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy?filename=splash.png",
  "heroImageUrl": "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png",
  "ogImageUrl": "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png"
}
```

## Key Differences

1. **Structure**: Both manifests have identical structure ✅
2. **URL Pattern**: Both use same Pinata gateway pattern ✅
3. **Hash Format**: Both use CIDv1 (`bafybei...`) for main images ✅
4. **Potential Issues**: 
   - Image files may not exist at those IPFS hashes
   - Images may not meet Farcaster size/format requirements
   - IPFS files may not be properly pinned
   - CORS/Content-Type headers may be missing

## Farcaster Image Requirements

### iconUrl
- **Format**: PNG
- **Size**: 1024×1024 pixels (square)
- **Content-Type**: `image/png`

### heroImageUrl / ogImageUrl
- **Format**: PNG or JPG
- **Aspect Ratio**: 3:2
- **Minimum Size**: 600×400px
- **Maximum Size**: 3000×2000px
- **Content-Type**: `image/png` or `image/jpeg`

### splashImageUrl
- **Format**: PNG or JPG
- **Recommended**: 1200×800px (3:2 ratio) or match device dimensions
- **Content-Type**: `image/png` or `image/jpeg`

## Diagnostic Steps

### 1. Verify Image Accessibility

Test each image URL in a browser:

```bash
# Test icon
curl -I "https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png"

# Test splash
curl -I "https://gateway.pinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy?filename=splash.png"

# Test hero/og
curl -I "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png"
```

**Expected Response:**
- Status: `200 OK`
- Content-Type: `image/png` or `image/jpeg`
- CORS headers present

**If you get 404 or 429:**
- Image doesn't exist at that IPFS hash
- File may not be pinned
- Rate limiting (try alternative gateway)

### 2. Check Image Dimensions

Download and verify image dimensions:

```bash
# Download and check
curl -o icon.png "https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png"
file icon.png
identify icon.png  # If ImageMagick installed
```

**iconUrl must be**: 1024×1024px
**heroImageUrl must be**: 600-3000px width, 3:2 aspect ratio

### 3. Test Alternative IPFS Gateways

If Pinata is rate-limiting, try other gateways:

```bash
# Try ipfs.io gateway
https://ipfs.io/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba

# Try dweb.link
https://dweb.link/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba

# Try cloudflare
https://cloudflare-ipfs.com/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba
```

### 4. Verify IPFS Pinning

Check if files are pinned in Pinata:

1. Log into Pinata dashboard
2. Check "Files" section
3. Verify the IPFS hashes exist
4. Ensure files are not expired or deleted

## Solutions

### Solution 1: Re-upload and Pin Images

1. **Create properly sized images:**
   - Icon: 1024×1024px PNG
   - Hero/OG: 1200×800px (3:2) PNG or JPG
   - Splash: 1200×800px (3:2) PNG or JPG

2. **Upload to IPFS via Pinata:**
   ```bash
   # Use Pinata API or dashboard
   # Ensure files are pinned permanently
   ```

3. **Update manifest with new hashes:**
   ```json
   {
     "iconUrl": "https://gateway.pinata.cloud/ipfs/NEW_HASH?filename=icon.png",
     "splashImageUrl": "https://gateway.pinata.cloud/ipfs/NEW_HASH?filename=splash.png",
     "heroImageUrl": "https://gateway.pinata.cloud/ipfs/NEW_HASH?filename=hero.png",
     "ogImageUrl": "https://gateway.pinata.cloud/ipfs/NEW_HASH?filename=og.png"
   }
   ```

### Solution 2: Use Alternative Gateway

If Pinata is unreliable, use a more stable gateway:

```json
{
  "iconUrl": "https://ipfs.io/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba",
  "splashImageUrl": "https://ipfs.io/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy",
  "heroImageUrl": "https://ipfs.io/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru",
  "ogImageUrl": "https://ipfs.io/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru"
}
```

**Note**: Remove `?filename=` parameter when using non-Pinata gateways.

### Solution 3: Host Images on Your Domain

For maximum reliability, host images on your own domain:

```json
{
  "iconUrl": "https://farcaster-mini-app-umber.vercel.app/images/icon.png",
  "splashImageUrl": "https://farcaster-mini-app-umber.vercel.app/images/splash.png",
  "heroImageUrl": "https://farcaster-mini-app-umber.vercel.app/images/hero.png",
  "ogImageUrl": "https://farcaster-mini-app-umber.vercel.app/images/og.png"
}
```

## Quick Fix Checklist

- [ ] Verify all image URLs are accessible (HTTP 200)
- [ ] Check image dimensions meet requirements
- [ ] Verify images are properly pinned in IPFS
- [ ] Test images in browser directly
- [ ] Check Content-Type headers are correct
- [ ] Try alternative IPFS gateways
- [ ] Consider hosting images on your domain
- [ ] Update manifest after fixing images
- [ ] Clear Farcaster cache (may take time to update)

## Testing After Fix

1. **Validate manifest:**
   ```bash
   curl https://farcaster-mini-app-umber.vercel.app/.well-known/farcaster.json | jq
   ```

2. **Test image URLs:**
   - Open each URL in browser
   - Verify images display correctly
   - Check browser console for errors

3. **Check Farcaster:**
   - Wait 5-10 minutes for cache to clear
   - Check app listing in Farcaster
   - Verify icon and preview appear

## Additional Notes

- Farcaster caches manifests and images, so changes may take time to appear
- Ensure all images have proper CORS headers if hosted on different domain
- Use descriptive filenames (like the working app does) for better organization
- Consider using the same image for `heroImageUrl` and `ogImageUrl` if appropriate

