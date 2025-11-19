# Pinata IPFS Setup Guide

## Overview

DeCleanup uses Pinata for IPFS file storage. All cleanup photos and impact report data are uploaded to IPFS via Pinata.

## Getting Pinata API Keys

### Step 1: Create Pinata Account

1. Go to [pinata.cloud](https://pinata.cloud)
2. Sign up for a free account
3. Verify your email address

### Step 2: Create API Key

1. Log into your Pinata dashboard
2. Navigate to **API Keys** (in the left sidebar)
3. Click **"New Key"**
4. Configure the key:
   - **Key Name**: `DeCleanup Mini App` (or any name you prefer)
   - **Admin**: Leave unchecked (not needed)
   - **Permissions**: 
     - ✅ **pinFileToIPFS** (required for photo uploads)
     - ✅ **pinJSONToIPFS** (required for impact report data)
     - ✅ **unpin** (optional, for cleanup if needed)
5. Click **"Create Key"**
6. **IMPORTANT**: Copy both:
   - **API Key** (starts with something like `a1b2c3d4...`)
   - **Secret Key** (starts with something like `e5f6g7h8...`)

⚠️ **Warning**: The Secret Key is only shown once. Copy it immediately!

## Adding Keys to Vercel

### Step 1: Access Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**

### Step 2: Add Pinata Keys

Add these two variables:

**Variable 1:**
- **Key**: `NEXT_PUBLIC_PINATA_API_KEY`
- **Value**: Your Pinata API Key (from Step 2 above)
- **Environment**: Select all (Production, Preview, Development)

**Variable 2:**
- **Key**: `NEXT_PUBLIC_PINATA_SECRET_KEY`
- **Value**: Your Pinata Secret Key (from Step 2 above)
- **Environment**: Select all (Production, Preview, Development)

### Step 3: Redeploy

After adding the environment variables:

1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger automatic deployment

## Testing

After deployment, test the cleanup submission:

1. Go to `/cleanup` page
2. Upload a before photo
3. Upload an after photo
4. Fill out the impact report (optional)
5. Submit

If the keys are configured correctly, photos should upload successfully and you'll see IPFS hashes in the console.

## Troubleshooting

### Error: "Pinata API keys not configured"

**Solution:**
- Verify keys are set in Vercel environment variables
- Check that keys are added to the correct environment (Production/Preview/Development)
- Redeploy after adding keys
- Verify key names match exactly: `NEXT_PUBLIC_PINATA_API_KEY` and `NEXT_PUBLIC_PINATA_SECRET_KEY`

### Error: "Failed to upload to IPFS"

**Possible causes:**
- Invalid API keys (check for typos)
- API key doesn't have correct permissions
- Pinata account has reached rate limits (free tier: 1GB storage, 1000 files/month)
- Network issues

**Solution:**
- Verify keys in Pinata dashboard
- Check Pinata account usage/limits
- Test keys using Pinata API directly

### Photos upload but don't display

**Possible causes:**
- IPFS gateway URL misconfigured
- Pinata gateway not accessible
- CORS issues

**Solution:**
- Verify `NEXT_PUBLIC_IPFS_GATEWAY` is set to `https://gateway.pinata.cloud/ipfs/`
- Check that files are actually pinned in Pinata dashboard
- Test IPFS URL directly in browser

## Pinata Free Tier Limits

- **Storage**: 1 GB
- **Files**: 1,000 files per month
- **Bandwidth**: 50 GB per month

For production, consider upgrading to a paid plan if you expect high usage.

## Security Notes

- **Never commit API keys to Git**
- Keys are stored in Vercel environment variables (encrypted)
- Keys are prefixed with `NEXT_PUBLIC_` so they're accessible in the browser (required for client-side uploads)
- Consider using Pinata's JWT tokens for better security (future enhancement)

## Resources

- [Pinata Documentation](https://docs.pinata.cloud)
- [Pinata API Reference](https://docs.pinata.cloud/api)
- [IPFS Gateway](https://docs.ipfs.tech/concepts/ipfs-gateway/)

