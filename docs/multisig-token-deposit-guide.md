# Multisig Token Deposit Guide

## Overview
The Clanker community pool (15% reserve) will be held in a multisig wallet. This guide explains how to transfer tokens from the multisig to the `bDCURewardDistributor` contract.

## Method 1: Direct Transfer (Recommended)

**Simplest method - no approval needed**

### Steps:
1. Multisig signers approve the transaction
2. Multisig executes: `bDCUToken.transfer(rewardDistributorAddress, amount)`
3. Tokens are immediately available in the contract

### Example Transaction:
```solidity
// From multisig wallet
IERC20(bDCUTokenAddress).transfer(
    0x...RewardDistributorAddress,  // Your contract address
    10000 * 10**18                  // 10,000 $bDCU tokens
);
```

### Advantages:
- ✅ No approval step needed
- ✅ Single transaction
- ✅ Tokens immediately available
- ✅ Simpler multisig process

## Method 2: Approval + Deposit

**If you need more control or tracking**

### Steps:
1. **Multisig approves the contract:**
   ```solidity
   IERC20(bDCUTokenAddress).approve(
       0x...RewardDistributorAddress,  // Your contract address
       10000 * 10**18                  // Amount to approve
   );
   ```

2. **Owner calls deposit function:**
   ```solidity
   bDCURewardDistributor.depositTokensFrom(
       0x...MultisigAddress,  // Multisig wallet address
       10000 * 10**18         // Amount to deposit
   );
   ```

### Advantages:
- ✅ Can track deposits via events
- ✅ More control over timing
- ⚠️ Requires two transactions

## Monitoring Contract Balance

### Check Balance:
```javascript
// Using wagmi/viem
const balance = await readContract(config, {
  address: REWARD_DISTRIBUTOR_ADDRESS,
  abi: BDCU_REWARD_DISTRIBUTOR_ABI,
  functionName: 'getContractBalance',
})
```

### Recommended Thresholds:
- **Low balance alert**: < 1,000 $bDCU
- **Critical alert**: < 100 $bDCU
- **Top-up amount**: 10,000 - 50,000 $bDCU (based on usage)

## Workflow Recommendation

1. **Initial Setup:**
   - Transfer dev buy tokens to contract
   - Set up monitoring/alerting for contract balance

2. **Regular Top-ups:**
   - Monitor contract balance weekly
   - When balance < 1,000 $bDCU, request multisig top-up
   - Multisig transfers tokens directly (Method 1)
   - Verify balance updated

3. **Emergency:**
   - If balance runs out, pause distributions
   - Request urgent multisig top-up
   - Resume distributions after top-up

## Contract Functions

### Available Functions:
- `getContractBalance()` - Check current token balance
- `depositTokens(amount)` - Owner deposits (requires approval)
- `depositTokensFrom(from, amount)` - Deposit from specific address (requires approval)
- Direct `transfer()` - Multisig can transfer directly (no function call needed)

## Example Script

```javascript
// Check if contract needs top-up
const balance = await contract.getContractBalance()
const minBalance = ethers.parseEther("1000") // 1,000 $bDCU

if (balance < minBalance) {
  console.log("⚠️ Low balance! Request multisig top-up")
  console.log(`Current balance: ${ethers.formatEther(balance)} $bDCU`)
  console.log(`Recommended top-up: 10,000 $bDCU`)
}
```

## Security Notes

- ✅ Multisig controls community pool (secure)
- ✅ Contract can only distribute, not withdraw (except owner emergency)
- ✅ Owner can pause distributions if needed
- ✅ All distributions are tracked on-chain

