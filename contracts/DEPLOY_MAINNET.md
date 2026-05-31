# Deploy and Verify on Base Mainnet

This guide covers deploying upgradeable contracts to Base Mainnet and verifying them on Basescan.

## Prerequisites

- Node.js 18+
- `contracts/.env` with:
  - `PRIVATE_KEY` — deployer private key (no `0x` prefix or with)
  - `RPC_URL=https://mainnet.base.org` (or Alchemy/Infura/QuickNode for production)
  - `ETHERSCAN_API_KEY` or `BASESCAN_API_KEY` — for verification ([Etherscan API](https://etherscan.io/apidashboard))
- Base ETH on deployer address for gas

## 1. Deploy to Base Mainnet

From the **contracts** directory:

```bash
cd contracts

# Ensure .env has PRIVATE_KEY and RPC_URL for mainnet
# Optional: BDCU_TOKEN_ADDRESS=0x30171b7014c02229497cde6745dd3ad821f12b07 (mainnet bDCU)
# Optional: FEE_TREASURY=0x... INITIAL_VERIFIERS=0x...,0x...

npm run deploy:base
```

This deploys (or upgrades) in order:

1. **PointsRewardDistributor** (proxy + implementation)
2. **ImpactProductNFT** (proxy + implementation)
3. **VerificationContract** (proxy + implementation)

Then it links them and sets the fee treasury. The script waits 2 seconds before linking to avoid "nonce too low" errors. If linking failed after a successful deploy (e.g. "nonce too low" at Step 4), use **link-only mode**: set in `contracts/.env` the three proxy addresses (`POINTS_REWARD_DISTRIBUTOR_ADDRESS`, `IMPACT_PRODUCT_NFT_ADDRESS`, `VERIFICATION_CONTRACT_ADDRESS`) and run `npm run deploy:base` again—the script will skip deploy and only run the linking and fee treasury steps.

Copy the proxy addresses from the output into the app’s `.env.local` (and root `.env.example` if you maintain it):

- `NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS`
- `NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS` (or `NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT`)
- `NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS`

**After redeploy: update README and .env.example**  
Addresses are written to `contracts/deployment-base-upgradeable.json`. Update the root **README.md** “Live on Mainnet” table and **.env.example** with the proxy addresses from that file (`contracts.PointsRewardDistributor`, `contracts.ImpactProductNFT`, `contracts.VerificationContract`). bDCU token stays `0x30171b7014c02229497cde6745dd3ad821f12b07`.

**Note:** The current **PointsRewardDistributor** source uses `MINIMUM_LEVEL_FOR_STAKING = 3`. If you are upgrading an existing proxy, the new implementation will enforce level 3 for claiming and staking once the upgrade is complete.

## 2. Verify on Basescan

After deploy (or upgrade), verify implementation contracts so “Read as Proxy” / “Write as Proxy” work on Basescan:

```bash
cd contracts

# ETHERSCAN_API_KEY or BASESCAN_API_KEY must be set in contracts/.env
npm run verify:basescan
```

This script:

- Reads implementation addresses from `.openzeppelin/base.json` (from the last deploy/upgrade), or uses a fallback list
- Verifies each implementation contract on Basescan (Base Mainnet)
- Proxies are already visible; verification of implementations enables the proxy UI

Run with `--network base` (script enforces Base mainnet):

```bash
npx hardhat run scripts/verify-on-basescan.js --network base
```

## 3. Upgrade contracts (if needed)

### ⚠️ 30 DCU minimum to claim tokens — upgrade required

The contract source now uses **MINIMUM_POINTS_TO_CLAIM = 30** (and level 3 for eligibility). To get this live on mainnet you must **upgrade** the PointsRewardDistributor proxy (same address, new implementation):

```bash
cd contracts
npm run upgrade:pointsDistributor:base
```

The script uses the proxy address from `deployment-base-upgradeable.json` or `POINTS_REWARD_DISTRIBUTOR_ADDRESS` in `contracts/.env`. After the upgrade, users need only **30 DCU** (and level 3) to claim tokens. Then run verification again (step 2).

### Upgrade PointsRewardDistributor only (other changes)

```bash
cd contracts
npm run upgrade:pointsDistributor:base
```

Then run verification again (step 2). The app reads `hasMinimumLevel` from the contract; the current source uses **level 3** as the minimum for claiming and staking.

### Upgrade all three (gas-optimized claim)

To enable the gas-optimized claim flow (single reward call, no auto fee transfer, no URI storage on claim):

1. **PointsRewardDistributor** — adds `awardClaimRewards` (batch streak + referral + impact form)
2. **VerificationContract** — single `awardClaimRewards` call, fees accumulate (owner withdraws via `withdrawFees()`)
3. **ImpactProductNFT** — no `_setTokenURI` on claim/update/decrease (URI computed in `tokenURI()`)

Run all three upgrades in one go:

```bash
cd contracts
npm run upgrade:all:base
```

Or upgrade individually (order does not matter for correctness; PointsRewardDistributor should be upgraded first so VerificationContract can call the new batch):

```bash
npm run upgrade:pointsDistributor:base
npm run upgrade:verification:base
npm run upgrade:impactNFT:base
```

Then run verification again (step 2).

## 4. Why is my fee treasury empty?

Fees are only sent to the treasury when **claim fee** (or submission fee) is **enabled** on the VerificationContract. At deploy, both are **disabled by default** (`SUBMISSION_FEE=0`, `FEE_ENABLED=false`, `CLAIM_FEE=0`, `CLAIM_FEE_ENABLED=false`).

**Policy: submission fee stays 0.** We do not charge for submitting cleanups. Only the **claim fee** (for claiming the Impact Product NFT) may be enabled.

**To start receiving claim fees in your treasury (e.g. `0x986913D1FB38AD0685Ba2d8C10a28B7b962c38d9`):**

1. **Treasury is already set** — the deploy script calls `setFeeTreasury(FEE_TREASURY)`, so fees will go there once claim fee is enabled.
2. **Enable claim fee only** — as the contract owner, call on the VerificationContract (proxy):
   - `setClaimFee(feeWei, true)` — e.g. `setClaimFee("10000000000000", true)` for 0.00001 ETH (~few cents) per claim. Use “few cents” amounts; 0.0007 ETH is ~$2.
   - Leave submission fee disabled (0).

   You can do this on [Basescan](https://basescan.org) → VerificationContract proxy → “Write as Proxy” → connect owner wallet → `setClaimFee`. Or use the script below.

3. **Flow after enabling:** When a user claims and pays the fee, the contract receives the ETH and **immediately** sends it to the fee treasury via `_withdrawFeesIfNeeded()`. No separate “withdraw” step is needed. The app shows the exact claim fee before the user presses Claim Level or Claim Impact Product.

**Optional script to enable claim fee only (from `contracts/`):**

```bash
cd contracts
CLAIM_FEE_WEI=10000000000000 CLAIM_FEE_ENABLED=true npx hardhat run scripts/setFees.js --network base
```

Or use [Basescan](https://basescan.org) → VerificationContract proxy → “Write as Proxy” → `setClaimFee`. Keep submission fee at 0.

## 5. Withdraw accumulated fees (back to you)

**Yes, you can withdraw the fees.** The VerificationContract holds any claim (or submission) fees it receives. As the contract **owner**, you can pull that ETH out at any time.

- **Recipient:** ETH goes to `feeTreasury` if you set it (e.g. via deploy or `setFeeTreasury`), otherwise to the contract **owner** (deployer).
- **No per-user tracking:** The contract does not record who paid what; it only has a single balance. So you withdraw the full balance to one address (treasury or owner), not “back to each sender.”

**If you use the gas-optimized upgrade:** Fees no longer auto-transfer on each claim. They **accumulate** on the contract until you call `withdrawFees()`. That call sends the contract’s entire ETH balance to the fee treasury (if set) or to the owner.

**From the repo (as owner, from `contracts/`):**

```bash
cd contracts
# Base mainnet
npm run withdrawFees:base
# Base Sepolia
npm run withdrawFees:baseSepolia
```

The script uses `VERIFICATION_CONTRACT_ADDRESS` (or `NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS`) from `contracts/.env`, shows the contract balance and whether fees will go to fee treasury or owner, then calls `withdrawFees()`. You need to be the contract owner (same key as deployer / upgrade).

**On Basescan:** VerificationContract proxy → “Write as Proxy” → connect owner wallet → `withdrawFees()` (no args).

**Send fees to a specific user (refund):** After upgrading VerificationContract (so it has `withdrawFeesTo(address)`), you can send the contract’s fee balance directly to one address in one tx:

```bash
cd contracts
REFUND_RECIPIENT=0x7D85fCbB505D48E6176483733b62b51704e0bF95 npm run withdrawFeesTo:base
```

Or on Basescan: VerificationContract proxy → “Write as Proxy” → `withdrawFeesTo(address)` with the user’s address. The contract’s full ETH balance is sent to that address. (No per-user tracking; use when you want to refund one known address.)

## 6. Frontend / App

- Set **Base Mainnet** in the app:
  - `NEXT_PUBLIC_CHAIN_ID=8453`
  - `NEXT_PUBLIC_RPC_URL` (mainnet RPC)
  - `NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://basescan.org`
- Use the **proxy** addresses (not implementation) in the app env.
- Redeploy the frontend (e.g. Vercel) after updating env and contract links.

## Live on Mainnet

After deploy and verify, update the README “Live on Mainnet” section with the new proxy and Basescan links if they changed. Current mainnet proxies (as of last update) are in the root [README.md](../README.md#live-on-mainnet).
