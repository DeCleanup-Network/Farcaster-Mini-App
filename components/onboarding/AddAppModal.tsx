'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Pin, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'

interface AddAppModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddAppModal({ isOpen, onClose }: AddAppModalProps) {
  const { isMiniApp, context } = useFarcaster()
  const [isBaseApp, setIsBaseApp] = useState(false)
  const [farcasterAdded, setFarcasterAdded] = useState(false)
  const [basePinned, setBasePinned] = useState(false)

  useEffect(() => {
    // Check if we're in Base app environment
    if (typeof window !== 'undefined') {
      const hasMiniKit = !!(window as any).minikit
      setIsBaseApp(hasMiniKit)
    }
  }, [])

  const handleAddToFarcaster = async () => {
    // There's no reliable way to programmatically add apps to Farcaster
    // Instead, show clear instructions to the user
    const instructions = `To add DeCleanup Rewards to your Farcaster apps:

1. Tap the menu (☰) in the top-left of Farcaster
2. Go to Settings
3. Tap "Apps"
4. Find "DeCleanup Rewards" in the list
5. Tap "Add" or toggle it on

Alternatively, you can access the app anytime by:
• Using the app link from your profile
• Opening any cast or link that includes the app

The app will be available in your apps list for quick access!`

    // Show instructions in an alert
    alert(instructions)
    
    // Mark as attempted
    setFarcasterAdded(true)
  }

  const handlePinToBase = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).minikit) {
        const minikit = (window as any).minikit
        
        // Try different possible method names for pinning
        if (minikit.pinApp) {
          await minikit.pinApp()
          setBasePinned(true)
        } else if (minikit.actions?.pinApp) {
          await minikit.actions.pinApp()
          setBasePinned(true)
        } else if (minikit.requestPin) {
          await minikit.requestPin()
          setBasePinned(true)
        } else {
          // If methods aren't available, mark as done (user can pin manually)
          setBasePinned(true)
          console.log('Pin app method not available - user can pin manually from Base app')
        }
      } else {
        setBasePinned(true)
      }
    } catch (error) {
      console.warn('Could not trigger Base pin app:', error)
      // Mark as done anyway - user can pin manually
      setBasePinned(true)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overscroll-contain">
      <div className="relative w-full max-w-md rounded-lg bg-background p-6 shadow-xl overscroll-contain">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>

        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Stay Connected</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add DeCleanup Rewards to your apps for quick access
            </p>
          </div>

          <div className="space-y-3">
            {/* Farcaster Add App */}
            {isMiniApp && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Plus className="h-5 w-5 text-brand-green" />
                      <h3 className="font-semibold text-foreground">Add to Farcaster Apps</h3>
                      {farcasterAdded && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add this app to your Farcaster apps list for easy access
                    </p>
                  </div>
                  {!farcasterAdded && (
                    <Button
                      onClick={handleAddToFarcaster}
                      size="sm"
                      className="ml-4"
                    >
                      Add
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Base App Pin */}
            {isBaseApp && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Pin className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold text-foreground">Pin to Base App</h3>
                      {basePinned && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pin this app to your Base app home screen
                    </p>
                  </div>
                  {!basePinned && (
                    <Button
                      onClick={handlePinToBase}
                      size="sm"
                      variant="outline"
                      className="ml-4"
                    >
                      Pin
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Fallback message if neither is available */}
            {!isMiniApp && !isBaseApp && (
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Open this app in Farcaster or Base to add it to your apps
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Maybe Later
            </Button>
            {(farcasterAdded || basePinned) && (
              <Button
                onClick={onClose}
                size="sm"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

