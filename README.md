# DeCleanup Rewards - Farcaster Mini App

> **A mobile-first Farcaster Mini App that gamifies environmental cleanup through Impact Product NFTs, $bDCU token rewards, and on-chain engagement on Base.**

**🌐 [Farcaster Mini App](https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards)** | **🌍 [Web App](https://decleanup.net)** | **🏠 [Landing Page](https://decleanup.net)** | **📖 [System Architecture](SYSTEM_ARCHITECTURE.md)** | **🧪 [Local Testing Guide](LOCAL_TESTING.md)**

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

## Features

### **Core Cleanup**
- **Submit Cleanup**: Upload before/after photos with automatic geotagging (max 10MB per image)
- **Enhanced Impact Report**: Optional detailed metrics (+5 $bDCU bonus)

### **Rewards & Gamification**
- **Impact Products** (dynamic NFTs): 10 progressive levels (Newbie → Guardian) that evolve based on cleanup activity
- **$bDCU Tokens**: Automatic token distribution for verified cleanups, enhanced reports, referrals, and verifier activity
- **Level Claiming**: Claim Impact Product level after verification (10 $bDCU per level)

### **Social & Community**
- **Referral System**: Generate referral links, earn 3 $bDCU per verified referral (both parties)
- **User Profile**: Track $bDCU balance, Impact Product level, referrals, and cleanup history
- **Verifier Dashboard**: Verify cleanups and earn 1 $bDCU per verification

### **Engagement**
- **Farcaster Integration**: Native wallet connection and user context
- **Social Sharing**: Share cleanups and Impact Products on Farcaster and X

---

## 🚀 Quick Start

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

Edit `.env.local` with your configuration:
- Contract addresses (Impact Product NFT, Verification Contract, bDCURewardDistributor, $bDCU Token)
- RPC URLs (Base Sepolia for testing, Base Mainnet for production)
- **Pinata API keys** (server-side only: `PINATA_API_KEY` and `PINATA_SECRET_KEY` - NOT `NEXT_PUBLIC_*`)
- WalletConnect Project ID
- Farcaster Neynar API key
- Base App ID

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

For testing on mobile devices without deploying, see [LOCAL_TESTING.md](LOCAL_TESTING.md).

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Blockchain**: Wagmi v2 + Viem on Base mainnet/Base Sepolia
- **Farcaster**: `@farcaster/miniapp-sdk`
- **Styling**: Tailwind CSS + shadcn/ui
- **Storage**: IPFS for decentralized photo storage (via Pinata)

---

## Smart Contracts

Latest Base Sepolia deployment. These addresses are wired into `.env.local` and verified on Basescan:

| Contract | Address | Explorer |
| --- | --- | --- |
| ImpactProductNFT | `0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9` | [Basescan](https://sepolia.basescan.org/address/0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9) |
| VerificationContract | `0x08e9Ad176773ea7558e9C8453191d4361f8225f5` | [Basescan](https://sepolia.basescan.org/address/0x08e9Ad176773ea7558e9C8453191d4361f8225f5) |
| bDCURewardDistributor | See deployment files | Automatic $bDCU token distribution |

These contracts are production-ready; swap the env vars to Base mainnet once you redeploy.

- **Impact Product NFT**: Dynamic NFT with 10 progressive levels
- **Verification Contract**: Handles cleanup submissions and verification
- **bDCURewardDistributor**: Automatically distributes $bDCU tokens for level claims, streaks, referrals, impact forms, and verifier rewards

### Upgradeable Contracts

All contracts are **upgradeable** using OpenZeppelin's UUPS pattern, allowing:
- ✅ Bug fixes without redeployment
- ✅ Feature additions (like DCU token integration)
- ✅ Seamless migration from points to tokens
- ✅ No data loss during upgrades

### $bDCU Token Integration

**Current Status**: Using $bDCU token system with automatic distribution  
**Rewards**: Level claims (10 $bDCU), streaks (2 $bDCU), referrals (3 $bDCU), impact forms (5 $bDCU), verifier rewards (1 $bDCU)

---

## 📚 Documentation

- **[System Architecture](SYSTEM_ARCHITECTURE.md)** – Complete technical overview: contract/data flow, verifier roles, Farcaster integration, and architecture diagrams
- **[Local Testing Guide](LOCAL_TESTING.md)** – Test on mobile devices without deploying using tunnels (ngrok, Cloudflare, localtunnel)
- **[Base Mini App Setup](docs/base-miniapp-setup.md)** – Configure manifests, Base Build `accountAssociation`, and Warpcast options
- **[User Guide](docs/user-guide.md)** – Complete user guide for cleanup submission, rewards, and leveling

## 🔗 Resources

- **🌐 [Farcaster Mini App](https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards)** – Native Farcaster experience in Warpcast
- **🌍 [Web App](https://decleanup.net)** – Browser-accessible version
- **🏠 [Landing Page](https://decleanup.net)** – Project homepage
- **[Farcaster Mini Apps Docs](https://docs.farcaster.xyz/developers/mini-apps)** – Official Farcaster documentation
- **[Base Documentation](https://docs.base.org)** – Base network documentation
- **[Base Mini App Guide](https://docs.base.org/miniapp)** – Base Mini App development guide

---

## Contributing

Contributions are welcome! Fork the repository, create a feature branch, and open a Pull Request.

---

## Support

Join our Telegram: [t.me/DecentralizedCleanup](https://t.me/DecentralizedCleanup)

---
