'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { sdk } from '@farcaster/miniapp-sdk'
import { ExternalLink, X } from 'lucide-react'

const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'
const STORAGE_KEY = 'farcaster_redirect_choice'

/**
 * Check if we're in Farcaster using multiple methods
 * This is a safety check to ensure we NEVER show the modal in Farcaster
 */
function isInFarcasterEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  
  // Check 1: window.farcaster object exists (strong indicator)
  if ((window as any).farcaster?.sdk || (window as any).farcaster) {
    return true
  }
  
  // Check 2: URL contains Farcaster Mini App indicators
  const url = window.location.href.toLowerCase()
  if (url.includes('farcaster.xyz/miniapps') || 
      url.includes('warpcast.com/~/')) {
    return true
  }
  
  // Check 3: Check if SDK actions are available (indicates SDK is injected)
  try {
    if (sdk?.actions && typeof sdk.actions.ready === 'function') {
      // SDK is available - we're likely in Farcaster
      // But don't assume - let the async detection handle it
      // This is just a safety check
      return false // Let async detection decide
    }
  } catch {
    // SDK not available - we're on web
  }
  
  return false
}

export function FarcasterRedirectModal() {
  const { isMiniApp, isLoading, isInitialized } = useFarcaster()
  const [isOpen, setIsOpen] = useState(false)
  const [directCheck, setDirectCheck] = useState<boolean | null>(null)

  // Direct check for Farcaster environment (safety net)
  useEffect(() => {
    const check = isInFarcasterEnvironment()
    setDirectCheck(check)
  }, [])

  useEffect(() => {
    // NEVER show modal if:
    // 1. window.farcaster exists (definitive indicator)
    // 2. Direct check indicates we're in Farcaster
    // 3. Context says we're in Mini App
    // 4. Still loading/initializing
    // 5. URL indicates Farcaster
    
    const hasFarcasterSDK = typeof window !== 'undefined' && 
      ((window as any).farcaster?.sdk || (window as any).farcaster)
    
    const inFarcaster = hasFarcasterSDK || directCheck === true || isMiniApp || isInFarcasterEnvironment()
    
    // Only show modal if:
    // 1. Detection is complete (isInitialized === true)
    // 2. We're NOT in a Mini App (isMiniApp === false)
    // 3. window.farcaster does NOT exist
    // 4. Direct check says we're NOT in Farcaster
    // 5. We're on web (not loading and initialized)
    if (isInitialized && !inFarcaster && !isLoading && typeof window !== 'undefined') {
      // Always show modal on web - don't check localStorage
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }, [isMiniApp, isLoading, isInitialized, directCheck])

  const handleStayOnWeb = () => {
    if (typeof window !== 'undefined') {
      // Save choice to localStorage (optional - user wants it every time, so we might not save)
      // localStorage.setItem(STORAGE_KEY, 'web')
      setIsOpen(false)
    }
  }

  const handleGoToFarcaster = () => {
    if (typeof window !== 'undefined') {
      // Save choice
      // localStorage.setItem(STORAGE_KEY, 'farcaster')
      // Redirect to Farcaster Mini App
      window.location.href = FARCASTER_MINIAPP_URL
    }
  }

  // NEVER render if:
  // - Still loading/initializing
  // - Already in Mini App (from context) - this is the PRIMARY check
  // - Direct check indicates Farcaster
  // - Not initialized yet (wait for detection to complete)
  // - window.farcaster exists (definitive indicator we're in Farcaster)
  // - Any Farcaster indicators detected
  
  // Most reliable check: window.farcaster object
  const hasFarcasterSDK = typeof window !== 'undefined' && 
    ((window as any).farcaster?.sdk || (window as any).farcaster)
  
  const inFarcaster = hasFarcasterSDK || directCheck === true || isMiniApp || isInFarcasterEnvironment()
  
  // If we're in Farcaster in ANY way, never show modal
  if (isLoading || inFarcaster || !isInitialized) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold uppercase tracking-wide">
            Choose Your Experience
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Continue on web or open in Farcaster Mini App for the best experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            onClick={handleStayOnWeb}
            className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
            size="lg"
          >
            <X className="h-5 w-5" />
            Stay on Web
          </Button>

          <Button
            onClick={handleGoToFarcaster}
            variant="outline"
            className="w-full gap-2 border-2 border-brand-green bg-transparent text-brand-green hover:bg-brand-green/10"
            size="lg"
          >
            <ExternalLink className="h-5 w-5" />
            Open in Farcaster Mini App
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500">
          The Farcaster Mini App provides seamless wallet connection and social features
        </p>
      </DialogContent>
    </Dialog>
  )
}

