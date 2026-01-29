# DeCleanup Rewards

> **Farcaster Mini App that gamifies environmental cleanup through Impact Product NFTs, DCU points, and $bDCU token rewards on Base.**

## Live on Mainnet

**🌐 [Farcaster Mini App](https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards)** · **🌍 [Web App](https://decleanup.net)** · **👨‍💻 [Developer Specs](DEVELOPER_SPECS.md)** · **🔐 [Security Audit](SECURITY_AUDIT.md)** · **📄 [Terms of Service](TERMS_OF_SERVICE.md)**

**Base Mainnet** (Chain ID 8453). Contracts are verified on [Basescan](https://basescan.org):

| Contract | Proxy (use in app) | Basescan |
|----------|--------------------|----------|
| **PointsRewardDistributor** | [`0x9F42cf21fB3d5855E2c0B6FCDf5F4A2Cbc1332ba`](https://basescan.org/address/0x9F42cf21fB3d5855E2c0B6FCDf5F4A2Cbc1332ba) | [Read as Proxy](https://basescan.org/address/0x9F42cf21fB3d5855E2c0B6FCDf5F4A2Cbc1332ba#readProxyContract) |
| **ImpactProductNFT** | [`0x0B3A52260d62268BE75A7EfA12f16E83Ef218656`](https://basescan.org/address/0x0B3A52260d62268BE75A7EfA12f16E83Ef218656) | [Read as Proxy](https://basescan.org/address/0x0B3A52260d62268BE75A7EfA12f16E83Ef218656#readProxyContract) |
| **VerificationContract** | [`0x7fC07dbE598827E619459390674C028BADdD75F5`](https://basescan.org/address/0x7fC07dbE598827E619459390674C028BADdD75F5) | [Read as Proxy](https://basescan.org/address/0x7fC07dbE598827E619459390674C028BADdD75F5#readProxyContract) |
| **bDCU Token** | `0x30171b7014c02229497cde6745dd3ad821f12b07` | [Basescan](https://basescan.org/address/0x30171b7014c02229497cde6745dd3ad821f12b07) |

Implementations are verified so proxy pages support “Read as Proxy” / “Write as Proxy”. Deploy and verify: [contracts/DEPLOY_MAINNET.md](contracts/DEPLOY_MAINNET.md).

### $bDCU — Buy & support the movement

$bDCU is DeCleanup’s liquid action token on Base, deployed via [**Clanker**](https://www.clanker.world/clanker/0x30171b7014c02229497CdE6745DD3aD821F12b07). You can **earn** it by doing cleanups in the Mini App — or **buy** it to back the project: early investors directly support the cleanup movement and rewards for on-the-ground action. Trade $bDCU on [Clanker](https://www.clanker.world/clanker/0x30171b7014c02229497CdE6745DD3aD821F12b07), in the [Base app](https://base.org), or via Farcaster — turn trash into treasure while cleaning the planet.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?logo=base)](https://base.org/)
[![Farcaster](https://img.shields.io/badge/Farcaster-Mini%20App-purple)](https://farcaster.xyz/)

---

## 🎯 Overview

DeCleanup Rewards is a fully functional, production-ready Farcaster Mini App that incentivizes environmental cleanup through:

- **DCU Points System**: Users earn points for cleanups, streaks, referrals, and verifications
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
- **DCU Points**: Earn points for various actions (cleanup: 10 pts, streak: 1 pt, referral: 3 pts, etc.)
- **Token Claims**: Convert DCU points to $bDCU tokens (requires Level 3 and minimum 100 points)
- **Staking**: Stake tokens to become a verifier (requires ≥51% of balance and Level 3)
- **Add App Modal**: Prompts users to add app to Farcaster or pin to Base after onboarding
- **Bot Protection**: Vercel Bot ID protection on sensitive routes (Edge-level, no user friction)
- **Security Headers**: Comprehensive CORS, CSP, and security headers for production

### Admin Features
- **Verifier Management**: Manually add/remove verifiers (bypasses staking requirement)
- **Verifier Slashing**: Remove verifier status even with staked tokens (for misconduct)
- **Point Multipliers**: Adjust reward point values for all action types
- **Price Management**: Update token price and target reward values
- **Fee Management**: Submission fee stays 0. Claim fee (optional) may apply when claiming the Impact Product NFT; the app shows the exact fee in ETH before the user presses Claim Level or Claim Impact Product.
- **Level Management**: Decrease user levels for inappropriate behavior
- **Emergency Controls**: Pause/unpause contracts, withdraw tokens
- **Contract Upgrades**: Upgrade contracts using UUPS pattern (preserves user data)

---

## 🏗️ System Architecture

### Smart Contracts

| Contract | Purpose | Admin Functions | Upgradeable |
|----------|---------|----------------|-------------|
| **PointsRewardDistributor** | Points tracking, token claims, staking | Update prices, multipliers, verifiers, slash | ✅ UUPS |
| **VerificationContract** | Cleanup submissions, verification | Manage verifiers, fees, treasury, slash | ✅ UUPS |
| **ImpactProductNFT** | Dynamic NFT levels | Update base URI, decrease levels | ✅ UUPS |
| **bDCU Token** | ERC20 reward token | Standard ERC20 functions | ❌ Standard |

### Reward System

**DCU Points Structure:**
- **Cleanup (Level)**: 10 points
- **Streak**: 1 point
- **Referral**: 3 points (both parties)
- **Verifier**: 1 point
- **Manual/Retroactive**: Variable (admin-awarded)

**Note:** Points are converted to $bDCU tokens at claim time based on current token price and multipliers. The USD equivalent varies with market conditions.

**Claim Formula:**
```
usdValue = (points × targetRewardValueUSD) / LEVEL_POINTS
tokens = (usdValue × 1e18 × 1e8) / currentTokenPriceUSD
```

**Minimum Requirements:**
- Minimum 100 DCU points required to claim tokens
- User must reach Level 3 to claim tokens

**Staking Rules:**
- Users must reach **Level 3** to stake or claim tokens
- To become verifier: stake **≥51% of available token balance** at time of staking
- Verifier status lost if unstaking reduces balance below 50% of original stake (unless manually added)
- Admin can manually add verifiers (bypasses staking requirement and persists after unstaking)
- Minimum 100 DCU points required to claim tokens

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A Farcaster account
- A Base-compatible wallet
- Base ETH (for mainnet)

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
- Contract addresses (mainnet proxies in table above; see [.env.example](.env.example))
- `NEXT_PUBLIC_CHAIN_ID=8453` (Base mainnet)
- `NEXT_PUBLIC_RPC_URL` for mainnet. Use a dedicated RPC (Alchemy, Infura, QuickNode) in production to avoid 429 rate limits from the public `mainnet.base.org` endpoint.
- **Pinata API keys** (server-side: `PINATA_API_KEY`, `PINATA_SECRET_KEY`)
- WalletConnect Project ID, Farcaster Neynar API key, Base App ID

3. **Run locally:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

*Optional: to run against **Base Sepolia** for local or CI testing, set `NEXT_PUBLIC_CHAIN_ID=84532`, deploy with `npm run deploy:baseSepolia` in `contracts/`, and copy the deploy output addresses into `.env.local`. See [.env.example](.env.example) for the Base Sepolia section.*

---

## 📚 Documentation

- **[DEVELOPER_SPECS.md](DEVELOPER_SPECS.md)** - Technical specs, contracts, env
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Architecture
- **[DEV_DOCS.md](DEV_DOCS.md)** - Development guide
- **[SECURITY_AUDIT.md](SECURITY_AUDIT.md)** - Security audit
- **[TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md)** - Terms of Service

---

## 🔧 Admin Management

### Quick Admin Commands

From `contracts/` (use `--network base` for mainnet, `--network baseSepolia` for testnet):

```bash
# Check user status / distributor balance
npx hardhat run scripts/checkUserStatus.js --network base <address>
npx hardhat run scripts/checkDistributorBalance.js --network base

# Add verifier, update token price, transfer tokens to PointsRewardDistributor
npx hardhat run scripts/addVerifierToPointsDistributor.js --network base <address>
TOKEN_PRICE=77 npx hardhat run scripts/updateTokenPrice.js --network base
TRANSFER_AMOUNT=1000000 npx hardhat run scripts/transferTokensToPointsDistributor.js --network base
```

See [contracts/DEPLOY_MAINNET.md](contracts/DEPLOY_MAINNET.md) for deploy and verify steps.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Blockchain**: Wagmi v2 + Viem on Base
- **Farcaster**: `@farcaster/miniapp-sdk`
- **Styling**: Tailwind CSS + shadcn/ui
- **Storage**: IPFS (Pinata)
- **Smart Contracts**: Solidity 0.8.20, Hardhat

---

## 🔐 Security

### Smart Contract Security
- **Ownable Contracts**: All contracts use OpenZeppelin's Ownable pattern
- **ReentrancyGuard**: Critical functions protected against reentrancy
- **Pausable**: Emergency pause functionality available
- **Access Control**: Verifier and admin roles properly managed
- **Input Validation**: All user inputs validated

### Application Security
- **Bot Protection**: Vercel Bot ID protection on sensitive routes (Edge-level, no user friction)
- **Rate Limiting**: All API endpoints rate-limited to prevent abuse
- **CORS Security**: Secure CORS with origin validation (no wildcard)
- **CSP Headers**: Comprehensive Content Security Policy
- **Security Headers**: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Input Validation**: JSON depth and size limits to prevent DoS attacks
- **API Key Security**: Server-side secrets properly isolated
- **Automated Security**: Dependabot for dependency updates, CodeRabbit for PR reviews

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for complete security analysis.

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
✅ **Security** - Contracts and application secured with best practices  
✅ **Bot Protection** - Vercel Bot ID integrated (Edge-level protection, no user friction)  
✅ **CORS/CSP** - Secure headers and policies configured  
✅ **Automated Security** - Dependabot and CodeRabbit configured

---

**Built with ❤️ for a cleaner planet**
