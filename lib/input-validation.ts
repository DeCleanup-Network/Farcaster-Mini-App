/**
 * Input validation utilities to prevent DoS attacks via deeply nested data
 * 
 * Protects against the Node.js stack overflow vulnerability:
 * https://nodejs.org/en/blog/vulnerability/january-2026-dos-mitigation-async-hooks
 */

import { logSecurityEvent, getClientIP, getUserAgent } from './security-monitoring'

const MAX_JSON_DEPTH = 32 // Reasonable limit for most use cases
const MAX_JSON_SIZE = 1024 * 1024 // 1MB max JSON string size

/**
 * Calculate the maximum depth of a nested object/array structure
 */
function calculateDepth(obj: any, currentDepth = 0, maxDepth = 0): number {
  if (currentDepth > maxDepth) {
    maxDepth = currentDepth
  }

  if (maxDepth >= MAX_JSON_DEPTH) {
    return maxDepth // Early exit if we've exceeded limit
  }

  if (obj === null || obj === undefined) {
    return maxDepth
  }

  if (typeof obj !== 'object') {
    return maxDepth
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      maxDepth = calculateDepth(item, currentDepth + 1, maxDepth)
      if (maxDepth >= MAX_JSON_DEPTH) {
        break // Early exit
      }
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        maxDepth = calculateDepth(obj[key], currentDepth + 1, maxDepth)
        if (maxDepth >= MAX_JSON_DEPTH) {
          break // Early exit
        }
      }
    }
  }

  return maxDepth
}

/**
 * Safely parse JSON with depth validation
 * Throws an error if the JSON is too deeply nested
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  maxDepth: number = MAX_JSON_DEPTH,
  context?: { endpoint?: string; request?: Request | { headers: Headers | { get: (key: string) => string | null } } }
): T {
  // Check size first (quick check)
  if (jsonString.length > MAX_JSON_SIZE) {
    const error = new Error(`JSON string exceeds maximum size of ${MAX_JSON_SIZE} bytes`)
    
    // Log security event
    if (context?.endpoint && context?.request) {
      logSecurityEvent(
        'size_validation_failure',
        context.endpoint,
        {
          size: jsonString.length,
          maxSize: MAX_JSON_SIZE,
          error: error.message,
        },
        {
          ip: getClientIP(context.request),
          userAgent: getUserAgent(context.request),
        }
      )
    }
    
    throw error
  }

  // Parse JSON
  let parsed: any
  try {
    parsed = JSON.parse(jsonString)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Check depth (calculateDepth returns max depth found, starting from root at depth 0)
  // So a 50-level nested object will have depth 50, which exceeds maxDepth of 32
  const depth = calculateDepth(parsed)
  if (depth >= maxDepth) {
    const error = new Error(
      `JSON structure exceeds maximum depth of ${maxDepth} levels (found ${depth} levels). ` +
      `This may be an attempt to exploit a security vulnerability.`
    )
    
    // Log security event for monitoring
    if (context?.endpoint && context?.request) {
      logSecurityEvent(
        'depth_validation_failure',
        context.endpoint,
        {
          depth,
          maxDepth,
          error: error.message,
        },
        {
          ip: getClientIP(context.request),
          userAgent: getUserAgent(context.request),
        }
      )
    }
    
    throw error
  }

  return parsed as T
}

/**
 * Validate that an object doesn't exceed maximum depth
 */
export function validateObjectDepth(
  obj: any,
  maxDepth: number = MAX_JSON_DEPTH
): void {
  const depth = calculateDepth(obj)
  if (depth > maxDepth) {
    throw new Error(
      `Object structure exceeds maximum depth of ${maxDepth} levels (found ${depth} levels)`
    )
  }
}

/**
 * Recursively process nested data with depth limit
 * Prevents stack overflow from user-controlled recursion depth
 */
export function processNestedData<T, R>(
  data: T,
  processor: (item: T) => R,
  maxDepth: number = MAX_JSON_DEPTH,
  currentDepth: number = 0
): R {
  if (currentDepth > maxDepth) {
    throw new Error(
      `Recursion depth exceeded maximum of ${maxDepth} levels. ` +
      `This may be an attempt to exploit a security vulnerability.`
    )
  }

  return processor(data)
}

/**
 * Safely process arrays with depth limit
 */
export function processArray<T, R>(
  array: T[],
  processor: (item: T, index: number) => R,
  maxDepth: number = MAX_JSON_DEPTH,
  currentDepth: number = 0
): R[] {
  if (currentDepth > maxDepth) {
    throw new Error(
      `Array processing depth exceeded maximum of ${maxDepth} levels`
    )
  }

  return array.map((item, index) => {
    if (Array.isArray(item)) {
      return processArray(item, processor, maxDepth, currentDepth + 1) as any
    } else if (item && typeof item === 'object') {
      return processNestedData(item, (data) => processor(data as T, index), maxDepth, currentDepth + 1)
    }
    return processor(item, index)
  })
}

