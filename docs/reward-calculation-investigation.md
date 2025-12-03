# Reward Calculation Investigation

## Issue
User reported receiving 17 $bDCU after claiming an Impact Product with a referral, but expected 13-18 $bDCU.

## Reward Structure

When a user claims an Impact Product, the following rewards are distributed:

1. **Level Reward**: 10 $bDCU (always distributed when level is claimed)
2. **Referral Reward**: 3 $bDCU (to both referrer and referee, if referrer exists)
3. **Streak Reward**: 2 $bDCU (if user maintains a streak - may fail silently if conditions not met)
4. **Impact Form Reward**: 5 $bDCU (if enhanced impact form was submitted)

### Expected Totals

- **Minimum** (no referral, no impact form, no streak): 10 $bDCU
- **With referral only**: 10 + 3 = 13 $bDCU
- **With referral + impact form**: 10 + 3 + 5 = 18 $bDCU
- **With referral + streak**: 10 + 3 + 2 = 15 $bDCU
- **With referral + impact form + streak**: 10 + 3 + 5 + 2 = 20 $bDCU

## Why 17 $bDCU?

The user's displayed balance (17 $bDCU) is their **total ERC20 token balance**, which includes:

1. **All rewards from this claim** (13-20 $bDCU depending on conditions)
2. **Previous rewards** from earlier cleanups/actions
3. **Tokens from other sources** (if any)

### Possible Explanations

1. **Previous Balance**: User had 4 $bDCU from previous actions, then received 13 $bDCU from this claim = 17 $bDCU total
2. **Partial Reward Failure**: One reward failed silently (unlikely, as rewards use try-catch and should either succeed or fail completely)
3. **Display Rounding**: Balance display might be rounding (but 17 is a whole number, so unlikely)

## How to Debug

### Check Contract-Tracked Rewards

The `bDCURewardDistributor` contract tracks all rewards distributed via the `totalDistributed` mapping. Use the new `getTotalRewardsDistributed()` function to check:

```typescript
import { getTotalRewardsDistributed } from '@/lib/contracts'

const contractTrackedRewards = await getTotalRewardsDistributed(userAddress)
const actualBalance = await getPointsBalance(userAddress)

console.log('Contract tracked:', contractTrackedRewards)
console.log('Actual balance:', actualBalance)
```

### Check Individual Rewards

To see which specific rewards were distributed, check the blockchain events:

- `LevelRewardDistributed(address indexed user, uint256 amount)` - 10 $bDCU
- `ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount)` - 3 $bDCU each
- `StreakRewardDistributed(address indexed user, uint256 amount)` - 2 $bDCU
- `ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount)` - 5 $bDCU

### Expected vs Actual

- **Contract `totalDistributed`**: Shows cumulative rewards distributed by the contract
- **User's ERC20 balance**: Shows actual token balance (may include tokens from other sources)

If these differ, it means:
- User received tokens from other sources, OR
- User transferred/spent some tokens, OR
- There's a discrepancy that needs investigation

## Referral Reward Confirmation

The referral reward is **3 $bDCU** (not 2), as defined in the contract:

```solidity
uint256 public constant REFERRAL_REWARD = 3 * 10**18; // 3 $bDCU for both referrer and referee
```

Both the referrer and referee receive 3 $bDCU each when a referral is processed.

## Recommendation

1. Check the user's transaction history to see all reward distributions
2. Compare `totalDistributed` from the contract vs actual balance
3. Check if user had any previous balance before this claim
4. Verify which rewards were actually distributed by checking events

The most likely explanation is that the user had a previous balance of 4 $bDCU, and received 13 $bDCU from this claim (10 level + 3 referral), totaling 17 $bDCU.

