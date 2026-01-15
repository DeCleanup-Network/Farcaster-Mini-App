# API Security Review - Input Validation

## Summary

Completed security review of all API routes to protect against the Node.js stack overflow vulnerability ([CVE-2025-XXXXX](https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks)).

## Changes Made

### 1. Created Input Validation Utility (`lib/input-validation.ts`)

**Functions:**
- `safeJsonParse()` - Safely parse JSON with depth validation
- `validateObjectDepth()` - Validate object depth without parsing
- `processNestedData()` - Process nested data with depth limit
- `processArray()` - Process arrays with depth limit

**Features:**
- Maximum JSON depth: 32 levels (configurable per use case)
- Maximum JSON size: 1MB
- Early exit on depth limit exceeded
- Clear error messages for security violations

### 2. Updated API Routes

#### `/api/ipfs/upload` (POST)
- ✅ Added depth validation for `metadata` JSON (max 10 levels)
- ✅ Added depth validation for `options` JSON (max 5 levels)
- ✅ Added depth validation for Pinata error responses (max 5 levels)
- ✅ Added depth validation for Pinata success responses (max 5 levels)

#### `/api/ipfs/fetch` (GET)
- ✅ Added depth validation for IPFS JSON content (max 20 levels)
- ⚠️ **Note**: IPFS content is external and could be malicious, so validation is critical

#### `/api/neynar/user-by-fid` (GET)
- ✅ Added depth validation for Neynar API responses (max 10 levels)

#### `/api/neynar/user-by-custody-address` (GET)
- ✅ Added depth validation for Neynar API responses (max 10 levels)

#### `/api/snapchain/user-by-fid` (GET)
- ✅ Added depth validation for Snapchain API responses (max 15 levels)
- ⚠️ **Note**: Snapchain responses can be nested (messages array), so higher limit

### 3. Routes Reviewed (No Changes Needed)

#### `/api/og` (GET)
- ✅ Safe: Only processes query parameters (no nested JSON)
- ✅ No user-controlled recursion

#### `/api/health` (GET)
- ✅ Safe: No user input, only returns system status

## Security Best Practices Applied

1. **Defense in Depth**: Multiple layers of protection
   - Node.js version upgrade (20.20.0+)
   - Input validation on all JSON parsing
   - Depth limits appropriate for each use case

2. **Fail Secure**: All validation failures result in safe error responses
   - Invalid JSON → 400 Bad Request
   - Too deeply nested → 400 Bad Request with clear error message
   - External API errors → Graceful fallback

3. **Appropriate Limits**:
   - Metadata: 10 levels (simple key-value structure)
   - Options: 5 levels (flat configuration)
   - IPFS content: 20 levels (may contain nested structures)
   - User data: 10-15 levels (API responses)

## No Recursive Functions Found

✅ **No vulnerable recursive functions** found in API routes that process user-controlled input.

All recursive operations are:
- Limited by depth checks
- Not controlled by user input
- Protected by early exit conditions

## Testing

### Automated Tests

✅ **Test suite created**: `__tests__/lib/input-validation.test.ts`

Run tests:
```bash
npm test -- __tests__/lib/input-validation.test.ts
```

### Manual Testing

✅ **Test script created**: `scripts/test-input-validation.js`

Run manual tests:
```bash
# Start dev server first
npm run dev

# In another terminal
npm run test:validation

# Or test against production
TEST_URL=https://your-domain.com npm run test:validation
```

### Test Scenarios

1. **Deeply nested JSON** (should be rejected):
   ```bash
   curl -X POST http://localhost:3000/api/ipfs/upload \
     -F "file=@test.jpg" \
     -F 'metadata={"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":{"k":"too deep"}}}}}}}}}}}'
   # Should return 400 error or use default metadata
   ```

2. **Rate limiting** (should be rejected after limit):
   ```bash
   # Make 11 requests quickly
   for i in {1..11}; do
     curl -X POST http://localhost:3000/api/ipfs/upload -F "file=@test.jpg"
   done
   # 11th request should return 429
   ```

3. **Monitor security stats**:
   ```bash
   curl http://localhost:3000/api/security/stats
   ```

### Monitoring

✅ **Security event logging** implemented:
- All validation failures are logged with IP, user agent, and details
- Logs include: `[SECURITY EVENT]` prefix
- Check application logs for security events

✅ **Security statistics endpoint**:
- `GET /api/security/stats` - View current stats
- Returns: blocked IPs count, total security failures

### Production Monitoring Recommendations

1. **Set up log aggregation** (Datadog, Sentry, etc.)
2. **Create alerts** for:
   - Multiple depth validation failures from same IP
   - Rate limit violations
   - IP blocking events
3. **Review security stats** regularly
4. **Analyze patterns** in security events

## Future Considerations

1. **Rate Limiting**: Consider adding rate limiting to prevent abuse
2. **Monitoring**: Alert on repeated depth validation failures
3. **Upgrade Path**: Consider upgrading to Node.js 24+ (completely avoids the issue)

## References

- [Node.js Security Release](https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks)
- [Input Validation Utility](../lib/input-validation.ts)

