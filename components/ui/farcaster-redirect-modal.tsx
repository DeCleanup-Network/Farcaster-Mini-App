'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { ExternalLink, X } from 'lucide-react'

const FARCASTER_MINIAPP_URL = 'https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards'
const STORAGE_KEY = 'farcaster_redirect_choice'

export function FarcasterRedirectModal() {
  const { isMiniApp, isLoading, isInitialized } = useFarcaster()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Only show modal if:
    // 1. Detection is complete (isInitialized === true)
    // 2. We're NOT in a Mini App (isMiniApp === false)
    // 3. We're on web (not loading and initialized)
    // This ensures we never show the modal when already in Farcaster
    if (isInitialized && !isMiniApp && !isLoading && typeof window !== 'undefined') {
      // Always show modal on web - don't check localStorage
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }, [isMiniApp, isLoading, isInitialized])

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

  // Don't render if:
  // - Still loading/initializing
  // - Already in Mini App
  // - Not initialized yet (wait for detection to complete)
  if (isLoading || isMiniApp || !isInitialized) {
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

