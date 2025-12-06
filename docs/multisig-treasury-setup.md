# Multisig Treasury and Fee Setup Guide

## Overview

This document explains how to set up multisig ownership, configure treasury addresses, and manage fees for the DeCleanup contracts.

## Architecture Overview

**Three-Wallet Setup:**
1. **Deployer**: Regular wallet (EOA) - deploys contracts, then transfers ownership
2. **Multisig 1: Token Treasury Safe** - Holds 15% of Clanker tokens, sends to reward distributor
3. **Multisig 2: Fee Treasury Safe** - Receives ETH fees from claim fees

**Flow:**
- Deployer → Deploys contracts → Transfers ownership to Multisig 2
- Multisig 1 → Sends Clanker tokens → bDCURewardDistributor
- Users → Pay claim fees (ETH) → VerificationContract → Multisig 2

## Current Contract Ownership

### Deployer Information

The deployer is determined by the `PRIVATE_KEY` environment variable in `contracts/.env`. When you run deployment scripts, the first signer (`ethers.getSigners()[0]`) becomes the contract owner.

**To check current contract owners:**
```bash
cd contracts
npx hardhat run scripts/checkContractOwners.js --network baseSepolia
```

**Current test token deployer:** `0x7D85fCbB505D48E6176483733b62b51704e0bF95`

## Streak Functions (Deprecated)

**Why are `getStreakCount` and `hasActiveStreak` deprecated?**

The `bDCURewardDistributor` contract does **not** track streaks. These functions return `0` and `false` respectively because streak tracking is not implemented in the current contract architecture. They are marked as deprecated and should not be used.

**Status:** Removed from profile page - they were returning hardcoded values anyway.

## Fee Configuration

### Current Fee Settings

1. **Claim Fee**: ✅ Enabled
   - Amount: ~2 cents USD in ETH (approximately `7,142,857,142,857 wei` at $2,800/ETH)
   - Applied: Only when claiming Impact Products
   - Location: `VerificationContract.sol` - `claimFee` and `claimFeeEnabled`
   - **Collection**: Fees accumulate in `VerificationContract` contract balance
   - **Withdrawal**: Owner (multisig) can call `withdrawFees()` to send fees to multisig address

2. **Submission Fee**: ❌ Disabled (set to 0)
   - Not currently used
   - Can be enabled via `setSubmissionFee()` if needed

### Fee Flow

```
User pays claim fee → VerificationContract contract balance → withdrawFees() → Multisig owner → Transfer to Treasury Safe
```

**Important**: 
- Fees are collected in ETH (not tokens)
- `withdrawFees()` sends ETH to contract owner (multisig)
- Multisig should transfer ETH to Treasury Safe if needed
- Currently, there's no direct function to send fees to a separate treasury address

### Fee Calculation

The claim fee is set in the contract constructor or via `setClaimFee()`:
```solidity
// 2 cents USD at $2,800/ETH ≈ 7,142,857,142,857 wei
uint256 claimFee = 7_142_857_142_857; // ~0.000007142857 ETH
bool claimFeeEnabled = true;
```

**To update the claim fee:**
```bash
cd contracts
npx hardhat run scripts/setClaimFee.js --network baseSepolia
```

## Multisig Setup

### Option 1: Deploy from Multisig (Recommended)

If your multisig wallet supports EOA operations (like Gnosis Safe):

1. **Set up multisig wallet** (e.g., Gnosis Safe on Base Sepolia)
2. **Fund the multisig** with ETH for deployment gas
3. **Update deployment script** to use multisig address:
   ```javascript
   // In deployment script
   const multisigAddress = "0x..."; // Your multisig address
   const multisigSigner = await ethers.getSigner(multisigAddress);
   // Deploy with multisigSigner
   ```

4. **Deploy contracts** - they will be owned by the multisig

### Option 2: Deploy Normally, Transfer to Multisig

1. **Deploy contracts** normally (they'll be owned by your deployer address)
2. **Transfer ownership** to multisig:
   ```bash
   # Transfer VerificationContract ownership
   npx hardhat run scripts/transferOwnership.js --network baseSepolia
   # Input: multisig address when prompted
   ```

**Note:** Contracts use OpenZeppelin's `Ownable`, which supports single owner. The multisig wallet becomes the owner and can execute all `onlyOwner` functions.

## Treasury Configuration

### Current Implementation

Currently, `withdrawFees()` sends fees to `owner()`:
```solidity
function withdrawFees() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, "No fees to withdraw");
    payable(owner()).transfer(balance);
}
```

### Setting Treasury Address

**Option A: Use Multisig as Owner (Simplest)**
- Transfer contract ownership to multisig
- `withdrawFees()` will automatically send to multisig
- ✅ No contract changes needed

**Option B: Add Treasury Address Variable (More Flexible)**

Modify `VerificationContract.sol`:
```solidity
address public treasury;

function setTreasury(address _treasury) external onlyOwner {
    require(_treasury != address(0), "Invalid treasury address");
    treasury = _treasury;
}

function withdrawFees() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, "No fees to withdraw");
    address recipient = treasury != address(0) ? treasury : owner();
    payable(recipient).transfer(balance);
}
```

Then deploy the updated contract and set treasury:
```bash
npx hardhat run scripts/setTreasury.js --network baseSepolia
```

## Fee Withdrawal

### Current Process (Manual)

Fees are **NOT automatically withdrawn**. You must manually call `withdrawFees()`:

1. **Connect to contract** as owner (or multisig)
2. **Call `withdrawFees()`** function
3. **Fees are sent** to owner (or treasury if configured)

**To withdraw fees:**
```bash
cd contracts
npx hardhat run scripts/withdrawFees.js --network baseSepolia
```

### Automation Options

If you want automated withdrawals, you could:

1. **Use a keeper service** (e.g., Chainlink Keepers, Gelato)
2. **Create a scheduled script** that runs periodically
3. **Add a withdrawal threshold** - only withdraw when balance exceeds a certain amount

**Example with threshold:**
```solidity
uint256 public constant MIN_WITHDRAWAL = 0.01 ether; // Only withdraw if > 0.01 ETH

function withdrawFees() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance >= MIN_WITHDRAWAL, "Balance below minimum");
    payable(owner()).transfer(balance);
}
```

## Summary Checklist

- [ ] **Streak functions**: Removed from profile page (they were deprecated)
- [ ] **Claim fee**: Set to ~2 cents in ETH (only for claims, not submissions)
- [ ] **Submission fee**: Disabled (set to 0)
- [ ] **Deployer**: Check with `checkContractOwners.js` script
- [ ] **Multisig setup**: Choose Option 1 (deploy from multisig) or Option 2 (transfer ownership)
- [ ] **Treasury**: Either use multisig as owner, or add treasury address variable
- [ ] **Withdrawal**: Manual via `withdrawFees()` - not automated

## Next Steps

1. **Decide on multisig approach** (deploy from multisig vs transfer ownership)
2. **Set up multisig wallet** on Base Sepolia
3. **Transfer ownership** or redeploy with multisig
4. **Configure treasury** (if using separate treasury address)
5. **Test fee withdrawal** to multisig/treasury
6. **Set up automation** (optional) for periodic withdrawals

