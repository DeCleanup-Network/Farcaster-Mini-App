# Critical: Node.js Security Update Required

## ⚠️ Security Vulnerability

**CVE**: Denial-of-Service via Unrecoverable Stack Space Exhaustion  
**Reference**: [Node.js Security Release - January 2026](https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks)

## Impact

This vulnerability affects **all Next.js applications** because Next.js uses `AsyncLocalStorage` (which uses `async_hooks`) for request context tracking. When stack space is exhausted, Node.js crashes with exit code 7 instead of throwing a catchable error, making applications vulnerable to DoS attacks.

## Affected Versions

- **Node.js 20.x**: Requires **20.20.0+** (patched)
- **Node.js 22.x**: Requires **22.22.0+** (patched)
- **Node.js 24.x**: **Not affected** (AsyncLocalStorage reimplemented without async_hooks)
- **Node.js 25.x**: **Not affected**

## Immediate Action Required

### 1. Update Local Development

```bash
# Update Node.js to patched version
nvm install 20.20.0
nvm use 20.20.0

# Or upgrade to Node.js 24.13.0+ (recommended - not affected)
nvm install 24.13.0
nvm use 24.13.0
```

### 2. Update Vercel Configuration

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**
2. Set **Node.js Version** to:
   - `20.20.0` (minimum patched version)
   - `24.13.0` (recommended - completely avoids the issue)
3. **Redeploy** your application

### 3. Verify Configuration

The project is already configured with:
- ✅ `package.json` engines field: `>=20.20.0 <21.0.0`
- ✅ `.nvmrc` file: `20.20.0`

## Why This Affects Next.js

Next.js uses `AsyncLocalStorage` internally for:
- Request context tracking
- Cookie and header management
- Server component rendering context

This means **every Next.js application** is affected when running on Node.js 20.x or 22.x without the patch.

## Attack Vector

An attacker can crash your server by sending deeply nested JSON:

```javascript
// Vulnerable API route
export default async function handler(req, res) {
  try {
    const data = req.body; // Attacker sends 50,000 levels of nesting
    const result = processNestedData(data); // Stack overflow
    res.json({ result });
  } catch (err) {
    // THIS NEVER RUNS - Server crashes with exit code 7
    res.status(500).json({ error: 'Failed' });
  }
}
```

## Additional Recommendations

1. **Upgrade to Node.js 24+** if possible (completely avoids the issue)
2. **Validate input depth** in API routes processing nested data
3. **Limit recursion depth** in user-controlled code paths
4. **Don't rely on stack overflow errors** for security - always validate input

## References

- [Node.js Security Release Blog](https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks)
- Reported by React/Next.js teams (December 2025)
- Fixed by Matteo Collina and Anna Henningsen (January 2026)

## Status

- ✅ Package.json updated to require Node.js 20.20.0+ (allows up to 24.x)
- ✅ .nvmrc file updated to 24.13.0 (recommended - not affected by vulnerability)
- ✅ Input validation added to all API routes
- ✅ Rate limiting implemented
- ✅ Security monitoring and logging added
- ⚠️ **Action Required**: Update Vercel Node.js version to 24.13.0+ (recommended) or 20.20.0+ (minimum)

