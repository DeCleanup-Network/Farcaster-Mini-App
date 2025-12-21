'use client'

import { useEffect, useState, useCallback } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { isFarcaster } from '@/lib/farcaster-detection'
import { Bell, X, Check, Loader2 } from 'lucide-react'

const NOTIFICATION_PROMPT_KEY = 'decleanup_notification_prompt_shown'
const NOTIFICATION_ENABLED_KEY = 'decleanup_notifications_enabled'

/**
 * NotificationPrompt - Prompts users to enable app notifications in Farcaster
 *
 * Uses sdk.actions.addFrame() which:
 * 1. Adds the app to user's favorites
 * 2. Enables push notifications
 * 3. Returns notification token for server-side notifications
 *
 * Only shows in Farcaster context, once per session
 */
export function NotificationPrompt() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    // Check if in Farcaster
    const inFarcaster = isFarcaster()
    setIsInFarcaster(inFarcaster)

    if (!inFarcaster) {
      console.log('[NotificationPrompt] Not in Farcaster, skipping')
      return
    }

    // Check if already shown this session
    const alreadyShown = sessionStorage.getItem(NOTIFICATION_PROMPT_KEY)
    if (alreadyShown) {
      console.log('[NotificationPrompt] Already shown this session')
      return
    }

    // Check if notifications already enabled (persisted)
    const notificationsEnabled = localStorage.getItem(NOTIFICATION_ENABLED_KEY)
    if (notificationsEnabled === 'true') {
      console.log('[NotificationPrompt] Notifications already enabled')
      return
    }

    // Check if app is already added via SDK context
    const checkIfAdded = async () => {
      try {
        const context = await sdk.context
        if (context?.client?.added) {
          console.log('[NotificationPrompt] App already added by user')
          localStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true')
          return
        }
      } catch (err) {
        console.log('[NotificationPrompt] Could not check context:', err)
      }

      // Show prompt after a short delay for better UX
      setTimeout(() => {
        setIsOpen(true)
        sessionStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
      }, 2000)
    }

    checkIfAdded()
  }, [])

  const handleEnableNotifications = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[NotificationPrompt] Requesting addFrame...')

      if (!sdk.actions || typeof sdk.actions.addFrame !== 'function') {
        throw new Error('addFrame not available')
      }

      const result = await sdk.actions.addFrame()

      console.log('[NotificationPrompt] addFrame result:', result)

      if (result.added) {
        // Success - app was added and notifications enabled
        setIsSuccess(true)
        localStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true')

        // Store notification details if provided (for server-side notifications)
        if (result.notificationDetails) {
          try {
            localStorage.setItem(
              'decleanup_notification_details',
              JSON.stringify(result.notificationDetails)
            )
            console.log('[NotificationPrompt] Notification details saved:', result.notificationDetails)
          } catch (e) {
            console.warn('[NotificationPrompt] Could not save notification details')
          }
        }

        // Close after showing success
        setTimeout(() => {
          setIsOpen(false)
        }, 2000)
      } else {
        // User rejected
        console.log('[NotificationPrompt] User rejected addFrame')
        setError('You can enable notifications later from settings')
        setTimeout(() => {
          setIsOpen(false)
        }, 2000)
      }
    } catch (err: any) {
      console.error('[NotificationPrompt] Error:', err)

      if (err?.message?.includes('rejected_by_user')) {
        setError('You can enable notifications later from settings')
      } else {
        setError('Could not enable notifications. Try again later.')
      }

      setTimeout(() => {
        setIsOpen(false)
      }, 3000)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setIsOpen(false)
    // Mark as shown so we don't show again this session
    sessionStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
  }, [])

  // Don't render if not in Farcaster or not open
  if (!isInFarcaster || !isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isSuccess
              ? 'bg-brand-green/20'
              : error
                ? 'bg-red-500/20'
                : 'bg-brand-green/20'
          }`}>
            {isSuccess ? (
              <Check className="w-8 h-8 text-brand-green" />
            ) : error ? (
              <X className="w-8 h-8 text-red-500" />
            ) : isLoading ? (
              <Loader2 className="w-8 h-8 text-brand-green animate-spin" />
            ) : (
              <Bell className="w-8 h-8 text-brand-green" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          {isSuccess ? (
            <>
              <h2 className="text-lg font-bold text-foreground mb-2">
                Notifications Enabled!
              </h2>
              <p className="text-sm text-muted-foreground">
                You'll receive updates about your cleanups and rewards
              </p>
            </>
          ) : error ? (
            <>
              <h2 className="text-lg font-bold text-foreground mb-2">
                No Problem
              </h2>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-foreground mb-2">
                Stay Updated
              </h2>
              <p className="text-sm text-muted-foreground">
                Enable notifications to get updates on your cleanups, rewards, and community activity
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        {!isSuccess && !error && (
          <div className="space-y-3">
            <button
              onClick={handleEnableNotifications}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-green hover:bg-[#4a9a26] text-black font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  Enable Notifications
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              disabled={isLoading}
              className="w-full py-3 px-4 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              Maybe Later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationPrompt
