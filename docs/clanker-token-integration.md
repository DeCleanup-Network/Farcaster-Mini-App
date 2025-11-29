# Clanker Token Integration Plan

> **⚠️ DEPRECATED**: This document is outdated. See [`bdcu-token-integration-plan.md`](./bdcu-token-integration-plan.md) for the current plan.

## Overview

DeCleanup plans to launch the **$bDCU** token on Clanker and integrate its contract address into the Mini App. This document outlines the integration plan.

**Token Naming**:
- **$bDCU** = The official token name (bDCU = Base DeCleanup)
- **DCU** = Old/deprecated name (no longer used)
- Always use **$bDCU** in all documentation and code

## Current State

### $bDCU Points System
- **Current**: $bDCU points are tracked on-chain in the `RewardDistributor` contract
- **Storage**: Points are stored as internal balances in the contract
- **Display**: UI shows "$bDCU" (updated from "DCU Points")
- **Migration**: Points will be exchangeable for $bDCU tokens after Clanker launch (1:1 conversion)

### Contracts
- `RewardDistributor.sol`: Manages $bDCU points distribution (legacy)
- `bDCURewardDistributor.sol`: New contract for automatic $bDCU token distributions (Clanker integration)

## Clanker Integration Plan

### Phase 1: Token Launch on Clanker

1. **Deploy $bDCU Token Contract**

   **Deployment Method**: Use **clanker.world/deploy** (NOT Farcaster bot)
   - ✅ Dev Buy support (required for funding bDCURewardDistributor)
   - ✅ 100% creator rewards (vs 80% on Farcaster bot)
   - ✅ Full parameter control

   **Token Configuration**:
   - **Network**: Base Mainnet
   - **Name**: bDCU (DeCleanup Token)
   - **Symbol/Ticker**: bDCU
   - **Image**: IPFS hash of token image/logo
   - **Description**: "DeCleanup Network token - Earn tokens for environmental cleanup efforts"
   - **Website**: Your DeCleanup website URL
   - **Social**: X (Twitter), Farcaster profiles

   **Tokenomics**:
   - **Total Supply**: Configure based on distribution needs
   - **Starting Market Cap**: Recommended 10 ETH (optimized liquidity layout)
   - **Fee Configuration**: Dynamic fee (default) or fixed % fees
   - **Reward Recipients**: 100% to creator wallet (default)

   **Creator Vault** (Recommended):
   - **Vault Percentage**: 5-10% of total supply (for team/vesting)
   - **Lockup Period**: 30-90 days (minimum 7 days)
   - **Vesting Period**: 90-365 days (linear vesting)
   - **Beneficiary**: Your wallet address

   **Dev Buy (Creator Buy)** ⚠️ CRITICAL:
   - **Purpose**: Fund `bDCURewardDistributor` contract for automatic token distributions
   - **Recommended Amount**: 1-5 ETH worth of tokens
   - **Calculation**: Based on token price at launch (starting market cap / total supply)
   - **After Purchase**: Transfer tokens to `bDCURewardDistributor` contract
   - **Note**: Dev Buy is ONLY available via clanker.world/deploy, NOT Farcaster bot

   **After Deployment**:
   - Save token contract address
   - Transfer dev buy tokens to `bDCURewardDistributor` contract
   - Update environment variables (see below)

2. **Update Environment Variables**
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x... # Clanker token contract address (REQUIRED)
   NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=0x... # bDCURewardDistributor contract
   ```
   
   **Note**: Only use `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS`. The old `DCU_TOKEN_ADDRESS` is deprecated.

### Phase 2: Contract Integration

1. **Deploy bDCURewardDistributor Contract**
   - New contract: `bDCURewardDistributor.sol` (already created)
   - Holds $bDCU tokens and automatically distributes them
   - Replaces old points-based RewardDistributor for new distributions

2. **Contract Architecture**
   ```solidity
   // bDCURewardDistributor.sol
   contract bDCURewardDistributor {
       IERC20 public bDCUToken; // Clanker token contract
       
       // Automatically distributes tokens on user actions:
       // - Level claim: 10 $bDCU
       // - Streak: 2 $bDCU
       // - Referral: 3 $bDCU (both parties)
       // - Impact form: 5 $bDCU
   }
   ```
   
   **Migration**: Old `RewardDistributor` keeps points for backward compatibility. New rewards use `bDCURewardDistributor`.

### Phase 3: Frontend Updates

1. **Update Token Display** ✅ (Completed)
   - Changed "DCU Points" to "$bDCU" throughout the app
   - Shows token balance from Clanker contract (when deployed)
   - Falls back to points system if token not deployed

2. **Token Balance Reading** ✅ (Completed)
   - `lib/contracts.ts` automatically detects token contract
   - Reads from ERC20 token contract when `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS` is set
   - Falls back to points system if token not available

3. **UI Components** ✅ (Completed)
   - `app/profile/page.tsx`: Shows "$bDCU" balance
   - `app/cleanup/page.tsx`: Shows "$bDCU" rewards
   - `lib/contracts.ts`: Token contract integration ready

### Phase 4: Migration Flow

1. **Points to Tokens Exchange**
   - User initiates migration
   - Contract burns points and mints/transfers tokens
   - Update UI to reflect token balance

2. **Gradual Migration**
   - Allow users to migrate points in batches
   - Set minimum migration amount
   - Track migration status

## Implementation Checklist

### Backend/Contracts
- [ ] Deploy $DCU token on Clanker
- [ ] Get token contract address
- [ ] Update `RewardDistributor` to reference token contract
- [ ] Implement points-to-tokens migration function
- [ ] Test migration flow on testnet

### Frontend
- [x] Update all "DCU Points" references to "$bDCU" ✅
- [x] Create token contract ABI interface (ERC20_ABI) ✅
- [x] Add token balance reading function ✅
- [x] Update profile page to show "$bDCU" balance ✅
- [x] Update cleanup page to show "$bDCU" rewards ✅
- [ ] Add `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS` to `.env.local` (after token launch)
- [ ] Add Clanker token page link
- [ ] Test token display after deployment

### Documentation
- [ ] Update README with token information
- [ ] Document migration process
- [ ] Add Clanker integration guide
- [ ] Update system architecture docs

## Token Contract Interface

Expected token contract functions (standard ERC20):

```solidity
interface IbDCUToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8); // Returns 18
    function symbol() external view returns (string); // Returns "bDCU"
    function name() external view returns (string); // Returns "DeCleanup Token"
}
```

## Environment Variables

```bash
# $bDCU Token Integration (Clanker)
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x... # Clanker token contract address (REQUIRED after launch)
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=0x... # bDCURewardDistributor contract address

# Note: NEXT_PUBLIC_DCU_TOKEN_ADDRESS is deprecated - use BDCU_TOKEN_ADDRESS only
```

## Testing Strategy

1. **Testnet Testing**
   - Deploy test token on Base Sepolia
   - Test points-to-tokens migration
   - Verify token balance display
   - Test token transfers

2. **Mainnet Deployment**
   - Deploy token on Clanker (mainnet)
   - Update production environment variables
   - Enable migration for users
   - Monitor migration progress

## Timeline Considerations

- **Token Launch**: Coordinate with Clanker launch schedule
- **Migration Window**: Allow sufficient time for users to migrate points
- **Communication**: Notify users about token launch and migration process

## Resources

- [Clanker Documentation](https://clanker.xyz/docs) (when available)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [Token Migration Best Practices](https://ethereum.org/en/developers/tutorials/token-migration/)

## Notes

- ✅ **Updated**: All references now use "$bDCU" (not "DCU Points")
- **Token Name**: bDCU (Base DeCleanup)
- **Old Name**: DCU (deprecated, no longer used)
- **Distribution**: Automatic via `bDCURewardDistributor` contract (no claim needed)
- **Migration**: Points → Tokens (1:1 conversion when token is live)
- Ensure backward compatibility during migration period

## See Also

- **[bdcu-token-integration-plan.md](./bdcu-token-integration-plan.md)** - Complete integration plan with Clanker details

