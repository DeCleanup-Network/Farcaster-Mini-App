'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useAccount, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
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
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  History,
} from 'lucide-react'
import { ImportTokenModal } from '@/components/wallet/ImportTokenModal'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  getDCUBalance,
  getDCUPointsBalance,
  getStakedDCU,
  getStakedBalance,
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
  claimTokensFromPoints,
  calculateClaimAmount,
  stakeTokensForVerifier,
  unstakeTokens,
  isUserVerifier,
  hasMinimumLevelForStaking,
  getCurrentTokenPrice,
  getTargetRewardValue,
} from '@/lib/contracts'
import { useBuilderCodeAttribution } from '@/lib/hooks/useBuilderCode'
import { useFarcasterReady } from '@/lib/hooks/useFarcasterReady'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { useChainId } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { generateReferralLink, formatReferralMessage } from '@/lib/farcaster'
import { SuccessModal } from '@/components/ui/success-modal'
import { useFeatureLock } from '@/lib/hooks/useFeatureLock'
import { FeatureLockedNotice } from '@/components/ui/FeatureLockedNotice'

const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

// Token logo with fallback URLs
const TOKEN_LOGO_IPFS_HASH = 'bafkreifk3qijhbmrcr6uadoihyinaayogc73hzbfc2hm3yvvrmdrbi4sn4'
const TOKEN_LOGO_URLS = [
  `https://gateway.pinata.cloud/ipfs/${TOKEN_LOGO_IPFS_HASH}?filename=DCUTokenLogo.png`,
  `https://ipfs.io/ipfs/${TOKEN_LOGO_IPFS_HASH}?filename=DCUTokenLogo.png`,
  `https://cloudflare-ipfs.com/ipfs/${TOKEN_LOGO_IPFS_HASH}?filename=DCUTokenLogo.png`,
  `https://dweb.link/ipfs/${TOKEN_LOGO_IPFS_HASH}?filename=DCUTokenLogo.png`,
]

function TokenLogo() {
  const [logoUrl, setLogoUrl] = useState(TOKEN_LOGO_URLS[0])
  const [fallbackIndex, setFallbackIndex] = useState(0)

  const handleImageError = () => {
    const nextIndex = fallbackIndex + 1
    if (nextIndex < TOKEN_LOGO_URLS.length) {
      setFallbackIndex(nextIndex)
      setLogoUrl(TOKEN_LOGO_URLS[nextIndex])
    }
  }

  return (
    <Image
      src={logoUrl}
      alt="$bDCU Token"
      fill
      className="object-contain rounded-full"
      sizes="48px"
      onError={handleImageError}
    />
  )
}

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
  const { context: farcasterContext, isMiniApp, isLoading: farcasterLoading } = useFarcaster()
  
  // Debug logging for profile display
  useEffect(() => {
    console.log('🔍 Profile page - Farcaster context check:', {
      isMiniApp,
      farcasterLoading,
      hasContext: !!farcasterContext,
      hasUser: !!farcasterContext?.user,
      userFid: farcasterContext?.user?.fid,
      username: farcasterContext?.user?.username,
      displayName: farcasterContext?.user?.displayName,
      hasPfp: !!farcasterContext?.user?.pfp?.url,
      pfpUrl: farcasterContext?.user?.pfp?.url,
      fullContext: farcasterContext, // Log full context for debugging
    })
  }, [isMiniApp, farcasterLoading, farcasterContext])
  
  const chainId = useChainId()
  const searchParams = useSearchParams()
  const [hasMounted, setHasMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const featureLock = useFeatureLock()
  const { sendWithBuilderCode } = useBuilderCodeAttribution()
  const [profileData, setProfileData] = useState({
    dcuBalance: 0, // Token balance in wallet
    dcuPoints: 0, // DCU points balance
    stakedDCU: 0, // Staked tokens (old system)
    stakedBalance: BigInt(0), // Staked tokens (new system, in wei)
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
      retroRewards: 0,
      total: 0,
    },
    isVerifier: false,
    hasMinimumLevel: false,
    currentTokenPrice: 0,
    targetRewardValue: 90,
  })
  const [claimPoints, setClaimPoints] = useState<string>('')
  const [claimableTokens, setClaimableTokens] = useState<bigint>(BigInt(0))
  const [isClaimingPoints, setIsClaimingPoints] = useState(false)
  const [showClaimConfirmModal, setShowClaimConfirmModal] = useState(false)
  const [calculatedClaimAmount, setCalculatedClaimAmount] = useState<bigint>(BigInt(0))
  const [isStaking, setIsStaking] = useState(false)
  const [stakeAmount, setStakeAmount] = useState<string>('')
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

  // Use wagmi's useEnsName hook for ENS resolution (web flow only)
  // This is the recommended way to resolve ENS names
  const { data: ensName, isLoading: ensLoading } = useEnsName({
    address: !isMiniApp && isConnected && address ? address : undefined,
    chainId: mainnet.id, // ENS is on mainnet
    query: {
      enabled: !isMiniApp && isConnected && !!address, // Only query on web when connected
      retry: 2, // Retry up to 2 times
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    },
  })
  
  // Debug ENS resolution
  useEffect(() => {
    if (!isMiniApp && isConnected && address) {
      console.log('Profile ENS resolution:', { address, ensName, ensLoading, isConnected })
    }
  }, [isMiniApp, isConnected, address, ensName, ensLoading])

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
          getDCUPointsBalance(userAddress).catch(() => 0), // Try new points system, fallback to 0
          getStakedDCU(userAddress),
          getStakedBalance(userAddress).catch(() => BigInt(0)), // Try new staking system
          getUserLevel(userAddress),
          getStreakCount(userAddress),
          hasActiveStreak(userAddress),
          getTotalRewardsDistributed(userAddress),
          isUserVerifier(userAddress).catch(() => false),
          hasMinimumLevelForStaking(userAddress).catch(() => false),
          getCurrentTokenPrice().catch(() => 0),
          getTargetRewardValue().catch(() => 90),
        ])

        // Load main data and rewards breakdown in parallel
        const [mainData, rewardsBreakdown] = await Promise.all([
          Promise.race([
            dataPromise,
            timeoutPromise,
          ]) as Promise<Awaited<typeof dataPromise>>,
          getRewardsBreakdown(userAddress).catch((error) => {
            console.error('Error fetching rewards breakdown:', error)
            return {
              levelRewards: 0,
              cleanupCount: 0,
              streakRewards: 0,
              referralRewards: 0,
              impactFormRewards: 0,
              verifierRewards: 0,
              retroRewards: 0,
              total: 0,
            }
          }),
        ])

        const [dcuBalance, dcuPoints, stakedDCU, stakedBalance, level, streak, activeStreak, totalRewardsDistributed, isVerifier, hasMinimumLevel, currentTokenPrice, targetRewardValue] = mainData

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
              return `${gatewayList[0]}${path}`.trim()
            }

            const fetchWithFallback = async (ipfsUrl: string, timeout = 3000): Promise<Response> => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return fetch(ipfsUrl)
              }

              // Helper function to create a new timeout promise for each race
              // Once a promise rejects, it stays rejected, so we need a fresh one for each Promise.race()
              const createTimeoutPromise = () => new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('IPFS fetch timeout')), timeout)
              )

              // Try server-side proxy first (bypasses CORS, faster)
              try {
                const path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
                const proxyUrl = `/api/ipfs/fetch?path=${encodeURIComponent(path)}`
                const proxyResponse = await Promise.race([
                  fetch(proxyUrl),
                  createTimeoutPromise(), // Create new timeout promise for this race
                ])
                if (proxyResponse.ok) {
                  return proxyResponse
                }
              } catch (proxyError) {
                // Silently fail and try direct gateways
              }

              // Fallback to direct gateways with timeout
              // Include configured gateway first if available
              const configuredGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY
              const gateways = [
                ...(configuredGateway ? [configuredGateway] : []),
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]

              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)

              // Try gateways in parallel with timeout
              // Each Promise.race() needs its own timeout promise
              const gatewayPromises = gateways.map(async (gateway) => {
                try {
                  const url = `${gateway}${path}`.trim()
                  const response = await Promise.race([
                    fetch(url, {
                      method: 'GET',
                      headers: { Accept: 'application/json' },
                      redirect: 'follow',
                      mode: 'cors',
                    }),
                    createTimeoutPromise(), // Create new timeout promise for each gateway race
                  ])
                  if (response.ok) {
                    return response
                  }
                } catch (error) {
                  return null
                }
                return null
              })

              const results = await Promise.all(gatewayPromises)
              const success = results.find(r => r !== null)
              if (success) {
                return success
              }

              throw new Error(`All IPFS gateways failed for: ${ipfsUrl} `)
            }

            // Load metadata with fast fallback - use constructed metadata immediately if IPFS is slow
            if (tokenURI && level > 0) {
              // Construct metadata immediately (fast path)
              const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
              const levelConfig: Record<number, { name: string; impactValue: number; dcu: number; hasAnimation: boolean }> = {
                1: { name: 'Newbie', impactValue: 1, dcu: 10, hasAnimation: false },
                2: { name: 'Newbie', impactValue: 2, dcu: 20, hasAnimation: false },
                3: { name: 'Pro', impactValue: 3, dcu: 30, hasAnimation: false },
                4: { name: 'Pro', impactValue: 4, dcu: 40, hasAnimation: false },
                5: { name: 'Pro', impactValue: 5, dcu: 50, hasAnimation: false },
                6: { name: 'Hero', impactValue: 6, dcu: 60, hasAnimation: false },
                7: { name: 'Hero', impactValue: 7, dcu: 70, hasAnimation: false },
                8: { name: 'Hero', impactValue: 8, dcu: 80, hasAnimation: false },
                9: { name: 'Hero', impactValue: 9, dcu: 90, hasAnimation: false },
                10: { name: 'Guardian', impactValue: 10, dcu: 100, hasAnimation: true },
              }
              
              const config = levelConfig[level]
              if (config) {
                // Set constructed metadata immediately (fast)
                metadata = {
                  name: `DeCleanup Impact Product • Level ${level}`,
                  description: 'Tokenized proof of real-world cleanups, verified by DeCleanup Rewards.',
                  external_url: 'https://decleanup.network',
                  image: level === 10 
                    ? `ipfs://${imagesCID}/IP10Placeholder.png`
                    : `ipfs://${imagesCID}/IP${level}.png`,
                  attributes: [
                    { trait_type: 'Category', value: 'Cleanup NFT' },
                    { trait_type: 'Type', value: 'Dynamic' },
                    { trait_type: 'Impact', value: 'Environment' },
                    { trait_type: 'Rarity', value: 'Unique' },
                    { trait_type: 'Impact Value', value: config.impactValue.toString() },
                    { trait_type: '$DCU', value: config.dcu.toString() },
                    { trait_type: 'Level', value: config.name },
                  ],
                }
                
                if (config.hasAnimation) {
                  metadata.animation_url = `ipfs://${imagesCID}/IP10VIdeo.mp4`
                }
                
                impactValue = config.impactValue.toString()
                dcuReward = config.dcu.toString()
                if (metadata.image) {
                  imageUrl = convertIPFSToGateway(metadata.image)
                }
                if (metadata.animation_url) {
                  animationUrl = convertIPFSToGateway(metadata.animation_url)
                }
              }

              // Try to fetch from IPFS in background (non-blocking, updates if successful)
              fetchWithFallback(tokenURI, 1500).then((metadataResponse) => {
                if (metadataResponse.ok) {
                  return metadataResponse.json().then((fetchedMetadata: ImpactMetadata) => {
                    // Update with fetched metadata if successful
                    const stats = extractImpactStats(fetchedMetadata)
                    if (stats.impactValue) impactValue = stats.impactValue
                    if (stats.dcuReward) dcuReward = stats.dcuReward
                    
                    if (fetchedMetadata?.image) {
                      let fixedImagePath = fetchedMetadata.image
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

                    if (fetchedMetadata?.animation_url) {
                      let fixedAnimationPath = fetchedMetadata.animation_url
                      if (fixedAnimationPath.includes('/video/level10')) {
                        fixedAnimationPath = `ipfs://${imagesCID}/IP10VIdeo.mp4`
                      }
                      animationUrl = convertIPFSToGateway(fixedAnimationPath)
                    }
                    
                    // Update metadata if fetched version is better
                    if (fetchedMetadata) {
                      metadata = fetchedMetadata
                    }
                  }).catch(() => {
                    // Silently fail - we already have constructed metadata
                  })
                }
              }).catch(() => {
                // Silently fail - we already have constructed metadata
              })
            }
          } catch (error) {
            console.error('Error fetching token URI:', error)
          }
        }

        const newProfileData = {
          dcuBalance,
          dcuPoints: dcuPoints || 0,
          stakedDCU,
          stakedBalance: stakedBalance || BigInt(0),
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
          isVerifier: isVerifier || false,
          hasMinimumLevel: hasMinimumLevel || false,
          currentTokenPrice: currentTokenPrice || 0,
          targetRewardValue: targetRewardValue || 90,
        }
        
        console.log('📊 Profile data loaded:', {
          dcuBalance,
          dcuPoints: dcuPoints || 0,
          hasMinimumLevel: hasMinimumLevel || false,
          isVerifier: isVerifier || false,
          level,
        })
        
        setProfileData(newProfileData)
      } catch (error) {
        console.error('Error fetching profile data:', error)
        setProfileData({
          dcuBalance: 0,
          dcuPoints: 0,
          stakedDCU: 0,
          stakedBalance: BigInt(0),
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
            retroRewards: 0,
            total: 0,
          },
          isVerifier: false,
          hasMinimumLevel: false,
          currentTokenPrice: 0,
          targetRewardValue: 90,
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
              <h3 className="mb-1 text-sm font-bold uppercase text-gray-300">Checking Referral Eligibility…</h3>
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
              <X className="h-4 w-4" aria-hidden="true" />
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
              You've been referred to DeCleanup Rewards! When you submit your first cleanup and it gets verified, both you and your referrer will earn <strong className="text-white">3 DCU</strong> each.
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
            {/* Show Farcaster username if available, otherwise show ENS/wallet */}
            {farcasterContext?.user ? (
              <>
                <p className="text-sm text-gray-400">
                  {farcasterContext.user.displayName || farcasterContext.user.username || 'Farcaster User'}
                </p>
                {farcasterContext.user.username && (
                  <p className="text-xs text-gray-500">
                    @{farcasterContext.user.username}
                  </p>
                )}
                {farcasterContext.user.fid && (
                  <p className="text-xs text-gray-500 font-mono">
                    FID: {farcasterContext.user.fid}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400">
                  {ensName || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '')}
            </p>
                {ensName && address && (
                  <p className="text-xs text-gray-500 font-mono">
                    {address}
                  </p>
                )}
                {!ensName && address && (
                  <p className="text-xs text-gray-500 font-mono">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                )}
              </>
            )}
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
            aria-label="Refresh profile data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>

        {/* Referral Notification */}
        <ReferralNotification />

        {/* Account Info */}
        {farcasterContext?.user && (
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-gray-700">
                <Image
                  src={farcasterContext.user.pfp?.url || 'https://farcaster.xyz/avatar.png'}
                  alt={farcasterContext.user.displayName || farcasterContext.user.username}
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                  onError={(e) => {
                    // Fallback to default avatar
                    const img = e.currentTarget as HTMLImageElement
                    if (img.src !== 'https://farcaster.xyz/avatar.png') {
                      img.src = 'https://farcaster.xyz/avatar.png'
                    }
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold uppercase tracking-wide text-white truncate">
                  {farcasterContext.user.displayName || farcasterContext.user.username}
                </h2>
                <p className="text-sm text-gray-400 truncate">
                  @{farcasterContext.user.username}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {address && (
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
                      <p className="text-sm font-medium text-white truncate">
                        {ensName || `${address.slice(0, 6)}...${address.slice(-4)}`}
                      </p>
                      {ensName && (
                        <p className="text-xs font-mono text-gray-400 truncate mt-0.5">
                          {address}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(address)
                          setCopyingField('wallet')
                          setTimeout(() => setCopyingField(null), 2000)
                        } catch (error) {
                          console.error('Failed to copy wallet address:', error)
                          alert(`Wallet Address: ${address}`)
                        }
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-white"
                      title="Copy wallet address"
                      aria-label="Copy wallet address"
                    >
                      {copyingField === 'wallet' ? (
                        <CheckCircle className="h-4 w-4 text-brand-green" aria-hidden="true" />
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              {farcasterContext.user.bio?.text && (
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <p className="text-xs text-gray-400 mb-1">Bio</p>
                  <p className="text-sm text-gray-300">{farcasterContext.user.bio.text}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid - DCU Points */}
        <div className="mb-6">
          <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-6">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-green" />
              <h3 className="text-sm font-sans font-medium text-gray-300 normal-case">
                DCU
              </h3>
            </div>
            <p className="text-3xl font-bold text-brand-green">
              {profileData.dcuPoints > 0 ? profileData.dcuPoints.toFixed(0) : '0'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              DCU (multiplier) - The amount of DCU you have determines how many $bDCU tokens you'll receive when claiming
            </p>
          </div>
        </div>

        {/* Points Claim Section */}
        {profileData.dcuPoints > 0 && profileData.hasMinimumLevel && (
          <div className="mb-6 rounded-lg border border-brand-yellow/30 bg-brand-yellow/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-yellow" />
              <h3 className="text-lg font-bold uppercase tracking-wide text-white">
                Claim Tokens
              </h3>
            </div>
            <p className="mb-4 text-sm text-gray-300">
              Convert your DCU to $bDCU tokens. You need to reach level 3 first. The amount of tokens you receive depends on the DCU you have.
            </p>
            
            <div className="mb-4 space-y-3">
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-center">
                <p className="text-3xl font-bold text-white">
                  {profileData.dcuPoints.toFixed(0)}x Multiplier
                </p>
              </div>
            </div>

            <Button
              onClick={async () => {
                if (!profileData.hasMinimumLevel) {
                  alert('You need to reach level 3 before you can claim tokens')
                  return
                }
                if (isClaimingPoints) return
                
                // Calculate claim amount and show confirmation modal
                try {
                  const tokens = await calculateClaimAmount(profileData.dcuPoints)
                  setCalculatedClaimAmount(tokens)
                  setShowClaimConfirmModal(true)
                } catch (error: any) {
                  console.error('Error calculating claim amount:', error)
                  alert(`Failed to calculate claim amount: ${error?.message || String(error)}`)
                }
              }}
              disabled={isClaimingPoints || !profileData.hasMinimumLevel || profileData.dcuPoints === 0}
              className="w-full gap-2 bg-brand-yellow text-black hover:bg-[#e6e600] disabled:opacity-50"
            >
              <TrendingUp className="h-4 w-4" />
              Claim $bDCU
            </Button>
          </div>
        )}

        {/* Staking Section */}
        {profileData.hasMinimumLevel && (
          <div className="mb-6 rounded-lg border border-brand-green/30 bg-brand-green/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-green" />
              <h3 className="text-lg font-bold uppercase tracking-wide text-white">
                Become a Verifier
              </h3>
            </div>
            <p className="mb-4 text-sm text-gray-300">
              Stake your $bDCU tokens to become a verifier and help review cleanup submissions. You need to reach level 3 first.
            </p>
            
            {profileData.isVerifier ? (
              <div className="mb-4 rounded-lg border border-brand-green bg-brand-green/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-brand-green" />
                  <p className="font-bold text-brand-green">You are a Verifier</p>
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  Staked: {formatUnits(profileData.stakedBalance, 18).replace(/\.?0+$/, '')} $bDCU
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">
                      Unstake Amount
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        name="unstake-amount"
                        autoComplete="off"
                        inputMode="decimal"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder={`Max: ${formatUnits(profileData.stakedBalance, 18).replace(/\.?0+$/, '')}`}
                        min={0}
                        step="0.1"
                        spellCheck={false}
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const amount = formatUnits(profileData.stakedBalance, 18).replace(/\.?0+$/, '')
                          setStakeAmount(amount)
                        }}
                        className="text-xs whitespace-nowrap"
                        disabled={profileData.stakedBalance === BigInt(0)}
                      >
                        Max
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Staked: {formatUnits(profileData.stakedBalance, 18).replace(/\.?0+$/, '')} $bDCU
                    </p>
                    <p className="mt-2 text-xs text-brand-yellow">
                      ⚠️ Warning: Unstaking tokens will cause you to lose your verifier status if you unstake more than half of your staked tokens.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
                        alert('Please enter a valid amount to unstake')
                        return
                      }
                      if (isStaking) return
                      
                      try {
                        setIsStaking(true)
                        const amount = parseUnits(stakeAmount, 18)
                        if (amount > profileData.stakedBalance) {
                          alert('Amount exceeds staked balance')
                          return
                        }
                        const hash = await unstakeTokens(amount, chainId)
                        alert(`Unstake transaction submitted! Hash: ${hash}`)
                        setStakeAmount('')
                        // Reload profile data
                        if (address) {
                          await loadProfileData(address, { showSpinner: false })
                        }
                      } catch (error: any) {
                        console.error('Error unstaking:', error)
                        alert(`Failed to unstake: ${error?.message || String(error)}`)
                      } finally {
                        setIsStaking(false)
                      }
                    }}
                    disabled={(() => {
                      if (isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0) {
                        return true
                      }
                      try {
                        const amount = parseUnits(stakeAmount, 18)
                        return amount > profileData.stakedBalance
                      } catch {
                        return false // If parsing fails, allow click (will be validated in onClick)
                      }
                    })()}
                    variant="outline"
                    className="w-full border-gray-700 text-white hover:bg-gray-800"
                  >
                    {isStaking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Unstaking…
                      </>
                    ) : (
                      'Unstake Tokens'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    Stake Amount ($bDCU)
                  </label>
                  <input
                    type="number"
                    name="stake-amount"
                    autoComplete="off"
                    inputMode="decimal"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="Enter amount to stake"
                    min={0}
                    step="0.1"
                    spellCheck={false}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const amount = (profileData.dcuBalance * 0.51).toFixed(2)
                        setStakeAmount(amount)
                      }}
                      className="text-xs"
                      disabled={profileData.dcuBalance === 0}
                    >
                      51%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const amount = (profileData.dcuBalance * 0.75).toFixed(2)
                        setStakeAmount(amount)
                      }}
                      className="text-xs"
                      disabled={profileData.dcuBalance === 0}
                    >
                      75%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStakeAmount(profileData.dcuBalance.toFixed(2))
                      }}
                      className="text-xs"
                      disabled={profileData.dcuBalance === 0}
                    >
                      100%
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Available: {profileData.dcuBalance.toFixed(2)} $bDCU
                  </p>
                  {!profileData.isVerifier && (
                    <p className="mt-1 text-xs text-brand-yellow">
                      ⚠️ You must stake at least 51% of your available tokens to become a verifier
                    </p>
                  )}
                </div>
                <Button
                  onClick={async () => {
                    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
                      alert('Please enter a valid amount to stake')
                      return
                    }
                    if (parseFloat(stakeAmount) > profileData.dcuBalance) {
                      alert('Amount exceeds your balance')
                      return
                    }
                    // If not already a verifier, must stake more than half
                    if (!profileData.isVerifier && parseFloat(stakeAmount) <= profileData.dcuBalance / 2) {
                      alert(`You must stake more than half of your available tokens (${((profileData.dcuBalance / 2) + 0.01).toFixed(2)} $bDCU minimum) to become a verifier`)
                      return
                    }
                    if (isStaking) return
                    
                    try {
                      setIsStaking(true)
                      const amount = parseUnits(stakeAmount, 18)
                      const hash = await stakeTokensForVerifier(amount, chainId)
                      alert(`Stake transaction submitted! Hash: ${hash}`)
                      setStakeAmount('')
                      // Reload profile data
                      if (address) {
                        await loadProfileData(address, { showSpinner: false })
                      }
                    } catch (error: any) {
                      console.error('Error staking:', error)
                      alert(`Failed to stake: ${error?.message || String(error)}`)
                    } finally {
                      setIsStaking(false)
                    }
                  }}
                  disabled={
                    isStaking || 
                    !stakeAmount || 
                    parseFloat(stakeAmount) <= 0 || 
                    parseFloat(stakeAmount) > profileData.dcuBalance ||
                    (!profileData.isVerifier && parseFloat(stakeAmount) <= profileData.dcuBalance / 2)
                  }
                  className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26] disabled:opacity-50"
                >
                  {isStaking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Staking…
                    </>
                  ) : (
                    <>
                      <Award className="h-4 w-4" />
                      Stake Tokens to Become Verifier
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {profileData.level < 3 && (
          <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-400">
              Reach level 3 to unlock staking and token claiming features.
            </p>
          </div>
        )}

        {/* Reward Breakdown - Expandable */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <button
            onClick={() => setBreakdownExpanded(!breakdownExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setBreakdownExpanded(!breakdownExpanded)
              }
            }}
            className="flex w-full items-center justify-between hover:bg-gray-800/50 rounded-lg p-2 -m-2 transition-colors"
            aria-expanded={breakdownExpanded}
            aria-label={breakdownExpanded ? 'Collapse reward breakdown' : 'Expand reward breakdown'}
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
                      {profileData.rewardsBreakdown.cleanupCount} cleanup{profileData.rewardsBreakdown.cleanupCount !== 1 ? 's' : ''} = {profileData.rewardsBreakdown.cleanupCount * 10} DCU ({profileData.rewardsBreakdown.cleanupCount} × 10)
                    </p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {profileData.rewardsBreakdown.cleanupCount * 10} DCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-brand-green" />
                  <div>
                    <span className="text-sm font-medium text-white">Referrals</span>
                    <p className="text-xs text-gray-400">Rewards for referring new users (3 DCU each)</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {Math.floor(profileData.rewardsBreakdown.referralRewards / 3) * 3} DCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <Flame className="h-5 w-5 text-brand-yellow" />
                  <div>
                    <span className="text-sm font-medium text-white">Streak</span>
                    <p className="text-xs text-gray-400">Weekly streak maintenance rewards (1 DCU each)</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {Math.floor(profileData.rewardsBreakdown.streakRewards / 1) * 1} DCU
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-brand-green" />
                  <div>
                    <span className="text-sm font-medium text-white">Verifier Rewards</span>
                    <p className="text-xs text-gray-400">Rewards for verifying cleanups (1 DCU each)</p>
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-white">
                  {Math.floor(profileData.rewardsBreakdown.verifierRewards)} DCU
                </span>
              </div>

              {/* Retro Rewards */}
              {profileData.rewardsBreakdown.retroRewards > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-brand-yellow" />
                    <div>
                      <span className="text-sm font-medium text-white">Retro Rewards</span>
                      <p className="text-xs text-gray-400">Retroactive rewards for past activity</p>
                    </div>
                  </div>
                  <span className="text-lg font-mono font-bold text-white">
                    {Math.floor(profileData.rewardsBreakdown.retroRewards)} DCU
                  </span>
                </div>
              )}
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
                    ? 'Checking…'
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
                        let modalWasShown = false // Track if modal was shown to avoid stale closure
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
                                modalWasShown = true // Mark that modal was shown
                                // Don't auto-reload - let user share and close modal manually
                                // User can refresh manually if needed
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

                        // Fallback: stop polling after max time (but don't auto-reload if modal is showing)
                        setTimeout(() => {
                          clearInterval(pollInterval)
                          // Only reload if modal was not shown (check the variable, not stale state)
                          if (!modalWasShown) {
                            window.location.reload()
                          }
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
                        <span>Hang on, your Impact Product is being minted…</span>
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
                      Connect wallet to claim
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
                      width={400}
                      height={400}
                      className="h-full w-full object-contain"
                      loading="lazy"
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
                      width={400}
                      height={400}
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
                    width={400}
                    height={400}
                    className="h-full w-full object-contain"
                    loading="lazy"
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

        {/* Claim Confirmation Modal */}
        {showClaimConfirmModal && (
          <Dialog open={showClaimConfirmModal} onOpenChange={setShowClaimConfirmModal}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold uppercase text-white">
                  Confirm Claim
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Confirm converting your DCU to $bDCU tokens
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                  <p className="text-sm text-gray-400 mb-2">You will receive:</p>
                  <p className="text-lg font-bold text-white mb-1 break-words">
                    {calculatedClaimAmount > BigInt(0) ? formatUnits(calculatedClaimAmount, 18).replace(/\.?0+$/, '') : 'Calculating…'} $bDCU
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    For {profileData.dcuPoints.toFixed(0)} DCU
                  </p>
                </div>
                <p className="text-sm text-gray-300">
                  This will convert all your DCU to $bDCU tokens based on the current market price.
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowClaimConfirmModal(false)}
                  className="flex-1 border-gray-700 text-white hover:bg-gray-800"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={async () => {
                    setShowClaimConfirmModal(false)
                    if (isClaimingPoints) return
                    
                    try {
                      setIsClaimingPoints(true)
                      const hash = await claimTokensFromPoints(profileData.dcuPoints, chainId)
                      
                      // Show success modal immediately after transaction is submitted
                      setSuccessModalData({
                        title: 'Claim Submitted Successfully!',
                        message: `Your claim for ${formatUnits(calculatedClaimAmount, 18).replace(/\.?0+$/, '')} $bDCU tokens (${profileData.dcuPoints.toFixed(0)} DCU) has been submitted. The transaction is being processed on-chain.`,
                        transactionHash: hash,
                      })
                      setShowSuccessModal(true)
                      
                      // Try to wait for confirmation, but handle errors gracefully
                      const { waitForTransactionReceipt } = await import('wagmi/actions')
                      const { config } = await import('@/lib/wagmi')
                      
                      try {
                        await waitForTransactionReceipt(config, { 
                          hash, 
                          timeout: 120000,
                          retryCount: 5,
                          retryDelay: 2000,
                        })
                        console.log('✅ Claim transaction confirmed!')
                        
                        // Update success message after confirmation
                        setSuccessModalData({
                          title: 'Tokens Claimed Successfully!',
                          message: `You've successfully claimed ${formatUnits(calculatedClaimAmount, 18).replace(/\.?0+$/, '')} $bDCU tokens for ${profileData.dcuPoints.toFixed(0)} DCU.`,
                          transactionHash: hash,
                        })
                      } catch (waitError: any) {
                        // "Block not found" errors are often temporary - transaction might still succeed
                        const errorMessage = String(waitError?.message || waitError || '')
                        if (
                          errorMessage.includes('block not found') ||
                          errorMessage.includes('Requested resource not found') ||
                          errorMessage.includes('ResourceNotFound')
                        ) {
                          console.warn('Transaction receipt check failed (block not found - may be temporary):', waitError)
                          console.log('Transaction was submitted. It may still be processing.')
                        } else {
                          console.warn('Transaction confirmation wait failed, but continuing:', waitError)
                        }
                      }
                      
                      // Poll for balance update after a delay
                      setTimeout(async () => {
                        if (address) {
                          await loadProfileData(address, { showSpinner: false })
                        }
                      }, 3000)
                      
                    } catch (error: any) {
                      console.error('Error claiming tokens:', error)
                      alert(`Failed to claim: ${error?.message || String(error)}`)
                    } finally {
                      setIsClaimingPoints(false)
                    }
                  }}
                  disabled={isClaimingPoints}
                  className="flex-1 gap-2 bg-brand-yellow text-black hover:bg-[#e6e600] disabled:opacity-50"
                >
                  {isClaimingPoints ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Claiming…
                    </>
                  ) : (
                    'Confirm'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Success Modal */}
        {showSuccessModal && successModalData && (
          <SuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false)
              setSuccessModalData(null)
              // Reload profile data when modal is closed
              if (address) {
                loadProfileData(address, { showSpinner: false })
              }
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
