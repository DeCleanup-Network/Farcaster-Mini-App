# Base Mini App Setup Guide

This guide walks you through setting up DeCleanup as a Base Mini App following the [Base Mini App template](https://docs.base.org/miniapp).

## Prerequisites

- Base account (sign up at [base.org](https://base.org))
- Deployed app URL (e.g., `https://decleanup.network`)
- Base Build access for accountAssociation generation

## Step 1: Generate accountAssociation

The `accountAssociation` field in `.well-known/farcaster.json` must be generated via Base Build to link your Base account to the Mini App.

### Using Base Build

1. **Access Base Build**: Log into your Base account and navigate to Base Build
2. **Create Mini App**: Follow the Base Build interface to create a new Mini App
3. **Generate accountAssociation**: Base Build will generate the `accountAssociation` object with:
   - `header`: Base64-encoded header
   - `payload`: Base64-encoded payload
   - `signature`: Cryptographic signature
4. **Copy the generated values**: The structure will look like:
   ```json
   {
     "accountAssociation": {
       "header": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9",
       "payload": "eyJpc3MiOiJodHRwczovL2Jhc2Uub3JnIiwic3ViIjoiMHg1NGUyYkM3NDZjRjYzNDY5QTBjYTFlM2M2NjQ3QkIzY0ZDRTQ4OTc4IiwiaWF0IjoxNzE2MjM0NTY3LCJleHAiOjE3MTYyMzQ1Njc...",
       "signature": "0x1234..."
     }
   }
   ```

### baseBuilder Configuration

The `baseBuilder` section identifies the owner of the Mini App:

```json
{
  "baseBuilder": {
    "ownerAddress": "0x54e2bC746Cf63469A0ca1e3c6647BB3cfCE48978"
  }
}
```

This is already configured in your manifest. If you need to allow multiple addresses, use `allowedAddresses` instead:

```json
{
  "baseBuilder": {
    "allowedAddresses": ["0x54e2bC746Cf63469A0ca1e3c6647BB3cfCE48978"]
  }
}
```

## Step 2: Update Manifest

Update `.well-known/farcaster.json` with your generated `accountAssociation` from Base Build. The manifest structure includes:

1. **accountAssociation**: Generated via Base Build (header, payload, signature)
2. **baseBuilder**: Owner address (already configured)
3. **miniapp**: App metadata (name, URLs, images, etc.)

The complete structure should look like:

```json
{
  "accountAssociation": {
    "header": "YOUR_BASE_BUILD_HEADER",
    "payload": "YOUR_BASE_BUILD_PAYLOAD",
    "signature": "YOUR_BASE_BUILD_SIGNATURE"
  },
  "baseBuilder": {
    "ownerAddress": "0x54e2bC746Cf63469A0ca1e3c6647BB3cfCE48978"
  },
  "miniapp": {
    "version": "1",
    "name": "DeCleanup Network",
    "homeUrl": "https://decleanup.network",
    "iconUrl": "https://decleanup.network/icon.png",
    "splashImageUrl": "https://decleanup.network/splash.png",
    "splashBackgroundColor": "#000000",
    "subtitle": "Tokenize Your Environmental Impact",
    "description": "Join the global cleanup movement...",
    "screenshotUrls": [...],
    "primaryCategory": "social",
    "tags": ["environment", "cleanup", "impact", "nft", "base"],
    "heroImageUrl": "https://decleanup.network/og-image.png",
    "tagline": "Clean Up, Snap, Earn",
    "ogTitle": "DeCleanup Network - Tokenize Your Environmental Impact",
    "ogDescription": "Join the global cleanup movement...",
    "ogImageUrl": "https://decleanup.network/og-image.png",
    "noindex": false
  }
}
```

**Important**: Replace all placeholder URLs (`https://decleanup.network/...`) with your actual deployed domain and ensure all image assets exist.

## Step 3: Update Metadata

The app layout (`app/layout.tsx`) already includes the required `fc:miniapp` metadata:

```typescript
other: {
  "fc:miniapp": "https://decleanup.network",
  "fc:frame": "vNext",
}
```

Update the URL to match your deployed domain.

## Step 4: Deploy & Verify

1. **Deploy your app** to your hosting provider (Vercel, etc.)
2. **Verify manifest is accessible**: 
   - Visit `https://your-domain.com/.well-known/farcaster.json`
   - Should return valid JSON with your `accountAssociation`
3. **Test in Farcaster**: 
   - Open your app in a Farcaster client (Warpcast, etc.)
   - Verify wallet connection works via Farcaster SDK
   - Test Base network switching

## Step 5: Environment Variables

Ensure your `.env.local` includes Base configuration:

```bash
# Base network
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia (8453 for mainnet)
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_TESTNET_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.basescan.org

# Contract addresses (after deployment)
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x...
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0x...
NEXT_PUBLIC_RECYCLABLES_CONTRACT=0x...
```

## Troubleshooting

### Manifest not accessible
- Check `next.config.ts` has proper headers for `.well-known` routes
- Verify file is in `.well-known/farcaster.json` (not `public/.well-known/`)
- Check CORS headers if accessing from different domain

### accountAssociation errors
- Ensure `accountAssociation` is generated via Base Build (not manually)
- Verify Base account address matches your deployment
- Check that `chain` field is set to `"base"`

### Wallet connection issues
- Verify `@farcaster/miniapp-sdk` is properly installed
- Check that `farcasterMiniApp()` connector is in wagmi config
- Ensure Base network is configured in wagmi chains

## Resources

- [Base Mini App Documentation](https://docs.base.org/miniapp)
- [Farcaster Mini Apps Guide](https://docs.farcaster.xyz/developers/mini-apps)
- [Base Build](https://build.base.org)

