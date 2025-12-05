# Deployment Guide for Updated Contracts

## New Features in This Deployment

1. **Streak Tracking** (bDCURewardDistributor)
   - Tracks user streaks with 7-day window
   - Rewards 2 $bDCU for maintaining streak
   - First cleanup starts streak, subsequent cleanups within 7 days maintain it

2. **Referral Protection** (Both Contracts)
   - Users can only be referred ONCE (on their first submission)
   - Prevents multiple referral rewards
   - Referral persists in localStorage until submission

## Prerequisites

1. **Environment Variables** (in `contracts/.env`):
   ```bash
   PRIVATE_KEY=your_private_key_here
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   # Or use a more reliable RPC:
   # BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   # BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/YOUR_API_KEY
   
   # Required addresses (or will be deployed/loaded):
   BDCU_TOKEN_ADDRESS=0x85162f919Bf8cd09B8046F8EAd2ecD434841e044  # Test token
   IMPACT_PRODUCT_CONTRACT_ADDRESS=0x...  # Your existing ImpactProductNFT
   VERIFIER_ADDRESSES=0x...,0x...  # Comma-separated verifier addresses
   
   # Optional fee configuration:
   CLAIM_FEE=7000000000000  # ~2 cents USD in wei
   CLAIM_FEE_ENABLED=true
   SUBMISSION_FEE=0  # Disabled by default
   FEE_ENABLED=false
   ```

2. **Compile Contracts**:
   ```bash
   cd contracts
   npx hardhat compile
   ```

## Deployment Steps

### Option 1: Deploy Both Contracts (Recommended)

```bash
cd contracts
npx hardhat run scripts/deployUpdatedContracts.js --network baseSepolia
```

This will:
1. Deploy new `bDCURewardDistributor` (with streak tracking)
2. Deploy new `VerificationContract` (with referral protection)
3. Link all contracts together
4. Save deployment info to JSON files

### Option 2: Deploy Contracts Separately

#### Step 1: Deploy bDCURewardDistributor
```bash
cd contracts
npx hardhat run scripts/redeployBDCURewardDistributor.js --network baseSepolia
```

#### Step 2: Deploy VerificationContract
```bash
cd contracts
npx hardhat run scripts/redeployVerificationWithVerifierRewards.js --network baseSepolia
```

## After Deployment

1. **Update Environment Variables**:

   In `contracts/.env`:
   ```bash
   BDCU_REWARD_DISTRIBUTOR_ADDRESS=<new_distributor_address>
   VERIFICATION_CONTRACT_ADDRESS=<new_verification_address>
   ```

   In `.env.local` (frontend):
   ```bash
   NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=<new_distributor_address>
   NEXT_PUBLIC_VERIFICATION_CONTRACT=<new_verification_address>
   ```

2. **Transfer Tokens** (if needed):
   ```bash
   cd contracts
   npx hardhat run scripts/transferTokensToDistributor.js --network baseSepolia
   ```

3. **Verify Contracts** (optional):
   ```bash
   npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

## Troubleshooting

### RPC Error (500 Internal Server Error)

If you get RPC errors, try:

1. **Use a different RPC endpoint**:
   - Alchemy: `https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
   - Infura: `https://base-sepolia.infura.io/v3/YOUR_API_KEY`
   - QuickNode: Your QuickNode endpoint

2. **Wait and retry** - Public RPCs can be rate-limited

3. **Check network status**:
   ```bash
   curl https://sepolia.base.org
   ```

### Missing Addresses

If you get "address not found" errors:
- Check that `IMPACT_PRODUCT_CONTRACT_ADDRESS` is set in `.env`
- Or deploy ImpactProductNFT first using `deploy.js`

### Gas Issues

If transactions fail due to gas:
- Check your account balance: `npx hardhat run scripts/checkContractOwners.js --network baseSepolia`
- Increase gas limit in hardhat.config.js if needed

## Deployment Files Created

After successful deployment, you'll have:
- `bdcu-reward-distributor-deployment.json` - Distributor deployment info
- `verification-contract-deployment.json` - Verification contract deployment info

These files contain all addresses and can be used for future reference.

## Testing New Features

1. **Test Streak Tracking**:
   - Submit first cleanup → streak = 1, no streak reward
   - Submit second cleanup within 7 days → streak = 2, get 2 $bDCU
   - Submit after 7 days → streak resets to 1

2. **Test Referral Protection**:
   - New user with referral link → referral stored
   - Submit cleanup → referral reward distributed
   - Try to use another referral link → ignored (already submitted)

## Rollback Plan

If you need to rollback:
1. Keep old contract addresses in `.env`
2. Update frontend to point to old addresses
3. New contracts remain deployed but unused

