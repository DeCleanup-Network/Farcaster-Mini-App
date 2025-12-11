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

