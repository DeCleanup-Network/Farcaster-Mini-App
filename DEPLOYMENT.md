# DeCleanup Rewards - Deployment Guide

> **Complete guide for deploying and setting up the DeCleanup Rewards system**

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Contract Deployment](#contract-deployment)
4. [Contract Configuration](#contract-configuration)
5. [Frontend Configuration](#frontend-configuration)
6. [Testing](#testing)
7. [Mainnet Deployment](#mainnet-deployment)

---

## Prerequisites

### Required Accounts & Services

1. **Wallet with ETH**
   - Base Sepolia ETH for testnet (get from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet))
   - Base Mainnet ETH for production

2. **Pinata Account**
   - Sign up at [pinata.cloud](https://pinata.cloud)
   - Get API Key and Secret Key

3. **WalletConnect Project**
   - Sign up at [cloud.walletconnect.com](https://cloud.walletconnect.com)
   - Get Project ID

4. **Farcaster Neynar API**
   - Sign up at [neynar.com](https://neynar.com)
   - Get API Key

5. **Base Build Account**
   - Sign up at [build.base.org](https://build.base.org)
   - Get Base App ID

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/DeCleanup-Network/decleanup-mini-app-base.git
cd decleanup-mini-app-base
```

### 2. Install Dependencies

```bash
# Frontend
npm install

# Contracts
cd contracts
npm install
```

### 3. Configure Environment Variables

**Frontend (`.env.local`):**
```bash
# Blockchain
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# Contracts (will be set after deployment)
NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS=
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=

# Pinata (server-side only)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Farcaster
NEXT_PUBLIC_FARCASTER_NEYNAR_KEY=your_neynar_key

# Base
NEXT_PUBLIC_BASE_APP_ID=your_base_app_id
```

**Contracts (`.env`):**
```bash
# Network
PRIVATE_KEY=your_private_key_here
RPC_URL=https://sepolia.base.org

# Token (deploy first or use existing)
BDCU_TOKEN_ADDRESS=0x85162f919Bf8cd09B8046F8EAd2ecD434841e044

# Contracts (set after deployment)
POINTS_REWARD_DISTRIBUTOR_ADDRESS=
VERIFICATION_CONTRACT_ADDRESS=
IMPACT_PRODUCT_NFT_ADDRESS=
```

---

## Contract Deployment

### Step 1: Deploy Test Token (if needed)

If you don't have a token address:

```bash
cd contracts
npx hardhat run scripts/deployTestToken.js --network baseSepolia
```

Save the token address to `.env` as `BDCU_TOKEN_ADDRESS`.

### Step 2: Deploy PointsRewardDistributor

```bash
cd contracts

# Set initial token price (8 decimals, e.g., 77 = $0.00000077)
INITIAL_TOKEN_PRICE=77 npx hardhat run scripts/deployPointsRewardDistributor.js --network baseSepolia
```

**Save the contract address** to:
- `contracts/.env`: `POINTS_REWARD_DISTRIBUTOR_ADDRESS`
- `.env.local`: `NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS`

### Step 3: Deploy VerificationContract

```bash
cd contracts

# Set initial verifiers (comma-separated addresses)
INITIAL_VERIFIERS=0xYourAddress1,0xYourAddress2 \
SUBMISSION_FEE=0 \
FEE_ENABLED=false \
CLAIM_FEE=0 \
CLAIM_FEE_ENABLED=false \
npx hardhat run scripts/redeployVerificationContractWithFeeTreasury.js --network baseSepolia
```

**Save the contract address** to:
- `contracts/.env`: `VERIFICATION_CONTRACT_ADDRESS`
- `.env.local`: `NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS`

### Step 4: Deploy ImpactProductNFT

```bash
cd contracts

# Deploy with base URI (IPFS or your metadata URL)
BASE_URI=https://your-metadata-url.com/ \
npx hardhat run scripts/deployImpactProductNFT.js --network baseSepolia
```

**Save the contract address** to:
- `contracts/.env`: `IMPACT_PRODUCT_NFT_ADDRESS`
- `.env.local`: `NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS`

---

## Contract Configuration

### Step 1: Link Contracts

**Link PointsRewardDistributor:**
```bash
cd contracts
npx hardhat run scripts/setupPointsRewardDistributor.js --network baseSepolia
```

This script:
- Links ImpactProductNFT to PointsRewardDistributor
- Links VerificationContract to PointsRewardDistributor
- Sets initial token price and target reward value

**Link VerificationContract:**
```bash
npx hardhat run scripts/updateVerificationContractLinkage.js --network baseSepolia
```

**Link ImpactProductNFT:**
```bash
npx hardhat run scripts/updateImpactProductNFTLinkage.js --network baseSepolia
```

### Step 2: Verify Linkages

```bash
npx hardhat run scripts/verifyContractLinkages.js --network baseSepolia
```

### Step 3: Fund Contracts

**Transfer tokens to PointsRewardDistributor:**
```bash
TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferFromDeployer.js --network baseSepolia
```

**Check balance:**
```bash
npx hardhat run scripts/checkDistributorBalance.js --network baseSepolia
```

### Step 4: Configure Fees (Optional)

**Set submission fee:**
```bash
# Create script or use existing
```

**Set claim fee:**
```bash
# Create script or use existing
```

**Set fee treasury:**
```bash
npx hardhat run scripts/setFeeTreasury.js --network baseSepolia <treasury_address>
```

---

## Frontend Configuration

### 1. Update Contract Addresses

Update `.env.local` with all deployed contract addresses.

### 2. Configure Base Mini App

1. Go to [Base Build](https://build.base.org)
2. Create/update your app
3. Set Base App ID in `.env.local`

### 3. Configure Farcaster Manifest

Update `.well-known/farcaster.json` with your app details.

### 4. Test Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and test:
- Wallet connection
- Cleanup submission
- Verification
- Token claiming

---

## Testing

### Test Checklist

- [ ] Wallet connection works
- [ ] Cleanup submission works
- [ ] Verification works
- [ ] Points are awarded correctly
- [ ] Token claiming works
- [ ] Staking works
- [ ] Verifier status updates correctly
- [ ] Fees are collected (if enabled)
- [ ] All contract linkages verified

### Test Scripts

```bash
# Check user status
npx hardhat run scripts/checkUserStatus.js --network baseSepolia <user_address>

# Check contract balances
npx hardhat run scripts/checkDistributorBalance.js --network baseSepolia

# Test cleanup submission
npx hardhat run scripts/testSubmitCleanup.js --network baseSepolia
```

---

## Mainnet Deployment

### Pre-Deployment Checklist

- [ ] All contracts tested on testnet
- [ ] All linkages verified
- [ ] Token balances sufficient
- [ ] Fee configuration reviewed
- [ ] Treasury addresses set
- [ ] Admin functions tested
- [ ] Frontend tested with testnet contracts

### Deployment Steps

1. **Update RPC URLs:**
   - Change `NEXT_PUBLIC_CHAIN_ID` to `8453` (Base Mainnet)
   - Change `NEXT_PUBLIC_RPC_URL` to `https://mainnet.base.org`
   - Change `RPC_URL` in `contracts/.env` to `https://mainnet.base.org`

2. **Deploy Contracts:**
   ```bash
   # Deploy in same order as testnet
   npx hardhat run scripts/deployPointsRewardDistributor.js --network baseMainnet
   # ... etc
   ```

3. **Verify Contracts:**
   ```bash
   # Verify on Basescan
   npx hardhat verify --network baseMainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

4. **Configure Contracts:**
   ```bash
   # Same scripts as testnet, but use --network baseMainnet
   npx hardhat run scripts/setupPointsRewardDistributor.js --network baseMainnet
   ```

5. **Transfer Ownership to Multisig:**
   ```bash
   npx hardhat run scripts/transferOwnershipToMultisig.js --network baseMainnet
   ```

6. **Update Frontend:**
   - Update all contract addresses in `.env.local`
   - Deploy frontend to production

---

## Post-Deployment

### Monitoring

1. **Set up monitoring:**
   - Monitor contract balances
   - Monitor transaction volumes
   - Monitor error rates

2. **Regular checks:**
   - Daily: Contract balances
   - Weekly: Verifier activity
   - Monthly: Fee accumulation

### Maintenance

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for ongoing maintenance tasks.

---

## Troubleshooting

### Common Issues

**"Contract not found" errors:**
- Verify contract addresses in `.env` files
- Check network (testnet vs mainnet)

**"Insufficient balance" errors:**
- Fund contracts with tokens
- Check deployer wallet has ETH for gas

**"Not authorized" errors:**
- Verify contract linkages
- Check verifier status

---

## Support

For deployment issues:
- **Telegram**: [t.me/DecentralizedCleanup](https://t.me/DecentralizedCleanup)
- **Farcaster**: [@decleanup](https://warpcast.com/decleanup)

---

**Last Updated**: January 2025

