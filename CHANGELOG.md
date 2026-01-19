# Changelog

All notable changes to the DeCleanup Mini App will be documented in this file.

## [2025-01-27] - Security & UX Improvements

### ✅ Added
- **CAPTCHA Protection**: Cloudflare Turnstile CAPTCHA integrated for wallet connection
  - Only appears on web app (automatically skipped in Farcaster Mini App)
  - Server-side verification for security
  - Privacy-friendly solution
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
- **Wallet Connection Flow**: Added CAPTCHA verification (web only)
  - CAPTCHA appears before wallet connection on web
  - Automatically skipped in Farcaster Mini App
  - Server-side verification before connection
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

