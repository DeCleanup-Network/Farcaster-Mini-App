/**
 * Security monitoring utilities for tracking validation failures and potential attacks
 * 
 * Logs depth validation failures to help identify DoS attack attempts
 */

interface SecurityEvent {
  type: 'depth_validation_failure' | 'size_validation_failure' | 'rate_limit_exceeded'
  endpoint: string
  ip?: string
  userAgent?: string
  details: {
    depth?: number
    maxDepth?: number
    size?: number
    maxSize?: number
    error?: string
  }
  timestamp: string
}

/**
 * Log security event for monitoring
 */
export function logSecurityEvent(
  type: SecurityEvent['type'],
  endpoint: string,
  details: SecurityEvent['details'],
  request?: { ip?: string; userAgent?: string }
): void {
  const event: SecurityEvent = {
    type,
    endpoint,
    ip: request?.ip,
    userAgent: request?.userAgent,
    details,
    timestamp: new Date().toISOString(),
  }

  // Log to console (in production, this should go to a monitoring service)
  console.warn('[SECURITY EVENT]', JSON.stringify(event, null, 2))

  // In production, you might want to:
  // - Send to monitoring service (Datadog, Sentry, etc.)
  // - Store in database for analysis
  // - Alert if threshold exceeded
  // - Track IP addresses for blocking
}

/**
 * Extract client IP from request (works with both Request and NextRequest)
 */
export function getClientIP(request: Request | { headers: Headers | { get: (key: string) => string | null } }): string | undefined {
  // Try various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return undefined
}

/**
 * Extract user agent from request (works with both Request and NextRequest)
 */
export function getUserAgent(request: Request | { headers: Headers | { get: (key: string) => string | null } }): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Check if an IP should be blocked based on security events
 * This is a simple in-memory implementation - use Redis/database in production
 */
const blockedIPs = new Map<string, { count: number; blockedUntil: number }>()
const MAX_FAILURES_PER_IP = 10
const BLOCK_DURATION_MS = 60 * 60 * 1000 // 1 hour

export function isIPBlocked(ip: string): boolean {
  const blockInfo = blockedIPs.get(ip)
  if (!blockInfo) {
    return false
  }

  if (Date.now() > blockInfo.blockedUntil) {
    // Block expired, remove it
    blockedIPs.delete(ip)
    return false
  }

  return true
}

export function recordSecurityFailure(ip: string | undefined): void {
  if (!ip) {
    return
  }

  const blockInfo = blockedIPs.get(ip) || { count: 0, blockedUntil: 0 }
  blockInfo.count += 1

  if (blockInfo.count >= MAX_FAILURES_PER_IP) {
    blockInfo.blockedUntil = Date.now() + BLOCK_DURATION_MS
    console.warn(`[SECURITY] IP ${ip} blocked for ${BLOCK_DURATION_MS / 1000 / 60} minutes due to ${blockInfo.count} security failures`)
  }

  blockedIPs.set(ip, blockInfo)
}

/**
 * Get security statistics (for monitoring dashboard)
 */
export function getSecurityStats(): {
  blockedIPs: number
  totalBlocks: number
} {
  const now = Date.now()
  let activeBlocks = 0
  let totalBlocks = 0

  for (const [ip, blockInfo] of blockedIPs.entries()) {
    if (now < blockInfo.blockedUntil) {
      activeBlocks++
    }
    totalBlocks += blockInfo.count
  }

  return {
    blockedIPs: activeBlocks,
    totalBlocks,
  }
}

