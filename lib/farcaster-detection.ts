/**
 * Farcaster environment detection utilities
 * Determines if the app is running inside Farcaster Mini App
 * and whether Farcaster Wallet is available
 */

/**
 * Check if the app is running inside Farcaster Mini App
 * Uses multiple detection methods for reliability
 */
export const isFarcaster = (): boolean => {
  if (typeof window === 'undefined') return false

  try {
    // Method 1: Check user agent
    const userAgent = navigator.userAgent || ''
    if (userAgent.includes('Farcaster') || userAgent.includes('fc:frame')) {
      return true
    }

    // Method 2: Check if in iframe (Farcaster apps run in iframes)
    // Exclude localhost to avoid false positives in development
    if (window.parent !== window) {
      const hostname = window.location.hostname
      const isLocalhost = 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.includes('.local')
      
      // In iframe and not localhost - likely Farcaster
      if (!isLocalhost) {
        return true
      }
    }

    // Method 3: Check for Farcaster SDK
    if ((window as any).farcaster?.sdk) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Check if Farcaster Wallet is available and connected
 */
export const isFarcasterWallet = (): boolean => {
  if (typeof window === 'undefined') return false

  try {
    const eth = (window as any).ethereum
    
    // Check if ethereum provider exists and is Farcaster
    if (eth?.isFarcaster === true || eth?.provider?.isFarcaster === true) {
      return true
    }

    // Check Farcaster SDK wallet provider
    if ((window as any).farcaster?.sdk?.wallet?.ethProvider) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Check if a feature should be locked
 * Features are locked when in Farcaster but Farcaster wallet is not connected
 */
export const isFeatureLocked = (): boolean => {
  return isFarcaster() && !isFarcasterWallet()
}

/**
 * Get the current environment type
 */
export const getEnvironment = (): 'farcaster' | 'browser' => {
  return isFarcaster() ? 'farcaster' : 'browser'
}

