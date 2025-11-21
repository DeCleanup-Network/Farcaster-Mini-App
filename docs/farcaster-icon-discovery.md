# Farcaster Ghost Icon & Discovery Guide

## Why the Ghost Icon Appears

The ghost icon in Farcaster's app search typically appears when:

### 1. **Icon File Size Too Large**
- **Issue**: Farcaster has strict size limits for icons (typically < 500KB, ideally < 200KB)
- **Current icon**: `bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba` might be too large
- **Solution**: Optimize the icon to be:
  - **Size**: 512x512px or 1024x1024px (square)
  - **Format**: PNG with transparency
  - **File size**: < 200KB (ideally < 100KB)
  - **Compression**: Use tools like TinyPNG or ImageOptim

### 2. **Icon URL Not Accessible**
- **Issue**: The IPFS gateway might be slow or unreachable
- **Current URL**: `https://gateway.pinata.cloud/ipfs/...?filename=icon.png`
- **Solution**: 
  - Verify the URL is accessible: `curl -I "https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png"`
  - Check Content-Type header is `image/png`
  - Consider using a CDN or direct domain URL instead of IPFS gateway

### 3. **Wrong Content-Type Header**
- **Issue**: Server returns wrong MIME type
- **Solution**: Ensure the URL returns `Content-Type: image/png` header
- The `?filename=icon.png` parameter helps, but verify the actual response headers

### 4. **Icon Dimensions Not Square**
- **Issue**: Farcaster requires square icons
- **Solution**: Ensure icon is exactly square (e.g., 512x512, 1024x1024)

### 5. **CDN Caching Issues**
- **Issue**: Vercel/CDN might be serving cached old version
- **Solution**: 
  - Clear Vercel cache
  - Use cache-busting query param: `?v=2&filename=icon.png`
  - Wait 24-48 hours for Farcaster's cache to refresh

## How to Fix the Ghost Icon

### Step 1: Optimize Your Icon

1. **Create/Export Icon**:
   - Size: 1024x1024px (square)
   - Format: PNG with transparency
   - File size: < 200KB

2. **Optimize**:
   ```bash
   # Using ImageOptim (Mac) or similar tool
   # Or use online tools like TinyPNG
   ```

3. **Upload to IPFS**:
   ```bash
   # Upload optimized icon to Pinata
   # Get new CID
   ```

4. **Update Manifest**:
   ```json
   {
     "miniapp": {
       "iconUrl": "https://gateway.pinata.cloud/ipfs/NEW_CID?filename=icon.png&v=2"
     }
   }
   ```

### Step 2: Verify Icon URL

Test the icon URL:
```bash
curl -I "https://gateway.pinata.cloud/ipfs/YOUR_CID?filename=icon.png"
```

Should return:
```
HTTP/2 200
content-type: image/png
content-length: < 200000
```

### Step 3: Update Manifest

Update both manifest files:
- `.well-known/farcaster.json`
- `public/.well-known/farcaster.json`

### Step 4: Clear Caches

1. **Vercel**: Redeploy or clear cache
2. **Farcaster**: Wait 24-48 hours for their cache to refresh
3. **Base Build**: Re-validate your manifest in Base Build dashboard

## How to Add App to Discovery

Farcaster app discovery is currently **curated** - apps don't automatically appear. Here's how to get listed:

### Option 1: Base Build Submission (Recommended)

1. **Go to Base Build**: https://build.base.org
2. **Navigate to Your Mini App**
3. **Submit for Discovery**:
   - Look for "Submit for Discovery" or "Request Discovery Listing" button
   - Fill out any required forms
   - Provide app description, use cases, metrics

4. **Requirements** (typical):
   - ✅ Valid manifest with `accountAssociation`
   - ✅ Working app (no critical bugs)
   - ✅ Active users (varies, but usually 100+)
   - ✅ Good user ratings/feedback
   - ✅ Complete metadata (icon, screenshots, description)

### Option 2: Farcaster Team Contact

1. **Join Farcaster Discord**: https://discord.gg/farcaster
2. **Reach out in #mini-apps channel**
3. **Request discovery listing** with:
   - App name: "DeCleanup Rewards"
   - Domain: `https://farcaster-mini-app-umber.vercel.app`
   - Brief description
   - User metrics (if available)
   - Why it's valuable for Farcaster users

### Option 3: Base Team Contact

Since you're on Base, reach out to Base team:
1. **Base Discord**: https://discord.gg/base
2. **Base Build Support**: Through Base Build dashboard
3. **Base Partnerships**: If you have partnerships contact

### Discovery Requirements Checklist

- [ ] **Valid Manifest**: `.well-known/farcaster.json` accessible and valid
- [ ] **Working Icon**: Optimized, accessible, correct format
- [ ] **Complete Metadata**: All required fields filled
- [ ] **Active Users**: App has real usage (varies by platform)
- [ ] **No Critical Bugs**: App works reliably
- [ ] **Good UX**: Smooth user experience
- [ ] **Base Build Verified**: Account association verified
- [ ] **Screenshots**: At least 3 quality screenshots
- [ ] **Description**: Clear, compelling description
- [ ] **Category & Tags**: Properly categorized

### Tips for Discovery Approval

1. **Build User Base First**: 
   - Share app via casts
   - Get friends/community to use it
   - Show engagement metrics

2. **Polish the Experience**:
   - Fix all bugs
   - Optimize performance
   - Ensure smooth onboarding

3. **Document Your Impact**:
   - Number of cleanups submitted
   - User testimonials
   - Community growth

4. **Engage with Farcaster Community**:
   - Share updates in Farcaster
   - Engage with other mini apps
   - Build relationships in Discord

## Quick Fix Checklist

If you're seeing a ghost icon right now:

1. [ ] Check icon file size (< 200KB)
2. [ ] Verify icon URL is accessible
3. [ ] Check Content-Type header is `image/png`
4. [ ] Ensure icon is square (512x512 or 1024x1024)
5. [ ] Update manifest with optimized icon URL
6. [ ] Redeploy to Vercel
7. [ ] Wait 24-48 hours for Farcaster cache refresh
8. [ ] Re-validate in Base Build dashboard

## Testing Your Icon

```bash
# Test icon accessibility
curl -I "https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png"

# Download and check size
curl -o icon.png "https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png"
ls -lh icon.png  # Should be < 200KB
file icon.png   # Should show "PNG image"
```

## Resources

- [Farcaster Mini Apps Docs](https://docs.farcaster.xyz/developers/mini-apps)
- [Base Build Dashboard](https://build.base.org)
- [Farcaster Discord](https://discord.gg/farcaster)
- [Base Discord](https://discord.gg/base)

