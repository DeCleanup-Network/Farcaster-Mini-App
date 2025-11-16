'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { Award, TrendingUp, Trash2, Loader2, Flame, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import {
  getDCUBalance,
  getStakedDCU,
  getUserLevel,
  getUserTokenId,
  getTokenURI,
  getTokenURIForLevel,
  getStreakCount,
  hasActiveStreak,
  getCleanupStatus,
  claimImpactProductFromVerification,
} from '@/lib/contracts'

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState({
    dcuBalance: 0,
    stakedDCU: 0,
    level: 0,
    streak: 0,
    hasActiveStreak: false,
    tokenURI: '',
    imageUrl: '',
    animationUrl: '',
    metadata: null as { name?: string; description?: string; attributes?: any[] } | null,
  })
  const [cleanupStatus, setCleanupStatus] = useState<{
    cleanupId: bigint | null
    verified: boolean
    claimed: boolean
    level: number
    loading: boolean
  } | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false)
      return
    }

    async function fetchProfileData() {
      try {
        setLoading(true)
        const [
          dcuBalance,
          stakedDCU,
          level,
          streak,
          activeStreak,
        ] = await Promise.all([
          getDCUBalance(address),
          getStakedDCU(address),
          getUserLevel(address),
          getStreakCount(address),
          hasActiveStreak(address),
        ])

        let tokenURI = ''
        let imageUrl = ''
        let animationUrl = ''
        let metadata = null
        
        if (level > 0) {
          try {
            // Get the actual token ID for this user
            const tokenId = await getUserTokenId(address)
            
            if (tokenId > 0n) {
              // Use the actual tokenURI from the contract (more accurate)
              try {
                tokenURI = await getTokenURI(tokenId)
              } catch (error) {
                // Fallback to level-based URI
                console.warn('Failed to get tokenURI from tokenId, using level-based URI:', error)
                tokenURI = await getTokenURIForLevel(level)
              }
            } else {
              // Fallback if no token ID yet
              tokenURI = await getTokenURIForLevel(level)
            }
            
            // Helper function to convert IPFS URL to gateway URL
            // Handles both ipfs://CID/path and ipfs://CID/ formats
            const convertIPFSToGateway = (ipfsUrl: string, gateways?: string[]): string => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return ipfsUrl
              }
              // Remove 'ipfs://' prefix and clean up path
              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/') // Remove double slashes
              if (path.startsWith('/')) path = path.substring(1) // Remove leading slash
              
              const defaultGateways = [
                'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]
              
              const gatewayList = gateways || [process.env.NEXT_PUBLIC_IPFS_GATEWAY || defaultGateways[0], ...defaultGateways]
              return `${gatewayList[0]}${path}`
            }
            
            // Helper function to fetch with multiple gateway fallbacks
            const fetchWithFallback = async (ipfsUrl: string): Promise<Response> => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return fetch(ipfsUrl)
              }
              
              const gateways = [
                process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]
              
              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)
              
              // Try each gateway
              for (const gateway of gateways) {
                try {
                  const url = `${gateway}${path}`
                  console.log(`🔄 Trying gateway: ${url}`)
                  const response = await fetch(url, { 
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    redirect: 'follow'
                  })
                  
                  if (response.ok) {
                    console.log(`✅ Success with gateway: ${gateway}`)
                    return response
                  }
                } catch (error) {
                  console.warn(`⚠️ Gateway ${gateway} failed:`, error)
                  continue
                }
              }
              
              throw new Error(`All IPFS gateways failed for: ${ipfsUrl}`)
            }
            
            // Fetch metadata from IPFS
            if (tokenURI) {
              try {
                console.log('📥 Fetching metadata from:', tokenURI)
                const metadataResponse = await fetchWithFallback(tokenURI)
                
                if (!metadataResponse.ok) {
                  throw new Error(`Failed to fetch metadata: ${metadataResponse.status} ${metadataResponse.statusText}`)
                }
                
                metadata = await metadataResponse.json()
                console.log('✅ Fetched metadata:', { metadata, tokenURI })
                
                // Extract image URL and convert IPFS to gateway URL
                if (metadata?.image) {
                  // Fix old image paths: /images/level1.png -> IP1.png
                  let fixedImagePath = metadata.image
                  const imagesCID = 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
                  
                  // Check if it's the old format: /images/levelX.png
                  if (fixedImagePath.includes('/images/level')) {
                    // Extract level number and convert to IPX.png format
                    const levelMatch = fixedImagePath.match(/level(\d+)\.png/)
                    if (levelMatch) {
                      const levelNum = levelMatch[1]
                      if (levelNum === '10') {
                        fixedImagePath = `ipfs://${imagesCID}/IP10Placeholder.png`
                      } else {
                        fixedImagePath = `ipfs://${imagesCID}/IP${levelNum}.png`
                      }
                      console.log('🔧 Fixed old image path:', { 
                        old: metadata.image, 
                        new: fixedImagePath 
                      })
                    }
                  }
                  
                  imageUrl = convertIPFSToGateway(fixedImagePath)
                  console.log('✅ Image URL converted:', { 
                    original: metadata.image, 
                    fixed: fixedImagePath,
                    converted: imageUrl,
                    level: level 
                  })
                  
                  // Pre-validate the image URL by trying to fetch it
                  try {
                    const testResponse = await fetch(imageUrl, { method: 'HEAD' })
                    if (testResponse.ok) {
                      console.log('✅ Image URL is accessible:', imageUrl)
                    } else {
                      console.warn('⚠️ Image URL returned status:', testResponse.status, imageUrl)
                    }
                  } catch (testError) {
                    console.warn('⚠️ Could not pre-validate image URL:', testError)
                  }
                } else {
                  console.warn('⚠️ No image in metadata:', metadata)
                }
                
                // Extract animation URL (for level 10 video)
                if (metadata?.animation_url) {
                  // Fix old video paths if needed
                  let fixedAnimationPath = metadata.animation_url
                  const imagesCID = 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
                  
                  // Check if it's the old format: /video/level10.mp4
                  if (fixedAnimationPath.includes('/video/level10')) {
                    fixedAnimationPath = `ipfs://${imagesCID}/IP10VIdeo.mp4`
                    console.log('🔧 Fixed old animation path:', { 
                      old: metadata.animation_url, 
                      new: fixedAnimationPath 
                    })
                  }
                  
                  animationUrl = convertIPFSToGateway(fixedAnimationPath)
                  console.log('✅ Animation URL:', { 
                    original: metadata.animation_url, 
                    fixed: fixedAnimationPath,
                    converted: animationUrl 
                  })
                }
              } catch (metadataError) {
                console.error('❌ Error fetching metadata:', metadataError)
                // Try fallback: use level-based metadata from env if available
                const fallbackCID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID
                if (fallbackCID && level > 0) {
                  console.log(`🔄 Trying fallback with CID: ${fallbackCID}`)
                  try {
                    const fallbackUrl = `https://gateway.pinata.cloud/ipfs/${fallbackCID}/level${level}.json`
                    const fallbackResponse = await fetch(fallbackUrl)
                    if (fallbackResponse.ok) {
                      metadata = await fallbackResponse.json()
                      if (metadata?.image) {
                        imageUrl = convertIPFSToGateway(metadata.image)
                      }
                      if (metadata?.animation_url) {
                        animationUrl = convertIPFSToGateway(metadata.animation_url)
                      }
                      console.log('✅ Fallback metadata loaded')
                    }
                  } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching token URI:', error)
          }
        }

        setProfileData({
          dcuBalance,
          stakedDCU,
          level,
          streak,
          hasActiveStreak: activeStreak,
          tokenURI,
          imageUrl,
          animationUrl,
          metadata,
        })
      } catch (error) {
        console.error('Error fetching profile data:', error)
        // Set default values on error to prevent UI from breaking
        setProfileData({
          dcuBalance: 0,
          stakedDCU: 0,
          level: 0,
          streak: 0,
          hasActiveStreak: false,
          tokenURI: '',
          imageUrl: '',
          animationUrl: '',
          metadata: null,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
    
    // Also refresh when page becomes visible (e.g., after returning from claim)
    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected && address) {
        fetchProfileData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [address, isConnected])

  // Check for pending cleanup status
  useEffect(() => {
    if (!isConnected || !address) {
      setCleanupStatus(null)
      return
    }

    async function checkCleanupStatus() {
      try {
        if (!address) {
          setCleanupStatus(null)
          return
        }
        
        // Check localStorage for pending cleanup ID (scoped to user address)
        if (typeof window !== 'undefined') {
          const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
          const pendingCleanupId = localStorage.getItem(pendingKey)
          
          if (pendingCleanupId) {
            setCleanupStatus({ cleanupId: BigInt(pendingCleanupId), verified: false, claimed: false, level: 0, loading: true })
            
            try {
              const status = await getCleanupStatus(BigInt(pendingCleanupId))
              
              // Verify this cleanup belongs to the current user
              if (status.user.toLowerCase() !== address.toLowerCase()) {
                console.log('Cleanup belongs to different user, clearing localStorage')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setCleanupStatus(null)
                return
              }
              
              setCleanupStatus({
                cleanupId: BigInt(pendingCleanupId),
                verified: status.verified,
                claimed: status.claimed,
                level: status.level,
                loading: false,
              })
              
              // If verified and claimed, remove from localStorage
              if (status.verified && status.claimed) {
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                // Clear cleanup status after a moment to hide the card
                setTimeout(() => setCleanupStatus(null), 2000)
              }
            } catch (error: any) {
              console.error('Error fetching cleanup status:', error)
              // If cleanup doesn't exist (e.g., from old contract or new empty contract), clear localStorage
              const errorMessage = error?.message || String(error)
              if (errorMessage.includes('does not exist') || errorMessage.includes('revert')) {
                console.log('Cleanup not found in contract, clearing localStorage...')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setCleanupStatus(null)
              } else {
                setCleanupStatus(prev => prev ? { ...prev, loading: false } : null)
              }
            }
          } else {
            // Check and clear old global keys for backward compatibility
            const oldPendingId = localStorage.getItem('pending_cleanup_id')
            if (oldPendingId) {
              localStorage.removeItem('pending_cleanup_id')
              localStorage.removeItem('pending_cleanup_location')
            }
            setCleanupStatus(null)
          }
        }
      } catch (error) {
        console.error('Error checking cleanup status:', error)
        setCleanupStatus(null)
      }
    }

    checkCleanupStatus()
    // Poll for status updates every 10 seconds
    const interval = setInterval(checkCleanupStatus, 10000)
    return () => clearInterval(interval)
  }, [address, isConnected])

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-white">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to view your profile.
          </p>
          <BackButton href="/" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  const getTierName = (level: number): string => {
    if (level === 0) return 'No Level'
    if (level <= 3) return 'Newbie'
    if (level <= 6) return 'Pro'
    if (level <= 9) return 'Hero'
    if (level === 10) return 'Guardian'
    return 'Unknown'
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <BackButton href="/" />
        </div>
        
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              My Profile
            </h1>
            <p className="text-sm text-gray-400">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (isRefreshing || !address) return
              setIsRefreshing(true)
              try {
                const [
                  dcuBalance,
                  stakedDCU,
                  level,
                  streak,
                  activeStreak,
                ] = await Promise.all([
                  getDCUBalance(address),
                  getStakedDCU(address),
                  getUserLevel(address),
                  getStreakCount(address),
                  hasActiveStreak(address),
                ])

                let tokenURI = ''
                let imageUrl = ''
                let animationUrl = ''
                let metadata = null
                
                if (level > 0) {
                  try {
                    tokenURI = await getTokenURIForLevel(level)
                    
                    // Fetch metadata from IPFS
                    if (tokenURI) {
                      try {
                        let metadataUrl = tokenURI
                        if (tokenURI.startsWith('ipfs://')) {
                          const hash = tokenURI.replace('ipfs://', '')
                          const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
                          metadataUrl = `${gateway}${hash}`
                        }
                        
                        const metadataResponse = await fetch(metadataUrl)
                        metadata = await metadataResponse.json()
                        
                        if (metadata?.image) {
                          if (metadata.image.startsWith('ipfs://')) {
                            const imageHash = metadata.image.replace('ipfs://', '')
                            const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
                            imageUrl = `${gateway}${imageHash}`
                          } else {
                            imageUrl = metadata.image
                          }
                        }
                        
                        if (metadata?.animation_url) {
                          if (metadata.animation_url.startsWith('ipfs://')) {
                            const videoHash = metadata.animation_url.replace('ipfs://', '')
                            const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
                            animationUrl = `${gateway}${videoHash}`
                          } else {
                            animationUrl = metadata.animation_url
                          }
                        }
                      } catch (metadataError) {
                        console.error('Error fetching metadata:', metadataError)
                      }
                    }
                  } catch (error) {
                    console.error('Error fetching token URI:', error)
                  }
                }

                setProfileData({
                  dcuBalance,
                  stakedDCU,
                  level,
                  streak,
                  hasActiveStreak: activeStreak,
                  tokenURI,
                  imageUrl,
                  animationUrl,
                  metadata,
                })
              } catch (error) {
                console.error('Error refreshing profile:', error)
              } finally {
                setIsRefreshing(false)
              }
            }}
            disabled={isRefreshing}
            className="text-gray-400 hover:text-white"
            title="Refresh profile data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-green" />
              <h3 className="text-sm font-medium text-gray-400">
                DCU Points
              </h3>
            </div>
            <p className="text-3xl font-bold text-white">
              {profileData.dcuBalance.toFixed(0)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Exchangeable for $DCU after TGE
            </p>
            {profileData.stakedDCU > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {profileData.stakedDCU.toFixed(0)} staked
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-yellow" />
              <h3 className="text-sm font-medium text-gray-400">
                Impact Product Level
              </h3>
            </div>
            <p className="text-3xl font-bold text-white">
              {profileData.level > 0 ? `Level ${profileData.level}` : 'No Level'}
            </p>
            {profileData.level > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {getTierName(profileData.level)}
              </p>
            )}
          </div>
        </div>

        {/* Additional Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Flame className={`h-4 w-4 ${profileData.hasActiveStreak ? 'text-brand-yellow' : 'text-gray-500'}`} />
              <h3 className="text-xs font-medium text-gray-400">
                Streak
              </h3>
            </div>
            <p className="text-xl font-bold text-white">
              {profileData.streak}
            </p>
            {profileData.hasActiveStreak && (
              <p className="mt-1 text-xs text-brand-yellow">
                Active
              </p>
            )}
          </div>
        </div>

        {/* Cleanup Status Card */}
        {cleanupStatus && cleanupStatus.cleanupId && (
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              {cleanupStatus.loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
              ) : cleanupStatus.verified && cleanupStatus.claimed ? (
                <CheckCircle className="h-5 w-5 text-brand-green" />
              ) : cleanupStatus.verified && !cleanupStatus.claimed ? (
                <CheckCircle className="h-5 w-5 text-brand-yellow" />
              ) : (
                <Clock className="h-5 w-5 text-brand-yellow" />
              )}
              <h2 className="text-lg font-bold uppercase tracking-wide text-white">
                Cleanup Status
              </h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Cleanup ID:</span>
                <span className="text-sm font-mono text-white">
                  #{cleanupStatus.cleanupId.toString()}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status:</span>
                <span className={`text-sm font-semibold ${
                  cleanupStatus.verified && cleanupStatus.claimed
                    ? 'text-brand-green'
                    : cleanupStatus.verified && !cleanupStatus.claimed
                    ? 'text-brand-yellow'
                    : 'text-brand-yellow'
                }`}>
                  {cleanupStatus.loading
                    ? 'Checking...'
                    : cleanupStatus.verified && cleanupStatus.claimed
                    ? 'Verified & Claimed'
                    : cleanupStatus.verified && !cleanupStatus.claimed
                    ? 'Verified - Ready to Claim'
                    : 'Pending Review'}
                </span>
              </div>
              
              {cleanupStatus.verified && cleanupStatus.level > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Assigned Level:</span>
                  <span className="text-sm font-semibold text-white">
                    Level {cleanupStatus.level}
                  </span>
                </div>
              )}
              
              {cleanupStatus.verified && !cleanupStatus.claimed && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-brand-yellow bg-brand-yellow/10 p-3">
                    <p className="text-sm text-brand-yellow">
                      🎉 Your cleanup has been verified! You can now claim your Impact Product NFT.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!cleanupStatus.cleanupId || isClaiming) return
                      
                      try {
                        setIsClaiming(true)
                        const hash = await claimImpactProductFromVerification(cleanupStatus.cleanupId)
                        alert(
                          `✅ Claim transaction submitted!\n\n` +
                          `Transaction Hash: ${hash}\n\n` +
                          `Your Impact Product NFT will be minted once the transaction confirms.\n\n` +
                          `View on CeloScan: https://sepolia.celoscan.io/tx/${hash}`
                        )
                        
                        // Wait for transaction confirmation
                        const { waitForTransactionReceipt } = await import('wagmi/actions')
                        const { config } = await import('@/lib/wagmi')
                        
                        try {
                          await waitForTransactionReceipt(config, { hash, timeout: 60000 })
                          console.log('✅ Claim transaction confirmed!')
                        } catch (waitError) {
                          console.warn('Transaction confirmation wait failed, but continuing:', waitError)
                        }
                        
                        // Poll for status update
                        let pollCount = 0
                        const maxPolls = 10
                        const pollInterval = setInterval(async () => {
                          pollCount++
                          try {
                            const status = await getCleanupStatus(cleanupStatus.cleanupId!)
                            setCleanupStatus({
                              cleanupId: cleanupStatus.cleanupId,
                              verified: status.verified,
                              claimed: status.claimed,
                              level: status.level,
                              loading: false,
                            })
                            
                            if (status.claimed || pollCount >= maxPolls) {
                              clearInterval(pollInterval)
                              // Refresh profile data to show new level
                              window.location.reload()
                            }
                          } catch (error) {
                            console.error('Error polling status:', error)
                            if (pollCount >= maxPolls) {
                              clearInterval(pollInterval)
                              window.location.reload()
                            }
                          }
                        }, 2000) // Poll every 2 seconds
                        
                        // Fallback: reload after max time
                        setTimeout(() => {
                          clearInterval(pollInterval)
                          window.location.reload()
                        }, 20000) // Max 20 seconds
                      } catch (error: any) {
                        console.error('Error claiming:', error)
                        const errorMessage = error?.message || String(error)
                        alert(`Failed to claim: ${errorMessage}`)
                      } finally {
                        setIsClaiming(false)
                      }
                    }}
                    disabled={isClaiming}
                    className="w-full gap-2 bg-brand-yellow text-black hover:bg-[#e6e600] disabled:opacity-50"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Award className="h-4 w-4" />
                        Claim Impact Product NFT
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {!cleanupStatus.verified && !cleanupStatus.loading && (
                <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <p className="text-sm text-gray-300">
                    Your cleanup is being reviewed by our verification team. This usually takes a few hours.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Impact Product Display */}
        {profileData.level > 0 && (
          <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white">
                <Award className="h-5 w-5 text-brand-yellow" />
                Your Impact Product
              </h2>
            </div>
            <div className="rounded-lg border border-gray-800 p-4">
              <div className="mb-4 aspect-square w-full max-w-xs mx-auto rounded-lg bg-gray-800 overflow-hidden">
                {profileData.animationUrl && profileData.level === 10 ? (
                  <video
                    src={profileData.animationUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // Fallback to image if video fails
                      if (profileData.imageUrl) {
                        const img = document.createElement('img')
                        img.src = profileData.imageUrl
                        img.className = 'h-full w-full object-cover'
                        e.currentTarget.parentElement?.replaceChild(img, e.currentTarget)
                      }
                    }}
                  />
                ) : profileData.imageUrl ? (
                  <img
                    src={profileData.imageUrl}
                    alt={`Level ${profileData.level} Impact Product`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement
                      
                      // Prevent infinite loops - check if we've already tried fallbacks
                      const hasTriedFallback = img.dataset.fallbackAttempted === 'true'
                      if (hasTriedFallback) {
                        console.error('❌ All gateways failed for image:', profileData.imageUrl)
                        img.style.display = 'none'
                        // Show placeholder if not already shown
                        if (!img.parentElement?.querySelector('.image-placeholder')) {
                          const placeholder = document.createElement('div')
                          placeholder.className = 'image-placeholder flex h-full items-center justify-center bg-gray-800'
                          placeholder.innerHTML = '<div class="text-center"><svg class="h-16 w-16 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-xs text-gray-500">Image unavailable</p></div>'
                          img.parentElement?.appendChild(placeholder)
                        }
                        return
                      }
                      
                      // Mark that we're trying fallback
                      img.dataset.fallbackAttempted = 'true'
                      console.warn('⚠️ Primary gateway failed, trying fallbacks:', profileData.imageUrl)
                      
                      // Extract IPFS path
                      if (profileData.imageUrl.includes('/ipfs/')) {
                        const ipfsPath = profileData.imageUrl.split('/ipfs/')[1]
                        const fallbackGateways = [
                          `https://ipfs.io/ipfs/${ipfsPath}`,
                          `https://dweb.link/ipfs/${ipfsPath}`,
                          `https://gateway.ipfs.io/ipfs/${ipfsPath}`,
                        ]
                        
                        // Try first fallback gateway
                        const currentGateway = fallbackGateways[0]
                        console.log('🔄 Trying fallback gateway:', currentGateway)
                        img.src = currentGateway
                        
                        // Set up handler for fallback failure
                        img.onerror = () => {
                          console.error('❌ All gateways exhausted for:', ipfsPath)
                          img.style.display = 'none'
                          if (!img.parentElement?.querySelector('.image-placeholder')) {
                            const placeholder = document.createElement('div')
                            placeholder.className = 'image-placeholder flex h-full items-center justify-center bg-gray-800'
                            placeholder.innerHTML = '<div class="text-center"><svg class="h-16 w-16 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-xs text-gray-500">Image unavailable</p><p class="text-xs text-gray-600 mt-1">CID: ' + ipfsPath.substring(0, 20) + '...</p></div>'
                            img.parentElement?.appendChild(placeholder)
                          }
                        }
                      } else {
                        img.style.display = 'none'
                      }
                    }}
                    onLoad={() => {
                      console.log('✅ Image loaded successfully:', profileData.imageUrl)
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-800">
                    <div className="text-center">
                      <Award className="h-16 w-16 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Loading image...</p>
                      {profileData.tokenURI && (
                        <p className="text-xs text-gray-600 mt-1">URI: {profileData.tokenURI.substring(0, 50)}...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold uppercase tracking-wide text-white">
                  {getTierName(profileData.level)} - Level {profileData.level}
                </h3>
                {profileData.metadata?.name && (
                  <p className="mt-1 text-sm text-gray-400">
                    {profileData.metadata.name}
                  </p>
                )}
                {profileData.level === 10 && (
                  <p className="mt-2 text-sm text-brand-yellow">
                    🎉 Guardian Level - Video NFT
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* No Impact Product Message */}
        {profileData.level === 0 && (
          <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
            <Award className="mx-auto mb-4 h-16 w-16 text-gray-600" />
            <h2 className="mb-2 text-xl font-bold uppercase tracking-wide text-white">
              No Impact Product Yet
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Submit your first cleanup to earn your Impact Product NFT and start earning DCU Points!
            </p>
            <Link href="/cleanup">
              <Button className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26]">
                <Trash2 className="h-4 w-4" />
                Submit Your First Cleanup
              </Button>
            </Link>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <Link href="/cleanup">
            <Button className="w-full gap-2 bg-brand-yellow text-black hover:bg-[#e6e600]">
              <Trash2 className="h-4 w-4" />
              Submit New Cleanup
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
