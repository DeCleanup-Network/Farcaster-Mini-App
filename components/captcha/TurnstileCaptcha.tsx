'use client'

import { useState, useEffect } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void
  onError?: (error: string) => void
  onExpire?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
  className?: string
  /**
   * Force show CAPTCHA even in Farcaster (default: false, only shows on web)
   */
  forceShow?: boolean
}

/**
 * Cloudflare Turnstile CAPTCHA Component
 * 
 * Privacy-friendly CAPTCHA solution that protects against automated attacks
 * while maintaining good user experience (often invisible).
 * 
 * @param onVerify - Callback when CAPTCHA is verified (receives token)
 * @param onError - Callback when CAPTCHA verification fails
 * @param onExpire - Callback when CAPTCHA token expires
 * @param theme - Theme: 'light', 'dark', or 'auto' (default: 'auto')
 * @param size - Size: 'normal' or 'compact' (default: 'normal')
 * @param className - Additional CSS classes
 */
export function TurnstileCaptcha({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  className = '',
  forceShow = false,
}: TurnstileCaptchaProps) {
  const [mounted, setMounted] = useState(false)
  const { isMiniApp } = useFarcaster()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render if site key is not configured
  if (!siteKey) {
    console.warn('Turnstile site key not configured. CAPTCHA will not be displayed.')
    return null
  }

  // CRITICAL: Only show CAPTCHA on web app, not in Farcaster Mini App
  // Farcaster Mini Apps have built-in security and don't need CAPTCHA
  if (isMiniApp && !forceShow) {
    // In Farcaster, skip CAPTCHA entirely
    // Farcaster Mini Apps have built-in security mechanisms
    return null
  }

  // Don't render during SSR
  if (!mounted) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="h-10 w-32 animate-pulse rounded bg-gray-700" />
      </div>
    )
  }

  const handleVerify = (token: string) => {
    if (token) {
      onVerify(token)
    }
  }

  const handleError = (error: string) => {
    // Error 110200 = Invalid site key or domain mismatch
    // Error 110201 = Invalid site key format
    // Error 110202 = Site key not found
    const errorCode = error
    let errorMessage = 'CAPTCHA error occurred'
    
    if (errorCode === '110200') {
      errorMessage = 'CAPTCHA configuration error: Site key may be invalid or domain mismatch. Check your Cloudflare Turnstile settings.'
      console.error('Turnstile CAPTCHA error 110200: Invalid site key or domain mismatch. Verify:', {
        siteKey: siteKey ? `${siteKey.substring(0, 10)}...` : 'NOT SET',
        currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        hint: 'Make sure the site key is configured for your domain in Cloudflare dashboard'
      })
    } else if (errorCode === '110201') {
      errorMessage = 'CAPTCHA configuration error: Invalid site key format'
      console.error('Turnstile CAPTCHA error 110201: Invalid site key format')
    } else if (errorCode === '110202') {
      errorMessage = 'CAPTCHA configuration error: Site key not found'
      console.error('Turnstile CAPTCHA error 110202: Site key not found')
    } else {
      console.error('Turnstile CAPTCHA error:', error)
    }
    
    if (onError) {
      onError(errorMessage)
    }
  }

  const handleExpire = () => {
    console.log('Turnstile CAPTCHA token expired')
    if (onExpire) {
      onExpire()
    }
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={handleVerify}
        onError={handleError}
        onExpire={handleExpire}
        options={{
          theme,
          size,
          // Use managed mode for best UX (invisible when possible)
          // Cloudflare automatically shows challenge only when needed
        }}
      />
    </div>
  )
}

/**
 * Hook to verify CAPTCHA token on server
 * 
 * @param token - CAPTCHA token from Turnstile component
 * @returns Promise<boolean> - true if verified, false otherwise
 */
export async function verifyCaptchaToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/captcha/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })

    if (!response.ok) {
      console.error('CAPTCHA verification failed:', response.statusText)
      return false
    }

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Error verifying CAPTCHA:', error)
    return false
  }
}

