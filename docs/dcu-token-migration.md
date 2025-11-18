# DCU Token Migration Plan

## Overview

DeCleanup currently uses a **points system** for tracking user rewards. After the DCU token is deployed (Token Generation Event - TGE), points will be migrated to actual DCU tokens.

## Current System (Points)

- Points are stored in `RewardDistributor` contract
- 1 point = 1e18 (18 decimals, same as ERC20)
- Points are earned through:
  - Level rewards: 10 points per level
  - Streak rewards: 2 points per week
  - Referral rewards: 3 points (both referrer and referee)
  - Impact form rewards: 5 points per enhanced form

## Migration Strategy

### Phase 1: Points System (Current)

✅ **Status**: Active

- Users earn points for verified cleanups
- Points are displayed in UI as "$DCU Points"
- Points are stored on-chain in `RewardDistributor` contract
- No actual token exists yet

### Phase 2: Token Deployment

⏳ **Status**: Planned

- Deploy DCU ERC20 token contract to Base
- Token will have 18 decimals (matching points system)
- Initial supply will be allocated for migration

### Phase 3: Migration Setup

⏳ **Status**: Planned

1. **Set DCU Token Address:**
   ```solidity
   rewardDistributor.setDCUToken(dcuTokenAddress);
   ```

2. **Enable Migration:**
   ```solidity
   rewardDistributor.setTokenMigrationEnabled(true);
   ```

3. **Fund Contract:**
   - Transfer DCU tokens to `RewardDistributor` contract
   - Amount should cover all outstanding points

### Phase 4: User Migration

⏳ **Status**: Planned

Users can migrate their points to tokens:

1. **Call Migration Function:**
   ```solidity
   rewardDistributor.migratePointsToToken();
   ```

2. **Conversion:**
   - 1 point = 1 DCU token (1:1 ratio)
   - Points are burned, tokens are transferred
   - One-time migration per user

3. **After Migration:**
   - New rewards are distributed as tokens (not points)
   - UI shows token balance instead of points

## Contract Upgradeability

The `RewardDistributor` contract is **upgradeable** using UUPS pattern:

- ✅ No redeployment needed for token integration
- ✅ Can add new features without losing data
- ✅ Seamless migration from points to tokens
- ✅ Bug fixes and improvements possible

## Implementation Details

### RewardDistributorV2 Contract

```solidity
// DCU Token address (set after deployment)
address public dcuToken;
bool public tokenMigrationEnabled;

// Migration tracking
mapping(address => bool) public hasMigrated;

// Migration function
function migratePointsToToken() external returns (uint256) {
    require(tokenMigrationEnabled, "Migration not enabled");
    require(!hasMigrated[msg.sender], "Already migrated");
    
    uint256 pointsAmount = pointsBalance[msg.sender];
    hasMigrated[msg.sender] = true;
    pointsBalance[msg.sender] = 0;
    
    IERC20(dcuToken).transfer(msg.sender, pointsAmount);
    
    return pointsAmount;
}
```

### Frontend Integration

The frontend automatically handles both points and tokens:

```typescript
// getDCUBalance checks if user has migrated
const { balance, isTokenBalance } = await getDCUBalance(userAddress);

if (isTokenBalance) {
    // Show token balance
    displayTokenBalance(balance);
} else {
    // Show points balance with migration option
    displayPointsBalance(balance);
    showMigrationButton();
}
```

## Migration Timeline

1. **Pre-TGE (Now)**: Points system active
2. **TGE**: DCU token deployed
3. **Post-TGE (Week 1)**: Migration setup, contract funded
4. **Post-TGE (Week 2+)**: Users can migrate points to tokens
5. **Post-Migration**: All new rewards distributed as tokens

## User Communication

### Before Migration

- UI shows "DCU Points" (not tokens)
- Clear messaging: "Points will be converted to DCU tokens after TGE"
- Display migration countdown/status

### During Migration

- Migration button appears in profile
- Clear instructions on how to migrate
- Show conversion rate (1:1)
- Gas cost estimate

### After Migration

- UI shows "DCU Tokens" (not points)
- Token balance from ERC20 contract
- Can transfer/sell tokens normally

## Technical Notes

### Points vs Tokens

- **Points**: Internal accounting, not transferable
- **Tokens**: ERC20 standard, transferable, tradeable

### Migration Safety

- One-time migration per user (prevents double-spending)
- Points are burned when migrated
- Tokens are transferred atomically
- Reentrancy protection via `nonReentrant`

### Upgrade Path

If migration logic needs changes:

1. Deploy new implementation contract
2. Call `upgradeTo(newImplementation)` on proxy
3. All state preserved, new logic active

## Testing

### Local Testing

```bash
# Deploy test token
npx hardhat run scripts/deployTestToken.js --network localhost

# Set token address
npx hardhat run scripts/setDCUToken.js --network localhost

# Enable migration
npx hardhat run scripts/enableMigration.js --network localhost

# Test migration
npx hardhat run scripts/testMigration.js --network localhost
```

### Testnet Testing

1. Deploy to Base Sepolia
2. Distribute test points to users
3. Deploy test DCU token
4. Enable migration
5. Test user migration flow
6. Verify token balances

## FAQ

**Q: Will I lose my points if I don't migrate?**  
A: No, points remain in the contract. Migration is optional but recommended.

**Q: Can I migrate multiple times?**  
A: No, migration is one-time per user to prevent double-spending.

**Q: What happens to new rewards after migration?**  
A: New rewards are distributed as tokens directly (not points).

**Q: Can I transfer points before migration?**  
A: No, points are not transferable. Only tokens can be transferred.

**Q: What if I have points after migration is enabled?**  
A: You can migrate at any time. There's no deadline, but it's recommended to migrate early.

## Resources

- [RewardDistributorV2 Contract](../contracts/contracts/RewardDistributorV2.sol)
- [OpenZeppelin UUPS Upgradeable Pattern](https://docs.openzeppelin.com/contracts/4.x/upgradeable)
- [ERC20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)

