# DeCleanup Rewards - Developer Documentation

> **Concise developer documentation for contributors and integrators**

## Quick Links

- **Farcaster Mini App**: [farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards](https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards)
- **Web App**: [decleanup.net](https://decleanup.net)
- **System Architecture**: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
- **Local Testing**: [LOCAL_TESTING.md](LOCAL_TESTING.md)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Blockchain** | Wagmi v2, Viem, Base (L2) |
| **Wallet** | Farcaster SDK, WalletConnect, MetaMask, Coinbase Wallet |
| **Storage** | IPFS (Pinata) |
| **Smart Contracts** | Solidity 0.8.20, Hardhat |

---

## Architecture Overview

```
┌─────────────────┐
│  Next.js Client │  (app/, components/)
├─────────────────┤
│  Wallet Layer   │  (lib/wagmi.ts, components/wallet/)
├─────────────────┤
│  Domain Logic   │  (lib/contracts.ts, lib/ipfs.ts)
├─────────────────┤
│  Smart Contracts│  (contracts/)
└─────────────────┘
```

**Key Flows:**
- **Cleanup Submission**: Photo capture → IPFS upload → On-chain submission
- **Verification**: Verifier dashboard → Review → Approve/Reject
- **Rewards**: Automatic $bDCU distribution via bDCURewardDistributor contract

---

## Environment Setup

### Required Variables

```bash
# Network Configuration
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia (8453 for mainnet)
NEXT_PUBLIC_RPC_URL=...
NEXT_PUBLIC_BLOCK_EXPLORER_URL=...

# Contract Addresses
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=...
NEXT_PUBLIC_VERIFICATION_CONTRACT=...
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=...
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=...

# IPFS (Server-side only - NOT NEXT_PUBLIC_*)
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# Farcaster
NEXT_PUBLIC_FARCASTER_NEYNAR_KEY=...
NEXT_PUBLIC_BASE_APP_ID=...

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

**⚠️ Important**: Pinata keys must be server-side only (`PINATA_API_KEY`, not `NEXT_PUBLIC_PINATA_API_KEY`) to prevent client exposure.

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Generate NFT metadata
npm run generate:metadata
```

---

## Smart Contracts

### Core Contracts

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| **ImpactProductNFT** | Dynamic NFT (10 levels) | `claimLevelForUser`, `userCurrentLevel` |
| **VerificationContract** | Cleanup submissions | `submitCleanup`, `verifyCleanup`, `getCleanupStatus` |
| **bDCURewardDistributor** | Auto token distribution | `distributeLevelReward`, `distributeStreakReward` |
| **$bDCU Token** | ERC20 reward token | `balanceOf`, `transfer` |

### Reward Structure

| Action | Reward |
|--------|--------|
| Level Claim | 10 $bDCU |
| Weekly Streak | 2 $bDCU |
| Referral | 3 $bDCU (both parties) |
| Impact Form | 5 $bDCU |
| Verification | 1 $bDCU |

---

## Key Directories

```
app/              # Next.js routes (/, /cleanup, /profile, /verifier)
components/       # Reusable UI components
lib/              # Business logic (contracts, IPFS, verification)
contracts/        # Solidity smart contracts
scripts/          # Utility scripts (metadata generation, etc.)
```

---

## Testing

### Local Development
1. Start dev server: `npm run dev`
2. Connect wallet on Base Sepolia
3. Test cleanup submission flow
4. Use verifier dashboard to approve

### Mobile Testing
See [LOCAL_TESTING.md](LOCAL_TESTING.md) for tunnel setup (ngrok, Cloudflare, localtunnel).

---

## Deployment

### Frontend (Vercel)
1. Push to main branch
2. Vercel auto-deploys
3. Update environment variables in Vercel dashboard
4. Verify Pinata keys are set correctly (server-side only)

### Smart Contracts (Hardhat)
```bash
cd contracts
npx hardhat deploy --network baseSepolia
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ipfs/upload` | POST | Proxy IPFS uploads (keeps Pinata keys server-side) |
| `/api/health` | GET | Health check endpoint |

---

## Security Notes

- ✅ Pinata API keys are server-side only
- ✅ IPFS uploads proxied through API route
- ✅ Wallet connection requires user approval
- ✅ Network switching enforced (Base only)
- ✅ Contract calls include proper error handling

---

## Troubleshooting

### Wallet Connection Issues
- Ensure wallet is on Base Sepolia (84532)
- Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Verify network is added to wallet

### IPFS Upload Failures
- Verify `PINATA_API_KEY` and `PINATA_SECRET_KEY` are set (server-side)
- Check file size limits (10MB per image)
- Ensure API route `/api/ipfs/upload` is accessible

### Contract Interaction Errors
- Verify contract addresses in `.env.local`
- Check RPC URL is correct and accessible
- Ensure wallet has testnet ETH for gas

---

## Resources

- **Base Docs**: [docs.base.org](https://docs.base.org)
- **Farcaster Docs**: [docs.farcaster.xyz](https://docs.farcaster.xyz)
- **Wagmi Docs**: [wagmi.sh](https://wagmi.sh)
- **Viem Docs**: [viem.sh](https://viem.sh)

---

## Support

- **Telegram**: [t.me/DecentralizedCleanup](https://t.me/DecentralizedCleanup)
- **GitHub Issues**: Report bugs and feature requests

---

*Last updated: 2025*

