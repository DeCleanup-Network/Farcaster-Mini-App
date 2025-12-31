# Mainnet Deployment Notes

## Token Distribution Model

### Funding Strategy

**Reward Allocation:**
- **15% of total token supply is reserved for rewards**
- These tokens are currently **locked by Clanker** (the token contract)
- When unlocked, they will be sent to the multisig, which then funds the Reward Distributor contract

**Token Flow:**
1. **Clanker Lock**: 15% of tokens reserved for rewards are locked by Clanker (token contract)
2. **Unlock/Release**: When unlocked, tokens are released from Clanker
3. **Multisig**: Unlocked tokens are sent to the multisig wallet for management
4. **Reward Distributor**: Multisig sends tokens to the Reward Distributor contract as needed
5. **Distribution**: Reward Distributor automatically distributes tokens to users on-chain

**Reward Distribution:**
- The Reward Distributor contract holds bDCU tokens and distributes them automatically when users:
  - Claim Impact Product levels (10 $bDCU)
  - Maintain streaks (2 $bDCU)
  - Refer new users (3 $bDCU each)
  - Submit impact forms (5 $bDCU)
  - Verify cleanups (1 $bDCU per verification)

**Important**: 15% of tokens are reserved for rewards but are currently locked by Clanker. The actual amount available for distribution depends on what has been unlocked and sent to the Reward Distributor contract.

### Contract Configuration
- **Reward Distributor Contract**: Must be funded with bDCU tokens from multisig
  - User balances are read from Reward Distributor's `totalDistributed(address)` mapping
  - This shows the cumulative tokens distributed to each user (total rewards earned)
- **bDCU Token Contract (Clanker)**: Not needed for frontend
  - **Mainnet Address**: [`0x30171b7014c02229497cde6745dd3ad821f12b07`](https://basescan.org/token/0x30171b7014c02229497cde6745dd3ad821f12b07)
  - Contract Name: ClankerToken (DeCleanup Network - bDCU)
  - Decimals: 18
  - **15% of tokens are reserved for rewards and are currently locked by Clanker**
  - The Reward Distributor contract uses this internally for token transfers
  - The frontend reads user balances from Reward Distributor, not the token contract
  - **No need to configure `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS` in environment variables**
  - **Note**: When reward tokens are unlocked from Clanker, they flow: Clanker → Multisig → Reward Distributor → Users

### Environment Variables

#### Required for Mainnet:
```bash
# Network Configuration
NEXT_PUBLIC_CHAIN_ID=8453  # Base Mainnet
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://basescan.org

# Contract Addresses
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x...
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=0x...

# Note: NEXT_PUBLIC_BDCU_TOKEN_ADDRESS is NOT needed
# User balances are read from Reward Distributor's totalDistributed mapping
# The token contract is only used internally by Reward Distributor for transfers
```

#### Pre-Deployment Checklist
1. ✅ Deploy all contracts to Base Mainnet
2. ✅ Fund Reward Distributor contract from multisig with bDCU tokens
3. ✅ Link Verification Contract to Reward Distributor (if not done during deployment)
4. ✅ Verify contract addresses on Basescan
5. ✅ Update environment variables in Vercel (or deployment platform)
6. ✅ Test reward distribution with a test transaction
7. ✅ Monitor contract balance and set up alerts for low balance

### Validation & Monitoring

The app includes pre-flight validation that checks:
- Wallet connection status
- Correct network (Base Mainnet)
- Reward Distributor balance (optional, can be disabled)

To monitor the Reward Distributor balance:
- Use `checkRewardDistributorFunded()` function
- Check contract balance on Basescan
- Set up alerts for low balance thresholds

### Important Notes

1. **Token Contract Not Needed**: The bDCU token contract address (`NEXT_PUBLIC_BDCU_TOKEN_ADDRESS`) is **not needed** for the frontend. User balances are read directly from the Reward Distributor contract's `totalDistributed(address)` mapping, which tracks the cumulative tokens distributed to each user. The token contract is only used internally by the Reward Distributor for executing transfers.

2. **User Balance Reading**: The frontend reads user balances from `Reward Distributor.totalDistributed(userAddress)`, which shows the total rewards earned by each user. This is more accurate than reading from the token contract's `balanceOf()` since it shows cumulative rewards regardless of whether the user has spent/transferred tokens.

3. **Multisig Funding**: Ensure the Reward Distributor contract is funded before users start claiming rewards. The contract will fail transactions if it doesn't have sufficient balance.

4. **Balance Monitoring**: Regularly check the Reward Distributor contract balance using `getContractBalance()` and fund it from multisig as needed.

5. **Contract Linking**: Ensure the Verification Contract is properly linked to the Reward Distributor contract. Use `checkVerificationContractLinked()` to verify.

---

*Last updated: 2025*

