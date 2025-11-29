# $bDCU Token Naming Convention

## Overview

This document explains the token naming convention and clarifies the difference between **bDCU** and **DCU**.

## Token Name: $bDCU

**Official Token Name**: **$bDCU** (pronounced "bee-D-C-U")

**Meaning**:
- **b** = Base (the blockchain network)
- **DCU** = DeCleanup (the project name)
- **$bDCU** = DeCleanup Token on Base

## bDCU vs DCU

### $bDCU (Current - Use This)
- ✅ **Official token name** for Clanker launch
- ✅ **Token ticker**: `bDCU`
- ✅ **Display name**: `$bDCU`
- ✅ **Used everywhere**: Code, documentation, UI, contracts
- **Why "b"?**: Indicates the token is on Base network (vs other chains)

### DCU (Deprecated - Don't Use)
- ❌ **Old/deprecated name**
- ❌ **No longer used** in new code or documentation
- ❌ **Legacy references only** (being phased out)
- **Why deprecated?**: 
  - Not specific to Base network
  - Could conflict with tokens on other chains
  - Less clear branding

## Environment Variables

### ✅ Correct (Use This)
```bash
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x... # Clanker token contract address
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=0x... # Distribution contract
```

### ❌ Deprecated (Don't Use)
```bash
NEXT_PUBLIC_DCU_TOKEN_ADDRESS=0x... # OLD - Don't use
NEXT_PUBLIC_CLANKER_TOKEN_ADDRESS=0x... # OLD - Don't use
```

**Why only one variable?**
- Simplicity: One clear variable name
- Consistency: Matches token name (bDCU)
- Clarity: No confusion about which token
- Future-proof: If we launch on other chains, we'd use different prefixes (e.g., `ARB_DCU_TOKEN_ADDRESS` for Arbitrum)

## Code References

### ✅ Correct Usage
```typescript
// Token contract address
CONTRACT_ADDRESSES.BDCU_TOKEN

// Function names
getPointsBalance() // Returns $bDCU balance
getDCUBalance() // Alias for getPointsBalance()

// Comments
// $bDCU token balance
// Distribute 10 $bDCU
```

### ❌ Deprecated Usage
```typescript
// Don't use:
CONTRACT_ADDRESSES.DCU_TOKEN // OLD
getDCUTokenBalance() // OLD naming
// DCU points // OLD terminology
```

## UI Display

### ✅ Correct
- `$bDCU` - Token symbol
- `1,234.56 $bDCU` - Balance display
- `Earn $bDCU` - Reward text
- `+5 $bDCU Bonus` - Bonus text

### ❌ Deprecated
- `DCU Points` - OLD
- `$DCU` - OLD (missing 'b')
- `DCU tokens` - OLD

## Contract Names

### ✅ Correct
- `bDCURewardDistributor.sol` - Distribution contract
- `bDCUToken` - Token contract variable
- `IERC20 public bDCUToken` - Contract interface

### ❌ Deprecated
- `DCURewardDistributor.sol` - OLD
- `dcuToken` - OLD (lowercase)
- `DCUToken` - OLD (missing 'b')

## Documentation

### ✅ Correct
- `$bDCU Token Integration Plan`
- `bDCU token contract`
- `$bDCU balance`
- `bDCU Reward Distributor`

### ❌ Deprecated
- `DCU Token Integration` - OLD
- `DCU points` - OLD
- `DCU Reward Distributor` - OLD

## Migration Notes

When migrating from old code:
1. Replace `DCU` → `bDCU` in all new code
2. Replace `DCU_TOKEN_ADDRESS` → `BDCU_TOKEN_ADDRESS`
3. Update UI text: `DCU Points` → `$bDCU`
4. Update comments: `DCU tokens` → `$bDCU tokens`
5. Keep old code working during transition (backward compatibility)

## Summary

| Term | Status | Use When |
|------|--------|----------|
| **$bDCU** | ✅ Current | Always use this |
| **bDCU** | ✅ Current | Token ticker, variable names |
| **DCU** | ❌ Deprecated | Legacy code only, being phased out |
| **BDCU_TOKEN_ADDRESS** | ✅ Current | Environment variable |
| **DCU_TOKEN_ADDRESS** | ❌ Deprecated | Don't use in new code |

## Questions?

**Q: Why "bDCU" and not just "DCU"?**
A: The "b" indicates Base network. If we launch on other chains, we'd use different prefixes (e.g., `arbDCU` for Arbitrum).

**Q: Should I update all old "DCU" references?**
A: Yes, for new code. Old code can stay during migration period for backward compatibility.

**Q: What about the environment variable?**
A: Only use `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS`. The old `DCU_TOKEN_ADDRESS` is deprecated and removed from code.

**Q: What if I see "DCU" in old documentation?**
A: Update it to `$bDCU` when you encounter it, or mark it as deprecated.

---

**Last Updated**: [Current Date]  
**Status**: Active Standard

