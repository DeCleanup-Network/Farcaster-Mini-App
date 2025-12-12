# OG Images Directory

This directory contains Open Graph preview images for social media sharing.

## Required Images

Place the following images in this directory:

1. **`default.png`** (1200x630px)
   - Default OG image used for share links without specific parameters
   - Used by Twitter, Telegram, Discord, LinkedIn, Slack, WhatsApp, etc.
   - Should be the same as your main OG image

2. **`referral.png`** (1200x630px) - Optional
   - Specific image for referral shares (if you want different images per type)

3. **`claim.png`** (1200x630px) - Optional
   - Specific image for claim shares (if you want different images per type)

## Current Implementation

The share page (`app/share/page.tsx`) uses `/og/default.png` for all OG/Twitter previews.

Farcaster embeds continue to use IPFS images (preserved in `EMBED_METADATA`).

## Image Requirements

- **Format:** PNG
- **Dimensions:** 1200x630px (OG image standard)
- **File size:** Keep under 1MB for fast loading
- **Content:** Should represent your app/brand clearly

## Notes

- These images are served from your domain, ensuring fast loading and reliable previews
- Farcaster does not use these images - it uses IPFS images in the embed metadata
- Twitter, Telegram, Discord, and other platforms will use these local images

## How to Add/Update Images

If drag-and-drop doesn't work in Cursor:

1. **Using Terminal:**
   ```bash
   # Copy your image file to the public/og directory
   cp /path/to/your/image.png public/og/default.png
   ```

2. **Using File Explorer/Finder:**
   - Navigate to `public/og/` folder in your project
   - Copy your 1200x630px PNG image
   - Rename it to `default.png` (replace the existing file)

3. **Verify the file:**
   ```bash
   ls -lh public/og/default.png
   # Should show file size > 0 bytes
   ```

**Important:** The image must be exactly 1200x630px for best results on all social platforms.

