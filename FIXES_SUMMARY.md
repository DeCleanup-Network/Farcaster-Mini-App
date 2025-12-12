# Fixes Summary - Farcaster Embed & Sharing Issues

## Issues Fixed

### 1. ✅ Farcaster Embed Preview Opening Old App
**Problem:** When clicking the preview in Farcaster, it opened the old deployed app and got stuck on splash screen.

**Fix:**
- Updated `buildFarcasterActionUrl()` in `app/share/page.tsx` to point to the share page (which has proper metadata) instead of direct miniapp URL
- The share page redirects to the miniapp with correct params, ensuring proper launch
- For base URLs without params, it now uses the direct miniapp URL

**Files Changed:**
- `app/share/page.tsx` - Fixed `buildFarcasterActionUrl()` function

### 2. ✅ Farcaster Manifest OG Image
**Problem:** Manifest was using IPFS image for `ogImageUrl`, which might cause issues with OG previews.

**Fix:**
- Updated `ogImageUrl` in both new and old domain manifests to use local image: `https://miniapp.decleanup.net/og/default.png`
- Farcaster embeds still use IPFS images (as required), but OG previews use local images

**Files Changed:**
- `app/.well-known/farcaster.json/route.ts` - Updated `ogImageUrl` for both manifests

### 3. ✅ X/Twitter Sharing on Mobile
**Problem:** X sharing tried to open in browser window within Farcaster, and no preview was available.

**Fix:**
- Created new `shareToX()` function in `lib/farcaster.ts` that:
  - Uses Web Share API on mobile devices (opens native share sheet)
  - Uses `openUrl()` in Farcaster context to open in external browser
  - Falls back to `window.open()` for desktop browsers
  - Falls back to clipboard if popup is blocked
- Updated all X sharing buttons to use the new function

**Files Changed:**
- `lib/farcaster.ts` - Added `shareToX()` function
- `app/page.tsx` - Updated "Share on X" button
- `app/profile/page.tsx` - Updated "Share on X" button

### 4. ✅ Referral Code System (Foundation)
**Problem:** User wanted simpler links without wallet addresses.

**Fix:**
- Added `generateReferralCode()` function to create short codes from wallet addresses
- Added `useSimpleLinks` parameter to `generateReferralLink()` and `generateClaimShareLink()`
- When `useSimpleLinks=true` (default), links are simple base URLs without params
- Legacy mode still available by setting `useSimpleLinks=false`

**Note:** Referral tracking with simple links requires alternative methods (e.g., post tracking, referral codes). The foundation is in place for future implementation.

**Files Changed:**
- `lib/farcaster.ts` - Added referral code functions and `useSimpleLinks` parameter

## Remaining Issues & Recommendations

### 1. OG Image File (`public/og/default.png`)
**Status:** File exists but is 0 bytes (empty)

**Action Required:**
1. Add a 1200x630px PNG image to `public/og/default.png`
2. See `public/og/README.md` for instructions on how to add the image

**Why This Matters:**
- Without a valid image, social platforms (Twitter, Telegram, Discord) will show generic previews
- The image is referenced in all OG metadata but the file is currently empty

### 2. Referral Tracking with Simple Links
**Current State:** Simple links are now the default (no wallet addresses in URLs)

**Options for Tracking:**
1. **Referral Codes:** Users can copy/share their referral code separately
2. **Post Tracking:** Track referrals by analyzing Farcaster/X posts (requires API integration)
3. **Hybrid Approach:** Use simple links for sharing, but allow users to enter referral codes manually

**Recommendation:** Implement a "Copy Referral Code" feature that generates a short code users can share. When someone uses the app, they can enter the code to claim referral rewards.

### 3. Plain Links Without Previews
**Status:** Root page (`/`) and Farcaster miniapp URL need proper OG metadata

**Current State:**
- Root page has OG metadata in `app/layout.tsx` ✅
- Share page has proper metadata ✅
- Farcaster miniapp URL should use manifest metadata ✅

**Verification Needed:**
- Test that `https://miniapp.decleanup.net` shows proper preview
- Test that `https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards` shows proper preview

## Testing Checklist

- [ ] Test Farcaster embed preview - click should open correct app
- [ ] Test X sharing on mobile - should open native share sheet
- [ ] Test X sharing in Farcaster - should open in external browser
- [ ] Test copy link - should show proper preview
- [ ] Verify `public/og/default.png` is uploaded and accessible
- [ ] Test plain miniapp URL preview on Twitter/Telegram
- [ ] Test Farcaster miniapp URL preview

## Files Modified

1. `app/share/page.tsx` - Fixed Farcaster embed action URL
2. `app/.well-known/farcaster.json/route.ts` - Updated OG image URL
3. `lib/farcaster.ts` - Added `shareToX()` and referral code functions
4. `app/page.tsx` - Updated X sharing button
5. `app/profile/page.tsx` - Updated X sharing button
6. `public/og/README.md` - Added image upload instructions

## Next Steps

1. **Upload OG Image:** Add `default.png` (1200x630px) to `public/og/`
2. **Test All Sharing:** Verify all share methods work correctly
3. **Implement Referral Code UI:** Add UI for users to copy/share referral codes
4. **Monitor:** Check social media previews after deployment

