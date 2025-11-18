# DeCleanup Mini App – System Architecture

> **Audience**: Contributors who need an end-to-end view of the DeCleanup Farcaster Mini App stack, from the Next.js client down to the smart contracts.  
> **Networks**: Base Mainnet (8453) for production, Base Sepolia (84532) for QA.  
> **External references**: Wagmi/Viem docs, Farcaster Mini App SDK, IPFS gateways, Basescan, Coinbase Wallet / MetaMask Mobile guidelines.

This document mirrors the level of depth and structure we admire in Green Goods’ documentation set to keep technical context close to the codebase and speed up onboarding for new team members.[^greengoods-readme][^greengoods-architecture]

---

## 1. Layered Overview

| Layer | Path(s) | Description | Key Tech |
| --- | --- | --- | --- |
| **Client Mini App** | `app/`, `components/` | Next.js 14 App Router UI tailored for Farcaster Frames/Mini Apps, optimized for mobile and touch capture. | Next.js 14, Tailwind, shadcn/ui |
| **Wallet & Auth** | `lib/wagmi.ts`, `components/wallet/` | Wagmi v2 + Viem config that auto-targets Base, interoperates with Farcaster, Coinbase Wallet, MetaMask Mobile, WalletConnect. | Wagmi, Viem, Farcaster SDK |
| **Domain Logic SDK** | `lib/contracts.ts`, `lib/verification.ts`, `lib/ipfs.ts`, `lib/points.ts` | Reusable helpers for contract IO, submission fee discovery, points fallback, IPFS upload orchestration. | Viem, IPFS (Pinata) |
| **Storage & Media** | `uploadToIPFS` pipeline | Photo capture (before/after) → IPFS via Pinata with gateway fallbacks, referenced inside on-chain submissions. | IPFS, Pinata |
| **Smart Contracts** | `contracts/` (Hardhat), `scripts/` | Impact Product NFT, Verification, Reward Distributor. Deployed to Base (Mainnet/Sepolia) with Hardhat scripts. | Solidity 0.8.20, Hardhat |
| **Ops Tooling** | `scripts/*.js`, `contracts/scripts/*.js` | Node scripts for metadata generation, deployment, troubleshooting, verifications. | Node.js, Viem/ethers |

---

## 2. Directory Map & Responsibilities

| Directory | Purpose |
| --- | --- |
| `app/` | Farcaster-focused routes (`/`, `/cleanup`, `/profile`, `/verifier`). Each route uses server components where possible but drops to client components for wallet state or camera access. |
| `components/` | Shared UI (wallet widget, network checker, navigation, forms). Wallet module encapsulates Farcaster + Wagmi connectors. |
| `lib/` | Typed utilities for contracts, verification orchestration, Farcaster context detection, local points storage, IPFS uploads. `lib/contracts.ts` is the canonical on-chain adapter with network guards. |
| `scripts/` | Off-chain helpers (metadata generation, IPFS upload, contract metadata inspection). |
| `contracts/` | Hardhat project containing Solidity sources and deployment scripts (currently still using Celo naming; schedule refactor to Base). |
| `metadata/` | Base NFT metadata seeds before pinning to IPFS. |
| `types/` | Shared TS types for cleanups, profiles, Farcaster context, etc. |

---

## 3. Runtime Flows

### 3.1 Wallet & Network Guard
1. On mount, `WalletConnect` inspects Farcaster context and auto-connects via `farcasterMiniApp()` when possible, otherwise offers injected wallets.
2. `lib/wagmi.ts` exposes `REQUIRED_CHAIN_*` constants so every component can enforce Base (8453/84532) without duplicating literals.
3. On connect, we attempt an automatic `switchChain(REQUIRED_CHAIN_ID)`. If the connector rejects or cannot switch (e.g., Farcaster-native wallet), UI surfaces explicit Base instructions.

### 3.2 Cleanup Submission
1. User captures before/after photos via the mobile camera capture helper.
2. Files upload to IPFS (Pinata) with input validation (<10 MB, JPEG/HEIC). `uploadToIPFS` provides deterministic hash logging.
3. `submitCleanup` scales GPS coordinates (×1e6), enforces Base via `getCurrentChainId`, and writes to the Verification contract.  
4. On success, we store the cleanup ID locally (scoped to address) to surface “Pending verification” warnings.  
5. If on Base Sepolia, placeholder cRECY reserve logic bypasses on-chain calls (since rewards only exist on Base mainnet).

### 3.3 Verification Workflow
1. `/verifier` page gates access via signature + allowlist check (see `contractsLib.isVerifier`).  
2. Verifiers fetch cleanup detail (photo hashes, metadata) and call `verifyCleanup` or `rejectCleanup`.  
3. After each transaction, we poll `getCleanupStatus` + show explorer links (Basescan) until confirmation or max retries.

### 3.4 Impact Product Claiming
1. When `cleanupStatus.canClaim` is true, UI prompts user to call `claimImpactProductFromVerification`.  
2. Transaction hash surfaces instantly with Basescan deep link; we wait for receipt (best-effort) and poll the contract for claim completion.  
3. Profile page reloads on success to refresh level, NFT metadata, and dynamic art.

### 3.5 Points Tracking
* DCU points prefer on-chain reads (`RewardDistributor.getPointsBalance`), with `lib/points.ts` providing a local fallback for dev/test (per-user localStorage).

---

## 4. API & Contract Surface

| Contract | ABI entry points used | Notes |
| --- | --- | --- |
| Impact Product NFT | `claimLevelForUser`, `userCurrentLevel`, `getUserTokenId`, `tokenURI`, `getTokenURIForLevel` | Levels map to on-chain metadata (IPFS CIDs). Verification contract address is also readable/settable. |
| Verification | `submitCleanup`, `verifyCleanup`, `rejectCleanup`, `claimImpactProduct`, `getCleanupStatus`, `cleanupCounter`, `getSubmissionFee` | Submission fees optional; when enabled we pass `value` from `getSubmissionFee`. |
| Reward Distributor | `getPointsBalance`, `getStreakCount`, `hasActiveStreak` | Used for leaderboard + profile view. |

Environment coordination happens through `NEXT_PUBLIC_*` vars (see Section 6).

---

## 5. Third-Party Integrations

| Integration | Usage |
| --- | --- |
| **Farcaster Mini App SDK** | Provides context (user, frame) and Farcaster wallet connector; required for Warpcast in-app experiences. |
| **WalletConnect (v2)** | Optional connector for wallets without injected support (mobile-first). |
| **Coinbase Wallet / MetaMask Mobile** | Primary target wallets outside Warpcast. Network switching guidance is tuned for these clients. |
| **IPFS (Pinata)** | Photo & metadata pinning. API credentials configured via `NEXT_PUBLIC_PINATA_*` for simple deployments; rotate to server-side secrets when backend exists. |
| **Basescan** | Explorer deep links for all user-facing transactions (mainnet vs sepolia auto-detected). |

---

## 6. Configuration Reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAIN_ID` | `84532` (Base Sepolia) | Controls which chain Wagmi treats as “required”; swap to `8453` for production. |
| `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_TESTNET_RPC_URL` | Base RPC endpoints | Primary transport for Viem clients. |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | `https://sepolia.basescan.org` | Ensures explorer links match the active network. |
| `NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS` | `0x…` | Contract addresses for each module; fallbacks exist for legacy keys. |
| `NEXT_PUBLIC_PINATA_API_KEY` / `NEXT_PUBLIC_PINATA_SECRET_KEY` | — | Optional for direct client uploads; prefer proxying through a backend for production. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | — | Enables WalletConnect connector when present. |
| `NEXT_PUBLIC_IMPACT_METADATA_CID` | — | Static fallback for NFT metadata fetches if on-chain call fails. |

For local dev copy `.env.example` → `.env.local` and populate addresses once Base deployments are live.

---

## 7. Build, Test, Deploy

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Dev server | `npm run dev` (Next.js) |
| Unit tests | `npm run test` (Jest) |
| Lint | `npm run lint` |
| Contracts compile/test | `cd contracts && npm install && npx hardhat compile` (future: migrate scripts to Base and update README) |
| Metadata generation | `npm run generate:metadata` |

Deployment workflow:
1. Deploy updated contracts to Base Sepolia via Hardhat.
2. Update `.env.local` with new addresses + RPC endpoints.
3. Run regression checklist (wallet connect, cleanup submit, verification, NFT claim).
4. Promote chain ID & RPC to Base mainnet, redeploy frontend (e.g., Vercel).
5. Monitor Basescan + Farcaster Mini App logs for regressions.

---

## 8. Operational Notes & Future Work

- **Contracts repo alignment**: `contracts/` currently mentions Celo; schedule refactor to Base-specific scripts plus Foundry-compatible deployments.
- **Secrets hygiene**: Long-term, move IPFS uploads behind a signed serverless function to avoid exposing Pinata keys in the client.
- **Gas insights**: Base gas differs from Celo; add telemetry (e.g., analytics event or simple console reporting) to monitor failed submissions.
- **Indexer**: Future milestone includes replicating the Green Goods pattern of dedicated indexer/admin packages once on-chain volume grows.[^greengoods-architecture]

---

### References

[^greengoods-readme]: Green Goods Repository – README and documentation style inspiration. [https://github.com/greenpill-dev-guild/green-goods](https://github.com/greenpill-dev-guild/green-goods?tab=readme-ov-file)  
[^greengoods-architecture]: Green Goods Developer Architecture Guide – reference template for system-level docs. [https://github.com/greenpill-dev-guild/green-goods/blob/develop/docs/developer/architecture.md](https://github.com/greenpill-dev-guild/green-goods/blob/develop/docs/developer/architecture.md)


