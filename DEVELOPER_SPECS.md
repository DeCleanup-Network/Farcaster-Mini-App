# DeCleanup Rewards - Developer Specifications

> **Complete technical specifications for developers and contributors**

**Last Updated:** January 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Smart Contract Specifications](#smart-contract-specifications)
3. [Frontend Architecture](#frontend-architecture)
4. [API Specifications](#api-specifications)
5. [Data Models](#data-models)
6. [Integration Points](#integration-points)
7. [Development Workflow](#development-workflow)
8. [Testing Specifications](#testing-specifications)

---

## System Overview

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend Framework** | Next.js | 14.x (App Router) |
| **Language** | TypeScript | 5.x |
| **Blockchain Library** | Wagmi | 2.x |
| **Ethereum Library** | Viem | 2.x |
| **Styling** | Tailwind CSS | 4.x |
| **UI Components** | shadcn/ui | Latest |
| **Smart Contracts** | Solidity | 0.8.20 |
| **Build Tool** | Hardhat | Latest |
| **Storage** | IPFS (Pinata) | - |
| **Network** | Base | Mainnet/Testnet |

### Network Configuration

- **Testnet**: Base Sepolia (Chain ID: 84532)
- **Mainnet**: Base (Chain ID: 8453)
- **RPC**: Public Base RPC endpoints
- **Explorer**: Basescan (sepolia.basescan.org / basescan.org)

---

## Smart Contract Specifications

### Upgradeable Contracts

All main contracts use the **UUPS (Universal Upgradeable Proxy Standard)** pattern:
- **Proxy Addresses**: User-facing contract addresses (use these in frontend)
- **Implementation Addresses**: Logic contract addresses (used for upgrades)
- Contracts are upgradeable by owner to fix bugs, add features, and improve functionality
- User data, balances, and state are preserved across upgrades
- All contracts are pausable for emergency situations

**Upgrade Process:**
1. Deploy new implementation contract
2. Call `upgradeTo(newImplementation)` on proxy (owner only)
3. Verify upgrade on block explorer

### PointsRewardDistributor

**Address (Testnet)**: `0x3adf82A2e4998938B87C885d1D11011851cBeCc4` (UUPS Proxy)  
**Implementation**: `0x8f29111f7BA8D2D5345Ea683822cd0E37C6a15B6`  
**Pattern**: UUPS (Universal Upgradeable Proxy Standard) - Upgradeable contract

#### Core Functions

**Points Management:**
```solidity
function awardLevelPoints(address user) external
function awardStreakPoints(address user) external
function awardReferralPoints(address referrer, address referee) external
function awardImpactFormPoints(address user, uint256 cleanupId) external
function awardVerifierPoints(address verifierAddress, uint256 cleanupId) external
function manualAwardPoints(address user, uint256 points) external onlyOwner
```

**Token Claims:**
```solidity
function claimTokens(uint256 pointsToClaim) external returns (uint256 tokensReceived)
function calculateClaimAmount(uint256 points) external view returns (uint256 tokens)
```

**Requirements:**
- Minimum 100 DCU points required to claim
- User must reach Level 3 to claim tokens
- Contract must have sufficient token balance

**Staking:**
```solidity
function stakeTokens(uint256 amount) external
function unstakeTokens(uint256 amount) external
```

**Requirements:**
- User must reach Level 3 to stake
- Must stake at least 51% of available token balance to become verifier
- Verifier status lost if unstaking reduces balance below 50% of original stake (unless manually added)
- Manually added verifiers retain status even after unstaking

**Admin Functions:**
```solidity
function updateTokenPrice(uint256 newPrice) external onlyOwner
function updateTargetRewardValue(uint256 newValue) external onlyOwner
function updatePointMultipliers(...) external onlyOwner
function addVerifier(address verifierAddress) external onlyOwner  // Manual verifier (bypasses staking)
function removeVerifier(address verifierAddress) external onlyOwner
function slashVerifier(address verifierAddress) external onlyOwner  // Remove verifier even with staked tokens
function pause() external onlyOwner
function unpause() external onlyOwner
function withdrawTokens(uint256 amount) external onlyOwner
function upgradeTo(address newImplementation) external onlyOwner  // UUPS upgrade
```

#### State Variables

- `LEVEL_POINTS`: 10 (adjustable)
- `STREAK_POINTS`: 1 (adjustable)
- `REFERRAL_POINTS`: 3 (adjustable)
- `IMPACT_FORM_POINTS`: 3 (adjustable)
- `VERIFIER_POINTS`: 1 (adjustable)
- `targetRewardValueUSD`: 50 cents (40-60 range, adjustable)
- `currentTokenPriceUSD`: 8 decimals (e.g., 77 = $0.00000077, adjustable)
- `MINIMUM_LEVEL_FOR_STAKING`: 10 (constant)
- `MINIMUM_POINTS_TO_CLAIM`: 100 (constant - minimum DCU points required to claim tokens)

#### Events

```solidity
event PointsAwarded(address indexed user, uint256 points, string rewardType)
event TokensClaimed(address indexed user, uint256 pointsUsed, uint256 tokensReceived)
event TokensStaked(address indexed user, uint256 amount)
event TokensUnstaked(address indexed user, uint256 amount)
event VerifierStatusChanged(address indexed user, bool isVerifier)
event TokenPriceUpdated(uint256 newPrice)
event TargetRewardValueUpdated(uint256 newValue)
event PointsMultiplierUpdated(string multiplierType, uint256 newValue)
```

### VerificationContract

**Address (Testnet)**: `0x390bDa64D1523075E74673ed957B9Ed67a3D34aD` (UUPS Proxy)  
**Implementation**: `0x74dc3CE94069027520C060FA2e94479a446c84B7`  
**Pattern**: UUPS (Universal Upgradeable Proxy Standard) - Upgradeable contract

#### Core Functions

**Submissions:**
```solidity
function submitCleanup(...) external payable returns (uint256 cleanupId)
function claimImpactProduct(uint256 cleanupId) external payable
```

**Verification:**
```solidity
function verifyCleanup(uint256 cleanupId, uint8 level) external
function rejectCleanup(uint256 cleanupId) external
```

**Admin Functions:**
```solidity
function addVerifier(address _verifier) external onlyOwner
function removeVerifier(address _verifier) external onlyOwner
function slashVerifier(address _verifier) external onlyOwner  // Remove verifier for misconduct
function setSubmissionFee(uint256 _fee, bool _enabled) external onlyOwner
function setClaimFee(uint256 _fee, bool _enabled) external onlyOwner
function setFeeTreasury(address _feeTreasury) external onlyOwner
function pause() external onlyOwner
function unpause() external onlyOwner
function upgradeTo(address newImplementation) external onlyOwner  // UUPS upgrade
```

**Note:** Submission fee stays 0. Claim fee (if enabled) is automatically withdrawn to the fee treasury when collected. The app displays the exact claim fee in ETH before the user presses Claim Level or Claim Impact Product.

**Referral Logic:**
- Referral rewards are awarded to both referrer and referee (3 points each)
- Referee can receive referral reward even if previous cleanup was rejected
- `hasSubmittedCleanup` is only set to `true` upon successful verification
- This allows users to be eligible for referral rewards on subsequent submissions

#### Fee Configuration

- **Submission Fee**: Stays 0 (not charged for submitting cleanups)
- **Claim Fee**: Optional; if enabled, ~few cents USD equivalent in ETH. User sees the exact amount before pressing Claim Level or Claim Impact Product.
- **Fee Treasury**: `0x986913D1FB38AD0685Ba2d8C10a28B7b962c38d9`

### ImpactProductNFT

**Address (Testnet)**: `0x45417FFD32986DA5Ba232cb3FdFB9b21aE6D3539` (UUPS Proxy)  
**Implementation**: `0xdA614b090d26dd2e68cC1A8c5601D8f38eA6E96A`  
**Pattern**: UUPS (Universal Upgradeable Proxy Standard) - Upgradeable contract

#### Core Functions

```solidity
function claimLevelForUser(address user, uint256 cleanupId, uint8 level) external
function userCurrentLevel(address user) external view returns (uint8)
function getUserTokenId(address user) external view returns (uint256)
function tokenURI(uint256 tokenId) external view returns (string)
function getTokenURIForLevel(uint8 level) external view returns (string)
function decreaseLevel(address user, uint8 newLevel) external onlyOwner  // Reduce user level for misconduct
```

**Admin Functions:**
```solidity
function setBaseURI(string memory _baseURI) external onlyOwner
function setVerificationContract(address _verificationContract) external onlyOwner
function pause() external onlyOwner
function unpause() external onlyOwner
function upgradeTo(address newImplementation) external onlyOwner  // UUPS upgrade
```

---

## Frontend Architecture

### Directory Structure

```
app/
├── page.tsx              # Home page (with onboarding and Add App modal)
├── cleanup/
│   └── page.tsx         # Cleanup submission
├── profile/
│   └── page.tsx         # User profile (points, claims, staking)
├── verifier/
│   └── page.tsx         # Verifier dashboard
└── api/
    ├── ipfs/
    │   ├── upload/route.ts  # IPFS upload proxy
    │   └── fetch/route.ts   # IPFS fetch proxy (bypasses CORS)
    └── neynar/
        ├── user-by-fid/route.ts  # Get user by FID
        └── user-by-custody-address/route.ts  # Get user by custody address

components/
├── wallet/              # Wallet connection
├── farcaster/          # Farcaster integration
├── navigation/         # Navigation components
├── onboarding/
│   ├── OnboardingFlow.tsx  # Onboarding guide
│   └── AddAppModal.tsx     # Add to Farcaster/Base app modal
└── ui/                 # shadcn/ui components

lib/
├── contracts.ts        # Contract interactions
├── wagmi.ts           # Wagmi configuration
├── ipfs.ts            # IPFS uploads
├── points.ts          # Points utilities
└── verification.ts    # Verification logic
```

### Key Libraries

**Contract Interactions (`lib/contracts.ts`):**
- `getDCUPointsBalance(address)` - Get user's DCU points
- `claimTokensFromPoints(points, chainId)` - Claim tokens
- `stakeTokensForVerifier(amount, chainId)` - Stake tokens
- `getRewardsBreakdown(address)` - Get reward history
- `submitCleanup(...)` - Submit cleanup
- `verifyCleanup(cleanupId, level)` - Verify cleanup

**IPFS (`lib/ipfs.ts`):**
- `uploadToIPFS(file)` - Upload file to IPFS via Pinata proxy

**Points (`lib/points.ts`):**
- Points calculation utilities
- Local storage fallback (dev only)

---

## API Specifications

### IPFS Upload Endpoint

**POST** `/api/ipfs/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body: File (max 10MB)

**Response:**
```json
{
  "hash": "Qm...",
  "url": "https://gateway.pinata.cloud/ipfs/Qm..."
}
```

### IPFS Fetch Endpoint

**GET** `/api/ipfs/fetch?path=<ipfs_path>`

**Purpose:** Server-side proxy to fetch IPFS content (bypasses CORS)

**Request:**
- Query parameter: `path` - IPFS path (e.g., `bafybe.../level1.json`)

**Response:**
- JSON content from IPFS
- CORS headers included for client access

**Example:**
```
GET /api/ipfs/fetch?path=bafybeifgncb7zgjydfuhr26anittgtib5hda2dlvhdabzpdb6xa2s26luu/level1.json
```

### Contract Read Operations

All contract reads use Wagmi's `readContract`:
- Automatic retry logic
- Network validation
- Error handling

### Contract Write Operations

All contract writes use Wagmi's `writeContract`:
- Transaction hash returned immediately
- Optional transaction receipt waiting
- Error handling with user-friendly messages

---

## Data Models

### Cleanup Submission

```typescript
interface CleanupSubmission {
  user: Address
  beforePhotoHash: string  // IPFS hash
  afterPhotoHash: string  // IPFS hash
  timestamp: number
  latitude: number  // Scaled by 1e6
  longitude: number  // Scaled by 1e6
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number  // 1-10
  referrer: Address | null
  /** @deprecated Impact report removed from app flow; contract still has fields, we always pass false and ''. */
  hasImpactForm: boolean
  /** @deprecated Impact report removed from app flow; contract still has fields, we always pass ''. */
  impactReportHash: string | null
}
```

### User Profile Data

```typescript
interface UserProfile {
  address: Address
  dcuPoints: number
  dcuBalance: bigint  // $bDCU token balance
  stakedBalance: bigint
  isVerifier: boolean
  level: number  // 1-10
  hasMinimumLevel: boolean  // level >= 3
  tokenId: number | null  // Impact Product NFT token ID
}
```

### Reward Breakdown

```typescript
interface RewardBreakdown {
  totalPoints: number
  byType: {
    level: number
    streak: number
    referral: number
    /** @deprecated Impact form reward not used; app always submits hasImpactForm: false. */
    impactForm: number
    verifier: number
  }
}
```

---

## Integration Points

### Farcaster Integration

**SDK**: `@farcaster/miniapp-sdk`

**Key Functions:**
- `sdk.actions.ready()` - Signal app is ready (prevents infinite loading)
- `sdk.context` - Get Farcaster context (user, frame)
- `farcasterMiniApp()` - Wagmi connector for Farcaster wallets

**Environment Detection:**
- Detects if running in Farcaster Mini App
- Auto-connects wallet when available
- Handles both in-app and web contexts

### Wallet Integration

**Supported Wallets:**
- Farcaster (via Mini App SDK)
- Coinbase Wallet
- MetaMask
- WalletConnect

**Network Switching:**
- Automatic Base network detection
- Prompts user to switch if on wrong network
- Network validation before transactions

### IPFS Integration

**Provider**: Pinata

**Upload Flow:**
1. User selects file (max 10MB)
2. File sent to `/api/ipfs/upload` (server-side)
3. Server uploads to Pinata
4. Returns IPFS hash and gateway URL
5. Hash stored onchain in cleanup submission

**Gateway Fallbacks:**
- Server-side proxy (`/api/ipfs/fetch`) - bypasses CORS, tried first
- `ipfs.io`
- `cloudflare-ipfs.com`
- `dweb.link`
- `gateway.pinata.cloud`

**Metadata Loading Strategy:**
- Constructed metadata used immediately (fast path)
- IPFS fetch attempted in background (non-blocking)
- Falls back to constructed metadata if IPFS fails or times out (2 second timeout)
- Ensures UI always loads quickly even if IPFS gateways are slow

### Onboarding and Add App Modal

**OnboardingFlow Component:**
- 4-step guide showing app features
- Appears on first visit (session-based)
- Can be skipped or completed

**AddAppModal Component:**
- Appears after onboarding completes
- Detects Farcaster Mini App or Base App environment
- Offers to add app to Farcaster apps or pin to Base app
- Uses SDK methods when available, graceful fallback otherwise
- Shows once per session

**Metadata Loading Strategy:**
- Constructed metadata used immediately (fast path)
- IPFS fetch attempted in background (non-blocking)
- Falls back to constructed metadata if IPFS fails or times out (2 second timeout)
- Ensures UI always loads quickly even if IPFS gateways are slow

---

## Development Workflow

### Local Development

1. **Start dev server:**
```bash
npm run dev
```

2. **Compile contracts:**
```bash
cd contracts
npx hardhat compile
```

3. **Run tests:**
```bash
npm run test
```

### Contract Development

1. **Write contract** in `contracts/contracts/`
2. **Compile**: `npx hardhat compile`
3. **Test**: `npx hardhat test`
4. **Deploy**: `npx hardhat run scripts/deploy*.js --network baseSepolia`
5. **Verify**: `npx hardhat verify --network baseSepolia <address> <args>`

### Frontend Development

1. **Update contract addresses** in `.env.local`
2. **Update ABI** if contract changed
3. **Test locally** with testnet
4. **Build**: `npm run build`
5. **Deploy**: Push to main branch (Vercel auto-deploys)

---

## Testing Specifications

### Unit Tests

**Location**: `__tests__/`

**Coverage:**
- Contract utilities (`lib/contracts.test.ts`)
- General utilities (`lib/utils.test.ts`)
- Component tests (`components/ui/`)

### Integration Tests

**Manual Testing Checklist:**
- [ ] Wallet connection (all supported wallets)
- [ ] Network switching
- [ ] Cleanup submission
- [ ] IPFS upload
- [ ] Verification flow
- [ ] Points awarding
- [ ] Token claiming
- [ ] Staking/unstaking
- [ ] Verifier status changes

### Contract Testing

**Location**: `contracts/test/` (if exists)

**Test Coverage:**
- Points awarding
- Token claiming calculations
- Staking logic
- Verifier management
- Admin functions
- Edge cases and error handling

---

## Environment Variables

### Frontend (.env.local)

```bash
# Network (Base Mainnet)
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://basescan.org

# Contracts
NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS=0x...
NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=0x...
NEXT_PUBLIC_BDCU_TOKEN_ADDRESS=0x...

# IPFS (Server-side only - NOT NEXT_PUBLIC_*)
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Farcaster
NEXT_PUBLIC_FARCASTER_NEYNAR_KEY=...

# Base
NEXT_PUBLIC_BASE_APP_ID=...
```

### Contracts (.env)

```bash
# Network (Base Mainnet)
PRIVATE_KEY=...
RPC_URL=https://mainnet.base.org

# Contracts
POINTS_REWARD_DISTRIBUTOR_ADDRESS=0x...
VERIFICATION_CONTRACT_ADDRESS=0x...
IMPACT_PRODUCT_NFT_ADDRESS=0x...
BDCU_TOKEN_ADDRESS=0x...
```

---

## Code Standards

### TypeScript

- **Strict mode**: Enabled
- **Type safety**: All functions typed
- **No `any`**: Use proper types or `unknown`

### Solidity

- **Version**: 0.8.20
- **Style**: OpenZeppelin patterns
- **Security**: ReentrancyGuard, input validation, access control

### React/Next.js

- **Components**: Functional components with hooks
- **Server Components**: Use where possible
- **Client Components**: Only when needed (wallet, interactions)

---

## Deployment Specifications

### Frontend Deployment

**Platform**: Vercel (recommended)

**Build Command**: `npm run build`
**Output Directory**: `.next`

**Environment Variables**: Set in Vercel dashboard

### Contract Deployment

**Network**: Base Sepolia (test) → Base Mainnet (production)

**Deployment Order:**
1. ImpactProductNFT
2. PointsRewardDistributor
3. VerificationContract
4. Link contracts
5. Configure settings
6. Transfer tokens

**Verification**: Use Hardhat verify plugin

---

## Security Considerations

### Smart Contracts

- **Access Control**: Ownable pattern for admin functions
- **Reentrancy**: ReentrancyGuard on all external functions
- **Input Validation**: All inputs validated
- **Pausable**: Emergency pause functionality
- **Upgradeability**: Not upgradeable (immutable for security)

### Frontend

- **Wallet Security**: Never store private keys
- **IPFS Keys**: Server-side only (not in client)
- **Input Validation**: Client and server-side
- **Network Validation**: Always verify chain ID
- **Transaction Safety**: User confirmation required

---

## Performance Considerations

### Frontend

- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic with Next.js
- **Caching**: IPFS gateway caching
- **Lazy Loading**: Components loaded on demand

### Smart Contracts

- **Gas Optimization**: Efficient storage patterns
- **Batch Operations**: Where possible
- **Event Logging**: For off-chain indexing

---

## Monitoring & Observability

### Contract Events

All state changes emit events for monitoring:
- Points awarded
- Tokens claimed
- Staking/unstaking
- Verifier status changes
- Admin actions

### Frontend Logging

- Transaction attempts
- Transaction success/failure
- Error logging
- User actions (anonymized)

---

## Future Enhancements

### Planned Features

- [ ] Automated fee withdrawals
- [ ] Multi-signature wallet for mainnet
- [ ] Enhanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Cross-chain support

### Technical Debt

- [ ] Migrate contract scripts to Base-specific naming
- [ ] Add Foundry for contract testing
- [ ] Implement contract upgradeability pattern (if needed)
- [ ] Add comprehensive integration tests

---

## Support & Resources

### Documentation

- [Admin Guide](ADMIN_GUIDE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [System Architecture](SYSTEM_ARCHITECTURE.md)
- [Local Testing](LOCAL_TESTING.md)

### External Resources

- [Base Documentation](https://docs.base.org)
- [Farcaster Mini Apps](https://docs.farcaster.xyz/developers/mini-apps)
- [Wagmi Documentation](https://wagmi.sh)
- [Viem Documentation](https://viem.sh)

---

**Last Updated**: January 2025

