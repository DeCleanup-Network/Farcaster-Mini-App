'use client'

import { useEffect, Component, ReactNode } from 'react'

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
      
      // Suppress Next.js dev WebSocket errors
      if (
        message === 'Connection interrupted while trying to subscribe' ||
        message.includes('Connection interrupted while trying to subscribe') ||
        (messageLower.includes('connection interrupted') && messageLower.includes('subscribe'))
      ) {
        // Silently ignore - this is a Next.js dev WebSocket/HMR error
        return
      }
      
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
      
      // Suppress WalletConnect localhost allowlist errors (development-only configuration issue)
      if (
        message.includes('not found on Allowlist') ||
        message.includes('update configuration on cloud.reown.com') ||
        (messageLower.includes('origin') && messageLower.includes('not found on allowlist'))
      ) {
        // This is a development-only issue - WalletConnect requires localhost to be whitelisted
        // Log a helpful message instead of showing an error
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.info(
            '💡 WalletConnect: To use WalletConnect on localhost, add your origin to the allowlist at https://cloud.reown.com',
            '\n   This is only needed for local development. Production URLs are automatically allowed.'
          )
        }
        return
      }
      
      // Suppress logger initialization errors (library issue, not our code)
      if (
        message.includes('is not a function') &&
        (messageLower.includes('logger') || messageLower.includes('sb.h6') || messageLower.includes('sb.iP'))
      ) {
        // Silently ignore - this is a library initialization issue
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
        errorMessage.includes('Connection interrupted while trying to subscribe') ||
        (errorString.includes('connection interrupted') && errorString.includes('subscribe')) ||
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
      
      // Handle logger initialization errors (library issue)
      const isLoggerError = 
        errorMessage.includes('is not a function') &&
        (errorString.includes('logger') || errorString.includes('sb.h6') || errorString.includes('sb.iP') || 
         errorString.includes('(0,sb.h6)') || errorString.includes('(0,sb.iP)'))
      
      if (isLoggerError) {
        // Silently ignore - this is a library initialization issue
        event.preventDefault()
        console.debug('Logger initialization error (ignored):', errorMessage)
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
        errorMessage.includes('Connection interrupted while trying to subscribe') ||
        (errorString.includes('connection interrupted') && errorString.includes('subscribe')) ||
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

// React Error Boundary to catch React component errors
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Check if this is a Next.js dev error we should ignore
    const errorMessage = error?.message || String(error || '')
    const errorString = errorMessage.toLowerCase()
    
    const isNextJsDevError = 
      errorMessage === 'Connection interrupted while trying to subscribe' ||
      errorMessage.includes('Connection interrupted while trying to subscribe') ||
      (errorString.includes('connection interrupted') && errorString.includes('subscribe'))
    
    if (isNextJsDevError) {
      // Don't set error state for Next.js dev errors - just log and continue
      console.debug('Next.js dev error caught by ErrorBoundary (ignored):', errorMessage)
      return { hasError: false, error: null }
    }
    
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const errorMessage = error?.message || String(error || '')
    const errorString = errorMessage.toLowerCase()
    
    const isNextJsDevError = 
      errorMessage === 'Connection interrupted while trying to subscribe' ||
      errorMessage.includes('Connection interrupted while trying to subscribe') ||
      (errorString.includes('connection interrupted') && errorString.includes('subscribe'))
    
    if (isNextJsDevError) {
      // Silently ignore Next.js dev errors
      console.debug('Next.js dev error in ErrorBoundary (ignored):', errorMessage)
      return
    }
    
    // Log other errors for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Only show error UI for non-dev errors
      const errorMessage = this.state.error?.message || String(this.state.error || '')
      const errorString = errorMessage.toLowerCase()
      
      const isNextJsDevError = 
        errorMessage === 'Connection interrupted while trying to subscribe' ||
        errorMessage.includes('Connection interrupted while trying to subscribe') ||
        (errorString.includes('connection interrupted') && errorString.includes('subscribe'))
      
      if (isNextJsDevError) {
        // Don't show error UI for Next.js dev errors
        return this.props.children
      }
      
      // For other errors, you could show a fallback UI here
      // For now, just return children to prevent breaking the app
      return this.props.children
    }

    return this.props.children
  }
}

