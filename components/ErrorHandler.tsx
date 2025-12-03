'use client'

import { useEffect } from 'react'

/**
 * Global error handler for unhandled promise rejections and WebSocket errors
 * This component silently handles Next.js HMR WebSocket connection errors
 * ONLY catches very specific Next.js dev errors to avoid blocking legitimate functionality
 */
export function ErrorHandler() {
  useEffect(() => {
    // Suppress WalletConnect/Lit framework warnings (known library issue, not our code)
    const originalWarn = console.warn
    const originalError = console.error
    
    console.warn = (...args: any[]) => {
      const message = args.map(arg => String(arg)).join(' ')
      // Suppress WalletConnect QR code update warnings (harmless library issue)
      if (
        message.includes('w3m-connecting-wc-qrcode') ||
        message.includes('scheduled an update') ||
        message.includes('change-in-update')
      ) {
        // Silently ignore - this is a known WalletConnect library issue
        return
      }
      // Log all other warnings normally
      originalWarn.apply(console, args)
    }
    
    // Suppress connection reset errors (expected user actions)
    console.error = (...args: any[]) => {
      const message = args.map(arg => String(arg)).join(' ')
      const messageLower = message.toLowerCase()
      
      // Suppress connection reset errors - these are expected when users cancel connections
      if (
        message.includes('Connection request reset') ||
        message.includes('request reset') ||
        messageLower.includes('connection request reset') ||
        message.includes('UserRejectedRequestError')
      ) {
        // Silently ignore - user can retry connection
        return
      }
      
      // Log all other errors normally
      originalError.apply(console, args)
    }
    
    return () => {
      console.warn = originalWarn
      console.error = originalError
    }
  }, [])
  
  useEffect(() => {
    // Handle unhandled promise rejections (like WebSocket subscription errors)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      const errorMessage = error?.message || String(error || '')
      const errorString = String(error || '').toLowerCase()
      
      // ONLY catch the EXACT Next.js dev errors - be very conservative
      const isNextJsDevError = 
        errorMessage === 'Connection interrupted while trying to subscribe' ||
        (errorString.includes('connection interrupted') && errorString.includes('subscribe') && errorString.includes('next')) ||
        (errorString.includes('nextjs_original-stack-frames') && errorString.includes('fetch api cannot load'))
      
      if (isNextJsDevError) {
        // Silently ignore - these are development-only WebSocket/HMR/dev tools errors
        event.preventDefault()
        console.debug('Next.js dev error (ignored):', errorMessage)
        return
      }
      
      // Handle WalletConnect connection reset errors (expected user actions)
      const isConnectionReset = 
        errorMessage.includes('Connection request reset') ||
        errorMessage.includes('request reset') ||
        errorString.includes('connection request reset') ||
        error?.name === 'UserRejectedRequestError' ||
        error?.code === 4001 // User rejected request
      
      if (isConnectionReset) {
        // Silently handle - this is expected when user cancels/closes connection
        event.preventDefault()
        console.debug('Connection reset (user action) - silently handled')
        return
      }
      
      // Handle WalletConnect stale session errors
      const isWalletConnectStaleSession = 
        errorString.includes('session topic doesn\'t exist') ||
        errorString.includes('no matching key') ||
        errorString.includes('session topic') ||
        (error?.code === 3000 && errorString.includes('unauthorized'))
      
      if (isWalletConnectStaleSession) {
        // Clear WalletConnect storage and prevent error from showing
        event.preventDefault()
        console.log('WalletConnect stale session detected in ErrorHandler. Clearing storage...')
        try {
          const wcKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('wc@2:') || key.startsWith('walletconnect')
          )
          wcKeys.forEach(key => localStorage.removeItem(key))
          sessionStorage.removeItem('wallet_connected_this_session')
          // Reload page to reset connection state
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        } catch (e) {
          console.warn('Failed to clear WalletConnect storage in ErrorHandler:', e)
        }
        return
      }
      
      // Let all other errors through - don't block legitimate errors
      // Just log them for debugging
      console.warn('Unhandled promise rejection:', error)
    }
    
    // Handle general errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || String(event.error || '')
      const errorString = errorMessage.toLowerCase()
      
      // ONLY catch the EXACT Next.js dev errors - be very conservative
      const isNextJsDevError = 
        errorMessage === 'Connection interrupted while trying to subscribe' ||
        (errorString.includes('nextjs_original-stack-frames') && errorString.includes('fetch api cannot load'))
      
      if (isNextJsDevError) {
        event.preventDefault()
        console.debug('Next.js dev error (ignored):', errorMessage)
        return
      }
      
      // Handle WalletConnect connection reset errors in ErrorEvent
      const isConnectionReset = 
        errorMessage.includes('Connection request reset') ||
        errorMessage.includes('request reset') ||
        errorString.includes('connection request reset')
      
      if (isConnectionReset) {
        // Silently handle - this is expected when user cancels/closes connection
        event.preventDefault()
        console.debug('Connection reset (user action) - silently handled')
        return
      }
      
      // Let all other errors through - don't block legitimate errors
      // Just log them for debugging
      console.warn('Global error:', event.error)
    }
    
    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)
    
    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])
  
  return null // This component doesn't render anything
}

