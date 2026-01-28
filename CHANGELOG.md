# Changelog

All notable changes to the DeCleanup Mini App will be documented in this file.

## [2025-01-25] - Live on Mainnet

### Live on Base Mainnet
- **Contracts** deployed and **verified on [Basescan](https://basescan.org)** (proxies + implementations). Use “Read as Proxy” / “Write as Proxy” on the proxy pages.
- **Proxies** (use in app): PointsRewardDistributor `0x4920…3dd9`, ImpactProductNFT `0x8D71…1BCf`, VerificationContract `0x6971…819F`, bDCU `0x3017…2b07`.
- **Frontend** defaults to Base mainnet (`NEXT_PUBLIC_CHAIN_ID=8453`). Set `84532` for Base Sepolia testnet.

### Claim/Stake level 10 → 3
- **PointsRewardDistributor**: `MINIMUM_LEVEL_FOR_STAKING` changed from 10 to 3 via **upgrade** (no proxy redeploy). Run `npm run upgrade:pointsDistributor:base` from `contracts/` to apply; see [contracts/DEPLOY_MAINNET.md](contracts/DEPLOY_MAINNET.md).
- **Frontend** and docs updated: “level 10” → “level 3” for claim/stake copy and gates.

### Verification
- **verify-on-basescan.js** reads implementation addresses from `.openzeppelin/base.json`, so new impls (e.g. after upgrades) are verified by re-running `npm run verify:basescan`.

### Repo cleanup
- **Removed**: `MAINNET_CHECKLIST.md`, `MAINNET_DEPLOYMENT.md`, `CHANGELOG_SINCE_58b2b4a.md`, `DEPENDABOT_SETUP.md`, `BASE_APPS_SETUP.md`, `WALLET_CONNECTION_FIXES.md`, `SECURITY_AND_BEST_PRACTICES_CHECKLIST.md`, `contracts/scripts-archive/`, `contracts/KEEP_SCRIPTS.md`, obsolete deployment JSONs (deprecated, baseSepolia-only, bdcu-reward-distributor).
- **contracts/package.json**: removed obsolete script refs (`deploy.js`, `setup.js`, `redeploy*`, etc.); added `deploy:base` / `deploy:baseSepolia` → `deployUpgradeable.js`.
- **README**: “Live on mainnet” section with Basescan links, mainnet-first contract table, Level 3, streamlined docs links and admin commands.

---

## [2025-01-27] - Security & UX Improvements

### ✅ Added
- **Bot Protection**: Vercel Bot ID protection integrated
  - Edge-level protection (runs before requests reach application)
  - No user friction (completely invisible to legitimate users)
  - Protects sensitive routes: cleanup submissions, verification, points, verifier pages
  - Configured via Vercel Dashboard (no environment variables needed)
- **CORS Security**: Secure CORS implementation with origin validation
  - No wildcard `*` - only trusted origins allowed
  - Proper preflight handling
  - Credentials support for authenticated requests
- **CSP Headers**: Comprehensive Content Security Policy
  - Script source restrictions
  - Image source restrictions (allows IPFS gateways)
  - Frame ancestor restrictions (Farcaster/Base only)
  - Upgrade insecure requests
- **Security Headers**: Additional security headers
  - HSTS (HTTP Strict Transport Security)
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: Restricted browser APIs
- **Automated Security Tools**:
  - CodeRabbit configuration (`.coderabbit.yaml`) for PR reviews
  - Dependabot configuration (`.github/dependabot.yml`) for dependency updates
- **Documentation**:
  - `SECURITY_AUDIT.md` - Comprehensive security audit
  - `VERCEL_ENV_SETUP.md` - Quick Vercel environment variables setup
  - `WALLET_CONNECTION_FIXES.md` - Wallet connection improvements

### 🔧 Fixed
- **Wallet Connection**: Fixed connection issues from verifier page
  - Added connector initialization wait
  - Improved connector readiness checking
  - Better error handling and user feedback
- **Wallet Connection Reliability**: Enhanced connection flow
  - Better mobile browser detection
  - Improved connector selection logic
  - Enhanced error messages

### 🔄 Changed
- **Bot Protection**: Replaced CAPTCHA with Vercel Bot ID
  - Edge-level protection via middleware
  - No user interaction required
  - Better performance (no client-side libraries)
  - Automatic bot detection and blocking
- **CORS Implementation**: Replaced wildcard with origin validation
  - Secure origin checking
  - Only allows trusted domains
- **Security Headers**: Enhanced Next.js config
  - Comprehensive CSP policy
  - HSTS header added
  - Additional security headers

### 📝 Documentation
- Updated `README.md` with security features
- Updated `ANALYSIS_SUMMARY.md` with completed security improvements
- Added comprehensive security documentation

---

## Previous Changes

See git history for earlier changes.

