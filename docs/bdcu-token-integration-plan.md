# $bDCU Token Integration Plan - Clanker Launch

## Executive Summary

This document outlines the complete plan for launching $bDCU token on Clanker and integrating it into the DeCleanup Mini App. The plan covers token deployment, smart contract integration, frontend updates, and distribution strategy.

### Key Learnings from Clanker Documentation

**Critical Information**:
1. **Dev Buy is ONLY available via clanker.world/deploy** - NOT via Farcaster bot or Preclank
2. **Dev Buy is in ETH**, not percentage of supply - typically 1-5 ETH worth of tokens
3. **Creator Rewards**: 100% of initial LP fees on clanker.world (vs 80% on Farcaster bot)
4. **Creator Vault**: Can set aside 5-10% with lockup/vesting (minimum 7 day lockup)
5. **Pool Configuration**: Recommended option has fixed 10 ETH starting market cap
6. **SDK Available**: Can deploy programmatically via Clanker SDK

**Recommended Deployment Method**: **clanker.world/deploy** (not Farcaster bot) because:
- ✅ Dev Buy support (critical for our use case)
- ✅ 100% creator rewards (vs 80% on bot)
- ✅ Full parameter control
- ✅ Creator Vault configuration

---

## Phase 1: Token Launch on Clanker

### 1.1 Token Deployment Methods

Clanker offers multiple deployment methods. **Recommended: clanker.world/deploy** for maximum control and dev buy support.

#### Option A: clanker.world/deploy (RECOMMENDED)

**Why This Method**:
- ✅ Full control over all parameters
- ✅ Dev Buy (Creator Buy) supported
- ✅ Creator Vault configuration
- ✅ Reward Recipients configuration
- ✅ 100% of initial LP fees go to creator (vs 80% on Farcaster bot)

**Steps**:
1. Visit [clanker.world/deploy](https://clanker.world/deploy)
2. Connect wallet (Base Mainnet)
3. Configure token parameters (see below)
4. Execute deployment

**Token Configuration**:

**Basic Token Info** (Required):
- **Network**: Base Mainnet
- **Name**: bDCU (DeCleanup Token)
- **Symbol/Ticker**: bDCU
- **Image**: IPFS hash of token image

**Token Metadata** (Optional but Recommended):
- **Description**: "DeCleanup Network token - Earn tokens for environmental cleanup efforts"
- **Website**: Your website URL
- **X (Twitter)**: @decleanupnet
- **Farcaster**: Your Farcaster profile
- **Telegram**: (if applicable)

**Fee Configuration** (Optional):
- **Recommended**: Dynamic fee (default) - fixed % base fee + variable fee based on volatility
- **Legacy**: Fixed % fees (if preferred)

**Reward Recipients** (Optional):
- **Default**: 100% to creator wallet (your connected wallet)
- **Can configure**: Multiple recipients with percentages
- **Reward Type**: Choose `Both` (Clanker token + WETH), `Clanker` (token only), or `Paired` (WETH only)

**Pool Configuration** (Optional):
- **Recommended**: Optimized liquidity layout, fixed 10 ETH starting market cap
- **Legacy**: Single LP position, configurable starting market cap

**Creator Vault** (Optional but Recommended):
- **Vault Percentage**: 5-10% of total supply (for team/vesting)
- **Lockup Period**: 30-90 days (minimum 7 days enforced)
- **Vesting Period**: 90-365 days (linear vesting)
- **Beneficiary**: Your wallet (can change post-deployment)

**Creator Buy (Dev Buy)** (CRITICAL for our use case):
- **ETH Amount**: Calculate based on token price at launch
- **Purpose**: Fund `bDCURewardDistributor` contract for automatic distributions
- **No Limits**: No upper/lower limits on dev buy amount
- **Recommendation**: 1-5 ETH worth of tokens (depending on launch price)

#### Option B: Farcaster Bot (@clanker)

**When to Use**: Quick deployment, less customization needed

**Limitations**:
- ❌ No Dev Buy support (yet)
- ❌ Only 80% of rewards to creator (vs 100% on clanker.world)
- ❌ Less parameter control

**Deployment Cast Example**:
```
@clanker deploy a token named bDCU with the ticker bDCU paired with WETH
```

#### Option C: Preclank (Not Recommended for Initial Launch)

**When to Use**: Want to configure on clanker.world but trigger via Farcaster

**Limitations**:
- ❌ Dev Buy NOT supported (on roadmap)
- More complex setup

### 1.2 Dev Buy (Creator Buy) Strategy

**IMPORTANT**: Dev Buy is only available via **clanker.world/deploy** method, NOT via Farcaster bot or Preclank.

**How Dev Buy Works**:
- Spend ETH to guarantee the first swap on the newly created token
- No upper/lower limits on ETH amount
- You receive tokens at launch price
- Tokens go to your connected wallet

**Recommended Dev Buy Amount**: **1-5 ETH worth of tokens**

**Calculation Method**:
1. Estimate token price at launch (based on starting market cap)
2. Calculate how many tokens you need for contract funding
3. Convert to ETH amount needed

**Example Calculation**:
- Starting market cap: 10 ETH (Recommended pool config)
- Total supply: 100 billion tokens
- Price per token: 10 ETH / 100B = 0.0000000001 ETH per token
- Need 1 billion tokens for contract: 1B × 0.0000000001 = 0.1 ETH
- **Recommendation**: Buy 1-5 ETH worth (1-5 billion tokens) for buffer

**Dev Buy Purpose**:
1. Fund `bDCURewardDistributor` contract for automatic distributions
2. Initial liquidity and price discovery
3. Reserve for future distributions
4. Testing token transfers

**After Dev Buy**:
- Transfer purchased tokens to `bDCURewardDistributor` contract
- Contract will automatically distribute to users

### 1.3 Creator Vault Configuration

**Recommended Setup**:
- **Vault Percentage**: 5-10% of total supply
- **Lockup Period**: 30-90 days (team tokens)
- **Vesting Period**: 180-365 days (linear vesting)
- **Purpose**: Team allocation, future incentives, emergency reserves

**Note**: Vault tokens can be distributed by anyone once vesting begins, but always go to the beneficiary address.

### 1.4 Creator Rewards Setup

**How It Works**:
- Full token supply deposited into initial LP (single-sided Uniswap v4)
- Trading fees from initial LP accrue to creator
- Can claim rewards on admin page: `https://clanker.world/clanker/TOKEN_ADDRESS/admin`

**Reward Split** (clanker.world deployments):
- **Creator**: 100% of initial LP fees
- **Clanker Fee**: 20% of LP fees (fixed, separate from creator rewards)

**Reward Type Configuration**:
- Choose `Both` to receive rewards in both $bDCU and WETH
- Or choose `Clanker` for $bDCU only, `Paired` for WETH only

### 1.5 Alternative: SDK Deployment (Advanced)

**When to Use**: Programmatic deployment, custom integrations, automation

**Installation**:
```bash
npm install clanker-sdk viem
```

**Basic Example**:
```typescript
import { Clanker } from 'clanker-sdk';
import { createWalletClient, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const walletClient = createWalletClient({
  chain: base,
  transport: http()
});

const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

const clanker = new Clanker({
  wallet: walletClient,
  publicClient,
  factoryAddress: 'CLANKER_FACTORY_ADDRESS' // Get from Clanker docs
});

const { address, hash } = await clanker.deployToken({
  name: 'bDCU',
  symbol: 'bDCU',
  image: 'ipfs://YOUR_IMAGE_HASH',
  metadata: {
    description: 'DeCleanup Network token',
    socialMediaUrls: ['https://twitter.com/decleanupnet'],
  },
  pool: {
    quoteToken: '0x4200000000000000000000000000000000000006', // WETH on Base
    initialMarketCap: '10' // 10 ETH starting market cap
  },
  devBuy: {
    ethAmount: '1' // 1 ETH dev buy
  },
  vault: {
    percentage: 5, // 5% to vault
    lockupDays: 30,
    vestingDays: 180
  }
});

console.log(`Token deployed at: ${address}`);
```

**Benefits of SDK**:
- Programmatic control
- Can integrate into deployment scripts
- Custom automation
- Same features as clanker.world interface

**Recommendation**: Use clanker.world/deploy for initial launch (easier), consider SDK for future tokens or automation.

---

## Phase 2: Smart Contract Architecture

### 2.1 New Contract: `bDCURewardDistributor.sol`

**Purpose**: Bridge contract that holds $bDCU tokens and distributes them automatically when users perform actions.

**Key Features**:
1. Holds $bDCU token balance (funded from dev buy)
2. Automatically distributes tokens on user actions
3. Tracks distribution history
4. Owner can top up token reserves
5. Emergency pause functionality

**Contract Structure**:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract bDCURewardDistributor is Ownable, ReentrancyGuard, Pausable {
    // $bDCU Token contract (from Clanker)
    IERC20 public bDCUToken;
    
    // Reward amounts (in tokens, 18 decimals)
    uint256 public constant LEVEL_REWARD = 10 * 10**18;      // 10 $bDCU per level
    uint256 public constant STREAK_REWARD = 2 * 10**18;      // 2 $bDCU per week streak
    uint256 public constant REFERRAL_REWARD = 3 * 10**18;   // 3 $bDCU for both referrer and referee
    uint256 public constant IMPACT_FORM_REWARD = 5 * 10**18; // 5 $bDCU per enhanced form
    
    // Authorized contracts
    address public impactProductNFT;
    address public verificationContract;
    mapping(address => bool) public verifiers;
    
    // Distribution tracking
    mapping(address => uint256) public totalDistributed; // user => total tokens received
    uint256 public globalTotalDistributed;
    
    // Events
    event LevelRewardDistributed(address indexed user, uint256 amount);
    event StreakRewardDistributed(address indexed user, uint256 amount);
    event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount);
    event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount);
    event TokensDeposited(uint256 amount);
    event TokensWithdrawn(uint256 amount);
    
    constructor(address _bDCUToken) Ownable(msg.sender) {
        require(_bDCUToken != address(0), "Invalid token address");
        bDCUToken = IERC20(_bDCUToken);
    }
    
    /**
     * @notice Distribute level reward (10 $bDCU)
     * Called by ImpactProductNFT when user claims a level
     */
    function distributeLevelReward(address user) external whenNotPaused {
        require(msg.sender == impactProductNFT, "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= LEVEL_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(user, LEVEL_REWARD), "Transfer failed");
        
        totalDistributed[user] += LEVEL_REWARD;
        globalTotalDistributed += LEVEL_REWARD;
        
        emit LevelRewardDistributed(user, LEVEL_REWARD);
    }
    
    /**
     * @notice Distribute streak reward (2 $bDCU)
     * Called by VerificationContract when user maintains streak
     */
    function distributeStreakReward(address user) external whenNotPaused {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= STREAK_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(user, STREAK_REWARD), "Transfer failed");
        
        totalDistributed[user] += STREAK_REWARD;
        globalTotalDistributed += STREAK_REWARD;
        
        emit StreakRewardDistributed(user, STREAK_REWARD);
    }
    
    /**
     * @notice Distribute referral reward (3 $bDCU to both)
     */
    function distributeReferralReward(address referrer, address referee) external whenNotPaused {
        require(_isAuthorizedCaller(), "Not authorized");
        require(referrer != address(0) && referee != address(0), "Invalid address");
        
        uint256 totalNeeded = REFERRAL_REWARD * 2;
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= totalNeeded, "Insufficient token balance");
        
        require(bDCUToken.transfer(referrer, REFERRAL_REWARD), "Transfer failed");
        require(bDCUToken.transfer(referee, REFERRAL_REWARD), "Transfer failed");
        
        totalDistributed[referrer] += REFERRAL_REWARD;
        totalDistributed[referee] += REFERRAL_REWARD;
        globalTotalDistributed += totalNeeded;
        
        emit ReferralRewardDistributed(referrer, referee, REFERRAL_REWARD);
    }
    
    /**
     * @notice Distribute impact form reward (5 $bDCU)
     */
    function distributeImpactFormReward(address user, uint256 cleanupId) external whenNotPaused {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= IMPACT_FORM_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(user, IMPACT_FORM_REWARD), "Transfer failed");
        
        totalDistributed[user] += IMPACT_FORM_REWARD;
        globalTotalDistributed += IMPACT_FORM_REWARD;
        
        emit ImpactFormRewardDistributed(user, cleanupId, IMPACT_FORM_REWARD);
    }
    
    /**
     * @notice Deposit tokens to contract (owner only)
     * Use this to fund the contract with tokens from dev buy
     */
    function depositTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(bDCUToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensDeposited(amount);
    }
    
    /**
     * @notice Withdraw tokens from contract (owner only, emergency use)
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(bDCUToken.transfer(owner(), amount), "Transfer failed");
        emit TokensWithdrawn(amount);
    }
    
    /**
     * @notice Get contract's token balance
     */
    function getContractBalance() external view returns (uint256) {
        return bDCUToken.balanceOf(address(this));
    }
    
    /**
     * @notice Set authorized contracts
     */
    function setImpactProductNFT(address _address) external onlyOwner {
        impactProductNFT = _address;
    }
    
    function setVerificationContract(address _address) external onlyOwner {
        verificationContract = _address;
    }
    
    function addVerifier(address _verifier) external onlyOwner {
        verifiers[_verifier] = true;
    }
    
    function removeVerifier(address _verifier) external onlyOwner {
        verifiers[_verifier] = false;
    }
    
    /**
     * @notice Pause/unpause distributions (emergency use)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function _isAuthorizedCaller() internal view returns (bool) {
        return verifiers[msg.sender] || msg.sender == owner() || msg.sender == verificationContract;
    }
}
```

### 2.2 Integration with Existing Contracts

**Update `ImpactProductNFT.sol`**:
- Change `rewardDistributor` reference to point to `bDCURewardDistributor`
- No other changes needed (interface compatible)

**Update `VerificationContract.sol`**:
- Change `rewardDistributor` reference to point to `bDCURewardDistributor`
- No other changes needed (interface compatible)

**Keep `RewardDistributor.sol`**:
- Keep for backward compatibility during migration
- Can deprecate after full migration to $bDCU

### 2.3 Distribution Strategy: Automatic vs Claim

**Recommendation: AUTOMATIC DISTRIBUTION**

**Why Automatic?**:
1. ✅ Better UX - users get tokens immediately
2. ✅ No extra transaction costs for users
3. ✅ Reduces friction and increases engagement
4. ✅ Matches current points system behavior
5. ✅ Prevents users from forgetting to claim

**Implementation**:
- Tokens are automatically transferred when:
  - User claims Impact Product level → 10 $bDCU
  - User maintains streak → 2 $bDCU
  - User refers someone → 3 $bDCU (both parties)
  - User submits enhanced impact form → 5 $bDCU

**Gas Costs**:
- Contract pays gas for distributions (from dev buy funds)
- Users receive tokens without paying gas
- More efficient than claim-based system

**Alternative: Hybrid Approach** (if needed):
- Automatic for small rewards (< 10 $bDCU)
- Claim button for larger rewards or batch claims
- Can be added later if needed

---

## Phase 3: Frontend Updates

### 3.1 Replace "Points" with "$bDCU"

**Files to Update**:

1. **`app/profile/page.tsx`**:
   - Change `$DCU Points` → `$bDCU`
   - Update balance display to show token balance

2. **`app/cleanup/page.tsx`**:
   - Change `+5 $DCU Points Bonus` → `+5 $bDCU Bonus`
   - Update all point references

3. **`lib/contracts.ts`**:
   - Update `getPointsBalance()` → `getbDCUBalance()`
   - Update function comments and documentation

4. **`lib/points.ts`**:
   - Rename to `lib/bdcu.ts` (optional, or keep for backward compat)
   - Update all references

5. **`contracts/contracts/RewardDistributor.sol`**:
   - Update comments from "points" to "$bDCU tokens"
   - Keep functionality same for migration period

6. **Documentation files**:
   - Update all docs to use "$bDCU" terminology

### 3.2 Token Balance Display

**Update Profile Page**:
```typescript
// Read token balance from Clanker contract
const tokenBalance = await readContract(config, {
  address: bDCU_TOKEN_ADDRESS,
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: [userAddress],
})
```

**Display Format**:
- Show: `1,234.56 $bDCU` (formatted with commas, 2 decimals)
- Add link to Clanker token page
- Show "View on Clanker" button

### 3.3 Environment Variables

**Add to `.env.local`**:
```bash
# $bDCU Token (Clanker)
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x... # Clanker token contract address
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=0x... # New contract address
NEXT_PUBLIC_CLANKER_TOKEN_URL=https://clanker.xyz/token/...
```

---

## Phase 4: Implementation Timeline

### Option A: Prepare App First, Then Integrate Token (RECOMMENDED)

**Timeline**: 2-3 weeks

**Week 1: Preparation (Before Token Launch)**
- [ ] Update all "points" → "$bDCU" in frontend ✅ (Completed)
- [ ] Create `bDCURewardDistributor.sol` contract ✅ (Completed)
- [ ] Write and test contract on Base Sepolia testnet
- [ ] Update frontend to read from new contract interface
- [ ] Deploy test contracts and test integration
- [ ] Prepare deployment scripts
- [ ] Prepare token image and metadata for Clanker deployment

**Week 2: Token Launch & Integration**
- [ ] **Deploy $bDCU token on Clanker**:
  - [ ] Visit clanker.world/deploy
  - [ ] Connect Base Mainnet wallet
  - [ ] Configure token (name, symbol, image, metadata)
  - [ ] Set pool configuration (Recommended: 10 ETH starting market cap)
  - [ ] Configure Creator Vault (5-10%, 30-90 day lockup)
  - [ ] **Execute Dev Buy** (1-5 ETH worth of tokens) ⚠️ CRITICAL
  - [ ] Deploy token
  - [ ] Save token contract address
- [ ] Deploy `bDCURewardDistributor` to Base Mainnet
- [ ] Transfer dev buy tokens from wallet to `bDCURewardDistributor` contract
- [ ] Update contract addresses in environment variables
- [ ] Update `ImpactProductNFT` and `VerificationContract` to use new distributor
- [ ] Test on mainnet with small amounts
- [ ] Set up monitoring for contract balance

**Week 3: Migration & Launch**
- [ ] Migrate existing points balances (if any) to tokens
- [ ] Enable automatic token distributions
- [ ] Monitor contract balance and top up as needed
- [ ] Claim creator rewards from Clanker admin page (if applicable)
- [ ] Update documentation
- [ ] Announce token launch to community
- [ ] Share Clanker token page link

**Advantages**:
- ✅ App is ready when token launches
- ✅ Faster integration after token deployment
- ✅ Can test everything on testnet first
- ✅ Less pressure during token launch

### Option B: Wait for Token, Then Deploy Contracts

**Timeline**: 3-4 weeks

**Week 1: Token Launch**
- [ ] Deploy $bDCU token on clanker.world/deploy
- [ ] Execute dev buy (1-5 ETH)
- [ ] Get token contract address

**Week 2-3: Contract Development**
- [ ] Create and test `bDCURewardDistributor` contract
- [ ] Update frontend
- [ ] Test integration

**Week 4: Deployment**
- [ ] Deploy contracts to mainnet
- [ ] Transfer dev buy tokens to contract
- [ ] Enable distributions

**Disadvantages**:
- ❌ Longer time to market
- ❌ More pressure during token launch
- ❌ Less time for testing
- ❌ Can't use Farcaster bot (no dev buy support)

**Recommendation**: **Option A** (Prepare app first, use clanker.world/deploy)

---

## Phase 5: Token Distribution Calculations

### 5.1 Estimated Token Requirements

**Assumptions**:
- Average user earns: 1 level per month = 10 $bDCU
- Average user maintains streak: 2 $bDCU/month
- Average user refers 1 person: 3 $bDCU (one-time)
- Average user submits impact form: 5 $bDCU/month
- **Total per active user per month**: ~17 $bDCU

**Scaling Estimates**:
- 100 active users/month: 1,700 $bDCU/month
- 1,000 active users/month: 17,000 $bDCU/month
- 10,000 active users/month: 170,000 $bDCU/month

**Contract Funding Strategy**:
- Initial funding: 1-5 billion $bDCU (from dev buy)
- Covers: 6-12 months for 1,000-5,000 active users
- Top up monthly based on usage (from creator rewards or additional purchases)
- Monitor contract balance and set alerts

### 5.2 Dev Buy Calculation (Updated)

**IMPORTANT**: Dev Buy is in ETH, not percentage of supply!

**Calculation Method**:
1. Determine starting market cap (Recommended: 10 ETH)
2. Calculate tokens needed for contract funding
3. Convert to ETH amount

**Example**:
- Starting market cap: 10 ETH
- Total supply: 100 billion tokens
- Price per token: 10 ETH / 100B = 0.0000000001 ETH
- Need 1 billion tokens: 1B × 0.0000000001 = **0.1 ETH**
- **Recommendation**: Buy **1-5 ETH worth** for buffer (1-5 billion tokens)

**Dev Buy Allocation**:
- **Contract funding**: 1-3 billion tokens (primary use)
- **Testing/development**: 10M tokens
- **Emergency reserve**: 100M tokens
- **Future airdrops**: Remaining tokens

**Cost Estimate**:
- 1 ETH dev buy ≈ 1 billion tokens (at 10 ETH market cap)
- 5 ETH dev buy ≈ 5 billion tokens
- **Total cost**: 1-5 ETH (much lower than previous estimate!)

**After Dev Buy**:
- Tokens received in your wallet
- Transfer to `bDCURewardDistributor` contract
- Contract automatically distributes to users

---

## Phase 6: Migration from Points to Tokens

### 6.1 Points Migration Strategy

**If users have existing points balances**:

1. **Snapshot existing points**:
   - Query `RewardDistributor.getPointsBalance()` for all users
   - Create migration mapping

2. **Airdrop tokens**:
   - Use Clanker's Airdrop extension or manual transfer
   - Transfer 1:1 (1 point = 1 $bDCU token)
   - Or use migration function in contract

3. **Update UI**:
   - Show "Migrated" status for users who had points
   - Hide old points system

**If no existing points**:
- No migration needed, start fresh with tokens

### 6.2 Backward Compatibility

**During Migration Period**:
- Keep `RewardDistributor.sol` deployed (read-only)
- New rewards go to `bDCURewardDistributor`
- Old points can be migrated via airdrop or claim function

**After Migration**:
- Deprecate `RewardDistributor.sol`
- All new rewards use $bDCU tokens

---

## Phase 7: Security & Best Practices

### 7.1 Contract Security

- [ ] Audit `bDCURewardDistributor` contract (recommended for mainnet)
- [ ] Use OpenZeppelin's battle-tested contracts
- [ ] Implement pause functionality for emergencies
- [ ] Set up multi-sig for owner functions (recommended)
- [ ] Test thoroughly on testnet

### 7.2 Token Management

- [ ] Monitor contract balance regularly
- [ ] Set up alerts for low balance
- [ ] Have top-up process ready
- [ ] Keep emergency reserve separate

### 7.3 User Education

- [ ] Announce token launch clearly
- [ ] Explain automatic distribution
- [ ] Provide Clanker token page link
- [ ] Show users how to view tokens in wallet

---

## Phase 8: Monitoring & Maintenance

### 8.1 Key Metrics to Track

- Contract token balance
- Total tokens distributed
- Distribution events per day
- Average tokens per user
- Contract gas usage

### 8.2 Alerts to Set Up

- Contract balance below threshold (e.g., 1M tokens)
- Unusual distribution patterns
- Failed transactions
- Contract pause events

### 8.3 Regular Tasks

- Weekly: Check contract balance
- Monthly: Top up contract if needed
- Quarterly: Review distribution patterns and adjust rewards if needed

---

## Implementation Checklist

### Pre-Token Launch
- [ ] Update all "points" → "$bDCU" in codebase
- [ ] Create `bDCURewardDistributor.sol` contract
- [ ] Write tests for new contract
- [ ] Deploy and test on Base Sepolia
- [ ] Update frontend to use new contract interface
- [ ] Prepare deployment scripts
- [ ] Update documentation

### Token Launch
- [ ] **Deploy $bDCU token on clanker.world/deploy** (NOT Farcaster bot - dev buy not supported)
- [ ] Configure token parameters (name, symbol, image, metadata)
- [ ] Set pool configuration (Recommended: 10 ETH starting market cap)
- [ ] Configure Creator Vault (optional: 5-10% for team)
- [ ] **Execute Dev Buy: 1-5 ETH worth of tokens** ⚠️ CRITICAL
- [ ] Get token contract address
- [ ] Save contract address securely
- [ ] Bookmark admin page: `https://clanker.world/clanker/TOKEN_ADDRESS/admin`

### Post-Token Launch
- [ ] Deploy `bDCURewardDistributor` to Base Mainnet
- [ ] Transfer dev buy tokens to contract
- [ ] Update environment variables
- [ ] Update `ImpactProductNFT` to use new distributor
- [ ] Update `VerificationContract` to use new distributor
- [ ] Test automatic distributions on mainnet
- [ ] Migrate existing points (if any)
- [ ] Enable automatic token distributions
- [ ] Announce token launch

### Ongoing
- [ ] Monitor contract balance
- [ ] Top up contract as needed
- [ ] Track distribution metrics
- [ ] Update documentation
- [ ] Community engagement

---

## Questions & Answers

### Q: Should we wait for token or prepare app first?
**A: Prepare app first (Option A)**. This allows thorough testing and faster integration after token launch.

### Q: How many tokens for dev buy?
**A: 1-5 ETH worth of tokens** (approximately 1-5 billion tokens at 10 ETH starting market cap). Dev buy is in ETH, not percentage. Calculate based on launch price.

### Q: Automatic or claim-based distribution?
**A: Automatic distribution** for better UX. Users get tokens immediately without extra transactions.

### Q: Do we need a migration function?
**A: Only if users have existing points**. If starting fresh, no migration needed.

### Q: What if contract runs out of tokens?
**A: Owner can deposit more tokens via `depositTokens()`. Set up monitoring and alerts.**

### Q: Can we change reward amounts later?
**A: Yes, but requires contract upgrade or new contract deployment. Better to set amounts correctly from start.**

---

## Resources

### Clanker Documentation
- [Clanker Documentation Home](https://clanker.gitbook.io/clanker-documentation)
- [Clanker.world Deployments](https://clanker.gitbook.io/clanker-documentation/general/token-deployments/clanker.world-deployments) - **Use this for dev buy**
- [Farcaster Bot Deployments](https://clanker.gitbook.io/clanker-documentation/general/token-deployments/farcaster-bot-deployments) - No dev buy support
- [Preclank Deployments](https://clanker.gitbook.io/clanker-documentation/general/token-deployments/preclank-deployments) - No dev buy support yet
- [Creator Rewards & Fees](https://clanker.gitbook.io/clanker-documentation/general/creator-rewards-and-fees)
- [Clanker SDK Quick Start](https://clanker.gitbook.io/clanker-documentation/sdk/quick-start)
- [Clanker SDK v4.0.0](https://clanker.gitbook.io/clanker-documentation/sdk/v4.0.0)

### Other Resources
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Clanker World](https://clanker.world) - Token deployment interface

---

## Next Steps

1. **Immediate**: Review and approve this plan
2. **This Week**: Start updating "points" → "$bDCU" in codebase
3. **Next Week**: Create and test `bDCURewardDistributor` contract
4. **Before Token Launch**: Complete all frontend updates
5. **Token Launch**: Deploy token on Clanker and execute dev buy
6. **After Token Launch**: Deploy contracts and enable distributions

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Status**: Draft - Awaiting Approval

