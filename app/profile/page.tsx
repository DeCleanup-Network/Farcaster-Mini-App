'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import Image from 'next/image'
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
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
} from 'lucide-react'
import { ImportTokenModal } from '@/components/wallet/ImportTokenModal'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  getClaimFee,
  getTotalRewardsDistributed,
  getRewardsBreakdown,
  CONTRACT_ADDRESSES,
  checkReferralEligibility,
  VERIFICATION_ABI,
} from '@/lib/contracts'
import { useBuilderCodeAttribution } from '@/lib/hooks/useBuilderCode'
import { useFarcasterReady } from '@/lib/hooks/useFarcasterReady'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { useChainId } from 'wagmi'
import { generateReferralLink, formatReferralMessage } from '@/lib/farcaster'
import { SuccessModal } from '@/components/ui/success-modal'
import { useFeatureLock } from '@/lib/hooks/useFeatureLock'
import { FeatureLockedNotice } from '@/components/ui/FeatureLockedNotice'

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
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfileContent />
    </Suspense>
  )
}

// Component to display claim fee
function ClaimFeeDisplay() {
  const [claimFee, setClaimFee] = useState<{ fee: bigint; enabled: boolean } | null>(null)
  
  useEffect(() => {
    async function loadClaimFee() {
      try {
        const feeInfo = await getClaimFee()
        setClaimFee(feeInfo)
      } catch (error) {
        console.error('Error loading claim fee:', error)
        setClaimFee({ fee: BigInt(0), enabled: false })
      }
    }
    loadClaimFee()
  }, [])
  
  if (!claimFee || !claimFee.enabled || claimFee.fee === BigInt(0)) {
    return null
  }
  
  const feeInEth = Number(claimFee.fee) / 1e18
  const feeInCents = feeInEth * 2800 // Approximate ETH price for display
  
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-2">
      <p className="text-xs text-gray-400">
        Claim fee: ~{feeInCents.toFixed(2)} cents USD ({feeInEth.toFixed(8)} ETH)
      </p>
    </div>
  )
}

function ProfileContent() {
  // Ensure ready() is called early on this landing page
  useFarcasterReady()
  
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const searchParams = useSearchParams()
  const [hasMounted, setHasMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const featureLock = useFeatureLock()
  const { sendWithBuilderCode } = useBuilderCodeAttribution()
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
    totalRewardsDistributed: 0,
    rewardsBreakdown: {
      levelRewards: 0,
      cleanupCount: 0,
      streakRewards: 0,
      referralRewards: 0,
      impactFormRewards: 0,
      verifierRewards: 0,
      total: 0,
    },
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
  const [copyingField, setCopyingField] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{
    title: string
    message: string
    transactionHash?: string
    level?: number
  } | null>(null)
  const [breakdownExpanded, setBreakdownExpanded] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<Address | null>(null)
  const [showReferralNotification, setShowReferralNotification] = useState(false)
  const [referralEligible, setReferralEligible] = useState<boolean | null>(null)
  const [referralIneligibleReason, setReferralIneligibleReason] = useState<string | null>(null)

  // Prevent hydration mismatch by ensuring we render only after mounting
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Capture referral codes from profile links as fallback (Safari-compatible)
  useEffect(() => {
    if (!hasMounted || typeof window === 'undefined') return
    
    // Safari-compatible: Try multiple methods to get ref parameter
    let ref: string | null = null
    
    // Method 1: Try useSearchParams (Next.js)
    if (searchParams) {
      ref = searchParams.get('ref')
    }
    
    // Method 2: Fallback to window.location.search (Safari compatibility)
    if (!ref) {
      const urlParams = new URLSearchParams(window.location.search)
      ref = urlParams.get('ref')
    }
    
    // Method 3: Try window.location.hash (for some deep link scenarios)
    if (!ref && window.location.hash) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
        ref = hashParams.get('ref')
      } catch (e) {
        // Ignore hash parsing errors
      }
    }
    
    if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
      const referrerAddr = ref as Address
      setReferrerAddress(referrerAddr)
      try {
        localStorage.setItem('referrer_pending', ref)
        console.log('✅ Profile: Referrer address saved (pending):', ref)
        if (address) {
          localStorage.setItem(`referrer_${address.toLowerCase()}`, ref)
          console.log('✅ Profile: Referrer address saved for address:', address)
        }
      } catch (e) {
        console.error('Failed to save referrer to localStorage:', e)
      }
    } else {
      setReferrerAddress(null)
      setShowReferralNotification(false)
    }
  }, [hasMounted, searchParams, address])

  // Check referral eligibility when address and referrer are available
  useEffect(() => {
    if (!address || !referrerAddress || !isConnected) {
      setReferralEligible(null)
      setReferralIneligibleReason(null)
      setShowReferralNotification(false)
      return
    }

    async function checkEligibility() {
      if (!address) return
      
      try {
        const eligibility = await checkReferralEligibility(address)
        setReferralEligible(eligibility.eligible)
        setReferralIneligibleReason(eligibility.reason || null)
        setShowReferralNotification(true)
      } catch (error) {
        console.error('Error checking referral eligibility:', error)
        setReferralEligible(true) // On error, assume eligible (contract will reject if not)
        setShowReferralNotification(true)
      }
    }
    checkEligibility()
  }, [address, referrerAddress, isConnected])

  const loadProfileData = useCallback(
    async (userAddress: Address, options?: { showSpinner?: boolean }) => {
      const showSpinner = options?.showSpinner ?? true
      try {
        if (showSpinner) {
          setLoading(true)
        }

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile data loading timeout')), 30000)
        )

        const dataPromise = Promise.all([
          getDCUBalance(userAddress),
          getStakedDCU(userAddress),
          getUserLevel(userAddress),
          getStreakCount(userAddress),
          hasActiveStreak(userAddress),
          getTotalRewardsDistributed(userAddress),
        ])

        const [dcuBalance, stakedDCU, level, streak, activeStreak, totalRewardsDistributed] = await Promise.race([
          dataPromise,
          timeoutPromise,
        ]) as Awaited<typeof dataPromise>

        // Get detailed breakdown from events (query actual rewards distributed)
        const rewardsBreakdown = await getRewardsBreakdown(userAddress).catch((error) => {
          console.error('Error fetching rewards breakdown:', error)
          return {
            levelRewards: 0,
            cleanupCount: 0,
            streakRewards: 0,
            referralRewards: 0,
            impactFormRewards: 0,
            verifierRewards: 0,
            total: 0,
          }
        })

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
          totalRewardsDistributed,
          rewardsBreakdown,
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
          totalRewardsDistributed: 0,
          rewardsBreakdown: {
            levelRewards: 0,
            cleanupCount: 0,
            streakRewards: 0,
            referralRewards: 0,
            impactFormRewards: 0,
            verifierRewards: 0,
            total: 0,
          },
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
    return <div className="min-h-screen bg-background" />
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-foreground">
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

  const ReferralNotification = () => {
    if (!showReferralNotification || !referrerAddress) return null
    
    // Show loading state while checking eligibility
    if (referralEligible === null) {
      return (
        <div className="mb-6 rounded-lg border-2 border-gray-600 bg-gray-900/50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-bold uppercase text-gray-300">Checking Referral Eligibility...</h3>
              <p className="text-sm text-gray-400">Verifying if you're eligible for a referral reward.</p>
            </div>
          </div>
        </div>
      )
    }
    
    // Show ineligible message if user already used referral
    if (referralEligible === false) {
      return (
        <div className="mb-6 rounded-lg border-2 border-brand-yellow/50 bg-brand-yellow/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-brand-yellow" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-bold uppercase text-brand-yellow">Referral Not Eligible</h3>
              <p className="text-sm text-gray-300">{referralIneligibleReason || 'You have already used a referral link. Each user can only receive referral rewards once.'}</p>
              <p className="mt-2 text-xs text-gray-400">You can still submit cleanups and earn rewards, but you won't receive additional referral rewards.</p>
            </div>
            <button
              onClick={() => setShowReferralNotification(false)}
              className="flex-shrink-0 text-gray-400 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )
    }
    
    // Show eligible message - redirect to cleanup page
    return (
      <div className="mb-6 rounded-lg border-2 border-brand-green bg-brand-green/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Users className="h-5 w-5 text-brand-green" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">🎉 You Were Invited!</h3>
            <p className="text-sm text-gray-300">
              You've been referred to DeCleanup Rewards! When you submit your first cleanup and it gets verified, both you and your referrer will earn <strong className="text-white">3 $bDCU</strong> each.
            </p>
            <Link href={`/cleanup?ref=${referrerAddress}`}>
              <Button className="mt-3 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]">
                <Leaf className="h-4 w-4" />
                Submit Your First Cleanup
              </Button>
            </Link>
          </div>
          <button
            onClick={() => setShowReferralNotification(false)}
            className="flex-shrink-0 text-gray-400 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header - moved back button inside the flex container */}
        <div className="mb-6 flex items-start justify-between">
          <BackButton href="/" />
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

        {/* Referral Notification */}
        <ReferralNotification />

        {/* Stats Grid - Total Balance and Total Rewards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 relative">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-green" />
              <h3 className="text-sm font-sans font-medium text-gray-400 normal-case">
                Total $bDCU
              </h3>
              <ImportTokenModal type="token" onCopy={handleManualCopy} />
            </div>
            {/* Token logo in top right corner */}
            <div className="absolute top-4 right-4">
              <div className="relative h-12 w-12 rounded-full border-2 border-gray-700 bg-gray-800 p-1">
                <Image
                  src="https://gateway.pinata.cloud/ipfs/bafkreifk3qijhbmrcr6uadoihyinaayogc73hzbfc2hm3yvvrmdrbi4sn4?filename=DCUTokenLogo.png"
                  alt="$bDCU Token"
                  fill
                  className="object-contain rounded-full"
                  sizes="48px"
                />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {profileData.dcuBalance.toFixed(0)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              All tokens in your wallet
            </p>
            {profileData.stakedDCU > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {profileData.stakedDCU.toFixed(0)} staked
              </p>
            )}
          </div>

          <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-6">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-green" />
              <h3 className="text-sm font-sans font-medium text-gray-300 normal-case">
                Total Rewards
              </h3>
            </div>
            <p className="text-3xl font-bold text-brand-green">
              {profileData.totalRewardsDistributed > 0 ? profileData.totalRewardsDistributed.toFixed(0) : '0'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              From all app actions
            </p>
          </div>
        </div>

        {/* Reward Breakdown - Expandable */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <button
            onClick={() => setBreakdownExpanded(!breakdownExpanded)}
            className="flex w-full items-center justify-between hover:bg-gray-800/50 rounded-lg p-2 -m-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-green" />
              <h2 className="text-lg font-bold uppercase tracking-wide text-white">
                Reward Breakdown
              </h2>
            </div>
            {breakdownExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {breakdownExpanded && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-brand-yellow" />
                  <div>
                    <span className="text-sm font-medium text-white">Cleanups - Claims of Impact Product</span>
                    <p className="text-xs text-gray-400">
                      {profileData.rewardsBreakdown.cleanupCount} cleanup{profileData.rewardsBreakdown.cleanupCount !== 1 ? 's' : ''} = {profileData.rewardsBreakdown.cleanupCount} level claim{profileData.rewardsBreakdown.cleanupCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {profileData.rewardsBreakdown.levelRewards.toFixed(2)} $bDCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-brand-green" />
                  <div>
                    <span className="text-sm font-medium text-white">Referrals</span>
                    <p className="text-xs text-gray-400">Rewards for referring new users</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {profileData.rewardsBreakdown.referralRewards.toFixed(2)} $bDCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <Flame className="h-5 w-5 text-brand-yellow" />
                  <div>
                    <span className="text-sm font-medium text-white">Streak</span>
                    <p className="text-xs text-gray-400">Weekly streak maintenance rewards</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {profileData.rewardsBreakdown.streakRewards.toFixed(2)} $bDCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-brand-green" />
                  <div>
                    <span className="text-sm font-medium text-white">Impact Reports</span>
                    <p className="text-xs text-gray-400">Submission of impact reports</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {profileData.rewardsBreakdown.impactFormRewards.toFixed(2)} $bDCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-brand-green" />
                  <div>
                    <span className="text-sm font-medium text-white">Verifier Rewards</span>
                    <p className="text-xs text-gray-400">Rewards for verifying cleanups</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {profileData.rewardsBreakdown.verifierRewards.toFixed(2)} $bDCU
                </span>
              </div>
            </div>
          )}
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
                  <ClaimFeeDisplay />
                  {featureLock.isLocked && <FeatureLockedNotice />}
                  <Button
                    disabled={featureLock.isLocked || isClaiming}
                    onClick={async () => {
                      if (!cleanupStatus.cleanupId || isClaiming) return
                      if (featureLock.isLocked) {
                        alert(featureLock.lockMessage)
                        return
                      }

                      try {
                        setIsClaiming(true)
                        
                        // Double-check cleanup status before claiming
                        try {
                          const { getCleanupStatus } = await import('@/lib/contracts')
                          const status = await getCleanupStatus(cleanupStatus.cleanupId!)
                          if (status.claimed) {
                            alert('This Impact Product has already been claimed. Refreshing...')
                            window.location.reload()
                            return
                          }
                        } catch (statusCheckError) {
                          console.warn('Could not check cleanup status before claim:', statusCheckError)
                          // Continue anyway - the claim function will check
                        }
                        
                        // Create transaction sender with Builder Code attribution
                        const sendTransaction = async (params: {
                          address: Address
                          abi: typeof VERIFICATION_ABI
                          functionName: 'claimImpactProduct'
                          args: readonly unknown[]
                          value: bigint
                        }) => {
                          return await sendWithBuilderCode({
                            to: params.address,
                            abi: params.abi,
                            functionName: params.functionName,
                            args: params.args,
                            value: params.value,
                          })
                        }

                        // Pass chainId to avoid false chain detection
                        const hash = await claimImpactProductFromVerification(
                          cleanupStatus.cleanupId,
                          chainId,
                          sendTransaction // Pass Builder Code transaction sender
                        )
                        
                        // Show styled success modal instead of alert
                        setSuccessModalData({
                          title: 'Impact Product Minted!',
                          message: 'Your Impact Product has been successfully minted!',
                          transactionHash: hash,
                        })
                        setShowSuccessModal(true)

                        // Wait for transaction confirmation with better error handling
                        const { waitForTransactionReceipt } = await import('wagmi/actions')
                        const { config } = await import('@/lib/wagmi')

                        try {
                          // Use a longer timeout and handle "block not found" errors gracefully
                          await waitForTransactionReceipt(config, { 
                            hash, 
                            timeout: 120000, // 2 minutes
                            retryCount: 10,
                            retryDelay: 2000,
                          })
                          console.log('✅ Claim transaction confirmed!')
                        } catch (waitError: any) {
                          // "Block not found" errors are often temporary - transaction might still succeed
                          const errorMessage = String(waitError?.message || waitError || '')
                          if (
                            errorMessage.includes('block not found') ||
                            errorMessage.includes('Requested resource not found') ||
                            errorMessage.includes('ResourceNotFound')
                          ) {
                            console.warn('Transaction receipt check failed (block not found - may be temporary):', waitError)
                            console.log('Transaction was submitted. It may still be processing. Polling for status...')
                          } else {
                            console.warn('Transaction confirmation wait failed, but continuing:', waitError)
                          }
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
                              // Update success modal with level for sharing
                              if (status.claimed && status.level) {
                                setSuccessModalData({
                                  title: 'Impact Product Minted!',
                                  message: 'Your Impact Product has been successfully minted!',
                                  transactionHash: hash,
                                  level: status.level,
                                })
                                setShowSuccessModal(true)
                                // Don't reload immediately - let user share first
                                setTimeout(() => {
                                  window.location.reload()
                                }, 5000) // Reload after 5 seconds
                              } else {
                                // Refresh profile data to show new level
                                window.location.reload()
                              }
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
                        
                        // Check if user rejected the transaction
                        if (
                          error?.code === 4001 ||
                          errorMessage.includes('User rejected') ||
                          errorMessage.includes('User denied') ||
                          errorMessage.includes('rejected the request')
                        ) {
                          console.log('User cancelled transaction')
                          // Don't show an error for user cancellation
                        } else if (
                          errorMessage.includes('already been claimed') ||
                          errorMessage.includes('already claimed')
                        ) {
                          // Already claimed - refresh status and show message
                          alert(
                            'This Impact Product has already been claimed.\n\n' +
                            'Refreshing your profile...'
                          )
                          // Refresh the page to show updated status
                          window.location.reload()
                        } else {
                          // Show error for actual failures
                          alert(`Failed to claim: ${errorMessage}`)
                        }
                      } finally {
                        setIsClaiming(false)
                      }
                    }}
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
                        Claim Impact Product
                      </>
                    )}
                  </Button>
                  {featureLock.isLocked && (
                    <p className="mt-2 text-xs text-yellow-400 text-center">
                      Connect Farcaster wallet to claim
                    </p>
                  )}
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
              {profileData.tokenId && (
                <ImportTokenModal type="nft" tokenId={Number(profileData.tokenId)} onCopy={handleManualCopy} />
              )}
            </div>
            <div className="rounded-lg border border-gray-800 p-4">
              <div className="mb-4 aspect-square w-full max-w-xs mx-auto rounded-lg bg-gray-800 flex items-center justify-center">
                {profileData.animationUrl && profileData.level === 10 ? (
                  // Check if it's a GIF or MP4
                  profileData.animationUrl.toLowerCase().endsWith('.gif') ? (
                    <img
                      src={profileData.animationUrl}
                      alt={`Level ${profileData.level} Impact Product`}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        // Fallback to video if GIF fails
                        if (profileData.imageUrl) {
                          const video = document.createElement('video')
                          video.src = profileData.animationUrl
                          video.className = 'h-full w-full object-contain'
                          video.setAttribute('autoplay', '')
                          video.setAttribute('loop', '')
                          video.setAttribute('muted', '')
                          video.setAttribute('playsinline', '')
                          e.currentTarget.parentElement?.replaceChild(video, e.currentTarget)
                        }
                      }}
                    />
                  ) : (
                    <video
                      src={profileData.animationUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        // Fallback to image if video fails
                        if (profileData.imageUrl) {
                          const img = document.createElement('img')
                          img.src = profileData.imageUrl
                          img.className = 'h-full w-full object-contain'
                          e.currentTarget.parentElement?.replaceChild(img, e.currentTarget)
                        }
                      }}
                    />
                  )
                ) : profileData.imageUrl ? (
                  <img
                    src={profileData.imageUrl}
                    alt={`Level ${profileData.level} Impact Product`}
                    className="h-full w-full object-contain"
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
                      <p className="text-xs text-gray-400">Token Reward</p>
                      <p className="text-lg font-mono font-semibold text-white">{profileData.dcuReward} $bDCU</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  {/* Share buttons removed - now shown in success modal after minting */}
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
              Submit your first cleanup to earn your Impact Product NFT and start earning $bDCU!
            </p>
            <Link href="/cleanup">
              <Button className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26]">
                <Leaf className="h-4 w-4" />
                Submit Your First Cleanup
              </Button>
            </Link>
          </section>
        )}

        {/* Success Modal */}
        {showSuccessModal && successModalData && (
          <SuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false)
              setSuccessModalData(null)
            }}
            title={successModalData.title}
            message={successModalData.message}
            transactionHash={successModalData.transactionHash}
            explorerUrl={successModalData.transactionHash ? getExplorerTxUrl(successModalData.transactionHash as `0x${string}`) : undefined}
            explorerName={BLOCK_EXPLORER_NAME}
            showShare={!!successModalData.level && successModalData.level > 0}
            level={successModalData.level}
          />
        )}

      </div>
    </div>
  )
}

function ProfilePageFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-20">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/" />
        <div className="mt-8 flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
        </div>
      </div>
    </div>
  )
}
