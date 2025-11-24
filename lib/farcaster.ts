import { sdk } from '@farcaster/miniapp-sdk'

const APP_NAME = 'DeCleanup Rewards'
export const MINIAPP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://farcaster-mini-app-umber.vercel.app'
// Profile share messages
export const formatReferralMessage = (referralLink: string, type: 'farcaster' | 'web' | 'copy' = 'copy') => {
  if (type === 'farcaster') {
    return `Join me in DeCleanup Rewards app! Clean up, share the proof, earn Impact Products, and tokenize your environmental impact on @base.base.eth\n\n${referralLink}`
  } else if (type === 'web') {
    return `Join me in DeCleanup Rewards app! Clean up, share the proof, earn Impact Products, and tokenize your environmental impact on @base\n\n${referralLink}`
  } else {
    return `Join me in DeCleanup Rewards app! Clean up, share the proof, earn Impact Products, and tokenize your environmental impact on Base chain\n\n${referralLink}`
  }
}

// Claim share messages
export const formatImpactShareMessage = (level: number | null | undefined, link?: string, type: 'farcaster' | 'web' | 'copy' = 'copy') => {
  const normalizedLink = (link && link.trim().length > 0 ? link : MINIAPP_URL).trim()
  const levelLabel = typeof level === 'number' && level > 0 ? `Level ${level} Impact Product` : 'an Impact Product'
  
  if (type === 'farcaster') {
    return `Just minted ${levelLabel} for my recent cleanup. Join DeCleanup Rewards on @base.base.eth to turn your actions into Impact Products:\n\n${normalizedLink}`
  } else if (type === 'web') {
    return `Just minted ${levelLabel} for my recent cleanup. Join DeCleanup Rewards on @base to turn your actions into Impact Products:\n\n${normalizedLink}`
  } else {
    return `Just minted ${levelLabel} for my recent cleanup. Join DeCleanup Rewards on Base chain to turn your actions into Impact Products:\n\n${normalizedLink}`
  }
}

// EIP-1193 Provider type (for wallet integration)
export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
}

// Initialize Farcaster SDK
export const initializeFarcaster = async () => {
  try {
    // Signal that the app is ready to display
    await sdk.actions.ready()
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
    return typeof window !== 'undefined' && !!sdk.context
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
      } catch (shareError) {
        // User cancelled or share failed, fall back to other methods
        console.log('Web Share API failed or cancelled, falling back:', shareError)
      }
    }

    // Farcaster SDK doesn't have a direct cast action, but we can use openUrl
    // to open the Farcaster compose interface with pre-filled text
    const farcasterUrl = url
      ? `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`
      : `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`

    // Check if we are in Farcaster context
    if (isFarcasterContext()) {
      await openUrl(farcasterUrl)
      return true
    }

    // If not in Farcaster, open in new tab
    window.open(farcasterUrl, '_blank')
    return true
  } catch (error) {
    console.error('Failed to share cast:', error)
    // Fallback: try to copy to clipboard
    try {
      await navigator.clipboard.writeText(text + (url ? ` ${url}` : ''))
      return true
    } catch (clipboardError) {
      console.error('Failed to copy to clipboard:', clipboardError)
      return false
    }
  }
}

// Farcaster miniapp link
const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/njiQzfqas3yN/decleanup-rewards'
const WEB_APP_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'https://farcaster-mini-app-umber.vercel.app'

// Generate referral link with wallet address
// type: 'farcaster' | 'web' | 'copy' - determines which URL to use
// For Farcaster and X sharing, use the /share route which provides proper OG tags for previews
// For Copy, use direct browser app links (no preview needed)
export const generateReferralLink = (
  walletAddress: string, 
  type: 'farcaster' | 'web' | 'copy' = 'web',
  useSharePage: boolean = true // Use /share page for Farcaster and X to get proper OG tags
): string => {
  if (useSharePage && (type === 'farcaster' || type === 'web')) {
    // Use share page for Farcaster and X to get proper OG tags for preview images
    const baseUrl = WEB_APP_URL.replace(/\/$/, '')
    return `${baseUrl}/share?ref=${walletAddress}&type=referral`
  }
  
  // For Copy, use direct browser app links (no preview needed)
  const baseUrl = type === 'farcaster' 
    ? FARCASTER_MINIAPP_URL 
    : WEB_APP_URL
  const url = baseUrl.replace(/\/$/, '')
  return `${url}/cleanup?ref=${walletAddress}`
}

// Generate claim share link with wallet address and level
// For Farcaster and X sharing, use the /share route which provides proper OG tags for previews
// For Copy, use direct browser app links (no preview needed)
export const generateClaimShareLink = (
  walletAddress: string,
  level: number,
  type: 'farcaster' | 'web' | 'copy' = 'web',
  useSharePage: boolean = true // Use /share page for Farcaster and X to get proper OG tags
): string => {
  if (useSharePage && (type === 'farcaster' || type === 'web')) {
    // Use share page for Farcaster and X to get proper OG tags for preview images
    const baseUrl = WEB_APP_URL.replace(/\/$/, '')
    return `${baseUrl}/share?ref=${walletAddress}&type=claim&level=${level}`
  }
  
  // For Copy, use direct browser app links (no preview needed)
  const baseUrl = type === 'farcaster' 
    ? FARCASTER_MINIAPP_URL 
    : WEB_APP_URL
  const url = baseUrl.replace(/\/$/, '')
  return `${url}/profile`
}

