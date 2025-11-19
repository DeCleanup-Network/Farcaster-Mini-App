# Contract Ownership Transfer Guide

## Overview

The `VerificationContract` collects fees from cleanup submissions. To withdraw these funds, you need to be the contract owner. This guide explains how to transfer ownership to a new address.

## Current Setup

- **Contract**: `VerificationContract`
- **Withdrawal Function**: `withdrawFees()` (only callable by owner)
- **Current Owner**: Check on [Basescan](https://sepolia.basescan.org) by viewing the contract

## Transfer Ownership

### Step 1: Set Environment Variables

In `contracts/.env`, ensure you have:

```bash
# Current owner's private key (must be the current contract owner)
PRIVATE_KEY=your_current_owner_private_key

# Contract address
VERIFICATION_CONTRACT_ADDRESS=0x08e9Ad176773ea7558e9C8453191d4361f8225f5

# New owner address (the address that will receive withdrawal permissions)
NEW_OWNER_ADDRESS=0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4
```

### Step 2: Run Transfer Script

```bash
cd contracts
npx hardhat run scripts/transferOwnership.js --network baseSepolia
```

Or pass the new owner address as an argument:

```bash
npx hardhat run scripts/transferOwnership.js --network baseSepolia --new-owner 0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4
```

### Step 3: Verify Transfer

1. Check the transaction on [Basescan Sepolia](https://sepolia.basescan.org)
2. Verify the `OwnershipTransferred` event was emitted
3. Confirm the new owner address matches your intended address

## Withdrawing Fees

After ownership is transferred, the new owner can withdraw collected fees:

### Option 1: Using Hardhat Script

Create a script `contracts/scripts/withdrawFees.js`:

```javascript
const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const contractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS;
  
  const VerificationContract = await ethers.getContractFactory("VerificationContract");
  const contract = VerificationContract.attach(contractAddress);
  
  const balance = await ethers.provider.getBalance(contractAddress);
  console.log("Contract balance:", ethers.formatEther(balance), "ETH");
  
  if (balance > 0n) {
    const tx = await contract.withdrawFees();
    await tx.wait();
    console.log("Fees withdrawn successfully!");
  } else {
    console.log("No fees to withdraw");
  }
}

main().catch(console.error);
```

Run it:

```bash
npx hardhat run scripts/withdrawFees.js --network baseSepolia
```

### Option 2: Using Basescan

1. Go to the contract on [Basescan Sepolia](https://sepolia.basescan.org/address/0x08e9Ad176773ea7558e9C8453191d4361f8225f5)
2. Click "Contract" → "Write Contract"
3. Connect your wallet (must be the owner)
4. Find `withdrawFees` function
5. Click "Write" and confirm the transaction

## Important Notes

⚠️ **Security Considerations**:

- The owner has full control over the contract (can add/remove verifiers, change fees, withdraw funds)
- Only transfer ownership to a trusted address
- Consider using a multisig wallet for production
- Keep the owner's private key secure

⚠️ **After Transfer**:

- The old owner loses all permissions
- Only the new owner can withdraw fees
- The new owner can transfer ownership again if needed

## Checking Contract Balance

To check how much ETH is available for withdrawal:

```bash
# Using Hardhat console
npx hardhat console --network baseSepolia
> const contract = await ethers.getContractAt("VerificationContract", "0x08e9Ad176773ea7558e9C8453191d4361f8225f5")
> const balance = await ethers.provider.getBalance(contract.target)
> console.log("Balance:", ethers.formatEther(balance), "ETH")
```

Or view directly on Basescan:
- Go to the contract address
- Check the "Balance" field in the contract overview

## Troubleshooting

### Error: "Current owner does not match deployer"

**Solution**: Ensure `PRIVATE_KEY` in `.env` matches the current contract owner address. Check the current owner on Basescan.

### Error: "Invalid address format"

**Solution**: Verify the `NEW_OWNER_ADDRESS` is a valid Ethereum address (starts with `0x`, 42 characters total).

### Transaction Fails

**Possible causes**:
- Insufficient gas
- Network congestion
- Wrong network (must be Base Sepolia)

**Solution**: Check transaction details on Basescan, ensure you have enough ETH for gas, and try again.

## Related Functions

The owner can also:
- `addVerifier(address)` - Add new verifiers
- `removeVerifier(address)` - Remove verifiers
- `setSubmissionFee(uint256, bool)` - Update submission fee
- `setImpactProductNFT(address)` - Update NFT contract address
- `setRewardDistributor(address)` - Update reward distributor address

All these functions are protected by `onlyOwner` modifier.

