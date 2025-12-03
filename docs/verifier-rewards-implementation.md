# Verifier Rewards Implementation

## ✅ Changes Made

### 1. Added Verifier Rewards to bDCURewardDistributor

**Contract:** `contracts/contracts/bDCURewardDistributor.sol`

- Added constant: `VERIFIER_REWARD = 1 * 10**18` (1 $bDCU)
- Added function: `distributeVerifierReward(address verifier, uint256 cleanupId)`
- Added event: `VerifierRewardDistributed`

**Reward Structure:**
- Verifiers receive **1 $bDCU** per verification (both approved and rejected cleanups)

### 2. Updated VerificationContract

**Contract:** `contracts/contracts/VerificationContract.sol`

- Updated `verifyCleanup()` to call `distributeVerifierReward()` immediately
- Updated `rejectCleanup()` to call `distributeVerifierReward()` immediately
- Changed from concrete `RewardDistributor` type to `address` with `IRewardDistributor` interface
- Removed dependency on old `RewardDistributor.sol` import

### 3. Updated Frontend

**File:** `app/verifier/page.tsx`

- Changed from calculated earnings to actual contract data
- Now calls `getVerifierTokenEarnings()` from `lib/contracts.ts`
- Falls back to calculation if contract call fails

**File:** `lib/contracts.ts`

- Added `getVerifierTokenEarnings(verifierAddress)` function
- Reads from `bDCURewardDistributor.totalDistributed(verifierAddress)`
- Returns formatted token amount (18 decimals)

### 4. Updated Interface

**File:** `contracts/contracts/ImpactProductNFT.sol`

- Extended `IRewardDistributor` interface to include:
  - `distributeVerifierReward(address verifier, uint256 cleanupId)`
  - All other reward distribution functions

## 📋 Deployment Steps

### Step 1: Redeploy bDCURewardDistributor

```bash
cd contracts
npx hardhat run scripts/redeployBDCURewardDistributor.js --network baseSepolia
```

**What this does:**
- Deploys new `bDCURewardDistributor` with verifier rewards function
- Saves deployment info to `bdcu-reward-distributor-deployment.json`

**After deployment:**
1. Link contracts (ImpactProductNFT and VerificationContract)
2. Transfer tokens from old distributor to new one (if needed)
3. Update environment variables

### Step 2: Redeploy VerificationContract

```bash
cd contracts
npx hardhat run scripts/redeployVerificationWithVerifierRewards.js --network baseSepolia
```

**What this does:**
- Deploys new `VerificationContract` with verifier reward calls
- Automatically links to ImpactProductNFT and bDCURewardDistributor
- Updates environment variables

**After deployment:**
1. Update `.env.local` with new VerificationContract address
2. Test verification to ensure verifier receives tokens

### Step 3: Update Environment Variables

**contracts/.env:**
```env
BDCU_REWARD_DISTRIBUTOR_ADDRESS=<new_distributor_address>
VERIFICATION_CONTRACT_ADDRESS=<new_verification_address>
```

**.env.local:**
```env
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=<new_distributor_address>
NEXT_PUBLIC_VERIFICATION_CONTRACT=<new_verification_address>
```

## 🗑️ Old RewardDistributor Removal

**Status:** Can be removed after migration

**Files that reference it:**
- `contracts/contracts/RewardDistributor.sol` - Can be deleted
- `contracts/scripts/redeployVerification.js` - Still references old contract (can be updated or removed)

**Note:** The old `RewardDistributor` contract at `0xd77f64024b0Ce2359DCe43ea149c77bF3cf08a40` is no longer used. All contracts now use `bDCURewardDistributor`.

## ✅ Complete Reward Structure

After deployment, the reward system includes:

1. **Level Reward:** 10 $bDCU (when user claims Impact Product)
2. **Streak Reward:** 2 $bDCU (if user maintains streak)
3. **Referral Reward:** 3 $bDCU (to both referrer and referee)
4. **Impact Form Reward:** 5 $bDCU (if user submits enhanced form)
5. **Verifier Reward:** 1 $bDCU (to verifier on each verification/rejection) ✨ NEW

## 🧪 Testing

After deployment, test:

1. **Verifier Reward:**
   - Verify a cleanup → Check verifier wallet for 1 $bDCU
   - Reject a cleanup → Check verifier wallet for 1 $bDCU
   - Check verifier dashboard → Should show actual token earnings

2. **User Rewards:**
   - Claim Impact Product → User should receive 10 $bDCU
   - Check user wallet for token balance

3. **Frontend:**
   - Verifier dashboard should show actual token earnings (not calculated)
   - Should update in real-time as verifications happen

