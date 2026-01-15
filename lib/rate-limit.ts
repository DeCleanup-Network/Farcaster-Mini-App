/**
 * Rate limiting utilities for API routes
 * 
 * Simple in-memory rate limiting (use Redis for production/distributed systems)
 */

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Check if request should be rate limited
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    cleanupExpiredEntries(now)
  }

  if (!entry || now >= entry.resetAt) {
    // Create new entry or reset expired entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return { allowed: true }
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(identifier, entry)
  return { allowed: true }
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Get rate limit identifier from request
 * Uses IP address by default, can be extended to use user ID, API key, etc.
 */
export function getRateLimitIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || 
             request.headers.get('x-real-ip') || 
             'unknown'

  // Include user agent for more granular limiting
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Use IP + user agent hash for identifier
  // In production, you might want to use just IP or user ID
  return `${ip}:${userAgent.slice(0, 50)}`
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // IPFS upload: 10 requests per minute
  IPFS_UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // IPFS fetch: 100 requests per minute
  IPFS_FETCH: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // Neynar API: 60 requests per minute
  NEYNAR_API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  // General API: 100 requests per minute
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
} as const

