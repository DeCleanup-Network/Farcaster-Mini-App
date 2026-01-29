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

## 3. Upgrade PointsRewardDistributor (if needed)

If you need to upgrade only the PointsRewardDistributor (e.g. to change minimum level or other logic):

```bash
cd contracts
npm run upgrade:pointsDistributor:base
```

Then run verification again (step 2). The app reads `hasMinimumLevel` from the contract; the current source uses **level 3** as the minimum for claiming and staking.

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

## 5. Frontend / App

- Set **Base Mainnet** in the app:
  - `NEXT_PUBLIC_CHAIN_ID=8453`
  - `NEXT_PUBLIC_RPC_URL` (mainnet RPC)
  - `NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://basescan.org`
- Use the **proxy** addresses (not implementation) in the app env.
- Redeploy the frontend (e.g. Vercel) after updating env and contract links.

## Live on Mainnet

After deploy and verify, update the README “Live on Mainnet” section with the new proxy and Basescan links if they changed. Current mainnet proxies (as of last update) are in the root [README.md](../README.md#live-on-mainnet).
