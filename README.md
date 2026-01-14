# DeCleanup Rewards - Production Ready

> **A production-ready Farcaster Mini App that gamifies environmental cleanup through Impact Product NFTs, DCU points, and $bDCU token rewards on Base.**

**🌐 [Farcaster Mini App](https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards)** | **🌍 [Web App](https://decleanup.net)** | **📖 [Admin Guide](ADMIN_GUIDE.md)** | **🏗️ [Deployment Guide](DEPLOYMENT.md)** | **👨‍💻 [Developer Specs](DEVELOPER_SPECS.md)**

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?logo=base)](https://base.org/)
[![Farcaster](https://img.shields.io/badge/Farcaster-Mini%20App-purple)](https://farcaster.xyz/)

---

## 🎯 Overview

DeCleanup Rewards is a fully functional, production-ready Farcaster Mini App that incentivizes environmental cleanup through:

- **DCU Points System**: Users earn points for cleanups, streaks, referrals, impact forms, and verifications
- **Token Rewards**: Points can be claimed for $bDCU tokens based on current market price
- **Impact Product NFTs**: Dynamic NFTs that evolve as users progress through 10 levels
- **Verifier System**: Users can stake tokens to become verifiers (51% of balance required)
- **Admin Controls**: Comprehensive admin functions for managing verifiers, fees, multipliers, and treasury

---

## ✨ Features

### Core Functionality
- **Cleanup Submissions**: Upload before/after photos with geotagging (max 10MB per image)
- **Verification System**: Team and community verifiers can approve/reject cleanups
- **Impact Products**: 10 progressive NFT levels (Newbie → Guardian)
- **DCU Points**: Earn points for various actions (cleanup: 10 pts, streak: 1 pt, referral: 2 pts, etc.)
- **Token Claims**: Convert DCU points to $bDCU tokens at any time (requires Level 10)
- **Staking**: Stake tokens to become a verifier (requires 51% of balance and Level 10)

### Admin Features
- **Verifier Management**: Manually add/remove verifiers (bypasses staking requirement)
- **Point Multipliers**: Adjust reward point values for all action types
- **Price Management**: Update token price and target reward values
- **Fee Management**: Configure submission and claim fees (optional)
- **Emergency Controls**: Pause/unpause contracts, withdraw tokens

---

## 🏗️ System Architecture

### Smart Contracts

| Contract | Purpose | Admin Functions |
|----------|---------|----------------|
| **PointsRewardDistributor** | Points tracking, token claims, staking | Update prices, multipliers, verifiers |
| **VerificationContract** | Cleanup submissions, verification | Manage verifiers, fees, treasury |
| **ImpactProductNFT** | Dynamic NFT levels | Update base URI, contract linkages |
| **bDCU Token** | ERC20 reward token | Standard ERC20 functions |

### Reward System

**DCU Points Structure:**
- **Cleanup (Level)**: 10 points = $0.50 USD equivalent
- **Streak**: 1 point = $0.05 USD equivalent
- **Referral**: 2 points = $0.10 USD equivalent (both parties)
- **Impact Form**: 3 points = $0.15 USD equivalent
- **Verifier**: 1 point = $0.05 USD equivalent

**Claim Formula:**
```
usdValue = (points × targetRewardValueUSD) / LEVEL_POINTS
tokens = (usdValue × 1e18 × 1e8) / currentTokenPriceUSD
```

**Staking Rules:**
- Users must reach **level 10** to stake or claim
- To become verifier: stake **>51% of available token balance**
- Verifier status lost if unstaking reduces balance below 50% of original stake
- Admin can manually add verifiers (bypasses staking requirement)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A Farcaster account
- A Base-compatible wallet
- Base Sepolia ETH for testing

### Installation

1. **Clone and install:**
```bash
git clone https://github.com/DeCleanup-Network/decleanup-mini-app-base.git
cd decleanup-mini-app-base
npm install
cd contracts && npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` with:
- Contract addresses (see [DEPLOYMENT.md](DEPLOYMENT.md))
- RPC URLs (Base Sepolia for testing, Base Mainnet for production)
- **Pinata API keys** (server-side only: `PINATA_API_KEY` and `PINATA_SECRET_KEY`)
- WalletConnect Project ID
- Farcaster Neynar API key
- Base App ID

3. **Run locally:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

---

## 📚 Documentation

### For Administrators
- **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** - Complete guide to managing the system
  - Verifier management
  - Fee configuration
  - Point multiplier adjustments
  - Emergency procedures

### For Developers
- **[DEVELOPER_SPECS.md](DEVELOPER_SPECS.md)** - Complete technical specifications
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment and setup guide
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Technical architecture
- **[LOCAL_TESTING.md](LOCAL_TESTING.md)** - Local testing guide
- **[docs/](docs/)** - Additional technical documentation

### For Users
- **[docs/user-guide.md](docs/user-guide.md)** - User guide
- **[TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md)** - Terms of Service

---

## 🔧 Admin Management

### Quick Admin Commands

**Check contract status:**
```bash
cd contracts
npx hardhat run scripts/checkUserStatus.js --network baseSepolia <user_address>
npx hardhat run scripts/checkDistributorBalance.js --network baseSepolia
```

**Manage verifiers:**
```bash
# Add verifier manually
npx hardhat run scripts/addVerifierToPointsDistributor.js --network baseSepolia <address>

# Check verifier status
npx hardhat run scripts/checkUserStatus.js --network baseSepolia <address>
```

**Update prices:**
```bash
# Update token price (8 decimals, e.g., 77 = $0.00000077)
TOKEN_PRICE=77 npx hardhat run scripts/updateTokenPrice.js --network baseSepolia

# Update target reward value (cents, e.g., 50 = $0.50)
TARGET_REWARD_VALUE=50 npx hardhat run scripts/updateTargetRewardValue.js --network baseSepolia
```

**Transfer tokens:**
```bash
# Transfer from deployer wallet to contract
TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferFromDeployer.js --network baseSepolia
```

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for complete admin documentation.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Blockchain**: Wagmi v2 + Viem on Base
- **Farcaster**: `@farcaster/miniapp-sdk`
- **Styling**: Tailwind CSS + shadcn/ui
- **Storage**: IPFS (Pinata)
- **Smart Contracts**: Solidity 0.8.20, Hardhat

---

## 📋 Contract Addresses

### Base Sepolia (Testnet)
- **PointsRewardDistributor**: `0xf0d87bFf397824D3CF9dcf7f400f8A7F78732F4f` ✅ **ACTIVE**
- **VerificationContract**: `0x82968575f998f669b72C56E4BdC2e94E6546c55F`
- **ImpactProductNFT**: `0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9`
- **bDCU Token**: `0x85162f919Bf8cd09B8046F8EAd2ecD434841e044`

### Base Mainnet
*See [DEPLOYMENT.md](DEPLOYMENT.md) for mainnet addresses*

---

## 🔐 Security

- **Ownable Contracts**: All contracts use OpenZeppelin's Ownable pattern
- **ReentrancyGuard**: Critical functions protected against reentrancy
- **Pausable**: Emergency pause functionality available
- **Access Control**: Verifier and admin roles properly managed
- **Input Validation**: All user inputs validated

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a Pull Request

---

## 📞 Support

- **Telegram**: [t.me/DecentralizedCleanup](https://t.me/DecentralizedCleanup)
- **Farcaster**: [@decleanup](https://warpcast.com/decleanup)

---

## 📄 License

See [LICENSE](LICENSE) file for details.

---

## 🎉 Status

✅ **Production Ready** - All core features implemented and tested  
✅ **Admin Controls** - Comprehensive admin functions available  
✅ **Documentation** - Complete documentation for admins, developers, and users  
✅ **Security** - Contracts secured with best practices

---

**Built with ❤️ for a cleaner planet**
