/**
 * Example: WalletConnect with CAPTCHA Integration
 * 
 * This is an example showing how to integrate CAPTCHA with wallet connection.
 * Copy the relevant parts into your WalletConnect component.
 * 
 * IMPORTANT: This is an example file - not meant to be used directly.
 * Integrate the CAPTCHA logic into your existing WalletConnect component.
 */

'use client'

import { useState } from 'react'
import { TurnstileCaptcha, verifyCaptchaToken } from './TurnstileCaptcha'
import { Button } from '@/components/ui/button'
import { Wallet } from 'lucide-react'

export function WalletConnectWithCaptchaExample() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [captchaError, setCaptchaError] = useState<string | null>(null)

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token)
    setCaptchaError(null)
  }

  const handleCaptchaError = (error: string) => {
    setCaptchaError('CAPTCHA verification failed. Please try again.')
    setCaptchaToken(null)
  }

  const handleCaptchaExpire = () => {
    setCaptchaToken(null)
    setCaptchaError('CAPTCHA expired. Please verify again.')
  }

  const handleConnectWallet = async () => {
    // Step 1: Check if CAPTCHA is verified
    if (!captchaToken) {
      setCaptchaError('Please complete the CAPTCHA verification first.')
      return
    }

    setIsVerifying(true)
    setCaptchaError(null)

    try {
      // Step 2: Verify CAPTCHA token on server
      const verified = await verifyCaptchaToken(captchaToken)
      
      if (!verified) {
        setCaptchaError('CAPTCHA verification failed. Please try again.')
        setCaptchaToken(null) // Reset token to force new verification
        return
      }

      // Step 3: Proceed with wallet connection
      // Replace this with your actual wallet connection logic
      // await connectWallet()
      
      console.log('CAPTCHA verified, proceeding with wallet connection...')
      
    } catch (error) {
      console.error('Error during CAPTCHA verification:', error)
      setCaptchaError('An error occurred. Please try again.')
      setCaptchaToken(null)
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* CAPTCHA Component */}
      <div className="flex flex-col gap-2">
        <TurnstileCaptcha
          onVerify={handleCaptchaVerify}
          onError={handleCaptchaError}
          onExpire={handleCaptchaExpire}
          theme="auto"
          size="normal"
        />
        
        {captchaError && (
          <p className="text-sm text-red-400">{captchaError}</p>
        )}
        
        {captchaToken && (
          <p className="text-sm text-green-400">✓ CAPTCHA verified</p>
        )}
      </div>

      {/* Connect Wallet Button */}
      <Button
        onClick={handleConnectWallet}
        disabled={!captchaToken || isVerifying}
        className="gap-2 bg-brand-green text-black hover:bg-brand-green/90"
      >
        <Wallet className="h-4 w-4" />
        <span>
          {isVerifying ? 'Verifying…' : 'Connect Wallet'}
        </span>
      </Button>
    </div>
  )
}

/**
 * Integration Steps:
 * 
 * 1. Add CAPTCHA state to your WalletConnect component:
 *    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
 * 
 * 2. Add CAPTCHA component before connect button:
 *    <TurnstileCaptcha onVerify={setCaptchaToken} />
 * 
 * 3. Verify CAPTCHA before connecting:
 *    const verified = await verifyCaptchaToken(captchaToken)
 *    if (!verified) return
 * 
 * 4. Only allow connection if CAPTCHA is verified:
 *    disabled={!captchaToken || isPending}
 * 
 * 5. Reset CAPTCHA on connection failure:
 *    setCaptchaToken(null)
 */

