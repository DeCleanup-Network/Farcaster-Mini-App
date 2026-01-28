/**
 * Timeout Utilities
 * 
 * Provides timeout wrappers for async operations with user-visible feedback.
 */

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeout: number) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Wrap an async operation with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(
        errorMessage || `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      ))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

/**
 * Retry an operation with exponential backoff and timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    timeoutMs?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
    onRetry?: (attempt: number, error: Error) => void
    /** If false, do not retry (throw immediately). E.g. use for 429 to avoid amplifying load. */
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeoutMs = 30000,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    onRetry,
    shouldRetry,
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(operation(), timeoutMs)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on timeout errors - they're likely network issues
      if (error instanceof TimeoutError) {
        throw error
      }

      // Don't retry when shouldRetry returns false (e.g. 429 to avoid amplifying rate-limit load)
      if (typeof shouldRetry === 'function' && !shouldRetry(lastError)) {
        throw lastError
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Call onRetry callback
      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Operation failed after retries')
}

/**
 * Create a timeout promise that can be cancelled
 */
export function createCancellableTimeout(timeoutMs: number): {
  promise: Promise<void>
  cancel: () => void
} {
  let timeoutId: NodeJS.Timeout | null = null
  let resolve: (() => void) | null = null
  let cancelled = false

  const promise = new Promise<void>((res) => {
    resolve = res
    if (!cancelled) {
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          res()
        }
      }, timeoutMs)
    }
  })

  const cancel = () => {
    cancelled = true
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (resolve) {
      resolve()
    }
  }

  return { promise, cancel }
}

