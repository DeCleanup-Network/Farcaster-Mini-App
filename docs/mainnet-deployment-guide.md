# Mainnet Deployment Guide (Multisig)

This guide covers deploying DeCleanup contracts to Base Mainnet using a multisig (Safe) wallet.

## Prerequisites

1. **Deployer Wallet (EOA - Non-Custodial)**
   - Regular wallet (MetaMask, etc.) with private key
   - Will be used to deploy contracts
   - **Important**: After deployment, ownership will be transferred to multisig
   - Ensure it has sufficient ETH for deployment gas fees
   - Record: `DEPLOYER_PRIVATE_KEY` (keep secure!)

2. **Multisig 1: Token Treasury Safe**
   - Safe wallet for storing 15% of Clanker tokens
   - This will be used for:
     - Depositing tokens to `bDCURewardDistributor`
   - **Does NOT receive fees** - that's Multisig 2
   - Record: `TOKEN_TREASURY_SAFE_ADDRESS`

3. **Multisig 2: Fee Treasury Safe**
   - Separate Safe wallet for receiving fees
   - This will be used for:
     - Receiving ETH fees from `VerificationContract` (claim fees)
   - **Does NOT hold tokens** - that's Multisig 1
   - Record: `FEE_TREASURY_SAFE_ADDRESS`

4. **Clanker Token Address**
   - Get the official Clanker token address on Base Mainnet
   - This will replace the test `bDCU` token
   - Record: `CLANKER_TOKEN_ADDRESS`

4. **Environment Setup**
   ```bash
   cd contracts
   cp .env.example .env
   ```

   Required `.env` variables:
   ```bash
   # Network
   BASE_MAINNET_RPC_URL=https://mainnet.base.org
   # Or use Alchemy/Infura for better reliability:
   # BASE_MAINNET_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

   # Deployer (EOA wallet with private key)
   PRIVATE_KEY=0x... # Deployer wallet private key (keep secure!)
   
   # Multisig 1: Token Treasury (for Clanker tokens)
   TOKEN_TREASURY_SAFE_ADDRESS=0x... # Safe wallet that holds 15% of Clanker tokens
   
   # Multisig 2: Fee Treasury (for ETH fees)
   FEE_TREASURY_SAFE_ADDRESS=0x... # Safe wallet that receives claim fees
   
   # Clanker Token
   CLANKER_TOKEN_ADDRESS=0x... # Official Clanker token on Base Mainnet
   
   # Verifiers
   VERIFIER_ADDRESSES=0x...,0x... # Comma-separated verifier addresses
   
   # Fees
   CLAIM_FEE=7000000000000 # ~2 cents USD in ETH
   CLAIM_FEE_ENABLED=true
   SUBMISSION_FEE=0
   FEE_ENABLED=false
   
   # IPFS Metadata
   IMPACT_PRODUCT_BASE_URI=ipfs://... # Your IPFS CID for NFT metadata
   ```

## Deployment Steps

### Step 1: Prepare Multisig for Deployment

Since Hardhat uses a private key, you have two options:

**Option A: Use a temporary deployer account (Recommended)**
1. Create a temporary EOA (Externally Owned Account) with private key
2. Deploy contracts using this account
3. Transfer ownership to multisig immediately after deployment
4. Discard the private key (or keep it secure for emergency use)

**Option B: Use Safe's transaction builder (Advanced)**
1. Manually create transactions in Safe UI
2. Use contract creation transactions
3. More complex but fully multisig-controlled

For this guide, we'll use **Option A** with immediate ownership transfer.

### Step 2: Deploy Contracts

```bash
cd contracts
npx hardhat run scripts/deployUpdatedContracts.js --network baseMainnet
```

This will:
1. Deploy `bDCURewardDistributor` with Clanker token address
2. Deploy `VerificationContract` with fee settings
3. Link all contracts together
4. Save deployment info to JSON files

**Important:** After deployment, immediately transfer ownership to multisig:

```bash
# Update .env with multisig address first:
# MULTISIG_ADDRESS=0x... (or use FEE_TREASURY_SAFE_ADDRESS as the multisig for contract ownership)

# Transfer all contract ownership to multisig
npx hardhat run scripts/transferOwnershipToMultisig.js --network baseMainnet
```

**Note**: You can use either multisig as the contract owner. Typically, use **Multisig 2 (Fee Treasury)** as the contract owner since it will manage fees. Multisig 1 (Token Treasury) only needs to send tokens.

### Step 3: Verify Contract Linkages

```bash
npx hardhat run scripts/verifyContractLinkages.js --network baseMainnet
```

Ensure all linkages are correct:
- ✅ ImpactProductNFT.rewardDistributor → bDCURewardDistributor
- ✅ VerificationContract.rewardDistributor → bDCURewardDistributor
- ✅ bDCURewardDistributor.impactProductNFT → ImpactProductNFT
- ✅ bDCURewardDistributor.verificationContract → VerificationContract

### Step 4: Deposit Clanker Tokens to Reward Distributor

From **Multisig 1 (Token Treasury)**, transfer Clanker tokens to `bDCURewardDistributor`:

**Method 1: Direct Transfer (Recommended)**
1. Open Multisig 1 (Token Treasury) Safe wallet UI
2. Navigate to "New Transaction" → "Send Tokens"
3. Select Clanker token
4. Recipient: `bDCURewardDistributor` contract address
5. Amount: Initial deposit (e.g., 20-30% of treasury allocation)
6. Create and execute multisig transaction

**Method 2: Using Script (Requires Approval)**
```bash
# First, approve tokens from Multisig 1 (via Safe UI)
# Then run (requires TOKEN_TREASURY_SAFE_ADDRESS in .env):
npx hardhat run scripts/depositTokensFromTreasury.js --network baseMainnet
```

**Important**: Only Multisig 1 (Token Treasury) sends tokens. Multisig 2 (Fee Treasury) only receives ETH fees.

### Step 5: Configure Fee Treasury

Set `VerificationContract` to send fees to Multisig 2 (Fee Treasury):

**Option A: Via Script (if deployer still has access)**
```bash
# Set FEE_TREASURY_SAFE_ADDRESS in .env first
npx hardhat run scripts/setFeeTreasury.js --network baseMainnet
```

**Option B: Via Multisig (Recommended - after ownership transfer)**
1. Connect Multisig 2 (Fee Treasury) to Safe UI
2. Navigate to "New Transaction" → "Contract Interaction"
3. Enter `VerificationContract` address
4. Select `setFeeTreasury` function
5. Enter `FEE_TREASURY_SAFE_ADDRESS` as parameter
6. Create and execute multisig transaction

**Verify fee treasury is set:**
```bash
npx hardhat run scripts/checkFeeTreasury.js --network baseMainnet
```

**Note:** After setting fee treasury, `withdrawFees()` will send fees directly to Multisig 2, not to the contract owner.

### Step 6: Update Frontend Environment Variables

Update `.env.local` and Vercel environment variables:

```bash
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=<CLANKER_TOKEN_ADDRESS>
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=<DEPLOYED_DISTRIBUTOR_ADDRESS>
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=<DEPLOYED_VERIFICATION_ADDRESS>
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=<IMPACT_PRODUCT_ADDRESS>
NEXT_PUBLIC_REQUIRED_CHAIN_ID=8453 # Base Mainnet
```

## Post-Deployment Checklist

- [ ] Contract changes applied (fee treasury support)
- [ ] Contracts compiled and tested
- [ ] All contracts deployed
- [ ] Ownership transferred to multisig (Multisig 2 recommended)
- [ ] Fee treasury set to Multisig 2 address
- [ ] Contract linkages verified
- [ ] Initial Clanker tokens deposited from Multisig 1 to `bDCURewardDistributor`
- [ ] Frontend environment variables updated
- [ ] Contracts verified on Basescan (optional but recommended)
- [ ] Test claim flow end-to-end
- [ ] Test fee withdrawal (fees go to Multisig 2)
- [ ] Monitor token balance in `bDCURewardDistributor`
- [ ] Monitor fee accumulation in `VerificationContract`

## Ongoing Operations

### Depositing More Tokens

When treasury receives more Clanker tokens (from the 15% allocation):
1. From Treasury Safe, transfer tokens to `bDCURewardDistributor` address
2. No approval needed - direct transfer works
3. Tokens are immediately available for rewards

### Withdrawing Fees

Fees accumulate in `VerificationContract`:
1. From Multisig 2 (Fee Treasury) Safe, call `withdrawFees()` on `VerificationContract`
2. ETH fees are sent directly to Multisig 2 (if `feeTreasury` is set)
3. If `feeTreasury` is not set, fees go to contract owner
4. No additional transfer needed - fees go directly to Multisig 2

### Emergency Token Withdrawal

If needed, multisig can withdraw tokens from `bDCURewardDistributor`:
1. From Multisig Safe, call `withdrawTokens(amount)` on `bDCURewardDistributor`
2. Tokens are sent to multisig (contract owner)
3. Transfer to Treasury Safe if needed

## Security Considerations

1. **Multisig Threshold**: Use at least 2-of-3 or 3-of-5 for production
2. **Key Management**: Store multisig keys securely (hardware wallets recommended)
3. **Token Limits**: Consider setting max withdrawal limits
4. **Monitoring**: Set up alerts for contract balance changes
5. **Backup**: Keep deployment info and private keys in secure backup

## Troubleshooting

### Contracts deployed but ownership not transferred
- Run ownership transfer scripts immediately
- Verify ownership via `checkContractOwners.js`

### Tokens not depositing
- Check token address is correct (Clanker token, not test token)
- Verify `bDCURewardDistributor` address is correct
- Check token balance in Treasury Safe

### Fees not accumulating
- Verify `claimFeeEnabled` is `true` in `VerificationContract`
- Check fee amount is set correctly
- Verify users are paying fees when claiming

### Rewards not distributing
- Check `bDCURewardDistributor` has sufficient token balance
- Verify contract linkages are correct
- Check contract is not paused

## Support

For issues or questions:
1. Check contract deployment JSON files for addresses
2. Verify contract state via `checkRewardDistributorStatus.js`
3. Review contract events on Basescan
4. Check multisig transaction history

