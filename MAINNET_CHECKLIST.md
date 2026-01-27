# Pre-mainnet checklist (short)

## 1. Where Base mainnet is wired

| Location | Purpose |
|----------|---------|
| `lib/wagmi.ts` | `NEXT_PUBLIC_CHAIN_ID` → `requiredChainId`; `baseMainnet` / `baseSepolia` RPC; `requiredChain`, `REQUIRED_*` exports |
| `lib/network.ts` | `REQUIRED_CHAIN_ID`, `REQUIRED_CHAIN_NAME`, `REQUIRED_RPC_URL` for switch/add/verify |
| `lib/contracts.ts` | `REQUIRED_CHAIN_ID`, `REQUIRED_CHAIN_NAME`; `NEXT_PUBLIC_BLOCK_EXPLORER_URL` override |
| `contracts/hardhat.config.js` | `base` network: `NEXT_PUBLIC_RPC_URL` or `BASE_MAINNET_RPC_URL` |

## 2. Env changes (local `.env.local`)

```bash
# Chain: Base mainnet
NEXT_PUBLIC_CHAIN_ID=8453

# RPC (mainnet = primary when chain is 8453)
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
# Optional: keep for local testnet
NEXT_PUBLIC_TESTNET_RPC_URL=https://sepolia.base.org

# Explorer (optional; wagmi derives basescan.org when chain is mainnet)
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://basescan.org
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=Basescan

# Contract addresses (after mainnet deploy)
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x...
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x30171b7014c02229497cde6745dd3ad821f12b07
NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS=0x...
NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS=0x...
```

## 3. Vercel (project → Settings → Environment Variables)

Set these for **Production** (and Preview if you want mainnet there):

| Name | Value (mainnet) |
|------|------------------|
| `NEXT_PUBLIC_CHAIN_ID` | `8453` |
| `NEXT_PUBLIC_RPC_URL` | `https://mainnet.base.org` |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | `https://basescan.org` |
| `NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS` | `<mainnet deployment>` |
| `NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS` | `<mainnet deployment>` |
| `NEXT_PUBLIC_BDCU_TOKEN_ADDRESS` | `0x30171b7014c02229497cde6745dd3ad821f12b07` |
| `NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS` | `<mainnet>` |
| `NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS` | `<mainnet>` |

Redeploy after changing env vars.

## 4. Before switching

- [ ] Deploy contracts to Base mainnet and verify on Basescan
- [ ] Link contracts (ImpactProduct ↔ Verification ↔ PointsRewardDistributor) and set prices
- [ ] Fund PointsRewardDistributor with bDCU
- [ ] Run smoke tests on testnet with `NEXT_PUBLIC_CHAIN_ID=84532`, then switch to `8453` and re-test
