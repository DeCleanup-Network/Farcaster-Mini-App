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
  quickAuthToken: string | null
}

const FarcasterContext = createContext<FarcasterContextType>({
  context: null,
  isInitialized: false,
  isLoading: true,
  isMiniApp: false,
  quickAuthToken: null,
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
  const [quickAuthToken, setQuickAuthToken] = useState<string | null>(null)

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
        
        // Also try to get context directly from SDK as a fallback/verification
        // According to docs: https://miniapps.farcaster.xyz/docs/sdk/context
        // After getting FID from SDK context, you can use it directly
        let directContext: Awaited<typeof sdk.context> | null = null
        try {
          if (env.isMiniApp) {
            directContext = await sdk.context
            console.log('📋 Direct SDK context access:', {
              hasUser: !!directContext?.user,
              userFid: directContext?.user?.fid,
            })
          }
        } catch (directContextError) {
          console.debug('ℹ️ Direct SDK context access failed (using retry method instead):', directContextError)
        }
        
        if (env.isMiniApp && env.context) {
          // We're in a Mini App
          // Get FID directly from SDK context - this is the primary source
          // According to Farcaster SDK docs: https://miniapps.farcaster.xyz/docs/sdk/context
          const rawUser = (env.context as any).user
          const rawContext = env.context as any
          
          // Log raw SDK context for debugging
          console.log('📋 Raw SDK context:', {
            hasUser: !!rawUser,
            userKeys: rawUser ? Object.keys(rawUser) : [],
            userFid: rawUser?.fid,
            contextKeys: Object.keys(rawContext || {}),
          })
          
          // Extract FID directly from SDK context - this is the canonical source
          // Per Farcaster SDK docs: FID is available in sdk.context.user.fid
          // After getting FID, you can use it directly for any operations
          let fid = rawUser?.fid
          if (fid) {
            console.log('✅ FID extracted from SDK context:', fid, '- Ready to use directly')
          } else {
            // Try direct context if available
            if (directContext?.user?.fid) {
              fid = directContext.user.fid
              console.log('✅ FID found in direct SDK context:', fid)
            } else {
              console.warn('⚠️ FID not found in SDK context, user object:', rawUser)
            }
          }
          
          // Initialize user object - even if SDK doesn't provide it, we'll fetch from Neynar
          const transformedContext: FarcasterContextData = {
            user: rawUser ? {
              fid: fid || rawUser.userFid || 0, // Prioritize direct fid from SDK
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
            } : (fid ? {
              // If we have FID but no user object from SDK, create empty user object
              // We'll fill it from Neynar below
              fid: fid,
              username: '',
              displayName: '',
              pfp: { url: '' },
              bio: { text: '' },
              followerCount: 0,
              followingCount: 0,
            } : undefined),
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
          
          // Always fetch user data from Neynar when we have FID
          // This ensures we have complete user data (username, pfp, displayName) for display
          // Following Base docs: https://docs.base.org/mini-apps/core-concepts/authentication
          if (fid) {
            // Ensure we have a user object
            if (!transformedContext.user) {
              transformedContext.user = {
                fid: fid,
                username: '',
                displayName: '',
                pfp: { url: '' },
                bio: { text: '' },
                followerCount: 0,
                followingCount: 0,
          }
            }
            const needsFetch = !transformedContext.user.pfp?.url || !transformedContext.user.username || !transformedContext.user.displayName
            if (needsFetch) {
              console.log('🔄 Fetching user data from Neynar API (FID:', fid, ') - missing:', {
                pfp: !transformedContext.user.pfp?.url,
                username: !transformedContext.user.username,
                displayName: !transformedContext.user.displayName,
              })
            }
            
            // Priority 1: Try Neynar API using FID (most reliable method)
            try {
              const neynarResponse = await fetch(`/api/neynar/user-by-fid?fid=${fid}`)
              if (neynarResponse.ok) {
                const neynarData = await neynarResponse.json()
                // Neynar v2 API returns { result: { user: {...} } }
                const user = neynarData.result?.user || neynarData.user
                if (user) {
                  // Always update with Neynar data (it's more complete and reliable)
                  transformedContext.user.fid = user.fid || fid
                  if (user.pfp_url) {
                    transformedContext.user.pfp.url = user.pfp_url
                  }
                  if (user.username) {
                    transformedContext.user.username = user.username
                  }
                  if (user.display_name) {
                    transformedContext.user.displayName = user.display_name
                  }
                  if (user.profile?.bio?.text) {
                    transformedContext.user.bio.text = user.profile.bio.text
                  }
                  if (user.follower_count !== undefined) {
                    transformedContext.user.followerCount = user.follower_count
                  }
                  if (user.following_count !== undefined) {
                    transformedContext.user.followingCount = user.following_count
                  }
                  console.log('✅ Fetched user data from Neynar API (by FID)', {
                    fid: transformedContext.user.fid,
                    username: transformedContext.user.username,
                    displayName: transformedContext.user.displayName,
                    hasPfp: !!transformedContext.user.pfp?.url,
                    pfpUrl: transformedContext.user.pfp?.url,
                  })
                } else {
                  console.warn('⚠️ Neynar API returned OK but no user data in response')
                }
              } else {
                const errorText = await neynarResponse.text().catch(() => 'Unknown error')
                console.warn('⚠️ Neynar API by FID failed:', neynarResponse.status, errorText)
                
                // Fallback to custody address if FID lookup fails
                const custodyAddress = rawUser?.custodyAddress || rawUser?.custody_address
                if (custodyAddress) {
                  console.log('🔄 Trying Neynar API by custody address:', custodyAddress)
                  const neynarCustodyResponse = await fetch(`/api/neynar/user-by-custody-address?address=${custodyAddress}`)
                  if (neynarCustodyResponse.ok) {
                    const neynarCustodyData = await neynarCustodyResponse.json()
                    const custodyUser = neynarCustodyData.result?.user || neynarCustodyData.user
                    if (custodyUser) {
                      if (custodyUser.pfp_url) {
                        transformedContext.user.pfp.url = custodyUser.pfp_url
                      }
                      if (custodyUser.username) {
                        transformedContext.user.username = custodyUser.username
                      }
                      if (custodyUser.display_name) {
                        transformedContext.user.displayName = custodyUser.display_name
                      }
                      console.log('✅ Fetched user data from Neynar API (by custody address fallback)', {
                        fid: transformedContext.user.fid,
                        hasPfp: !!transformedContext.user.pfp?.url,
                        hasUsername: !!transformedContext.user.username,
                      })
        }
                  } else {
                    console.warn('⚠️ Neynar API by custody address also failed:', neynarCustodyResponse.status)
                  }
                }
              }
            } catch (neynarError) {
              // Priority 2: Optional fallback to Snapchain API (requires self-hosted instance)
              console.warn('⚠️ Neynar API failed, trying Snapchain fallback:', neynarError)
        try {
                const snapchainResponse = await fetch(`/api/snapchain/user-by-fid?fid=${fid}`)
                if (snapchainResponse.ok) {
                  const snapchainData = await snapchainResponse.json()
                  if (snapchainData && !snapchainData.error && snapchainData.fid) {
                    // Merge Snapchain data to fill missing fields
                    if (snapchainData.pfp) {
                      transformedContext.user.pfp.url = snapchainData.pfp
                    }
                    if (snapchainData.displayName) {
                      transformedContext.user.displayName = snapchainData.displayName
                    }
                    if (snapchainData.bio) {
                      transformedContext.user.bio.text = snapchainData.bio
                    }
                    if (snapchainData.username) {
                      transformedContext.user.username = snapchainData.username
                    }
                    console.log('✅ Fetched user data from Snapchain API (fallback)', {
                      fid: transformedContext.user.fid,
                      hasPfp: !!transformedContext.user.pfp?.url,
                      hasDisplayName: !!transformedContext.user.displayName,
                    })
                  }
                } else {
                  console.warn('⚠️ Snapchain API also failed:', snapchainResponse.status)
                }
              } catch (snapchainError) {
                console.warn('⚠️ Failed to fetch user data from all APIs:', {
                  neynarError,
                  snapchainError,
                })
              }
            }
          }
          
          console.log('✅ Farcaster Mini App environment detected', {
            hasUser: !!transformedContext.user,
            fid: transformedContext.user?.fid,
            username: transformedContext.user?.username,
            displayName: transformedContext.user?.displayName,
            hasPfp: !!transformedContext.user?.pfp?.url,
            pfpUrl: transformedContext.user?.pfp?.url,
            rawContextKeys: Object.keys(rawContext || {}), // Log keys for debugging
          })
          
          // Set context with a new object reference to ensure React detects changes
          // This is set AFTER all async fetches (Neynar/Snapchain) have completed
          // This ensures the final context includes all fetched user data
          const contextToSet = {
            ...transformedContext,
            user: transformedContext.user ? {
              ...transformedContext.user,
              pfp: transformedContext.user.pfp ? { ...transformedContext.user.pfp } : { url: '' },
              bio: transformedContext.user.bio ? { ...transformedContext.user.bio } : { text: '' },
            } : undefined,
          }
          
          console.log('🔧 Setting Farcaster context (final state after all fetches):', {
            hasUser: !!contextToSet.user,
            fid: contextToSet.user?.fid,
            username: contextToSet.user?.username,
            displayName: contextToSet.user?.displayName,
            hasPfp: !!contextToSet.user?.pfp?.url,
            pfpUrl: contextToSet.user?.pfp?.url,
          })
          
          // Set context once after all async operations complete
          // This ensures the profile page receives the fully populated context
          setContext(contextToSet)
          
              setIsInitialized(true)
          
          // Fetch Quick Auth token when user context is available
          // Quick Auth provides a JWT session token for authenticated requests
          try {
            const { token } = await sdk.quickAuth.getToken()
            if (token) {
              setQuickAuthToken(token)
              // Optionally store in sessionStorage for persistence across page reloads
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.setItem('farcasterQuickAuthToken', token)
                } catch (storageError) {
                  // sessionStorage might not be available (e.g., in private mode)
                  console.debug('Could not store token in sessionStorage:', storageError)
                }
              }
              console.log('✅ Quick Auth token obtained and stored')
            } else {
              console.log('ℹ️ Quick Auth token is null (user may not be signed in)')
            }
          } catch (quickAuthError) {
            // Quick Auth might not be available or user might not be signed in
            // This is OK - it's optional for client-side only apps
            console.log('ℹ️ Quick Auth not available:', quickAuthError)
            // Try to load from sessionStorage as fallback
            if (typeof window !== 'undefined') {
              try {
                const storedToken = sessionStorage.getItem('farcasterQuickAuthToken')
                if (storedToken) {
                  setQuickAuthToken(storedToken)
                  console.log('✅ Quick Auth token loaded from sessionStorage')
                }
              } catch (storageError) {
                // Ignore sessionStorage errors
              }
            }
          }
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

  // Load Quick Auth token from sessionStorage on mount (if available)
  useEffect(() => {
    if (typeof window !== 'undefined' && !quickAuthToken) {
      try {
        const storedToken = sessionStorage.getItem('farcasterQuickAuthToken')
        if (storedToken) {
          setQuickAuthToken(storedToken)
          console.log('✅ Quick Auth token loaded from sessionStorage on mount')
        }
      } catch (storageError) {
        // sessionStorage might not be available
        console.debug('Could not load token from sessionStorage:', storageError)
      }
    }
  }, [quickAuthToken])

  return (
    <FarcasterContext.Provider value={{ context, isInitialized, isLoading, isMiniApp, quickAuthToken }}>
      {children}
    </FarcasterContext.Provider>
  )
}

