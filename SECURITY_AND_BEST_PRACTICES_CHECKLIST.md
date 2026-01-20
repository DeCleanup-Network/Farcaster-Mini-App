# Security & Best Practices Checklist

This document contains all security rules, best practices, and implementation requirements that should be verified in any production web application, especially for blockchain/mini-app projects.

## 🔒 Security Requirements

### 1. Bot Protection ✅
- **Implementation**: Vercel Bot ID (Edge-level protection)
- **Location**: `proxy.ts` or `middleware.ts`
- **Requirements**:
  - ✅ Use `botid` package with `verifyRequest()` function
  - ✅ Protect sensitive routes: `/api/cleanup/submit`, `/api/cleanup/verify`, `/api/points`, `/verifier`
  - ✅ Bot score threshold: < 10 (definitely bot)
  - ✅ No user friction (invisible to legitimate users)
  - ✅ Enable in Vercel Dashboard: Settings > Security > Bot Protection
- **Files to Check**:
  - `proxy.ts` or `middleware.ts` - Bot verification logic
  - `app/api/bot-check/route.ts` - Client-side bot check endpoint
  - `package.json` - Should include `botid` dependency

### 2. Rate Limiting ✅
- **Implementation**: Rate limiting on all API endpoints
- **Location**: `lib/rate-limit.ts`
- **Requirements**:
  - ✅ Rate limits configured per endpoint:
    - `/api/ipfs/upload`: 10 requests/minute
    - `/api/ipfs/fetch`: 100 requests/minute
    - `/api/neynar/*`: 60 requests/minute
    - General API: 100 requests/minute
  - ✅ Identify requests by IP + User-Agent
  - ✅ Return `429 Too Many Requests` with `Retry-After` header
  - ⚠️ **Production**: Migrate to Redis for distributed rate limiting (if using multiple instances)
- **Files to Check**:
  - `lib/rate-limit.ts` - Rate limiting utility
  - All API route files - Should use `checkRateLimit()`

### 3. CORS Security ✅
- **Implementation**: Secure CORS with origin validation
- **Location**: `lib/cors.ts` and `next.config.ts`
- **Requirements**:
  - ✅ **NO wildcard `*`** in production
  - ✅ Only trusted origins allowed
  - ✅ Proper preflight request handling
  - ✅ Credentials support for authenticated requests
  - ✅ Development mode support (localhost)
- **Allowed Origins**:
  - Production domains
  - Farcaster domains (if applicable)
  - Base domains (if applicable)
  - Localhost (development only)
- **Files to Check**:
  - `lib/cors.ts` - CORS utility functions
  - All API routes - Should use CORS utility

### 4. Content Security Policy (CSP) ✅
- **Implementation**: Comprehensive CSP headers
- **Location**: `next.config.ts`
- **Requirements**:
  - ✅ `default-src 'self'` - Restrictive default
  - ✅ `script-src` - Only allow necessary scripts
  - ✅ `img-src` - Allow HTTPS images and IPFS gateways
  - ✅ `connect-src` - Only trusted API endpoints
  - ✅ `frame-ancestors` - Only allow embedding from trusted domains (Farcaster/Base)
  - ✅ `upgrade-insecure-requests` - Force HTTPS
- **Files to Check**:
  - `next.config.ts` - CSP configuration in `headers()` function

### 5. Security Headers ✅
- **Implementation**: Additional security headers
- **Location**: `next.config.ts`
- **Required Headers**:
  - ✅ `Strict-Transport-Security` (HSTS): `max-age=31536000; includeSubDomains; preload`
  - ✅ `X-Content-Type-Options`: `nosniff`
  - ✅ `Referrer-Policy`: `strict-origin-when-cross-origin`
  - ✅ `Permissions-Policy`: Restrict browser APIs (camera, microphone, geolocation)
  - ✅ `X-XSS-Protection`: `1; mode=block` (legacy support)
- **Files to Check**:
  - `next.config.ts` - Security headers in `headers()` function

### 6. Input Validation ✅
- **Implementation**: Frontend and backend validation
- **Location**: `lib/input-validation.ts`
- **Requirements**:
  - ✅ JSON depth validation (max 32 levels) - Prevents DoS attacks
  - ✅ Size limits (1MB max JSON) - Prevents memory exhaustion
  - ✅ Frontend form validation
  - ✅ Backend API validation
  - ✅ Security event logging for validation failures
- **Files to Check**:
  - `lib/input-validation.ts` - Validation utilities
  - `lib/security-monitoring.ts` - Security event logging
  - All API routes - Should use `safeJsonParse()`

### 7. API Keys Security ✅
- **Implementation**: Environment variables
- **Requirements**:
  - ✅ Server-side API keys use `process.env.*` (NOT `NEXT_PUBLIC_*`)
  - ✅ Client-side public keys use `NEXT_PUBLIC_*` prefix
  - ✅ API keys validated on server-side only
  - ✅ `.env.local` in `.gitignore`
  - ✅ Never commit API keys to repository
  - ✅ Use Vercel environment variables for production
- **Example**:
  ```typescript
  // ✅ CORRECT: Server-side only
  const apiKey = process.env.PINATA_API_KEY
  
  // ✅ CORRECT: Public keys (safe to expose)
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  ```

### 8. HTTPS Enforcement ✅
- **Implementation**: Vercel automatic HTTPS
- **Requirements**:
  - ✅ All deployments use HTTPS
  - ✅ No HTTP endpoints exposed
  - ✅ HSTS header configured
  - ✅ SSL/TLS certificates managed automatically
- **Files to Check**:
  - Vercel project settings
  - `next.config.ts` - HSTS header

### 9. Dependency Security ✅
- **Implementation**: Automated dependency updates
- **Requirements**:
  - ✅ Dependabot configured (`.github/dependabot.yml`)
  - ✅ Regular `npm audit` checks
  - ✅ Keep dependencies up to date
  - ✅ Monitor security advisories
- **Files to Check**:
  - `.github/dependabot.yml` - Dependabot configuration
  - `package.json` - Dependency versions

### 10. Automated Code Review ✅
- **Implementation**: CodeRabbit integration
- **Requirements**:
  - ✅ CodeRabbit configuration (`.coderabbit.yaml`)
  - ✅ GitHub app installed
  - ✅ PR reviews enabled
- **Files to Check**:
  - `.coderabbit.yaml` - CodeRabbit configuration

## 🚀 Performance & UX Requirements

### 11. Wallet Connection Performance ✅
- **Requirements**:
  - ✅ Optimized connector initialization (reduced timeouts)
  - ✅ ENS resolution caching (10 minutes)
  - ✅ Reduced retries (1 retry instead of 2)
  - ✅ Disabled refetch on window focus
  - ✅ Proper error handling and user feedback
- **Files to Check**:
  - `components/wallet/WalletConnect.tsx` - Connection logic
  - `lib/wagmi.ts` - Wagmi configuration

### 12. Network Switching ✅
- **Requirements**:
  - ✅ Proper chain detection (avoid false positives)
  - ✅ Prevent unnecessary network switches
  - ✅ Handle iOS Safari edge cases
  - ✅ Double-check chain ID from multiple sources
- **Files to Check**:
  - `lib/chain-detection.ts` - Chain detection with caching
  - `app/verifier/page.tsx` - Network switching logic

### 13. Transaction Handling ✅
- **Requirements**:
  - ✅ Proper polling with timeout
  - ✅ Success modal only shows when transaction actually succeeds
  - ✅ Handle stuck transactions with refresh button
  - ✅ Auto-refresh after timeout (10 seconds)
- **Files to Check**:
  - `app/page.tsx` - Transaction polling
  - `app/cleanup/page.tsx` - Submission handling
  - `components/ui/transaction-modal.tsx` - Modal component

### 14. UI/UX Improvements ✅
- **Requirements**:
  - ✅ Wallet text display fixes (no overlap in RainbowKit modal)
  - ✅ Transaction modal z-index (visible in Farcaster iframes)
  - ✅ Refresh buttons for stuck submissions
  - ✅ Proper error messages and user feedback
- **Files to Check**:
  - `app/globals.css` - Wallet modal CSS fixes
  - `components/ui/transaction-modal.tsx` - Modal z-index

## 📱 Farcaster Mini App Requirements

### 15. Farcaster Integration ✅
- **Requirements**:
  - ✅ Farcaster Mini App SDK integration
  - ✅ Environment detection (web vs Farcaster)
  - ✅ "Add to Farcaster" functionality
  - ✅ Social sharing (X, Telegram, Farcaster)
- **Files to Check**:
  - `components/farcaster/FarcasterProvider.tsx`
  - `components/onboarding/AddAppModal.tsx`
  - `app/cleanup/page.tsx` - Social sharing

### 16. Farcaster-Specific Features ✅
- **Requirements**:
  - ✅ Skip CAPTCHA/Bot checks in Farcaster (if applicable)
  - ✅ Proper iframe handling
  - ✅ Farcaster wallet connector support
  - ✅ Base network integration
- **Files to Check**:
  - `lib/farcaster-detection.ts`
  - `components/farcaster/FarcasterWalletProvider.tsx`

## 🔧 Code Quality Requirements

### 17. Error Handling ✅
- **Requirements**:
  - ✅ Graceful error handling for RPC calls
  - ✅ Retry logic with timeout
  - ✅ User-friendly error messages
  - ✅ Error logging for debugging
- **Files to Check**:
  - `lib/contracts.ts` - RPC error handling
  - `lib/verification.ts` - Error handling
  - `components/navigation/BottomNav.tsx` - Error handling

### 18. TypeScript & Linting ✅
- **Requirements**:
  - ✅ TypeScript strict mode
  - ✅ ESLint configured
  - ✅ No TypeScript errors
  - ✅ No linting errors
- **Files to Check**:
  - `tsconfig.json` - TypeScript configuration
  - `eslint.config.mjs` - ESLint configuration

### 19. Testing ✅
- **Requirements**:
  - ✅ Unit tests for critical functions
  - ✅ Input validation tests
  - ✅ Test coverage for security-critical code
- **Files to Check**:
  - `__tests__/` directory
  - `jest.config.js` - Jest configuration

## 📋 Verification Checklist

Use this checklist to verify your application meets all requirements:

### Security
- [ ] Bot Protection implemented (Vercel Bot ID)
- [ ] Rate limiting on all API endpoints
- [ ] CORS configured (no wildcard)
- [ ] CSP headers configured
- [ ] Security headers (HSTS, X-Content-Type-Options, etc.)
- [ ] Input validation (frontend + backend)
- [ ] API keys in environment variables (not in code)
- [ ] HTTPS enforced
- [ ] Dependabot configured
- [ ] CodeRabbit configured

### Performance & UX
- [ ] Wallet connection optimized
- [ ] Network switching handled properly
- [ ] Transaction handling with proper polling
- [ ] UI/UX improvements (no text overlap, proper modals)
- [ ] Error handling and user feedback

### Farcaster Integration
- [ ] Farcaster SDK integrated
- [ ] Environment detection
- [ ] Social sharing (X, Telegram, Farcaster)
- [ ] Farcaster-specific features

### Code Quality
- [ ] Error handling implemented
- [ ] TypeScript strict mode
- [ ] ESLint configured
- [ ] Tests written

## 🚨 Critical Production Requirements

### Must Have Before Production:
1. ✅ Bot Protection enabled
2. ✅ Rate limiting (consider Redis for multi-instance)
3. ✅ CORS configured (no wildcard)
4. ✅ CSP headers
5. ✅ Security headers
6. ✅ Input validation
7. ✅ API keys in environment variables
8. ✅ HTTPS enforced
9. ✅ Error handling
10. ✅ Testing

### Should Have:
1. Dependabot configured
2. CodeRabbit configured
3. Security monitoring
4. Performance monitoring
5. Error tracking (Sentry, etc.)

## 📚 Reference Files

Key files to review for implementation examples:
- `SECURITY_AUDIT.md` - Comprehensive security audit
- `proxy.ts` - Bot protection and domain redirects
- `lib/rate-limit.ts` - Rate limiting implementation
- `lib/cors.ts` - CORS utility
- `lib/input-validation.ts` - Input validation
- `next.config.ts` - CSP and security headers
- `components/wallet/WalletConnect.tsx` - Wallet connection
- `lib/chain-detection.ts` - Chain detection

## 🔗 External Resources

- [Vercel Bot ID Documentation](https://vercel.com/docs/botid/get-started)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Best Practices](https://developer.mozilla.org/en-US/docs/Web/Security)

---

**Last Updated**: 2025-01-27  
**Version**: 1.0

