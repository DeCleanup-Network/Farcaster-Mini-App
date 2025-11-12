# DeCleanup Network - Farcaster Mini App

> **A mobile-first Farcaster Mini App that gamifies environmental cleanup through Impact Product NFTs - onchain commodities, community token and engagement.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Celo](https://img.shields.io/badge/Celo-Mainnet-gold)](https://celo.org/)
[![Farcaster](https://img.shields.io/badge/Farcaster-Mini%20App-purple)](https://farcaster.xyz/)

---

## Why Farcaster First?

We're launching DeCleanup on **Farcaster first** to validate product-market fit and build community before expanding. Here's why:

### **Native Web3 Community**
Farcaster users already understand wallets, NFTs, and token rewards, reducing onboarding friction and increasing engagement.

### **Built-in Distribution**
Mini apps live directly in Farcaster clients (Warpcast, etc.), enabling social discovery and viral sharing through casts.

### **Rapid Iteration**
Test core features with an engaged, tech-savvy audience and gather real feedback quickly through Farcaster's social features.

### **Cost-Effective Launch**
Reach Web3 users where they already are, leverage Farcaster's social graph for organic growth, and focus resources on building one platform well.

### **Technical Advantages**
Native wallet integration via Farcaster SDK, mobile-first clients perfect for photo capture, and decentralized identity handling.

---

## Features Available for Testing

### **Core Cleanup**
- **Submit Cleanup**: Upload before/after photos with automatic geotagging
- **Enhanced Impact Report**: Optional detailed metrics (+5 $DCU bonus)
- **Recyclables Submission**: Submit proof of separated recyclables (10 cRECY tokens, partnership with Recy App)

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

### Prerequisites
- Node.js 18+
- A Farcaster account
- A Celo wallet (MetaMask, Valora, etc.)

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

3. **Run development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Blockchain**: Wagmi v2 + Viem on Celo network
- **Farcaster**: `@farcaster/miniapp-sdk`
- **Styling**: Tailwind CSS + shadcn/ui
- **Storage**: IPFS for decentralized photo storage

---

## Smart Contracts

The app interacts with DeCleanup Network smart contracts on Celo:
- Impact Product NFT contract
- Verification contract
- Recyclables Reward contract

---

## Contributing

Contributions are welcome! Fork the repository, create a feature branch, and open a Pull Request.

---

## Resources

- [DeCleanup Network GitHub](https://github.com/DeCleanup-Network)
- [Farcaster Mini Apps Docs](https://docs.farcaster.xyz/developers/mini-apps)
- [Celo Documentation](https://docs.celo.org)
- [Recy App](https://app.recy.life/)

---

## Support

Join our Telegram: [t.me/DecentralizedCleanup](https://t.me/DecentralizedCleanup)

---
