# Vercel Deployment Guide for Farcaster Mini App

This guide walks you through deploying the DeCleanup Farcaster Mini App to Vercel for testnet testing.

## Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- GitHub repository with your code (or GitLab/Bitbucket)
- Base Build access for generating `accountAssociation`
- All environment variables ready

## Step 1: Prepare Your Repository

### 1.1 Ensure `.well-known` Directory is Tracked

The `.well-known/farcaster.json` file must be committed to your repository:

```bash
# Check if .well-known is tracked
git ls-files .well-known/

# If not, add it
git add .well-known/farcaster.json
git commit -m "Add Farcaster manifest"
git push
```

### 1.2 Verify `next.config.ts` Headers

Your `next.config.ts` should already have headers configured for `.well-known` routes. Verify it includes:

```typescript
async headers() {
  return [
    {
      source: '/.well-known/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
        {
          key: 'Content-Type',
          value: 'application/json',
        },
      ],
    },
  ];
}
```

## Step 2: Connect Repository to Vercel

### 2.1 Import Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your Git provider (GitHub, GitLab, or Bitbucket)
4. Authorize Vercel to access your repositories
5. Select the `DeCleanup-Network/Farcaster-Mini-App` repository
6. Click **"Import"**

### 2.2 Configure Project Settings

Vercel should auto-detect Next.js. Verify these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `./` (root of repository)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

## Step 3: Configure Environment Variables

### 3.1 Add Environment Variables in Vercel Dashboard

**⚠️ CRITICAL**: The following environment variables are **REQUIRED** for the app to function:

1. In the project settings, go to **Settings** → **Environment Variables**
2. Add each variable for **Production**, **Preview**, and **Development** environments:

**Required Variables (app will fail without these):**
- `NEXT_PUBLIC_PINATA_API_KEY` - **REQUIRED** for photo uploads
- `NEXT_PUBLIC_PINATA_SECRET_KEY` - **REQUIRED** for photo uploads
- `NEXT_PUBLIC_CHAIN_ID` - **REQUIRED** for blockchain interactions
- Contract addresses - **REQUIRED** for all contract calls

#### Base Network Configuration
```
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_TESTNET_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.basescan.org

   NEXT_PUBLIC_CHAIN_ID=84532
   NEXT_PUBLIC_TESTNET_RPC_URL=https://sepolia.base.org
   NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://sepolia.basescan.org
   NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9
   NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x08e9Ad176773ea7558e9C8453191d4361f8225f5
   NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0xd77f64024b0Ce2359DCe43ea149c77bF3cf08a40
   NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
   NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_token
```

#### Contract Addresses (Base Sepolia)
```
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x08e9Ad176773ea7558e9C8453191d4361f8225f5
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0xd77f64024b0Ce2359DCe43ea149c77bF3cf08a40
```

#### IPFS Configuration (REQUIRED for photo uploads)
```
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
NEXT_PUBLIC_PINATA_SECRET_KEY=your_pinata_secret_key
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud
```

**⚠️ IMPORTANT**: Without Pinata API keys, users cannot upload photos. The cleanup submission will fail with:
```
Failed to upload before photo: Pinata API keys not configured
```

To get your Pinata API keys:
1. Sign up at [pinata.cloud](https://pinata.cloud)
2. Go to API Keys section
3. Create a new API key with `pinFileToIPFS` and `pinJSONToIPFS` permissions
4. Copy the API Key and Secret Key
5. Add them to Vercel environment variables

#### WalletConnect (Optional)
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

#### Impact Product Metadata (Optional)
```
NEXT_PUBLIC_IMPACT_METADATA_CID=your_metadata_cid
```

### 3.2 Environment-Specific Variables

- **Production**: Use mainnet values (when ready)
- **Preview**: Use testnet values (Base Sepolia)
- **Development**: Use testnet values (Base Sepolia)

**Important**: For testnet deployment, ensure all `NEXT_PUBLIC_*` variables are set to Base Sepolia values.

## Step 4: Deploy

### 4.1 Initial Deployment

1. Click **"Deploy"** button
2. Vercel will:
   - Install dependencies
   - Run build command
   - Deploy to a preview URL (e.g., `farcaster-mini-app-xyz.vercel.app`)

### 4.2 Monitor Build Logs

Watch the build logs for any errors:
- ✅ Build successful
- ❌ Check for missing environment variables
- ❌ Check for TypeScript/build errors

## Step 5: Configure Custom Domain (Optional for Testnet)

### 5.1 Add Domain

1. Go to **Settings** → **Domains**
2. Add your testnet domain (e.g., `testnet.decleanup.network`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (can take a few minutes to 48 hours)

### 5.2 Update Farcaster Manifest

Once your domain is live, update `.well-known/farcaster.json`:

1. **Generate `accountAssociation` via Base Build**:
   - Log into [Base Build](https://build.base.org)
   - Create/update your Mini App
   - Copy the generated `header`, `payload`, and `signature`

2. **Update Manifest**:
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
      "name": "DeCleanup Rewards",
       "homeUrl": "https://your-testnet-domain.vercel.app",
       "iconUrl": "https://your-testnet-domain.vercel.app/icon.png",
       "splashImageUrl": "https://your-testnet-domain.vercel.app/splash.png",
       ...
     }
   }
   ```

3. **Commit and Push**:
   ```bash
   git add .well-known/farcaster.json
   git commit -m "Update Farcaster manifest with testnet URLs"
   git push
   ```

4. **Vercel will auto-deploy** the updated manifest

## Step 6: Verify Deployment

### 6.1 Check Manifest Accessibility

Visit your deployed URL:
```
https://your-app.vercel.app/.well-known/farcaster.json
```

**Expected Response**:
- ✅ Status: 200 OK
- ✅ Content-Type: `application/json`
- ✅ Valid JSON with `accountAssociation` populated
- ✅ CORS headers present

**If 404 Error**:
- Check that `.well-known/farcaster.json` is committed to repository
- Verify `next.config.ts` headers configuration
- Check Vercel build logs for errors

### 6.2 Test App Functionality

1. **Visit Homepage**: `https://your-app.vercel.app`
2. **Check Console**: Open browser DevTools, check for errors
3. **Test Wallet Connection**: Try connecting MetaMask/Coinbase Wallet
4. **Verify Network**: Ensure it switches to Base Sepolia

## Step 7: Test in Farcaster Client

### 7.1 Open in Warpcast

1. Open Warpcast app (iOS/Android) or web
2. Navigate to your Mini App URL
3. Or search for your app in Farcaster Mini Apps directory

### 7.2 Test Flows

1. **Wallet Connection**:
   - ✅ Farcaster wallet auto-connects
   - ✅ Network switches to Base Sepolia
   - ✅ No VeChain errors

2. **Cleanup Submission**:
   - ✅ Upload before/after photos
   - ✅ Capture location
   - ✅ Fill impact report form
   - ✅ Submit cleanup
   - ✅ Transaction confirms on Base Sepolia

3. **Impact Product Claiming**:
   - ✅ Wait for verification
   - ✅ Claim Impact Product NFT
   - ✅ NFT appears in profile
   - ✅ Share on X works

4. **Verifier Dashboard**:
   - ✅ Verifier can sign in
   - ✅ Can view pending cleanups
   - ✅ Can verify/reject cleanups
   - ✅ Stats display correctly

## Step 8: Troubleshooting

### 8.1 Manifest Not Accessible (404)

**Solution**:
```bash
# Ensure .well-known is in repository root (not in public/)
# Verify file structure:
.well-known/
  └── farcaster.json

# Check next.config.ts has headers configured
# Redeploy on Vercel
```

### 8.2 Environment Variables Not Loading

**Solution**:
- Verify variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Ensure `NEXT_PUBLIC_*` prefix for client-side variables
- Redeploy after adding variables

### 8.3 Build Errors

**Common Issues**:
- **TypeScript errors**: Fix in local environment first
- **Missing dependencies**: Check `package.json`
- **Node version**: Vercel auto-detects, but can set in settings

### 8.4 CORS Errors

**Solution**:
- Verify `next.config.ts` headers include CORS
- Check `.well-known` route is properly configured
- Test manifest URL directly in browser

### 8.5 Wallet Connection Issues

**Solution**:
- Check `NEXT_PUBLIC_CHAIN_ID` is set to `84532` (Base Sepolia)
- Verify RPC URLs are correct
- Check browser console for specific errors
- Ensure VeChain extension is disabled (if applicable)

## Step 9: Production Deployment Checklist

Before deploying to mainnet:

- [ ] All testnet tests pass
- [ ] Contracts deployed to Base Mainnet
- [ ] Environment variables updated for mainnet
- [ ] `NEXT_PUBLIC_CHAIN_ID` set to `8453` (Base Mainnet)
- [ ] Contract addresses updated
- [ ] RPC URLs updated to mainnet
- [ ] Farcaster manifest updated with production domain
- [ ] `accountAssociation` regenerated for production
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] All images/assets uploaded and accessible
- [ ] Tested in Farcaster client end-to-end

## Vercel-Specific Tips

### Automatic Deployments

- **Push to `main` branch**: Deploys to production
- **Push to other branches**: Creates preview deployment
- **Pull requests**: Auto-creates preview deployments

### Preview Deployments

Each PR gets a unique URL:
```
https://farcaster-mini-app-git-branch-name.vercel.app
```

Use these for testing before merging to main.

### Environment Variables Priority

1. **Production**: Used for `main` branch deployments
2. **Preview**: Used for branch/PR deployments
3. **Development**: Used for local `vercel dev`

### Build Optimization

Vercel automatically:
- Optimizes Next.js builds
- Caches dependencies
- Uses Edge Network for fast global delivery

### Monitoring

- **Deployments**: View in Vercel dashboard
- **Logs**: Check function logs for runtime errors
- **Analytics**: Enable Vercel Analytics (optional)

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Custom Domains](https://vercel.com/docs/projects/domains)
- [Base Mini App Template](https://docs.base.org/miniapp)
- [Pinata Setup Guide](./pinata-setup.md) - **Required for photo uploads**

## Quick Reference

### Deployment Commands

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls
```

### Important URLs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Project Settings**: https://vercel.com/[username]/[project]/settings
- **Deployments**: https://vercel.com/[username]/[project]/deployments
- **Environment Variables**: https://vercel.com/[username]/[project]/settings/environment-variables

---

**Next Steps**: After successful testnet deployment, proceed to mainnet deployment following the same steps with mainnet environment variables.

