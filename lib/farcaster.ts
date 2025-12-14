import { sdk } from '@farcaster/miniapp-sdk'

const APP_NAME = 'DeCleanup Rewards'
export const MINIAPP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'
const FARCASTER_HANDLE = '@base'
const REFERRAL_COPY_FARCASTER =
  'Join me in @decleanupnet Rewards! Clean up, share proof, earn tokens, and trade on Base\n\n'
const REFERRAL_COPY_WEB =
  'Join me in @decleanupnet Rewards! Clean up, share proof, earn tokens, and trade on @base.\n\n'
const REFERRAL_COPY_COPY =
  'Join me in DeCleanup Rewards! Clean up, share proof, earn tokens, and trade on Base.\n\n'

// Tip message for Farcaster app referrals
const FARCASTER_WALLET_TIP = '\n\nTip: Use Farcaster wallet for smooth experience'

// Profile share messages
export const formatReferralMessage = (
  referralLink: string,
  type: 'farcaster' | 'web' | 'copy' = 'copy'
) => {
  const copy =
    type === 'farcaster'
      ? REFERRAL_COPY_FARCASTER
      : type === 'web'
      ? REFERRAL_COPY_WEB
      : REFERRAL_COPY_COPY
  
  // Add tip message only for Farcaster app referrals
  const tip = type === 'farcaster' ? FARCASTER_WALLET_TIP : ''
  
  // For Farcaster, put link inline in the message so it's clickable
  // Links need to be inline in Farcaster/Warpcast to be pressable
  if (type === 'farcaster') {
    return `${copy}${referralLink}${tip}`
  }
  
  return `${copy}${referralLink}${tip}`
}

// Claim share messages
export const formatImpactShareMessage = (
  level: number | string | null | undefined,
  link?: string,
  type: 'farcaster' | 'web' | 'copy' = 'copy'
) => {
  const normalizedLink = (link && link.trim().length > 0 ? link : MINIAPP_URL).trim()
  const parsedLevel =
    typeof level === 'string'
      ? Number(level)
      : typeof level === 'number'
      ? level
      : null
  const hasLevel = typeof parsedLevel === 'number' && Number.isFinite(parsedLevel) && parsedLevel > 0
  const levelLabel = hasLevel ? `Level ${parsedLevel} Impact Product` : 'an Impact Product'
  
  let message: string
  if (type === 'farcaster') {
    message = `I've just minted ${levelLabel}! Earn tokens for cleanups and trade on @base: ${normalizedLink}`
  } else if (type === 'web') {
    message = `I've just minted ${levelLabel}! Earn tokens for cleanups and trade on @base: ${normalizedLink}`
  } else {
    message = `I've just minted ${levelLabel}! Earn tokens for cleanups and trade on @base: ${normalizedLink}`
  }
  
  // Add tip message only for Farcaster app sharing (after the link)
  const tip = type === 'farcaster' ? FARCASTER_WALLET_TIP : ''
  
  return `${message}${tip}`
}

// EIP-1193 Provider type (for wallet integration)
export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
}

// Initialize Farcaster SDK
// Note: ready() is called in FarcasterProvider - this function just initializes context
export const initializeFarcaster = async () => {
  try {
    // ready() is called separately in FarcasterProvider after app is fully loaded
    // This function just ensures SDK is available and returns success
    if (typeof window !== 'undefined' && (window as any).farcaster?.sdk) {
      return true
    }
    // If SDK not available, we're likely not in Farcaster context (browser mode)
    // This is OK - return true anyway
    return true
  } catch (error) {
    console.error('Failed to initialize Farcaster SDK:', error)
    return false
  }
}

// Get Farcaster context (user info, etc.)
export const getFarcasterContext = async () => {
  try {
    const context = await sdk.context
    return context
  } catch (error) {
    console.error('Failed to get Farcaster context:', error)
    return null
  }
}

// Get Farcaster wallet provider (EIP-1193 compatible)
export const getFarcasterWalletProvider = (): EIP1193Provider | null => {
  try {
    // The Farcaster connector will automatically use sdk.wallet.ethProvider
    // when available in Farcaster context
    if (typeof window !== 'undefined' && sdk.wallet?.ethProvider) {
      return sdk.wallet.ethProvider as EIP1193Provider
    }
    return null
  } catch (error) {
    console.error('Failed to get Farcaster wallet provider:', error)
    return null
  }
}

// Check if running in Farcaster context
export const isFarcasterContext = (): boolean => {
  try {
    if (typeof window === 'undefined') {
      return false
    }
    // Check if we're actually in Farcaster by checking for SDK context
    const hasSdkContext = !!sdk.context
    return hasSdkContext
  } catch {
    return false
  }
}

// Open URL in external browser
export const openUrl = async (url: string) => {
  try {
    await sdk.actions.openUrl({ url })
  } catch (error) {
    console.error('Failed to open URL:', error)
    // Fallback to window.open
    if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
  }
}

// Close the mini app
export const closeMiniApp = async () => {
  try {
    await sdk.actions.close()
  } catch (error) {
    console.error('Failed to close mini app:', error)
  }
}

// Share to X/Twitter (mobile-friendly with Web Share API)
export const shareToX = async (text: string, url?: string): Promise<boolean> => {
  try {
    // Try Web Share API first if available (mobile native share sheet)
    // Note: text already contains the link from formatReferralMessage/formatImpactShareMessage
    // So we should NOT add url again to avoid duplication
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: APP_NAME,
          text, // text already includes the link, don't add url again
        })
        return true
      } catch (shareError: any) {
        // User cancelled (code 0) is fine, but other errors should fall through
        if (shareError?.code === 0 || shareError?.name === 'AbortError') {
          return false // User cancelled
        }
        // Other errors, fall back to other methods
        console.log('Web Share API failed, falling back:', shareError)
      }
    }

    // Build X/Twitter intent URL
    // Note: text already contains the link, so don't add url again
    // Only use text, not text + url to avoid duplication
    const fullText = text // text already includes the link from formatReferralMessage
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`

    // Check if we are in Farcaster context
    let inFarcaster = false
    try {
      inFarcaster = isFarcasterContext()
    } catch (error) {
      console.log('Error checking Farcaster context, assuming browser:', error)
      inFarcaster = false
    }

    if (inFarcaster) {
      try {
        // In Farcaster, use SDK's openUrl to open in external browser
        await openUrl(xUrl)
        return true
      } catch (openUrlError) {
        console.warn('openUrl failed in Farcaster context, trying window.open:', openUrlError)
        // Fallback to window.open even in Farcaster context
      }
    }

    // For browser (not in Farcaster or if openUrl failed), open X compose in new tab
    // This works on desktop browsers including Safari
    if (typeof window !== 'undefined') {
      try {
        // Use window.open with noopener for security
        // On desktop, this should work even if popup blockers are enabled for Twitter intent URLs
        const newWindow = window.open(xUrl, '_blank', 'noopener,noreferrer')
        if (newWindow) {
          // Give it a moment to check if window was actually opened
          setTimeout(() => {
            if (newWindow.closed === false) {
              console.log('Share window opened successfully')
            }
          }, 100)
          return true
        } else {
          // Popup blocked - fall through to clipboard
          console.warn('Popup blocked, will try clipboard fallback')
          throw new Error('Popup blocked')
        }
      } catch (openError) {
        console.error('window.open failed:', openError)
        // Don't throw immediately - try clipboard fallback first
        throw new Error('Failed to open share window')
      }
    }

    // Last resort: copy to clipboard
    throw new Error('No sharing method available')
  } catch (error) {
    console.error('Failed to share to X:', error)
    // Fallback: try to copy to clipboard
    // Note: text already contains the link, don't add url again
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text) // text already includes the link
        if (typeof window !== 'undefined') {
          alert('Share popup was blocked. Message copied to clipboard! Paste it into X to share.')
        }
        return true
      } else {
        throw new Error('Clipboard API not available')
      }
    } catch (clipboardError) {
      console.error('Failed to copy to clipboard:', clipboardError)
      return false
    }
  }
}

// Share a cast (post) on Farcaster
export const shareCast = async (text: string, url?: string): Promise<boolean> => {
  try {
    // Try Web Share API first if available (mobile native share sheet)
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: APP_NAME,
          text,
          url,
        })
        return true
      } catch (shareError: any) {
        // User cancelled (code 0) is fine, but other errors should fall through
        if (shareError?.code === 0 || shareError?.name === 'AbortError') {
          return false // User cancelled
        }
        // Other errors, fall back to other methods
        console.log('Web Share API failed, falling back:', shareError)
      }
    }

    // Build Warpcast compose URL with pre-filled text and embed
    // Warpcast compose URL format: https://warpcast.com/~/compose?text=...&embeds[]=...
    // CRITICAL: For embeds[], use your app's /share URL (not Farcaster miniapp URL)
    // This allows Farcaster to crawl your app and read fc:miniapp metadata with ref parameter
    // The /share page has dynamic metadata that includes the ref in the frame action URL
    let farcasterUrl: string
    if (url) {
      // If url is a Farcaster miniapp URL with ref param, convert it to /share URL for embed
      // This ensures Farcaster crawls your app and gets correct metadata
      let embedUrl = url
      if (url.includes('farcaster.xyz/miniapps/') && url.includes('?ref=')) {
        // Extract ref parameter from Farcaster miniapp URL
        const urlObj = new URL(url)
        const refParam = urlObj.searchParams.get('ref')
        if (refParam) {
          // Convert to /share URL so Farcaster can crawl it and get metadata with ref
          // The /share page will have fc:miniapp metadata with the ref in the action URL
          embedUrl = buildUrl(WEB_APP_URL, 'share', { ref: refParam, type: 'referral' })
        }
      }
      // Include both text and embed URL
      farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`
    } else {
      // Just text, no embed
      farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
    }

    // Check if we are in Farcaster context
    let inFarcaster = false
    try {
      inFarcaster = isFarcasterContext()
    } catch (error) {
      console.log('Error checking Farcaster context, assuming browser:', error)
      inFarcaster = false
    }
    
    if (inFarcaster) {
      try {
        // In Farcaster, use SDK's openUrl
      await openUrl(farcasterUrl)
      return true
      } catch (openUrlError) {
        console.warn('openUrl failed in Farcaster context, trying window.open:', openUrlError)
        // Fallback to window.open even in Farcaster context
      }
    }

    // For browser (not in Farcaster), open Warpcast compose in new tab
    if (typeof window !== 'undefined') {
      console.log('Opening Warpcast compose in browser:', farcasterUrl)
      try {
        // Use window.open with noopener for security
        const newWindow = window.open(farcasterUrl, '_blank', 'noopener,noreferrer')
        if (newWindow) {
          // Successfully opened
          console.log('Successfully opened Warpcast compose window')
    return true
        } else {
          // Popup blocked - fall through to clipboard
          console.warn('Popup blocked by browser, falling back to clipboard')
          throw new Error('Popup blocked')
        }
      } catch (openError) {
        console.error('window.open failed:', openError)
        throw new Error('Failed to open share window')
      }
    }

    // Last resort: copy to clipboard
    throw new Error('No sharing method available')
  } catch (error) {
    console.error('Failed to share cast:', error)
    // Fallback: try to copy to clipboard
    try {
      const fullText = text + (url ? ` ${url}` : '')
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText)
        if (typeof window !== 'undefined') {
          alert('Share popup was blocked. Message copied to clipboard! Paste it into Warpcast to share.')
        }
      return true
      } else {
        throw new Error('Clipboard API not available')
      }
    } catch (clipboardError) {
      console.error('Failed to copy to clipboard:', clipboardError)
      if (typeof window !== 'undefined') {
        // Show the text in an alert so user can copy manually
        const shareText = `Failed to open share dialog. Please copy this manually:\n\n${text}${url ? ` ${url}` : ''}`
        alert(shareText)
        // Also try to select the text if possible
        const textarea = document.createElement('textarea')
        textarea.value = text + (url ? ` ${url}` : '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
          document.body.removeChild(textarea)
          alert('Text selected - press Ctrl+C (Cmd+C on Mac) to copy')
        } catch (e) {
          document.body.removeChild(textarea)
        }
      }
      return false
    }
  }
}

// Farcaster miniapp link
const FARCASTER_MINIAPP_URL =
  'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'
const WEB_APP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://miniapp.decleanup.net'

function buildUrl(base: string, path: string, params?: Record<string, string | number | undefined>) {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const url = new URL(path, normalizedBase)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

export const generateReferralLink = (
  walletAddress: string, 
  type: 'farcaster' | 'web' | 'copy' = 'web',
  useSharePage: boolean = true
): string => {
  const sanitizedAddress = walletAddress?.trim()
  if (!sanitizedAddress) {
    return type === 'farcaster' ? FARCASTER_MINIAPP_URL : WEB_APP_URL
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(sanitizedAddress)) {
    // Invalid address format - return base URL
    return type === 'farcaster' ? FARCASTER_MINIAPP_URL : WEB_APP_URL
  }

  if (type === 'farcaster') {
    // For Farcaster, use Farcaster miniapp URL with wallet address in query param
    return `${FARCASTER_MINIAPP_URL}?ref=${sanitizedAddress}`
  }

  // For web and copy, always use /share route for previews
  // /share is server-rendered, provides OG metadata for crawlers, then redirects to /cleanup?ref=...
  // This separates preview logic (metadata) from referral logic (runtime)
  if (useSharePage) {
    return buildUrl(WEB_APP_URL, 'share', { ref: sanitizedAddress, type: 'referral' })
  }

  // Fallback: direct link to cleanup page (no preview, just app logic)
  return buildUrl(WEB_APP_URL, 'cleanup', { ref: sanitizedAddress })
}

// Generate claim share link for impact product sharing (no referral tracking)
export const generateClaimShareLink = (
  level: number,
  type: 'farcaster' | 'web' | 'copy' = 'web'
): string => {
  const levelParam = typeof level === 'number' && !Number.isNaN(level) ? level : undefined

  if (type === 'farcaster') {
    // For Farcaster, use Farcaster miniapp URL (base URL, no referral)
    return FARCASTER_MINIAPP_URL
  }

  // For web and copy, use base app URL (no referral, just sharing the achievement)
  return WEB_APP_URL
}



