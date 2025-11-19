# Clanker Token Integration Plan

## Overview

DeCleanup plans to launch the $DCU token on Clanker and integrate its contract address into the Mini App. This document outlines the integration plan.

## Current State

### DCU Points System
- **Current**: DCU Points are tracked on-chain in the `RewardDistributor` contract
- **Storage**: Points are stored as internal balances in the contract
- **Display**: UI shows "DCU Points" (not tokens yet)
- **Migration**: Points will be exchangeable for $DCU tokens after TGE (Token Generation Event)

### Contracts
- `RewardDistributor.sol`: Manages DCU points distribution
- `RewardDistributorV2.sol`: Upgradeable version (prepared for token migration)

## Clanker Integration Plan

### Phase 1: Token Launch on Clanker

1. **Deploy $DCU Token Contract**
   - Launch token on Clanker platform
   - Configure tokenomics (supply, distribution, etc.)
   - Set up token contract address

2. **Update Environment Variables**
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_DCU_TOKEN_ADDRESS=0x... # Clanker token contract address
   NEXT_PUBLIC_CLANKER_TOKEN_ADDRESS=0x... # Same as above
   ```

### Phase 2: Contract Integration

1. **Update RewardDistributor Contract**
   - Add reference to $DCU token contract
   - Implement token distribution functions
   - Add migration function to convert points to tokens

2. **Contract Changes Needed**
   ```solidity
   // In RewardDistributor.sol or V2
   address public dcuTokenAddress;
   
   function setDCUTokenAddress(address _tokenAddress) external onlyOwner {
       dcuTokenAddress = _tokenAddress;
   }
   
   function migratePointsToTokens(uint256 amount) external {
       // Convert points to tokens
       // Transfer tokens to user
   }
   ```

### Phase 3: Frontend Updates

1. **Update Token Display**
   - Change "DCU Points" to "$DCU" when token is available
   - Show token balance from Clanker contract
   - Display token price/value if available

2. **Add Token Actions**
   - "Claim Tokens" button (convert points to tokens)
   - "View on Clanker" link
   - Token transfer functionality

3. **Update UI Components**
   - `app/profile/page.tsx`: Show token balance
   - `lib/contracts.ts`: Add token contract interactions
   - `lib/wagmi.ts`: Add token contract address

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
- [ ] Add `NEXT_PUBLIC_DCU_TOKEN_ADDRESS` to `.env.local`
- [ ] Create token contract ABI interface
- [ ] Add token balance reading function
- [ ] Update profile page to show token balance
- [ ] Add "Claim Tokens" button/flow
- [ ] Update all "DCU Points" references to "$DCU" (when token is live)
- [ ] Add Clanker explorer link
- [ ] Test token display and migration

### Documentation
- [ ] Update README with token information
- [ ] Document migration process
- [ ] Add Clanker integration guide
- [ ] Update system architecture docs

## Token Contract Interface

Expected token contract functions:

```solidity
interface IDCUToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}
```

## Environment Variables

```bash
# Clanker Token Integration
NEXT_PUBLIC_DCU_TOKEN_ADDRESS=0x... # Clanker token contract address
NEXT_PUBLIC_CLANKER_EXPLORER_URL=https://clanker.explorer/...
NEXT_PUBLIC_TOKEN_DECIMALS=18
NEXT_PUBLIC_TOKEN_SYMBOL=DCU
NEXT_PUBLIC_TOKEN_NAME=DeCleanup Token
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

- Keep "DCU Points" terminology until token is live
- Add "(coming soon)" label for token features
- Ensure backward compatibility during migration period
- Consider gas costs for migration transactions

