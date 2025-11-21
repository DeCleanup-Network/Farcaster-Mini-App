# DeCleanup Rewards - Farcaster Mini App

> **A mobile-first Farcaster Mini App that gamifies environmental cleanup through Impact Product NFTs - onchain commodities, community token (coming soon) and engagement.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?logo=base)](https://base.org/)
[![Farcaster](https://img.shields.io/badge/Farcaster-Mini%20App-purple)](https://farcaster.xyz/)

---

## Why Farcaster & Base?

We're launching DeCleanup on **Farcaster** and transacting on **Base** to validate product-market fit where onchain communities already live—while keeping user costs low. The mini app is built on top of the official [Base Mini App template](https://docs.base.org/miniapp), so we inherit wallet handling, secure request signing, and Warpcast compatibility from day one.

### Why Farcaster?

Farcaster gives us distribution, native wallet context, and a crypto-native audience who already understands the cleanup → NFT → points loop.

### **Native Web3 Community**
Farcaster users already understand wallets, NFTs, and token rewards, reducing onboarding friction and increasing engagement.

### **Built-in Distribution**
Mini apps live directly in Farcaster clients (Warpcast, etc.), enabling social discovery and viral sharing through casts.

### **Rapid Iteration**
Test core features with an engaged, tech-savvy audience and gather real feedback quickly through Farcaster's social features.

### **Cost-Effective Launch**
Reach Web3 users where they already are, leverage Farcaster's social graph for organic growth, and focus resources on building one platform well.

### Why Base L2?

- **Aligned incentives:** Base is actively investing in Mini Apps, providing co-marketing and infra support for consumer apps.
- **Low fees, high throughput:** OP Stack architecture keeps photo-backed submissions affordable even for emerging markets.
- **Security:** Coinbase-backed infrastructure inherits Ethereum security guarantees.
- **Developer velocity:** Full-stack TypeScript with Wagmi/Viem lets us ship quickly; Base Sepolia mirrors mainnet for reliable testing.

---

## Features Available for Testing

### **Core Cleanup**
- **Submit Cleanup**: Upload before/after photos with automatic geotagging
- **Enhanced Impact Report**: Optional detailed metrics (+5 $DCU bonus)

### **Rewards & Gamification**
- **Impact Products** (dynamic NFTs): 10 progressive levels (Newbie → Guardian) that evolve based on cleanup activity
- **$DCU Points**: Earn points for verified cleanups, enhanced reports, and referrals - exchangeable to $DCU token after TGE
- **Level Claiming**: Claim Impact Product level after verification

### **Social & Community**
- **Referral System**: Generate referral links, earn 3 $DCU per verified referral
- **Leaderboard**: Weighted scoring system ranking top contributors
- **User Profile**: Track $DCU balance, Impact Product level, streak, referrals, and leaderboard score

### **Engagement**
- **Streak System**: Maintain cleanup streaks that contribute to leaderboard score
- **Farcaster Integration**: Native wallet connection and user context

---

## Quick Start

This repo follows the Base Mini App template structure (manifest in `.well-known`, Farcaster SDK helpers, etc.). To run it locally:

### Prerequisites
- Node.js 18+
- A Farcaster account
- A Base-compatible wallet (Coinbase Wallet, MetaMask, etc.)
- (Optional) `base` CLI for manifest validation

### Installation

1. **Clone and install:**
```bash
git clone https://github.com/DeCleanup-Network/decleanup-mini-app.git
cd decleanup-mini-app
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration (contract addresses, API keys, etc.)

3. **Configure Base Mini App + Farcaster manifest:**
   - Follow the [Base Mini App Setup Guide](docs/base-miniapp-setup.md)
   - Generate `accountAssociation` via Base Build and paste into `.well-known/farcaster.json`
   - Update `NEXT_PUBLIC_BASE_APP_ID`, `NEXT_PUBLIC_FARCASTER_NEYNAR_KEY`, contract addresses, etc. inside `.env.local`

4. **Run and test locally:**
```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and:

1. Connect a Base-compatible wallet (MetaMask, Coinbase Wallet, Warpcast)
2. Ensure the wallet is on **Base Sepolia** (`chainId 84532`)
3. Submit a cleanup (photos + optional enhanced impact form)
4. Use the verifier dashboard to approve it
5. Claim the Impact Product NFT from `/profile`

### Testing checklist

- `npm run lint` – static analysis
- `npm run dev` – interactive testing of cleanup + verifier flows
- Hardhat scripts in `contracts/` – deploy, add verifiers, and verify contract wiring

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Blockchain**: Wagmi v2 + Viem on Base mainnet/Base Sepolia
- **Farcaster**: `@farcaster/miniapp-sdk`
- **Styling**: Tailwind CSS + shadcn/ui
- **Storage**: IPFS for decentralized photo storage

---

## Smart Contracts

Latest Base Sepolia deployment (2025-11-18). These addresses are wired into `.env.local` and verified on Basescan:

| Contract | Address | Explorer |
| --- | --- | --- |
| ImpactProductNFT | `0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9` | [Basescan](https://sepolia.basescan.org/address/0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9) |
| RewardDistributor | `0xd77f64024b0Ce2359DCe43ea149c77bF3cf08a40` | [Basescan](https://sepolia.basescan.org/address/0xd77f64024b0Ce2359DCe43ea149c77bF3cf08a40) |
| VerificationContract | `0x08e9Ad176773ea7558e9C8453191d4361f8225f5` | [Basescan](https://sepolia.basescan.org/address/0x08e9Ad176773ea7558e9C8453191d4361f8225f5) |

These contracts are production-ready; swap the env vars to Base mainnet once you redeploy.

- **Impact Product NFT**: Dynamic NFT with 10 progressive levels
- **Verification Contract**: Handles cleanup submissions and verification
- **Reward Distributor**: Distributes DCU points, streak, referral, and impact-form bonuses (see [Migration Plan](docs/dcu-token-migration.md))

### Upgradeable Contracts

All contracts are **upgradeable** using OpenZeppelin's UUPS pattern, allowing:
- ✅ Bug fixes without redeployment
- ✅ Feature additions (like DCU token integration)
- ✅ Seamless migration from points to tokens
- ✅ No data loss during upgrades

### DCU Token Migration

**Current Status**: Using points system  
**Future**: Points will migrate to DCU tokens after TGE

See [DCU Token Migration Plan](docs/dcu-token-migration.md) for details.

---

## Contributing

Contributions are welcome! Fork the repository, create a feature branch, and open a Pull Request.

---

## Documentation

- [System Architecture](docs/system-architecture.md) – Contract/data flow diagram, verifier roles, Farcaster integration
- [Base Mini App Setup](docs/base-miniapp-setup.md) – Configure manifests, Base Build `accountAssociation`, and Warpcast options
- [DCU Token Migration](docs/dcu-token-migration.md) – How points convert to $DCU token post-TGE

## Resources

- [DeCleanup Rewards GitHub](https://github.com/DeCleanup-Network)
- [Farcaster Mini Apps Docs](https://docs.farcaster.xyz/developers/mini-apps)
- [Base Documentation](https://docs.base.org)
- [Base Mini App Guide](https://docs.base.org/miniapp)

---

## Support

Join our Telegram: [t.me/DecentralizedCleanup](https://t.me/DecentralizedCleanup)

---
