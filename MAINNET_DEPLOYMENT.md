# Mainnet Deployment Status

## 📊 Current Status: Points-Based Reward System

### System Overview

The system uses a **points-based reward model** where:
- Users earn **DCU Points** (not tokens directly)
- Points are awarded for: cleanup submissions (10 = $0.50), streaks (1 = $0.05), referrals (2 = $0.10), impact forms (3 = $0.15), verifications (1 = $0.05)
- Users can **claim tokens** at any time using their accumulated points
- Claim amount = `(points × targetRewardValueUSD) / LEVEL_POINTS` converted to tokens based on market price
- Target: $0.50 USD per cleanup reward (10 points)
- Users must reach **Level 10** before they can claim tokens or stake

---

## ✅ Completed Tasks

### Contract Development
- [x] PointsRewardDistributor contract created
- [x] Points awarding functions implemented (awardLevelPoints, awardStreakPoints, etc.)
- [x] Claim function implemented (claimTokens)
- [x] Staking functions implemented (stakeTokens, unstakeTokens)
- [x] Price management functions implemented (updateTokenPrice, updateTargetRewardValue)
- [x] Level 10 requirement for claiming/staking implemented
- [x] Contract linking functions implemented (setImpactProductNFT, setVerificationContract)

### Frontend Integration
- [x] Points display on profile page
- [x] Claim UI implemented
- [x] Staking UI implemented
- [x] Updated all reward displays from "$bDCU" to "DCU points"
- [x] Points balance reading from contract
- [x] Claim amount calculation
- [x] Staking validation (51% minimum for new verifiers)

### Testing & Deployment (Testnet)
- [x] Contracts deployed to Base Sepolia
- [x] Contracts linked and configured
- [x] Initial prices set
- [x] Test points awarded
- [x] Test claims executed
- [x] Test staking executed

---

## 🔄 Next Steps (Mainnet Deployment)

### Phase 1: Contract Deployment
- [ ] Deploy ImpactProductNFT to Base Mainnet
- [ ] Deploy VerificationContract to Base Mainnet
- [ ] Deploy PointsRewardDistributor to Base Mainnet
  - [ ] Use mainnet bDCU token address: `0x30171b7014c02229497cde6745dd3ad821f12b07`
  - [ ] Set initial token price (8 decimals)
- [ ] Verify all contracts on Basescan
- [ ] Save contract addresses

### Phase 2: Contract Configuration
- [ ] Link contracts:
  - [ ] Call `setImpactProductNFT(address)` on PointsRewardDistributor
  - [ ] Call `setVerificationContract(address)` on PointsRewardDistributor
- [ ] Set initial prices on PointsRewardDistributor:
  - [ ] Call `updateTokenPrice(uint256)` with current market price (8 decimals)
  - [ ] Call `updateTargetRewardValue(uint256)` with target value (40-60 cents, default 50)
- [ ] Transfer ownership to multisig (if needed)
- [ ] Set fee treasury address (if using separate Safe for fees)

### Phase 3: Token Funding
- [ ] Unlock tokens from Clanker (if locked)
- [ ] Transfer tokens from multisig to PointsRewardDistributor contract
- [ ] Verify contract balance on Basescan
- [ ] Set up balance monitoring/alerts

### Phase 4: Frontend Deployment
- [ ] Update environment variables:
  ```bash
  NEXT_PUBLIC_CHAIN_ID=8453
  NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
  NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://basescan.org
  NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x...
  NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x...
  NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS=0x...
  NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x30171b7014c02229497cde6745dd3ad821f12b07
  ```
- [ ] Deploy frontend to production (Vercel or other platform)
- [ ] Verify all contract interactions work on mainnet

### Phase 5: Testing & Validation
- [ ] Test points awarding with a test transaction
- [ ] Test claim function with test points
- [ ] Test staking functionality
- [ ] Verify price calculations are correct
- [ ] Test all reward types (level, streak, referral, impact form, verifier)
- [ ] Monitor contract balance and ensure sufficient funding

### Phase 6: Ongoing Maintenance
- [ ] Set up regular balance monitoring
- [ ] Schedule regular token price updates
- [ ] Set up fee withdrawal schedule (twice weekly)
- [ ] Monitor points balances vs available tokens
- [ ] Set up alerts for low contract balance

---

## 📋 Quick Reference

### Contract Addresses (Mainnet)
- **bDCU Token**: `0x30171b7014c02229497cde6745dd3ad821f12b07`
- **ImpactProductNFT**: `0x...` (to be deployed)
- **VerificationContract**: `0x...` (to be deployed)
- **PointsRewardDistributor**: `0x...` (to be deployed)

### Key Functions

**PointsRewardDistributor:**
- `awardLevelPoints(address user)` - Award 10 points for level claim
- `awardStreakPoints(address user)` - Award 2 points for streak
- `awardReferralPoints(address referrer, address referee)` - Award 3 points each
- `awardImpactFormPoints(address user, uint256 cleanupId)` - Award 5 points
- `awardVerifierPoints(address verifier, uint256 cleanupId)` - Award 1 point
- `claimTokens(uint256 pointsToClaim)` - Convert points to tokens
- `stakeTokens(uint256 amount)` - Stake tokens to become verifier
- `updateTokenPrice(uint256 newPrice)` - Update token price (8 decimals)
- `updateTargetRewardValue(uint256 newValue)` - Update target reward value (cents)

**VerificationContract:**
- `withdrawFees()` - Withdraw accumulated fees (goes to owner or feeTreasury)

### Useful Scripts

```bash
# Check contract owners
cd contracts
npx hardhat run scripts/checkContractOwners.js --network baseMainnet

# Check fee treasury
npx hardhat run scripts/checkFeeTreasury.js --network baseMainnet

# Check fees
npx hardhat run scripts/checkFees.js --network baseMainnet

# Withdraw fees
npx hardhat run scripts/withdrawFees.js --network baseMainnet

# Setup PointsRewardDistributor
npx hardhat run scripts/setupPointsRewardDistributor.js --network baseMainnet
```

---

## 📝 Important Notes

### Token Flow
1. **Clanker Lock**: 15% of tokens reserved for rewards are locked by Clanker
2. **Unlock/Release**: When unlocked, tokens are released from Clanker
3. **Multisig**: Unlocked tokens are sent to the multisig wallet
4. **PointsRewardDistributor**: Multisig manually sends tokens to the contract
5. **Points Awarding**: Points are automatically awarded when users perform actions
6. **Token Claims**: Users manually claim tokens using their points

### Fee Management
- Fees collected from submissions and claims are stored in VerificationContract
- Fees can go to owner (default) or feeTreasury (if set)
- Withdraw fees twice weekly using `withdrawFees()` script
- See `FEE_MANAGEMENT.md` for detailed instructions

### Price Management
- Token price should be updated regularly based on market conditions
- Target reward value: $0.50 per cleanup (10 points)
- Use `updateTokenPrice()` to maintain target value

---

*Last updated: 2025*
