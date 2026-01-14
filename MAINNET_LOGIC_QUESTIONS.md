# Mainnet Deployment - Logic Questions

## PointsRewardDistributor.sol

### 1. Staking Logic
**Question:** In `stakeTokens()`, the requirement is `amount > userBalance / 2`. This means if a user has 100 tokens, they must stake at least 51 tokens. However, if they stake exactly 50.5 tokens worth (which would be > 50), the integer division `userBalance / 2` would be 50, so `amount > 50` would pass. But what if the user's balance changes between when they check and when they stake? Should we check the balance at the time of staking, or is the current logic fine?

**Current logic:** Checks balance at staking time, requires `amount > userBalance / 2`

### 2. Unstaking Logic
**Question:** In `unstakeTokens()`, if a user unstakes more than half, they lose verifier status. But what if they're a manually added verifier? The code checks `!manuallyAddedVerifiers[msg.sender]`, which is correct. However, what if a manually added verifier also has staked tokens? If they unstake everything, they keep verifier status (correct), but if they unstake more than half, they also keep it (correct). Is this the intended behavior?

**Current logic:** Manually added verifiers never lose status on unstaking, even if they unstake all tokens.

### 3. Verifier Status on Staking
**Question:** In `stakeTokens()`, a user becomes a verifier if they have level 10 OR if they're manually added. But what if a manually added verifier stakes tokens? They're already a verifier, so nothing changes. What if a user who's not a verifier but has level 10 stakes less than 51%? They won't become a verifier because the 51% check fails first. Is this correct?

**Current logic:** Must stake > 51% OR be manually added to become verifier (if level 10).

### 4. Claim Formula Precision
**Question:** The claim formula is: `(points × targetRewardValueUSD) / LEVEL_POINTS` for cents, then `(cents × 1e18) / 100` for dollars, then `(dollars × 1e8) / currentTokenPriceUSD` for tokens. This could lose precision for very small amounts. For example, if someone claims 1 point and the token price is very high, the result might round to 0. Is this acceptable, or should we add a minimum claim amount?

**Current logic:** No minimum claim amount, but `require(tokensToReceive > 0)` prevents 0-amount claims.

### 5. Manual Verifier Bypass
**Question:** Manually added verifiers can call `awardStreakPoints`, `awardReferralPoints`, etc. even if they don't have level 10. Is this intentional? Should manually added verifiers still need level 10 to claim/stake, or should they bypass all level requirements?

**Current logic:** Manual verifiers can award points but still need level 10 to claim/stake.

### 6. Streak Logic
**Question:** In `awardStreakPoints()`, if a user has no active streak (first cleanup or broken streak), we set `streakCount[user] = 1` but don't award points. This means the first cleanup doesn't count toward the streak reward, only subsequent cleanups within 7 days do. Is this correct?

**Current logic:** First cleanup starts streak at 1, no points. Next cleanup within 7 days awards points.

## VerificationContract.sol

### 7. Referral Logic
**Question:** The referral check happens in `submitCleanup()` and checks both `hasSubmittedCleanup` and `hasReceivedReferralReward`. If a user submits but their cleanup is rejected, they've already been marked as `hasSubmittedCleanup = true`, so they can't get a referral reward on a future submission. Is this correct, or should rejected cleanups allow referral rewards?

**Current logic:** Once a user submits (even if rejected), they can't get referral rewards.

### 8. Fee Collection
**Question:** Fees are collected in the contract but there's no automatic withdrawal mechanism. Fees accumulate in the contract until `withdrawFees()` is called. If fees are disabled, they're set to 0, but if they're enabled and then disabled, existing fees remain. Is this acceptable?

**Current logic:** Fees accumulate until manually withdrawn by owner.

 

## ImpactProductNFT.sol

### 10. Level Update Logic
**Question:** In `claimLevelForUser()`, if a user already has an NFT, we require `level > userCurrentLevel[user]`. This means users can only level up, never down. If a verifier makes a mistake and assigns the wrong level, they can't correct it by assigning a lower level. Should we allow owner to override this, or is one-way leveling correct?

**Current logic:** Levels can only increase, never decrease.

### 11. Reward Distribution on Level Update
**Question:** When a user levels up (e.g., from level 5 to level 7), they get 10 points. But what if they level up multiple times? Each level up gives 10 points. So going from 5 to 7 gives 20 points total (one per level). Is this correct?

**Current logic:** Each level claim awards 10 points, so multiple level ups award multiple times.

## General Questions

### 12. Contract Upgradeability
**Question:** None of these contracts are upgradeable (no proxy pattern). If we need to fix a bug or add features, we'll need to redeploy and migrate. Is this acceptable, or should we consider upgradeable proxies?

**Current state:** No upgradeability, all contracts are immutable after deployment.

### 13. Pausability
**Question:** `PointsRewardDistributor` is pausable, but `VerificationContract` and `ImpactProductNFT` are not. If we need to pause the entire system, we'd need to pause the points distributor and also stop new submissions/claims. Should we add pausability to other contracts?

**Current state:** Only PointsRewardDistributor is pausable.

### 14. Token Price Updates
**Question:** The token price can be updated by owner at any time. If the price changes dramatically, users who calculated their claim amount might get a different amount when they actually claim. Should we add a time delay or require multiple confirmations for price updates?

**Current logic:** Owner can update price immediately with no delay.

### 15. Minimum Level Check
**Question:** The `_hasMinimumLevel()` function uses a low-level call to `impactProductNFT`. If the NFT contract is not set or the call fails, it returns false. This means users can't claim/stake if the NFT contract isn't linked. Is this acceptable, or should we allow claiming/staking before the NFT contract is set?

**Current logic:** Requires NFT contract to be set and callable to check level.

## Recommendations

1. **Add minimum claim amount** to prevent dust claims
2. **Consider adding pausability** to VerificationContract for emergency stops
3. **Document the referral logic** clearly - rejected cleanups prevent future referral rewards
4. **Consider time delays** for critical parameter updates (token price, multipliers)
5. **Test edge cases** around staking/unstaking with manually added verifiers
6. **Verify precision** of claim formula with various token prices and point amounts

