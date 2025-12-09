n# Security Audit Report - DeCleanup Mini App

**Date:** December 8, 2024  
**Auditor:** Security Engineer  
**Context:** Post-incident audit following production server compromise (crypto-mining malware)

---

## Executive Summary

This audit was conducted following a serious security incident where the production server was compromised and used for crypto-mining. The attacker likely exploited a React/Next.js vulnerability (possibly CVE-2025-66478 or similar) and gained persistence through a Docker container running as `root`.

**Critical Finding:** No Dockerfile exists in the repository, yet the app is deployed via Docker/Coolify. This means deployment configuration is managed externally, making it impossible to audit container security from this codebase.

---

## 🔴 CRITICAL VULNERABILITIES (Fix Immediately)

### 1. Secret Exposure via NEXT_PUBLIC_ Fallback
**Severity:** 🔴 **CRITICAL**  
**Type:** Secret Leakage  
**Location:** `app/api/ipfs/upload/route.ts:10-11`

**Issue:**
```typescript
const pinataApiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY
const pinataSecretKey = process.env.PINATA_SECRET_KEY || process.env.NEXT_PUBLIC_PINATA_SECRET_KEY
```

**Why it's dangerous:**
- If `PINATA_API_KEY` is not set, the code falls back to `NEXT_PUBLIC_PINATA_API_KEY`
- `NEXT_PUBLIC_*` variables are **exposed to the client-side JavaScript bundle**
- This means your Pinata API keys could be visible in the browser's source code
- An attacker could extract these keys and abuse your Pinata account

**Fix:**
```typescript
// Remove fallback to NEXT_PUBLIC_ - these should NEVER be used for secrets
const pinataApiKey = process.env.PINATA_API_KEY
const pinataSecretKey = process.env.PINATA_SECRET_KEY

if (!pinataApiKey || !pinataSecretKey) {
  return NextResponse.json(
    { error: 'Pinata API keys not configured on server' },
    { status: 500 }
  )
}
```

---

### 2. Missing Dockerfile (Deployment Configuration Unknown)
**Severity:** 🔴 **CRITICAL**  
**Type:** Container Escape Risk / Misconfiguration  
**Location:** Repository root (file missing)

**Issue:**
- No `Dockerfile` exists in the repository
- The app is deployed via Coolify using Nixpacks
- You cannot audit how the container is built or what user it runs as
- Based on your incident, the container was running as `root` (Coolify/Nixpacks default)

**Why it's dangerous:**
- If the container runs as `root`, any code execution vulnerability can:
  - Install cron jobs on the host (`/var/spool/cron/root`)
  - Modify systemd services
  - Access host filesystems
  - Install persistence mechanisms
- This is exactly what happened in your incident

**Fix:**
Create a hardened `Dockerfile` (see recommended Dockerfile below)

---

### 3. No File Type Validation on Uploads
**Severity:** 🟡 **HIGH**  
**Type:** File Upload Vulnerability  
**Location:** `app/api/ipfs/upload/route.ts:22-40`

**Issue:**
```typescript
const file = formData.get('file') as File
// ... only checks size, not file type
if (file.size > MAX_FILE_SIZE) { ... }
```

**Why it's dangerous:**
- No MIME type validation
- No file extension validation
- An attacker could upload executable files, scripts, or malicious content
- While Pinata may reject some types, you should validate before forwarding

**Fix:**
```typescript
// Add after file size check
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

if (!ALLOWED_MIME_TYPES.includes(file.type)) {
  return NextResponse.json(
    { error: `Invalid file type: ${file.type}. Only images are allowed.` },
    { status: 400 }
  )
}

// Also validate extension
const fileName = file.name.toLowerCase()
const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))
if (!hasValidExtension) {
  return NextResponse.json(
    { error: 'Invalid file extension. Only image files are allowed.' },
    { status: 400 }
  )
}
```

---

## 🟡 HIGH PRIORITY ISSUES

### 4. Unsafe JSON Parsing
**Severity:** 🟡 **HIGH**  
**Type:** Deserialization Risk  
**Location:** `app/api/ipfs/upload/route.ts:47-86`

**Issue:**
```typescript
const metadata = JSON.parse(metadataStr)
const options = JSON.parse(optionsStr)
```

**Why it's dangerous:**
- No validation of parsed JSON structure
- If an attacker controls `metadataStr` or `optionsStr`, they could pass:
  - Extremely large objects (DoS)
  - Prototype pollution payloads
  - Malformed data that crashes the server

**Fix:**
```typescript
// Add validation function
function validateMetadata(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false
  }
  // Limit object size
  if (JSON.stringify(obj).length > 10000) {
    return false
  }
  // Validate expected structure
  if (obj.name && typeof obj.name !== 'string') return false
  if (obj.keyvalues && typeof obj.keyvalues !== 'object') return false
  return true
}

// Use it:
try {
  const metadata = JSON.parse(metadataStr)
  if (!validateMetadata(metadata)) {
    throw new Error('Invalid metadata structure')
  }
  pinataFormData.append('pinataMetadata', JSON.stringify(metadata))
} catch (e) {
  // Use default metadata
}
```

---

### 5. Environment Variable Exposure Risk
**Severity:** 🟡 **MEDIUM**  
**Type:** Secret Leakage  
**Location:** Multiple files using `NEXT_PUBLIC_*` for potentially sensitive data

**Issues Found:**
- `lib/wagmi.ts:78` - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (OK - this is meant to be public)
- `app/api/ipfs/upload/route.ts:10-11` - Fallback to `NEXT_PUBLIC_PINATA_API_KEY` (CRITICAL - see #1)
- Many contract addresses use `NEXT_PUBLIC_*` (OK - these are meant to be public)

**Recommendation:**
- Audit all `NEXT_PUBLIC_*` variables
- Ensure no secrets are exposed via this prefix
- Document which variables are intentionally public

---

### 6. No Rate Limiting on API Routes
**Severity:** 🟡 **MEDIUM**  
**Type:** DoS Risk  
**Location:** `app/api/ipfs/upload/route.ts`

**Issue:**
- No rate limiting on the IPFS upload endpoint
- An attacker could:
  - Spam uploads to exhaust Pinata API quota
  - Cause DoS by uploading many large files
  - Waste server resources

**Fix:**
Implement rate limiting using Next.js middleware or a library like `@upstash/ratelimit`:

```typescript
// middleware.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
})

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/ipfs/upload')) {
    const ip = request.ip ?? '127.0.0.1'
    const { success } = await ratelimit.limit(ip)
    if (!success) {
      return new NextResponse('Rate limit exceeded', { status: 429 })
    }
  }
}
```

---

## 🟢 MEDIUM PRIORITY ISSUES

### 7. Missing Security Headers
**Severity:** 🟢 **MEDIUM**  
**Type:** Misconfiguration  
**Location:** `next.config.ts`

**Issue:**
- No security headers configured
- Missing CSP, X-Frame-Options, etc.

**Fix:**
Add to `next.config.ts`:
```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
    // ... existing .well-known headers
  ]
}
```

---

### 8. Dependency Versions
**Severity:** 🟢 **LOW**  
**Type:** Dependency Vulnerability  
**Location:** `package.json`

**Current Versions:**
- `next: ^16.0.7` - Recent, but check for CVE-2025-66478 patches
- `react: ^19.2.1` - Very new, monitor for vulnerabilities
- `node-fetch: ^2.7.0` - Old version, consider upgrading

**Recommendation:**
- Run `npm audit` regularly (currently shows 0 vulnerabilities - good!)
- Monitor Next.js security advisories
- Consider pinning exact versions in production

---

## ✅ POSITIVE FINDINGS

1. **No eval/Function/vm usage** - Good, no code injection risks
2. **No shell command execution** - No `exec`, `spawn`, etc. in runtime code
3. **File system operations only in scripts** - Not exposed via API routes
4. **No user-controlled fetch URLs** - All external requests are to known services
5. **npm audit shows 0 vulnerabilities** - Dependencies are currently clean

---

## 🐳 RECOMMENDED HARDENED DOCKERFILE

Since no Dockerfile exists, here's a production-ready, hardened version:

```dockerfile
# Multi-stage build for smaller, more secure image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry and set production mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the application
CMD ["node", "server.js"]
```

**Key Security Features:**
- ✅ Runs as non-root user (`nextjs:nodejs`)
- ✅ Multi-stage build (smaller attack surface)
- ✅ Alpine Linux base (minimal dependencies)
- ✅ No shell/compilers in final image
- ✅ Proper file ownership

**Note:** This assumes Next.js standalone output. If using a different build mode, adjust accordingly.

---

## 📋 IMMEDIATE FIXES (Do Before Next Deployment)

1. ✅ **Fix secret fallback** in `app/api/ipfs/upload/route.ts` (remove `NEXT_PUBLIC_*` fallback)
2. ✅ **Add file type validation** to IPFS upload endpoint
3. ✅ **Create and use hardened Dockerfile** (run as non-root)
4. ✅ **Add security headers** to `next.config.ts`
5. ✅ **Implement rate limiting** on API routes

---

## 🔧 MEDIUM-TERM HARDENING

1. **Add input validation library** (e.g., `zod`) for all API routes
2. **Implement request logging** and monitoring
3. **Add health check endpoint** for container monitoring
4. **Set up resource limits** in Docker/Coolify:
   ```yaml
   # In Coolify or docker-compose
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```
5. **Enable container security scanning** (e.g., Trivy, Snyk)

---

## 🔄 ONGOING PRACTICES

1. **Dependency Updates:**
   - Run `npm audit` weekly
   - Subscribe to Next.js security advisories
   - Update dependencies promptly when patches are released

2. **Monitoring:**
   - Monitor CPU/memory usage (alert on >80% sustained)
   - Log all API requests
   - Set up alerts for:
     - Unusual outbound connections
     - High CPU usage
     - Failed authentication attempts

3. **Deployment:**
   - Never run containers as root
   - Use read-only filesystems where possible
   - Implement network policies (restrict egress)
   - Regular security scans of container images

4. **Code Review:**
   - Review all API routes for input validation
   - Never use `NEXT_PUBLIC_*` for secrets
   - Validate all user inputs
   - Use TypeScript strictly (no `any` types)

---

## 📊 RISK SUMMARY

| Risk Level | Count | Status |
|------------|-------|--------|
| 🔴 Critical | 2 | Must fix before deployment |
| 🟡 High | 2 | Fix within 1 week |
| 🟢 Medium | 4 | Fix within 1 month |
| ✅ Low | 0 | Monitor |

---

## 🎯 CONCLUSION

The codebase itself is relatively secure, but **critical deployment misconfigurations** (running as root, missing Dockerfile) made the incident possible. The main code vulnerabilities are:

1. **Secret exposure risk** (fallback to NEXT_PUBLIC_)
2. **Missing file validation** (upload endpoint)
3. **No container hardening** (no Dockerfile = unknown security posture)

**Priority:** Fix the secret fallback and create a hardened Dockerfile immediately. These are the highest-risk items that could lead to another compromise.

---

**Next Steps:**
1. Review and implement fixes for Critical and High issues
2. Create the hardened Dockerfile
3. Test deployment with non-root user
4. Set up monitoring and alerting
5. Schedule regular security audits

