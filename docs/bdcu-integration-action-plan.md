# $bDCU Token Integration - Action Plan

## Phase 1: Token Launch
- [ ] Deploy $bDCU token on clanker.world/deploy (Base Mainnet)
- [ ] Configure token: Name "bDCU", Symbol "bDCU"
- [ ] Set up token image, description, website, social links
- [ ] Configure tokenomics (total supply, starting market cap ~10 ETH)
- [ ] Set up Creator Vault (5-10% supply, 30-90 day lockup, 90-365 day vesting)
- [ ] Execute Dev Buy: 1-5 ETH worth of tokens
- [ ] Save token contract address
- [ ] Transfer dev buy tokens to bDCURewardDistributor contract

## Phase 2: Contract Deployment
- [ ] Deploy bDCURewardDistributor contract to Base Mainnet
- [ ] Set token address in bDCURewardDistributor constructor
- [ ] Transfer dev buy tokens to bDCURewardDistributor contract
- [ ] Test token distribution functions (level, streak, referral, impact form)
- [ ] Verify contract has sufficient token balance

## Phase 3: Environment Setup
- [ ] Add `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS` to `.env.local`
- [ ] Add `NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS` to `.env.local`
- [ ] Update production environment variables
- [ ] Verify token balance reading works in frontend

## Phase 4: Frontend Integration
- [ ] Verify "$bDCU" displays correctly (already done ✅)
- [ ] Test token balance reading from Clanker contract
- [ ] Verify automatic token distribution on user actions
- [ ] Test fallback to points system if token not deployed
- [ ] Add Clanker token page link (optional)

## Phase 5: Testing
- [ ] Test level claim → 10 $bDCU distribution
- [ ] Test streak maintenance → 2 $bDCU distribution
- [ ] Test referral → 3 $bDCU (both parties)
- [ ] Test impact form → 5 $bDCU distribution
- [ ] Verify tokens appear in user wallet automatically
- [ ] Test on Base Mainnet (after testnet verification)

## Phase 6: Migration (If Needed)
- [ ] Snapshot existing points balances (if any users have points)
- [ ] Plan 1:1 points-to-tokens conversion
- [ ] Execute airdrop or claim function for existing points
- [ ] Update UI to hide old points system

## Phase 7: Launch
- [ ] Announce token launch
- [ ] Update documentation
- [ ] Monitor token distributions
- [ ] Monitor contract balance (refill if needed)

---

**Timeline**: 
- Token deployment: 1 day
- Contract deployment: 1 day
- Testing: 2-3 days
- Migration (if needed): 1-2 days

**Total**: ~1 week from token launch to full integration

