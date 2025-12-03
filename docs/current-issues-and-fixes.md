# Current Issues and Fixes Summary

## Issues Fixed

### 1. ✅ Impact Report Disappearing in Verifier Dashboard
**Problem**: Impact report details disappear when scrolling or waiting.

**Fix**: 
- Added localStorage persistence for expanded state
- Each cleanup's impact report expanded state is now saved with a unique key
- State persists across page refreshes and scrolling

**Files Changed**: `app/verifier/page.tsx`

### 2. ✅ Referred By Address Not Fully Visible
**Problem**: Referrer address was truncated to `{address.slice(0, 10)}...`

**Fix**: 
- Now displays full wallet address with proper formatting
- Added ENS name resolution support (shows ENS name if available, with address as fallback)

**Files Changed**: `app/verifier/page.tsx`

### 3. ✅ ENS Address Fetching in Farcaster
**Problem**: Need to fetch ENS names for addresses displayed in verifier dashboard.

**Fix**: 
- Added ENS name fetching using `getEnsName` from wagmi
- Fetches ENS names for all unique addresses (users and referrers) in cleanups
- Displays ENS name with address fallback in `AddressDisplay` component
- Works cross-chain (ENS resolution queries Ethereum mainnet regardless of connected chain)

**Files Changed**: `app/verifier/page.tsx`

**Note**: ENS resolution works in Farcaster context because it queries Ethereum mainnet directly, not the connected chain.

## Issues Identified (Require Contract Changes)

### 4. ✅ $bDCU Rewards Distributed Too Early - FIXED
**Problem**: Rewards were distributed on **verification** instead of **claim**.

**Fix Applied**:
- ✅ Removed reward distribution from `verifyCleanup()` function
- ✅ Added reward distribution to `claimImpactProduct()` function
- ✅ All rewards (referral, streak, impact form) now distributed when user claims
- ✅ Level rewards already correctly distributed via `ImpactProductNFT.claimLevelForUser()`

**Contract Changes Made**:
- `contracts/contracts/VerificationContract.sol`: 
  - Removed reward distribution from `verifyCleanup()` (lines 166-180)
  - Added reward distribution to `claimImpactProduct()` (before NFT claim)

**Result**: Users now only receive $bDCU rewards after they claim their Impact Product, not when verification happens.

### 5. ✅ Verifier Rewards Stats - IMPLEMENTED
**Problem**: No UI showing verifier statistics.

**Fix Applied**:
- ✅ Added "Verifier Statistics" section to verifier dashboard
- ✅ Shows "Total Verified by You" (count of cleanups verified)
- ✅ Shows "Total $bDCU Distributed" (total tokens distributed to all users in system)
- ✅ Queries both token system (bDCURewardDistributor) and points system (RewardDistributor)
- ✅ Includes note that verifiers don't receive rewards for verifying

**Files Changed**: 
- `app/verifier/page.tsx`: Added verifier stats section and loading logic
- `lib/contracts.ts`: Added `totalPointsDistributed` to REWARD_DISTRIBUTOR_ABI

**Note**: Verifiers don't receive rewards for verifying cleanups (intentional design). Stats show verification activity and total system distribution.

### 6. ⚠️ Referral Persistence
**Problem**: Need to ensure referral is saved even if user leaves before submitting cleanup.

**Current Behavior**:
- Referral is saved to localStorage when user visits with `?ref=` parameter
- Referral is used when submitting cleanup
- If user leaves before submitting, referral remains in localStorage

**Potential Issues**:
- If user clears localStorage, referral is lost
- If user submits from different device/browser, referral is lost

**Recommendation**: 
- Current implementation is sufficient for MVP
- Referral is stored in contract when cleanup is submitted (line 141 in VerificationContract.sol)
- Consider adding referral tracking to user account/profile if needed

## Questions Answered

### 7. $bDCU Token Status and Clanker Integration

**Current Implementation**:
- Code supports both **points system** (current) and **token system** (future)
- `RewardDistributor.sol`: Points-based system (current)
- `bDCURewardDistributor.sol`: Token-based system (for Clanker integration)

**Environment Variables**:
- `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS`: Clanker token contract address (set when token is deployed)
- `NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS`: Reward distributor contract address

**Migration Path**:
1. Deploy token on Clanker (`clanker.world/deploy`)
2. Set token address in environment variables
3. Deploy `bDCURewardDistributor` contract with token address
4. Fund distributor contract with tokens from Clanker dev buy (15% community pool)
5. Update contract addresses in environment variables
6. Code will automatically use token balance instead of points balance

**Current Code Behavior**:
- `getDCUBalance()` in `lib/contracts.ts` checks:
  1. Direct ERC20 token balance (if token address is set)
  2. Points balance from RewardDistributor (fallback)
  3. Local storage (temporary fallback)

**Clanker 15% Community Pool**:
- This pool can be used to fund the `bDCURewardDistributor` contract
- Tokens are distributed automatically when users claim Impact Products
- No migration needed for users - points convert 1:1 to tokens

### 8. Domain Configuration

**Current Setup**:
- `miniapp.decleanup.net`: Main miniapp domain (Farcaster)
- `decleanup.net`: Secondary domain (registered on Cloudflare)

**Farcaster Manifest**:
- Located at: `.well-known/farcaster.json` and `public/.well-known/farcaster.json`
- `homeUrl`: Should point to `https://miniapp.decleanup.net`
- `castShareUrl`: Should point to `https://miniapp.decleanup.net`

**Transaction Approval Display**:
- Domain shown in transaction approvals is controlled by:
  1. Wallet's site metadata (from manifest)
  2. `NEXT_PUBLIC_MINIAPP_URL` environment variable
  3. Farcaster manifest `homeUrl` field

**To Make `miniapp.decleanup.net` Primary**:
1. Ensure Farcaster manifest uses `miniapp.decleanup.net` in all URLs
2. Set `NEXT_PUBLIC_MINIAPP_URL=https://miniapp.decleanup.net` in environment
3. Update all share links and referral URLs to use `miniapp.decleanup.net`
4. Set up redirects from `decleanup.net` to `miniapp.decleanup.net` if needed

## Next Steps

1. **Contract Updates** (High Priority):
   - Move reward distribution from verification to claim
   - Test reward timing with new contract

2. **Verifier Dashboard Enhancements** (Medium Priority):
   - Add verifier earnings stats (if applicable)
   - Add verifier performance metrics

3. **Referral System** (Low Priority):
   - Consider cross-device referral tracking
   - Add referral history to user profile

4. **Clanker Integration** (When Ready):
   - Deploy token on Clanker
   - Deploy bDCURewardDistributor contract
   - Fund with community pool tokens
   - Update environment variables

