'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import {
  Award,
  TrendingUp,
  Leaf,
  Loader2,
  Flame,
  Clock,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Share2,
  Copy,
} from 'lucide-react'
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
  CONTRACT_ADDRESSES,
} from '@/lib/contracts'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { useChainId } from 'wagmi'
import { shareCast, generateReferralLink, formatImpactShareMessage } from '@/lib/farcaster'

const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

interface ImpactAttribute {
  trait_type?: string
  value?: string | number
}

interface ImpactMetadata {
  name?: string
  description?: string
  external_url?: string
  image?: string
  animation_url?: string
  attributes?: ImpactAttribute[]
}

function extractImpactStats(metadata: ImpactMetadata | null) {
  let impactValue: string | null = null
  let dcuReward: string | null = null

  metadata?.attributes?.forEach((attr) => {
    const trait = attr?.trait_type?.toLowerCase()
    if (!trait) return
    if (trait === 'impact value') {
      impactValue = attr.value != null ? String(attr.value) : null
    } else if (trait === '$dcu' || trait === 'dcu' || trait.includes('dcu')) {
      dcuReward = attr.value != null ? String(attr.value) : null
    }
  })

  return { impactValue, dcuReward }
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [hasMounted, setHasMounted] = useState(false)
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
    metadata: null as ImpactMetadata | null,
    tokenId: null as bigint | null,
    impactValue: null as string | null,
    dcuReward: null as string | null,
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
  const [sharing, setSharing] = useState(false)
  const [copyingField, setCopyingField] = useState<string | null>(null)

  // Prevent hydration mismatch by ensuring we render only after mounting
  useEffect(() => {
    setHasMounted(true)
  }, [])

  const loadProfileData = useCallback(
    async (userAddress: Address, options?: { showSpinner?: boolean }) => {
      const showSpinner = options?.showSpinner ?? true
      try {
        if (showSpinner) {
          setLoading(true)
        }

        const [dcuBalance, stakedDCU, level, streak, activeStreak] = await Promise.all([
          getDCUBalance(userAddress),
          getStakedDCU(userAddress),
          getUserLevel(userAddress),
          getStreakCount(userAddress),
          hasActiveStreak(userAddress),
        ])

        let tokenURI = ''
        let imageUrl = ''
        let animationUrl = ''
        let metadata: ImpactMetadata | null = null
        let tokenId: bigint | null = null
        let impactValue: string | null = null
        let dcuReward: string | null = null

        if (level > 0) {
          try {
            tokenId = await getUserTokenId(userAddress)

            if (tokenId > BigInt(0)) {
              try {
                tokenURI = await getTokenURI(tokenId)
              } catch (error) {
                console.warn('Failed to get tokenURI from tokenId, using level-based URI:', error)
                tokenURI = await getTokenURIForLevel(level)
              }
            } else {
              tokenURI = await getTokenURIForLevel(level)
            }

            const convertIPFSToGateway = (ipfsUrl: string, gateways?: string[]) => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return ipfsUrl
              }
              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)

              const defaultGateways = [
                process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]
              const gatewayList = gateways || defaultGateways
              return `${gatewayList[0]}${path} `
            }

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

              for (const gateway of gateways) {
                try {
                  const url = `${gateway}${path} `
                  const response = await fetch(url, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    redirect: 'follow',
                  })
                  if (response.ok) {
                    return response
                  }
                } catch (error) {
                  console.warn(`Gateway ${gateway} failed: `, error)
                }
              }

              throw new Error(`All IPFS gateways failed for: ${ipfsUrl} `)
            }

            if (tokenURI) {
              try {
                const metadataResponse = await fetchWithFallback(tokenURI)
                if (!metadataResponse.ok) {
                  throw new Error(`Failed to fetch metadata: ${metadataResponse.status} ${metadataResponse.statusText} `)
                }

                metadata = (await metadataResponse.json()) as ImpactMetadata
                const stats = extractImpactStats(metadata)
                impactValue = stats.impactValue
                dcuReward = stats.dcuReward

                if (metadata?.image) {
                  let fixedImagePath = metadata.image
                  const imagesCID =
                    process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
                  if (fixedImagePath.includes('/images/level')) {
                    const levelMatch = fixedImagePath.match(/level(\d+)\.png/)
                    if (levelMatch) {
                      const levelNum = levelMatch[1]
                      fixedImagePath =
                        levelNum === '10'
                          ? `ipfs://${imagesCID}/IP10Placeholder.png`
                          : `ipfs://${imagesCID}/IP${levelNum}.png`
                    }
                  }
                  imageUrl = convertIPFSToGateway(fixedImagePath)
                }

                if (metadata?.animation_url) {
                  let fixedAnimationPath = metadata.animation_url
                  if (fixedAnimationPath.includes('/video/level10')) {
                    fixedAnimationPath = `ipfs://${process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'}/IP10VIdeo.mp4`
                  }
                  animationUrl = convertIPFSToGateway(fixedAnimationPath)
                }
              } catch (metadataError) {
                console.error('❌ Error fetching metadata:', metadataError)
                const fallbackCID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID
                if (fallbackCID && level > 0) {
                  try {
                    const fallbackUrl = `https://gateway.pinata.cloud/ipfs/${fallbackCID}/level${level}.json`
                    const fallbackResponse = await fetch(fallbackUrl)
                    if (fallbackResponse.ok) {
                      metadata = (await fallbackResponse.json()) as ImpactMetadata
                      const stats = extractImpactStats(metadata)
                      impactValue = stats.impactValue
                      dcuReward = stats.dcuReward
                      if (metadata?.image) {
                        imageUrl = convertIPFSToGateway(metadata.image)
                      }
                      if (metadata?.animation_url) {
                        animationUrl = convertIPFSToGateway(metadata.animation_url)
                      }
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
          tokenId,
          impactValue,
          dcuReward,
        })
      } catch (error) {
        console.error('Error fetching profile data:', error)
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
          tokenId: null,
          impactValue: null,
          dcuReward: null,
        })
      } finally {
        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false)
      return
    }

    loadProfileData(address, { showSpinner: true })

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected && address) {
        loadProfileData(address, { showSpinner: false })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [address, isConnected, loadProfileData])

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

              // Check if cleanup is rejected - if so, clear localStorage and allow new submission
              if (status.rejected) {
                console.log('Cleanup is rejected, clearing localStorage to allow new submission')
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

  if (!hasMounted) {
    return <div className="min-h-screen bg-black" />
  }

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

  const impactExplorerUrl =
    profileData.tokenId && CONTRACT_ADDRESSES.IMPACT_PRODUCT
      ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}?a=${profileData.tokenId.toString()}`
      : null
  const impactContractUrl = CONTRACT_ADDRESSES.IMPACT_PRODUCT
    ? `${REQUIRED_BLOCK_EXPLORER_URL}/address/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}`
    : null

  const handleManualCopy = async (value: string, label: string) => {
    if (!value) return
    try {
      setCopyingField(label)
      await navigator.clipboard.writeText(value)
      alert(`${label} copied to clipboard.`)
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error)
      alert(`${label}: ${value}`)
    } finally {
      setCopyingField(null)
    }
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
                await loadProfileData(address, { showSpinner: false })
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
                <span className={`text-sm font-semibold ${cleanupStatus.verified && cleanupStatus.claimed
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
                        // Pass chainId to avoid false chain detection
                        const hash = await claimImpactProductFromVerification(cleanupStatus.cleanupId, chainId)
                        alert(
                          `✅ Claim transaction submitted!\n\n` +
                          `Transaction Hash: ${hash}\n\n` +
                          `Your Impact Product NFT will be minted once the transaction confirms.\n\n` +
                          `View on ${BLOCK_EXPLORER_NAME}: ${getExplorerTxUrl(hash)}`
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
                        <span>Hang on, your Impact Product is being minted...</span>
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
                {profileData.metadata?.description && (
                  <p className="mt-2 text-sm text-gray-500">
                    {profileData.metadata.description}
                  </p>
                )}
                {profileData.level === 10 && (
                  <p className="mt-2 text-sm text-brand-yellow">
                    🎉 Guardian Level - Video NFT
                  </p>
                )}
                <div className="mt-4 grid gap-3 text-left text-sm text-gray-300 sm:grid-cols-2">
                  {profileData.impactValue && (
                    <div className="rounded-lg border border-gray-800 bg-gray-800/60 p-3">
                      <p className="text-xs text-gray-400">Impact Value</p>
                      <p className="text-lg font-semibold text-white">{profileData.impactValue}</p>
                    </div>
                  )}
                  {profileData.dcuReward && (
                    <div className="rounded-lg border border-gray-800 bg-gray-800/60 p-3">
                      <p className="text-xs text-gray-400">DCU Reward</p>
                      <p className="text-lg font-semibold text-white">{profileData.dcuReward} DCU</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium text-gray-400">
                    View your NFT on-chain and load it into any wallet:
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {impactExplorerUrl && (
                      <Link href={impactExplorerUrl} target="_blank" rel="noopener noreferrer" className="sm:flex-1">
                        <Button
                          variant="outline"
                          className="w-full gap-2 border-brand-green bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View on {BLOCK_EXPLORER_NAME}
                        </Button>
                      </Link>
                    )}
                  </div>
                  {profileData.tokenId && (
                    <div className="space-y-3 rounded-lg border border-gray-800 bg-black/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Manual wallet import
                      </p>
                      <p className="text-sm text-gray-300">
                        Wallets now require adding collectibles manually. Copy these details:
                      </p>
                      {CONTRACT_ADDRESSES.IMPACT_PRODUCT && (
                        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                            <span>Contract Address</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleManualCopy(CONTRACT_ADDRESSES.IMPACT_PRODUCT, 'Contract address')
                              }
                              className="flex items-center gap-1 text-brand-green hover:text-brand-yellow"
                              disabled={copyingField === 'Contract address'}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {copyingField === 'Contract address' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          {impactContractUrl ? (
                            <a
                              href={impactContractUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all font-mono text-xs text-white underline-offset-2 hover:underline"
                            >
                              {CONTRACT_ADDRESSES.IMPACT_PRODUCT}
                            </a>
                          ) : (
                            <p className="break-all font-mono text-xs text-white">
                              {CONTRACT_ADDRESSES.IMPACT_PRODUCT}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                          <span>Collectible ID</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleManualCopy(profileData.tokenId?.toString() || '', 'Collectible ID')
                            }
                            className="flex items-center gap-1 text-brand-green hover:text-brand-yellow"
                            disabled={copyingField === 'Collectible ID'}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copyingField === 'Collectible ID' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="font-mono text-xs text-white">{profileData.tokenId?.toString()}</p>
                      </div>
                      <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-400">
                        <li>Open your wallet → NFTs / Collectibles → Import or Add manually.</li>
                        <li>Paste the contract address above.</li>
                        <li>Enter the collectible ID and confirm to view your Impact Product.</li>
                      </ol>
                    </div>
                  )}
                  {/* Share buttons */}
                  {address && profileData.level > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-400">
                        Share your Impact Product and invite friends:
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          onClick={async () => {
                            if (sharing || !address) return
                            setSharing(true)
                            try {
                              const link = generateReferralLink(address, 'farcaster')
                              const text = formatImpactShareMessage(profileData.level, link)
                              await shareCast(text, link)
                            } catch (error) {
                              console.error('Failed to share:', error)
                            } finally {
                              setSharing(false)
                            }
                          }}
                          disabled={sharing}
                          className="w-full gap-2 bg-purple-600 text-white hover:bg-purple-700 sm:flex-1"
                        >
                          {sharing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Sharing...</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-4 w-4" />
                              Share on Farcaster
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            if (!address) return
                            const link = generateReferralLink(address, 'web')
                            const text = formatImpactShareMessage(profileData.level, link)
                            const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
                            window.open(xUrl, '_blank')
                          }}
                          variant="outline"
                          className="w-full gap-2 border-gray-700 bg-black text-white hover:bg-gray-800 sm:flex-1"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                          Share on X
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!address) return
                            const link = generateReferralLink(address, 'copy')
                            const message = formatImpactShareMessage(profileData.level, link)
                            try {
                              await navigator.clipboard.writeText(message)
                              alert('Share message copied to clipboard!')
                            } catch (error) {
                              alert(message)
                            }
                          }}
                          variant="outline"
                          className="w-full gap-2 border-gray-700 bg-black text-white hover:bg-gray-800 sm:flex-1"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
                <Leaf className="h-4 w-4" />
                Submit Your First Cleanup
              </Button>
            </Link>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <Link href="/cleanup">
            <Button className="w-full gap-2 bg-brand-yellow text-black hover:bg-[#e6e600]">
              <Leaf className="h-4 w-4" />
              Submit New Cleanup
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
