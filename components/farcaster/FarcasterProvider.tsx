'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { detectFarcasterEnvironment } from '@/lib/farcaster-environment'
import { sdk } from '@farcaster/miniapp-sdk'
import type { FarcasterContext as FarcasterContextData } from '@/types/farcaster'

export interface FarcasterContextType {
  context: FarcasterContextData | null
  isInitialized: boolean
  isLoading: boolean
  isMiniApp: boolean
}

const FarcasterContext = createContext<FarcasterContextType>({
  context: null,
  isInitialized: false,
  isLoading: true,
  isMiniApp: false,
})

export function useFarcaster(): FarcasterContextType {
  return useContext(FarcasterContext)
}

/**
 * FarcasterProvider - Initializes the Farcaster MiniApp SDK
 * 
 * Uses the official SDK method (sdk.isInMiniApp()) to detect environment.
 * 
 * IMPORTANT: 
 * - Must call sdk.actions.ready() when in Mini App to avoid infinite loading screen
 * - Environment detection happens once at startup
 * - All UI logic should branch based on isMiniApp flag
 */
export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<FarcasterContextData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMiniApp, setIsMiniApp] = useState(false)

  useEffect(() => {
    // CRITICAL: Call ready() IMMEDIATELY - this must happen before ANY other logic
    // Base Build preview checks for ready() synchronously, so we must call it immediately
    // Following Base migration guide pattern: https://docs.base.org/mini-apps/quickstart/migrate-existing-apps
    
    // Priority 1: Base MiniKit (for Base Apps) - call synchronously if available
    try {
      if (typeof window !== 'undefined' && (window as any).minikit?.setFrameReady) {
        (window as any).minikit.setFrameReady()
        console.log('✅ Base MiniKit setFrameReady() called immediately')
      }
    } catch (minikitError) {
      // Base MiniKit not available - continue to Farcaster SDK
      console.debug('ℹ️ Base MiniKit not available, trying Farcaster SDK')
    }
    
    // Priority 2: Farcaster SDK (for Farcaster Mini Apps)
    // Base migration guide shows calling it directly in useEffect (not in async function)
    // This ensures Base Build preview can detect it synchronously
    try {
      // Call directly (synchronously) - Base Build preview checks for this
      sdk.actions.ready()
      console.log('✅ Farcaster SDK ready() called synchronously (Base Build compatible)')
    } catch (error) {
      // If SDK not available, we're likely not in Mini App context (browser mode)
      // This is OK - detectFarcasterEnvironment and useFarcasterReady will also try
      console.log('ℹ️ Farcaster SDK ready() call skipped (will retry elsewhere):', error)
    }

    const init = async () => {
      try {
        // Use official SDK method to detect environment
        const env = await detectFarcasterEnvironment()
        
        setIsMiniApp(env.isMiniApp)
        
        if (env.isMiniApp && env.context) {
          // We're in a Mini App
          // Transform SDK context to our expected format
          // The SDK context might have different property names, so we check multiple possibilities
          const rawUser = (env.context as any).user
          const rawContext = env.context as any
          
          let transformedContext: FarcasterContextData = {
            user: rawUser ? {
              fid: rawUser.fid || rawUser.userFid || 0,
              username: rawUser.username || rawUser.userName || '',
              displayName: rawUser.displayName || rawUser.display_name || rawUser.username || rawUser.userName || '',
              pfp: {
                url: rawUser.pfpUrl || rawUser.pfp_url || rawUser.pfp?.url || rawUser.avatar_url || '',
              },
              bio: {
                text: rawUser.bio?.text || rawUser.bio || rawUser.bio_text || '',
              },
              followerCount: rawUser.followerCount || rawUser.follower_count || 0,
              followingCount: rawUser.followingCount || rawUser.following_count || 0,
            } : undefined,
            channel: rawContext.channel ? {
              id: rawContext.channel.id || '',
              name: rawContext.channel.name || '',
            } : undefined,
            cast: rawContext.cast ? {
              hash: rawContext.cast.hash || '',
              author: rawContext.cast.author ? {
                fid: rawContext.cast.author.fid || 0,
                username: rawContext.cast.author.username || '',
                displayName: rawContext.cast.author.displayName || rawContext.cast.author.username || '',
                pfp: {
                  url: rawContext.cast.author.pfpUrl || rawContext.cast.author.pfp?.url || '',
                },
                bio: {
                  text: rawContext.cast.author.bio?.text || rawContext.cast.author.bio || '',
                },
                followerCount: rawContext.cast.author.followerCount || 0,
                followingCount: rawContext.cast.author.followingCount || 0,
              } : {
                fid: 0,
                username: '',
                displayName: '',
                pfp: { url: '' },
                bio: { text: '' },
                followerCount: 0,
                followingCount: 0,
              },
            } : undefined,
          }
          
          // If user data is missing FID or pfp, try to fetch from Neynar API using custody address
          if (transformedContext.user && (!transformedContext.user.fid || !transformedContext.user.pfp?.url)) {
            try {
              // Get custody address from wallet if available
              const custodyAddress = rawUser?.custodyAddress || rawUser?.custody_address
              if (custodyAddress) {
                const neynarResponse = await fetch(`/api/neynar/user-by-custody-address?address=${custodyAddress}`)
                if (neynarResponse.ok) {
                  const neynarData = await neynarResponse.json()
                  if (neynarData.user) {
                    // Merge Neynar data to fill missing fields
                    if (!transformedContext.user.fid && neynarData.user.fid) {
                      transformedContext.user.fid = neynarData.user.fid
                    }
                    if (!transformedContext.user.pfp?.url && neynarData.user.pfp_url) {
                      transformedContext.user.pfp.url = neynarData.user.pfp_url
                    }
                    if (!transformedContext.user.username && neynarData.user.username) {
                      transformedContext.user.username = neynarData.user.username
                    }
                    if (!transformedContext.user.displayName && neynarData.user.display_name) {
                      transformedContext.user.displayName = neynarData.user.display_name
                    }
                    console.log('✅ Fetched missing user data from Neynar API', {
                      fid: transformedContext.user.fid,
                      hasPfp: !!transformedContext.user.pfp?.url,
                    })
                  }
                }
              }
            } catch (neynarError) {
              console.warn('⚠️ Failed to fetch user data from Neynar API:', neynarError)
            }
          }
          
          console.log('✅ Farcaster Mini App environment detected', {
            hasUser: !!transformedContext.user,
            fid: transformedContext.user?.fid,
            username: transformedContext.user?.username,
            hasPfp: !!transformedContext.user?.pfp?.url,
            rawContextKeys: Object.keys(rawContext || {}), // Log keys for debugging
          })
          
          setContext(transformedContext)
          setIsInitialized(true)
        } else {
          // We're in browser mode
          console.log('ℹ️ Running in browser mode (not in Farcaster Mini App)')
          setIsInitialized(true)
        }

        // Base MiniKit setFrameReady is already called at the start of useEffect
        // No need to call it again here
      } catch (error) {
        // Ignore errors if not in Farcaster/Base context
        // This allows the app to work in regular browsers too
        console.log('ℹ️ Mini App SDK init skipped (not in frame context):', error)
        setIsInitialized(true)
      } finally {
        setIsLoading(false)
      }
    }

    // Call immediately - don't wait for anything
    init()
  }, [])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading, isMiniApp }}>
      {children}
    </FarcasterContext.Provider>
  )
}

