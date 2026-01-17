'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAccount, useChainId, useSwitchChain, useConnect } from 'wagmi'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { Camera, Upload, ArrowRight, Check, Loader2, ExternalLink, X, Clock, AlertCircle, Users } from 'lucide-react'
import { uploadToIPFS, uploadJSONToIPFS, getIPFSUrl } from '@/lib/ipfs'
import { submitCleanup, getSubmissionFee, getCleanupStatus, getUserLevel, CONTRACT_ADDRESSES, checkReferralEligibility, VERIFICATION_ABI } from '@/lib/contracts'
import { clearPendingCleanupData, resetSubmissionCounting } from '@/lib/clear-cleanup-data'
import type { Address } from 'viem'
import { useBuilderCodeAttribution } from '@/lib/hooks/useBuilderCode'
import { useFarcasterReady } from '@/lib/hooks/useFarcasterReady'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { resolveENS, isValidENSFormat } from '@/lib/ens'
import { resolveFID, isValidFIDFormat, getFIDFromUsername } from '@/lib/farcaster-fid'
import { openUrl } from '@/lib/farcaster'
import { TransactionModal, useTransactionModal } from '@/components/ui/transaction-modal'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { AddAppModal } from '@/components/onboarding/AddAppModal'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from '@/lib/wagmi'

type Step = 'before' | 'after' | 'enhanced' | 'review'
const describeChain = (id?: number) => {
  switch (id) {
    case 1:
      return 'Ethereum Mainnet'
    case 11155111:
      return 'Ethereum Sepolia'
    case 8453:
      return 'Base Mainnet'
    case 84532:
      return 'Base Sepolia'
    case 44787:
      return 'Celo Sepolia'
    default:
      return 'Unknown Network'
  }
}

function CleanupContent() {
  // Ensure ready() is called early on this landing page
  useFarcasterReady()
  
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sendWithBuilderCode } = useBuilderCodeAttribution()
  const { isMiniApp } = useFarcaster()
  const [mounted, setMounted] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<Address | null>(null)
  const [step, setStep] = useState<Step>('before')
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null)
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null)
  const [beforePhotoAllowed, setBeforePhotoAllowed] = useState(false)
  const [afterPhotoAllowed, setAfterPhotoAllowed] = useState(false)
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null)
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null)
  const [beforePhotoIPFSHash, setBeforePhotoIPFSHash] = useState<string | null>(null)
  const [afterPhotoIPFSHash, setAfterPhotoIPFSHash] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [manualLocationMode, setManualLocationMode] = useState(false)
  const [manualLatInput, setManualLatInput] = useState('')
  const [manualLngInput, setManualLngInput] = useState('')
  const [hostName, setHostName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingCleanup, setPendingCleanup] = useState<{
    id: bigint
    verified: boolean
    claimed: boolean
  } | null>(null)
  const [checkingPending, setCheckingPending] = useState(true)
  const [clearingPending, setClearingPending] = useState(false)
  const [userLevel, setUserLevel] = useState<number | null>(null)
  const { modal, showSuccess, hideModal } = useTransactionModal()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showAddAppModal, setShowAddAppModal] = useState(false)
  
  // Fix hydration error by only rendering after mount
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setHostName(window.location.hostname)
      
      // Show onboarding for new sessions (check sessionStorage)
      // This ensures onboarding appears on each new session (when opening links)
      // but not on page reloads within the same session
      const hasSeenOnboardingThisSession = sessionStorage.getItem('decleanup_onboarding_seen_session')
      if (!hasSeenOnboardingThisSession) {
        setShowOnboarding(true)
      }
    }
  }, [])
  
  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    if (typeof window !== 'undefined') {
      // Mark onboarding as seen for this session only
      sessionStorage.setItem('decleanup_onboarding_seen_session', 'true')
      
      // Check if user has already seen the add app modal
      const hasSeenAddAppModal = sessionStorage.getItem('decleanup_add_app_modal_seen')
      if (!hasSeenAddAppModal && (isMiniApp || typeof (window as any).minikit !== 'undefined')) {
        // Show add app modal after a short delay
        setTimeout(() => {
          setShowAddAppModal(true)
        }, 500)
      }
    }
  }

  // Cleanup object URLs on unmount or when photos change
  useEffect(() => {
    return () => {
      if (beforePhotoUrl) {
        URL.revokeObjectURL(beforePhotoUrl)
      }
      if (afterPhotoUrl) {
        URL.revokeObjectURL(afterPhotoUrl)
      }
    }
  }, [beforePhotoUrl, afterPhotoUrl])
  
  // Read referrer from URL params and persist it
  const [showReferralNotification, setShowReferralNotification] = useState(false)
  const [referralEligible, setReferralEligible] = useState<boolean | null>(null)
  const [referralIneligibleReason, setReferralIneligibleReason] = useState<string | null>(null)
  
  // Read referrer from URL - run once on mount, preserve across wallet connections
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
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
      } catch {
        // Ignore hash parsing errors
      }
    }
    
    if (ref) {
      // Only accept full wallet addresses (0x followed by 40 hex characters)
      if (/^0x[a-fA-F0-9]{40}$/.test(ref)) {
        const referrerAddr = ref as Address
        
        // Only set if not already set (preserve during wallet connection)
        if (!referrerAddress) {
          setReferrerAddress(referrerAddr)
        }
        // Always persist to localStorage (even if already set)
        try {
          // Store referrer even before address is available
          localStorage.setItem('referrer_pending', referrerAddr)
          console.log('✅ Referrer address from URL saved:', referrerAddr)
          
          // If address is available, also store it scoped to address
          if (address) {
            const referrerKeyScoped = `referrer_${address.toLowerCase()}`
            localStorage.setItem(referrerKeyScoped, referrerAddr)
            console.log('✅ Referrer address saved for address:', address)
          }
        } catch (e) {
          console.error('Failed to save referrer to localStorage:', e)
        }
      }
    } else {
      // If no ref in URL, clear the referrer state
      // Don't load from localStorage - only show notification if ref is in current URL
      if (referrerAddress) {
        setReferrerAddress(null)
        setShowReferralNotification(false)
        console.log('✅ No ref in URL - cleared referrer state')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, searchParams]) // Intentionally exclude address/referrerAddress to prevent reset on wallet connect
  
  // Sync referrer to address-scoped storage when address becomes available
  useEffect(() => {
    if (address && referrerAddress) {
      try {
        const referrerKeyScoped = `referrer_${address.toLowerCase()}`
        localStorage.setItem(referrerKeyScoped, referrerAddress)
        console.log('✅ Referrer synced to address-scoped storage:', address)
      } catch (e) {
        console.error('Failed to sync referrer to address-scoped storage:', e)
      }
    }
  }, [address, referrerAddress])

  // Show referral notification only when referrer is detected from CURRENT URL
  // Check if ref is actually in the URL to avoid showing stale notifications
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    // Check if ref is in current URL
    let refInUrl: string | null = null
    if (searchParams) {
      refInUrl = searchParams.get('ref')
    }
    if (!refInUrl) {
      const urlParams = new URLSearchParams(window.location.search)
      refInUrl = urlParams.get('ref')
    }
    
    // Only show notification if ref is in URL AND referrerAddress is set
    if (refInUrl && referrerAddress && /^0x[a-fA-F0-9]{40}$/.test(refInUrl)) {
      // Verify the referrerAddress matches the ref in URL
      if (referrerAddress.toLowerCase() === refInUrl.toLowerCase()) {
        setShowReferralNotification(true)
        // Set eligible to null initially (will be checked when wallet connects)
        if (!address || !isConnected) {
          setReferralEligible(null)
          setReferralIneligibleReason(null)
          return
        }
      } else {
        // Mismatch - clear state
        setShowReferralNotification(false)
        setReferralEligible(null)
        setReferralIneligibleReason(null)
      }
    } else {
      // No ref in URL - don't show notification
      setShowReferralNotification(false)
      if (!refInUrl) {
        setReferralEligible(null)
        setReferralIneligibleReason(null)
      }
    }
  }, [referrerAddress, mounted, searchParams, address, isConnected])

  // Check referral eligibility when address and referrer are available
  useEffect(() => {
    if (!address || !referrerAddress || !isConnected) {
      // Don't reset notification here - keep it shown if referrer is detected
      // Only reset eligibility check state
      if (!referrerAddress) {
        setReferralEligible(null)
        setReferralIneligibleReason(null)
      }
      return
    }

    async function checkEligibility() {
      // Type guard: address is already checked in useEffect condition
      if (!address) return
      
      try {
        const eligibility = await checkReferralEligibility(address)
        setReferralEligible(eligibility.eligible)
        setReferralIneligibleReason(eligibility.reason || null)
        // Keep notification shown - eligibility check just updates the message
        setShowReferralNotification(true)
      } catch (error) {
        console.error('Error checking referral eligibility:', error)
        // On error, assume eligible (contract will reject if not)
        setReferralEligible(true)
        setShowReferralNotification(true)
      }
    }

    checkEligibility()
  }, [address, referrerAddress, isConnected])

  // Impact Report form data
  const [enhancedData, setEnhancedData] = useState({
    locationType: '',
    area: '',
    areaUnit: 'sqm' as 'sqm' | 'sqft',
    weight: '',
    weightUnit: 'kg' as 'kg' | 'lbs',
    bags: '',
    hours: '',
    minutes: '',
    wasteTypes: [] as string[],
    contributors: [] as string[], // Array of contributor addresses
    scopeOfWork: '', // Auto-generated
    rightsAssignment: '' as '' | 'attribution' | 'non-commercial' | 'no-derivatives' | 'share-alike' | 'all-rights-reserved',
    environmentalChallenges: '',
    preventionIdeas: '',
    additionalNotes: '',
  })

  // State for contributor resolution (ENS/FID)
  const [contributorResolving, setContributorResolving] = useState<Record<number, boolean>>({})
  const [contributorErrors, setContributorErrors] = useState<Record<number, string>>({})

  // Preset options
  const locationTypeOptions = [
    'Beach',
    'Park',
    'Waterway',
    'Forest',
    'Urban',
    'Rural',
    'Industrial',
    'Other',
  ]

  const wasteTypeOptions = [
    'Plastic',
    'Glass',
    'Metal',
    'Paper',
    'Organic',
    'Hazardous',
    'Electronics',
    'Textiles',
    'Other',
  ]

  const environmentalChallengePresets = [
    'Heavy pollution',
    'Lack of waste bins',
    'Illegal dumping',
    'Storm damage',
    'Wildlife impact',
    'Water contamination',
    'Soil contamination',
    'Air quality issues',
  ]

  const preventionPresets = [
    'Install more waste bins',
    'Increase public awareness',
    'Regular cleanup schedules',
    'Stricter enforcement',
    'Community involvement',
    'Better waste management',
    'Educational programs',
    'Recycling facilities',
  ]

  // Auto-generate scope of work
  useEffect(() => {
    if (enhancedData.locationType && enhancedData.wasteTypes.length > 0) {
      const scope = `Cleanup at ${enhancedData.locationType} location, removing ${enhancedData.wasteTypes.join(', ')} waste types`
      setEnhancedData(prev => ({ ...prev, scopeOfWork: scope }))
    } else {
      setEnhancedData(prev => ({ ...prev, scopeOfWork: '' }))
    }
  }, [enhancedData.locationType, enhancedData.wasteTypes])

  // Don't request location automatically - only when user is ready to submit
  // Location will be requested when user clicks "Next" on the before photo step

  // Fetch user level
  useEffect(() => {
    if (!isConnected || !address) {
      setUserLevel(null)
      return
    }

    async function fetchUserLevel() {
      if (!address) return
      try {
        const level = await getUserLevel(address)
        setUserLevel(level)
      } catch (error) {
        console.error('Error fetching user level:', error)
        setUserLevel(null)
      }
    }

    fetchUserLevel()
  }, [isConnected, address])

  // Check for pending cleanup submissions
  useEffect(() => {
    if (!isConnected || !address) {
      setCheckingPending(false)
      return
    }

    async function checkPendingCleanup() {
      try {
        if (!address) {
          setPendingCleanup(null)
          setCheckingPending(false)
          return
        }
        
        if (typeof window !== 'undefined') {
          // Check for pending cleanup ID scoped to this user's address
          const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
          const pendingCleanupId = localStorage.getItem(pendingKey)
          
          if (pendingCleanupId) {
            try {
              const status = await getCleanupStatus(BigInt(pendingCleanupId))
              console.log('Cleanup status found:', status)
              
              // Verify this cleanup belongs to the current user
              if (status.user.toLowerCase() !== address.toLowerCase()) {
                console.log('Cleanup belongs to different user, clearing localStorage')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setPendingCleanup(null)
                return
              }
              
              // Check if cleanup is rejected - if so, clear localStorage and allow new submission
              if (status.rejected) {
                console.log('Cleanup is rejected, clearing localStorage to allow new submission')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setPendingCleanup(null)
                return
              }
              
              // Only set pending if it's actually pending (not verified and not rejected)
              if (!status.verified) {
                setPendingCleanup({
                  id: BigInt(pendingCleanupId),
                  verified: status.verified,
                  claimed: status.claimed,
                })
              } else {
                // If verified, clear localStorage
                console.log('Cleanup is verified, clearing localStorage')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setPendingCleanup(null)
              }
            } catch (error: any) {
              console.error('Error checking pending cleanup status:', error)
              const errorMessage = error?.message || String(error)
              // Always clear localStorage on error - cleanup doesn't exist or RPC issue
              console.log('Clearing localStorage - cleanup not found or error:', errorMessage)
              localStorage.removeItem(pendingKey)
              localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
              setPendingCleanup(null)
            }
          } else {
            // Also check old global key for backward compatibility, then clear it
            const oldPendingId = localStorage.getItem('pending_cleanup_id')
            if (oldPendingId) {
              console.log('Found old global pending cleanup, clearing...')
              localStorage.removeItem('pending_cleanup_id')
              localStorage.removeItem('pending_cleanup_location')
            }
            setPendingCleanup(null)
          }
        }
      } catch (error) {
        console.error('Error checking pending cleanup:', error)
        setPendingCleanup(null)
      } finally {
        setCheckingPending(false)
      }
    }

    checkPendingCleanup()
    // Poll for status updates every 10 seconds
    const interval = setInterval(checkPendingCleanup, 10000)
    return () => clearInterval(interval)
  }, [isConnected, address])

  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const isBaseBuildHost = hostName.includes('build.base.org')

  const handlePhotoSelect = (type: 'before' | 'after') => {
    try {
      setPhotoError(null)
      const input = document.createElement('input')
      input.type = 'file'
      // Use generic image/* to allow all image types
      // Do NOT set capture attribute - this forces camera on some devices
      // By omitting it, mobile browsers will offer "Camera" or "Photo Library" options
      input.accept = 'image/*'

      input.onchange = (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
              setPhotoError('Please select a valid image file (JPEG, PNG, HEIC, etc.)')
              alert('Please select a valid image file (JPEG, PNG, HEIC, etc.)')
              return
            }

            // Validate file size
            const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per image
            if (file.size > MAX_FILE_SIZE) {
              const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
              const errorMsg = `Image size must be less than 10 MB per image. This image is ${fileSizeMB} MB.`
              setPhotoError(errorMsg)
              alert(errorMsg)
              return
            }

            // Validate file is not empty
            if (file.size === 0) {
              setPhotoError('The selected file is empty. Please choose a different image.')
              alert('The selected file is empty. Please choose a different image.')
              return
            }

            // Create object URL for preview and preload the image
            try {
              // Clean up previous object URL if it exists
              if (type === 'before' && beforePhotoUrl) {
                URL.revokeObjectURL(beforePhotoUrl)
              } else if (type === 'after' && afterPhotoUrl) {
                URL.revokeObjectURL(afterPhotoUrl)
              }

              const objectUrl = URL.createObjectURL(file)
              
              // Preload the image to ensure the blob URL is valid before setting state
              // This prevents Safari/WebKit blob resource errors
              const img = new Image()
              img.onload = () => {
                // Image loaded successfully, now it's safe to set state
                if (type === 'before') {
                  setBeforePhoto(file)
                  setBeforePhotoUrl(objectUrl)
                } else if (type === 'after') {
                  setAfterPhoto(file)
                  setAfterPhotoUrl(objectUrl)
                }
              }
              img.onerror = () => {
                // Image failed to load, clean up and show error
                URL.revokeObjectURL(objectUrl)
                setPhotoError('Failed to load image preview. The file may be corrupted. Please try a different image.')
                alert('Failed to load image preview. The file may be corrupted. Please try a different image.')
              }
              img.src = objectUrl
            } catch (urlError) {
              console.error('Error creating object URL:', urlError)
              setPhotoError('Failed to load image preview. The file may be corrupted. Please try a different image.')
              alert('Failed to load image preview. The file may be corrupted. Please try a different image.')
            }
          }
        } catch (error) {
          console.error('Error handling file selection:', error)
          setPhotoError('An error occurred while selecting the image. Please try again.')
          alert('An error occurred while selecting the image. Please try again.')
        } finally {
          // Clean up the input element
          input.remove()
        }
      }

      input.onerror = () => {
        setPhotoError('Failed to open file picker. Please try again.')
        input.remove()
      }

      input.click()
    } catch (error) {
      console.error('Error creating file input:', error)
      setPhotoError('Failed to open file picker. Please try again.')
      alert('Failed to open file picker. Please try again.')
    }
  }

  const getLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const message = 'Geolocation is not supported or allowed in this browser. Please enter coordinates manually below.'
      setLocationError(message)
      setManualLocationMode(true)
      console.warn(message)
      return
    }

    setIsGettingLocation(true)
    setLocationError(null)
    setManualLocationMode(false)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocation(locationData)
        setIsGettingLocation(false)
        setLocationError(null)
        setManualLocationMode(false)
        console.log('Location obtained:', locationData)
        
        // Store location in localStorage as backup
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_cleanup_location', JSON.stringify(locationData))
        }
      },
      (error) => {
        setIsGettingLocation(false)
        console.error('Error getting location:', error)
        setManualLocationMode(true)
        
        // Try to use last known location as fallback
        if (typeof window !== 'undefined') {
          const lastLocation = localStorage.getItem('last_cleanup_location')
          if (lastLocation) {
            try {
              const parsed = JSON.parse(lastLocation)
              setLocation(parsed)
              console.log('Using last known location:', parsed)
              alert('Using last known location. For accurate geotagging, please enable location services.')
              return
            } catch (e) {
              console.error('Error parsing last location:', e)
            }
          }
        }
        
        let errorMessage = 'Unable to get location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += isBaseBuildHost
              ? ' This Base Build preview is running inside a sandbox that blocks location prompts. Open the app in a new tab or enter coordinates manually below.'
              : ' Please enable location permissions in your browser settings.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += ' Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage += ' Location request timed out. Please try again.'
            break
          default:
            errorMessage += ` ${error.message}`
        }
        setLocationError(errorMessage.trim())
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }

  const handleManualLocationApply = () => {
    const lat = parseFloat(manualLatInput)
    const lng = parseFloat(manualLngInput)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Please enter valid latitude and longitude values.')
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Latitude must be between -90 and 90, and longitude between -180 and 180.')
      return
    }

    const manualLocation = { lat, lng }
    setLocation(manualLocation)
    setLocationError(null)
    if (typeof window !== 'undefined') {
      localStorage.setItem('last_cleanup_location', JSON.stringify(manualLocation))
    }
  }

  const handleBeforeNext = () => {
    if (!beforePhoto) {
      alert('Please upload a before photo')
      return
    }
    if (!location) {
      getLocation()
      return
    }
    setStep('after')
  }

  const handleAfterNext = () => {
    if (!afterPhoto) {
      alert('Please upload an after photo')
      return
    }
    // Go to enhanced form
    setStep('enhanced')
  }

  const handleSkipEnhanced = async () => {
    await submitCleanupFlow(false)
  }

  const handleSubmitEnhanced = async () => {
    // Validate that the form has at least locationType filled before proceeding
    // This prevents submitting hasImpactForm=true with empty impactReportHash
    if (!enhancedData.locationType || enhancedData.locationType.trim() === '') {
      alert('Please fill in at least the location type in the impact report form.')
      return
    }
    
    // Submit with form data (hasForm=true)
    await submitCleanupFlow(true)
  }

  const submitCleanupFlow = async (hasForm: boolean) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first')
      return
    }

    // Check if contracts are deployed
    if (!CONTRACT_ADDRESSES.VERIFICATION) {
      alert('Contracts not deployed yet. Please deploy contracts first and set NEXT_PUBLIC_VERIFICATION_CONTRACT in .env.local')
      return
    }

    if (!beforePhoto || !afterPhoto) {
      alert('Please upload both before and after photos')
      return
    }

    if (!location) {
      alert('Location is required. Please enable location services and try again.')
      getLocation()
      return
    }

    setIsSubmitting(true)
    try {
      // Upload photos to IPFS
      console.log('Uploading photos to IPFS...')
      let beforeHash: { hash: string; url: string }
      let afterHash: { hash: string; url: string }
      
      try {
        [beforeHash, afterHash] = await Promise.all([
        uploadToIPFS(beforePhoto).catch((error) => {
          console.error('Error uploading before photo:', error)
            const errorMsg = error?.message || String(error || 'Unknown error')
            if (errorMsg.includes('timeout') || errorMsg.includes('Upload timeout')) {
              throw new Error(`Before photo upload timed out. The image may be too large (max 10MB). Please try a smaller image or check your internet connection.`)
            } else if (errorMsg.includes('Network') || errorMsg.includes('Failed to fetch')) {
              throw new Error(`Network error uploading before photo. Please check your internet connection and try again.`)
            } else {
              throw new Error(`Failed to upload before photo: ${errorMsg}`)
            }
        }),
        uploadToIPFS(afterPhoto).catch((error) => {
          console.error('Error uploading after photo:', error)
            const errorMsg = error?.message || String(error || 'Unknown error')
            if (errorMsg.includes('timeout') || errorMsg.includes('Upload timeout')) {
              throw new Error(`After photo upload timed out. The image may be too large (max 10MB). Please try a smaller image or check your internet connection.`)
            } else if (errorMsg.includes('Network') || errorMsg.includes('Failed to fetch')) {
              throw new Error(`Network error uploading after photo. Please check your internet connection and try again.`)
            } else {
              throw new Error(`Failed to upload after photo: ${errorMsg}`)
            }
        }),
      ])
      } catch (uploadError: any) {
        // If photo upload fails, show a clear error and stop submission
        const uploadErrorMessage = uploadError?.message || String(uploadError || 'Unknown error')
        console.error('Photo upload failed:', uploadErrorMessage)
        
        // Create a more helpful error message with troubleshooting steps
        let errorTitle = 'Failed to submit cleanup:'
        let errorDetails = uploadErrorMessage
        
        // Add troubleshooting checklist
        const troubleshootingSteps = [
          'Your wallet is connected',
          `You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})`,
          'You have enough ETH for gas',
          'The contract address is correct',
        ]
        
        // Show error modal with detailed message
        const fullErrorMessage = `${errorDetails}\n\nPlease check:\n${troubleshootingSteps.map(step => `- ${step}`).join('\n')}`
        
        alert(`Failed to submit cleanup:\n\n${fullErrorMessage}`)
        setIsSubmitting(false)
        return
      }

      console.log('Photos uploaded:', { beforeHash: beforeHash.hash, afterHash: afterHash.hash })
      console.log('Location:', { lat: location.lat, lng: location.lng })
      
      // Store IPFS hashes for use in review step
      setBeforePhotoIPFSHash(beforeHash.hash)
      setAfterPhotoIPFSHash(afterHash.hash)

      // Upload enhanced impact report data to IPFS if form was submitted and valid
      // Validate that locationType is filled (required field) before uploading
      let impactFormDataHash: string | null = null
      const isFormValid: boolean = Boolean(hasForm && enhancedData.locationType && enhancedData.locationType.trim() !== '')
      if (isFormValid) {
        try {
          console.log('Uploading enhanced impact report data to IPFS...')
          const impactData = {
            locationType: enhancedData.locationType,
            area: enhancedData.area,
            areaUnit: enhancedData.areaUnit,
            weight: enhancedData.weight,
            weightUnit: enhancedData.weightUnit,
            bags: enhancedData.bags,
            hours: enhancedData.hours,
            minutes: enhancedData.minutes,
            wasteTypes: enhancedData.wasteTypes,
            contributors: enhancedData.contributors,
            scopeOfWork: enhancedData.scopeOfWork,
            rightsAssignment: enhancedData.rightsAssignment,
            environmentalChallenges: enhancedData.environmentalChallenges,
            preventionIdeas: enhancedData.preventionIdeas,
            additionalNotes: enhancedData.additionalNotes,
            // Image usage permissions
            beforePhotoAllowed: beforePhotoAllowed,
            afterPhotoAllowed: afterPhotoAllowed,
            timestamp: new Date().toISOString(),
            userAddress: address,
          }
          const impactDataResult = await uploadJSONToIPFS(impactData, `impact-report-${Date.now()}`)
          impactFormDataHash = impactDataResult.hash
          console.log('Impact report data uploaded to IPFS:', impactFormDataHash)

          // Store the hash in localStorage with cleanup ID (will be set after submission)
          // We'll associate this hash with the cleanup on-chain below
        } catch (error) {
          console.error('Error uploading impact report data to IPFS:', error)
          // Don't fail the submission if IPFS upload fails, just log it
        }
      }

      // Check if submission fee is required
      const feeInfo = await getSubmissionFee()
      const feeValue = feeInfo.enabled && feeInfo.fee > 0 ? feeInfo.fee : undefined
      
      if (feeInfo.enabled && feeInfo.fee > 0) {
        console.log('Submission fee required:', feeInfo.fee.toString(), 'wei')
      }

      // Chain switching is handled by ensureWalletOnRequiredChain() in submitCleanup()
      // No need to duplicate the logic here - it will handle switching and show errors if needed
      
      // Check referral eligibility ONLY if ref is in current URL
      // Don't check eligibility if referrerAddress is from localStorage but no ref in URL
      let refInUrl: string | null = null
      if (searchParams) {
        refInUrl = searchParams.get('ref')
      }
      if (!refInUrl) {
        const urlParams = new URLSearchParams(window.location.search)
        refInUrl = urlParams.get('ref')
      }
      
      // Only check eligibility if ref is in current URL and matches referrerAddress
      if (refInUrl && /^0x[a-fA-F0-9]{40}$/.test(refInUrl) && 
          referrerAddress && 
          referrerAddress.toLowerCase() === refInUrl.toLowerCase() &&
          referrerAddress !== '0x0000000000000000000000000000000000000000') {
        try {
          const eligibility = await checkReferralEligibility(address!)
          if (!eligibility.eligible) {
            alert(`Cannot submit with referral link: ${eligibility.reason || 'You are not eligible for referral rewards.'}\n\nYou can still submit without the referral link.`)
            setIsSubmitting(false)
            return
          }
        } catch (error) {
          console.error('Error checking referral eligibility:', error)
          // On error, allow submission (contract will reject if ineligible)
        }
      }
      
      // Submit to contract
      console.log('Submitting to contract...')
      console.log('Contract address:', CONTRACT_ADDRESSES.VERIFICATION)
      console.log('Current chain ID:', chainId)
      console.log('Submission data:', {
        beforeHash: beforeHash.hash,
        afterHash: afterHash.hash,
        lat: location.lat,
        lng: location.lng,
        hasForm,
        feeValue: feeValue?.toString() || '0'
      })
      
      try {
        // Check if ref is actually in current URL before using referrerAddress
        // Only pass referrer if it's in the current URL, not from localStorage
        let refInUrl: string | null = null
        if (searchParams) {
          refInUrl = searchParams.get('ref')
        }
        if (!refInUrl) {
          const urlParams = new URLSearchParams(window.location.search)
          refInUrl = urlParams.get('ref')
        }
        
        // Only use referrerAddress if ref is in current URL and matches
        const finalReferrerAddress = (refInUrl && /^0x[a-fA-F0-9]{40}$/.test(refInUrl) && 
                                      referrerAddress && 
                                      referrerAddress.toLowerCase() === refInUrl.toLowerCase() &&
                                      referrerAddress !== '0x0000000000000000000000000000000000000000') 
          ? referrerAddress 
          : null
        
        // Only pass hasForm=true if we actually have valid form data
        // This prevents contract mismatch where hasImpactForm=true but impactReportHash is empty
        const hasValidFormData: boolean = Boolean(isFormValid && impactFormDataHash !== null)
        const actualHasForm: boolean = hasValidFormData
        const finalImpactReportHash: string = hasValidFormData && impactFormDataHash ? impactFormDataHash : ''
        
        // Try with Builder Code first, fallback to standard submission if it fails
        let cleanupId: bigint
        let transactionHash: `0x${string}`
        try {
          // Create transaction sender with Builder Code attribution
          const sendTransaction = async (params: {
            address: Address
            abi: typeof VERIFICATION_ABI
            functionName: 'submitCleanup'
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

          const result = await submitCleanup(
            beforeHash.hash,
            afterHash.hash,
            location.lat,
            location.lng,
            finalReferrerAddress, // Use referrer from URL if available and eligible
            actualHasForm,
            finalImpactReportHash,
            feeValue, // Include fee if required
            chainId, // Pass chainId from useChainId hook to avoid detection bugs
            sendTransaction // Pass Builder Code transaction sender
          )
          cleanupId = result.cleanupId
          transactionHash = result.transactionHash
        } catch (builderCodeError: any) {
          // If Builder Code fails (capabilities error, etc.), retry without it
          const errorMessage = builderCodeError?.message || String(builderCodeError || '')
          const isBuilderCodeError = errorMessage.includes('capabilities') ||
                                    errorMessage.includes('dataSuffix') ||
                                    errorMessage.includes('invalid_type') ||
                                    errorMessage.includes('Expected object') ||
                                    errorMessage.includes('wallet_sendCalls')
          
          if (isBuilderCodeError) {
            console.warn('⚠️ Builder Code submission failed, retrying with standard transaction:', errorMessage)
            // Retry without Builder Code (standard submission)
            const result = await submitCleanup(
              beforeHash.hash,
              afterHash.hash,
              location.lat,
              location.lng,
              finalReferrerAddress,
              actualHasForm,
              finalImpactReportHash,
              feeValue,
              chainId,
              undefined // No Builder Code - use standard writeContract
            )
            cleanupId = result.cleanupId
            transactionHash = result.transactionHash
          } else {
            // Re-throw if it's not a Builder Code error
            throw builderCodeError
          }
        }

        console.log('✅ Cleanup submitted with ID:', cleanupId.toString())
        console.log('✅ Transaction hash:', transactionHash)
        console.log('✅ Referrer address used in submission:', referrerAddress || 'none (no referrer)')
        if (referrerAddress && referrerAddress !== '0x0000000000000000000000000000000000000000') {
          console.log('✅ Referral reward will be distributed when cleanup is verified!')
        }
        setStep('review')
        
        // Show transaction modal with success message
        const explorerUrl = `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${transactionHash}`
        showSuccess(
          'Cleanup Submitted Successfully!',
          `Your cleanup has been submitted and is pending verification. Cleanup ID: ${cleanupId.toString()}`,
          {
            transactionHash,
            actionLabel: 'View Transaction',
            onAction: async () => {
              await openUrl(explorerUrl)
            },
          }
        )
        
        // Store cleanup ID using storage manager (scoped to user address)
        if (typeof window !== 'undefined' && address) {
          const { setPendingCleanupId, setPendingCleanupLocation, removeReferrer } = await import('@/lib/storage-manager')
          setPendingCleanupId(address, cleanupId)
          setPendingCleanupLocation(address, location)
          
          // Clear referrer from localStorage after successful submission
          // The referrer is now stored on-chain, so we don't need to keep it locally
          removeReferrer(address)
        }
        
        // Redirect to home after 5 seconds (give user time to see transaction modal)
        setTimeout(() => {
          router.push('/')
        }, 5000)
      } catch (submitError: any) {
        console.error('Error submitting cleanup:', submitError)
        const errorMessage = submitError?.message || submitError?.shortMessage || String(submitError) || 'Unknown error'
        const errorName = submitError?.name || ''
        const errorDetails = submitError?.details || ''
        const errorCode = submitError?.code

        // Check for specific error types
        const isChainNotConfigured =
          errorDetails?.includes('Chain not configured') ||
          errorMessage.includes('Chain not configured') ||
          errorMessage.includes('chain not configured') ||
          errorMessage.includes('Unrecognized chain') ||
          errorCode === 4902 // MetaMask error code for chain not configured

        const isSwitchError =
          errorName === 'SwitchChainError' ||
          errorMessage.includes('switch chain') ||
          errorMessage.includes('SwitchChainError')

        const isGasError = 
          errorMessage.includes('Insufficient balance') ||
          errorMessage.includes('insufficient funds') ||
          errorMessage.includes('gas') ||
          errorCode === -32000 // RPC error for insufficient funds

        const isUserRejected = 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('user rejected') ||
          errorCode === 4001

        const isNetworkError =
          errorMessage.includes('network') ||
          errorMessage.includes('Network') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('timeout')

        if (isUserRejected) {
          alert(
            `Transaction was rejected.\n\n` +
            `You cancelled the transaction in your wallet. If you want to submit the cleanup, please approve the transaction when prompted.`
          )
        } else if (isChainNotConfigured) {
          alert(
            `❌ ${REQUIRED_CHAIN_NAME} is not configured in your wallet!\n\n` +
            `Please add ${REQUIRED_CHAIN_NAME} to your wallet:\n\n` +
            `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
            `2. Go to Settings → Networks → Add Network\n` +
            `3. Click "Add a network manually"\n` +
            `4. Enter these details:\n` +
            `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
            `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
            `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
            `   • Currency Symbol: ETH\n` +
            `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
            `5. Click "Save" and switch to ${REQUIRED_CHAIN_NAME}\n` +
            `${REQUIRED_CHAIN_IS_TESTNET ? `6. Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n` : ''}` +
            `${REQUIRED_CHAIN_IS_TESTNET ? `7. Then try submitting again.` : `6. Then try submitting again.`}`
          )
        } else if (isSwitchError) {
          alert(
            `❌ Failed to switch to ${REQUIRED_CHAIN_NAME}!\n\n` +
            `Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet:\n\n` +
            `1. Open your wallet extension/app\n` +
            `2. Click the network dropdown (top of wallet)\n` +
            `3. Select "${REQUIRED_CHAIN_NAME}" from the list\n` +
            `4. If ${REQUIRED_CHAIN_NAME} is not in the list, you may need to add it:\n` +
            `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
            `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
            `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
            `   • Currency Symbol: ETH\n` +
            `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
            `5. Once on ${REQUIRED_CHAIN_NAME}, try submitting again.\n\n` +
            `Current error: ${errorMessage}`
          )
        } else if (isGasError) {
          alert(
            `❌ Gas fee issue detected!\n\n` +
            `${errorMessage}\n\n` +
            `Please check:\n` +
            `- You have ETH in your wallet on ${REQUIRED_CHAIN_NAME}\n` +
            `- Your wallet shows sufficient balance for gas fees\n` +
            `- If you just added funds, wait a moment and try again\n\n` +
            `${REQUIRED_CHAIN_IS_TESTNET ? `Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet` : ''}`
          )
        } else if (isNetworkError) {
          alert(
            `❌ Network error!\n\n` +
            `${errorMessage}\n\n` +
            `This might be a temporary network issue. Please:\n` +
            `- Check your internet connection\n` +
            `- Make sure you're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
            `- Wait a moment and try again\n\n` +
            `If the problem persists, the transaction may have still been submitted. Check your wallet's transaction history.`
          )
        } else {
          alert(
            `Failed to submit cleanup:\n\n${errorMessage}\n\n` +
            `Please check:\n` +
            `- Your wallet is connected\n` +
            `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
            `- You have enough ETH for gas fees\n` +
            `- Your internet connection is stable\n\n` +
            `If the problem persists, try refreshing the page and submitting again.`
          )
        }

        setIsSubmitting(false)
        return
      }
    } catch (error) {
      console.error('Error in cleanup submission flow:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorName = error instanceof Error ? error.name : ''
      const errorDetails = (error as any)?.details || ''
      const errorCode = (error as any)?.code

      // Check for specific error types
      const isChainNotConfigured =
        errorDetails?.includes('Chain not configured') ||
        errorMessage.includes('Chain not configured') ||
        errorMessage.includes('chain not configured') ||
        errorMessage.includes('Unrecognized chain') ||
        errorCode === 4902

      const isSwitchError =
        errorName === 'SwitchChainError' ||
        errorMessage.includes('switch chain') ||
        errorMessage.includes('SwitchChainError')

      const isGasError = 
        errorMessage.includes('Insufficient balance') ||
        errorMessage.includes('insufficient funds') ||
        errorMessage.includes('gas') ||
        errorCode === -32000

      const isUserRejected = 
        errorMessage.includes('User rejected') ||
        errorMessage.includes('user rejected') ||
        errorCode === 4001

      const isNetworkError =
        errorMessage.includes('network') ||
        errorMessage.includes('Network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout')

      if (isUserRejected) {
        alert(
          `Transaction was rejected.\n\n` +
          `You cancelled the transaction in your wallet. If you want to submit the cleanup, please approve the transaction when prompted.`
        )
      } else if (isChainNotConfigured) {
        alert(
          `❌ ${REQUIRED_CHAIN_NAME} is not configured in your wallet!\n\n` +
          `Please add ${REQUIRED_CHAIN_NAME} to your wallet:\n\n` +
          `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
          `2. Go to Settings → Networks → Add Network\n` +
          `3. Click "Add a network manually"\n` +
          `4. Enter these details:\n` +
          `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
          `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
          `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
          `   • Currency Symbol: ETH\n` +
          `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
          `5. Click "Save" and switch to ${REQUIRED_CHAIN_NAME}\n` +
          `${REQUIRED_CHAIN_IS_TESTNET ? `6. Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n` : ''}` +
          `${REQUIRED_CHAIN_IS_TESTNET ? `7. Then try submitting again.` : `6. Then try submitting again.`}`
        )
      } else if (isSwitchError) {
        alert(
          `❌ Failed to switch to ${REQUIRED_CHAIN_NAME}!\n\n` +
          `Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet:\n\n` +
          `1. Open your wallet extension/app\n` +
          `2. Click the network dropdown (top of wallet)\n` +
          `3. Select "${REQUIRED_CHAIN_NAME}" from the list\n` +
          `4. If ${REQUIRED_CHAIN_NAME} is not in the list, you may need to add it:\n` +
          `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
          `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
          `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
          `   • Currency Symbol: ETH\n` +
          `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
          `5. Once on ${REQUIRED_CHAIN_NAME}, try submitting again.\n\n` +
          `Current error: ${errorMessage}`
        )
      } else if (isGasError) {
        alert(
          `❌ Gas fee issue detected!\n\n` +
          `${errorMessage}\n\n` +
          `Please check:\n` +
          `- You have ETH in your wallet on ${REQUIRED_CHAIN_NAME}\n` +
          `- Your wallet shows sufficient balance for gas fees\n` +
          `- If you just added funds, wait a moment and try again\n\n` +
          `${REQUIRED_CHAIN_IS_TESTNET ? `Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet` : ''}`
        )
      } else if (isNetworkError) {
        alert(
          `❌ Network error!\n\n` +
          `${errorMessage}\n\n` +
          `This might be a temporary network issue. Please:\n` +
          `- Check your internet connection\n` +
          `- Make sure you're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
          `- Wait a moment and try again\n\n` +
          `If the problem persists, the transaction may have still been submitted. Check your wallet's transaction history.`
        )
      } else {
        alert(
          `Failed to submit cleanup:\n\n${errorMessage}\n\n` +
          `Please check:\n` +
          `- Your wallet is connected\n` +
          `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
          `- You have enough ETH for gas fees\n` +
          `- Your internet connection is stable\n\n` +
          `If the problem persists, try refreshing the page and submitting again.`
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if submission is disabled due to pending cleanup or wrong network
  const isWrongNetwork = chainId !== REQUIRED_CHAIN_ID
  const isSubmissionDisabled = (pendingCleanup && !pendingCleanup.verified) || isWrongNetwork || isSwitchingChain

  // Referral Notification Component (defined early so it's always in scope)
  const ReferralNotification = () => {
    if (!showReferralNotification || !referrerAddress) return null
    
    // Show message before wallet connection
    if (!address || !isConnected) {
      return (
        <div className="mb-6 rounded-lg border-2 border-brand-green bg-brand-green/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Users className="h-5 w-5 text-brand-green" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">
                🎉 You Were Invited!
              </h3>
              <p className="text-sm text-gray-300">
                You've been referred to DeCleanup Rewards! Connect your wallet and submit your first cleanup to earn <strong className="text-white">3 DCU</strong> for both you and your referrer.
              </p>
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
    
    // Show loading state while checking eligibility
    if (referralEligible === null) {
      return (
        <div className="mb-6 rounded-lg border-2 border-gray-600 bg-gray-900/50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Checking referral eligibility…</p>
            </div>
          </div>
        </div>
      )
    }
    
    // Show ineligible message if user already used referral
    if (referralEligible === false) {
      return (
        <div className="mb-6 rounded-lg border-2 border-yellow-600 bg-yellow-900/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-bold uppercase text-yellow-500">
                ⚠️ Referral Already Used
              </h3>
              <p className="text-sm text-gray-300">
                {referralIneligibleReason || 'You have already used a referral link. Each user can only receive referral rewards once.'}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                You can still submit cleanups and earn rewards, but you won't receive additional referral rewards.
              </p>
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
    
    // Show eligible message
    return (
      <div className="mb-6 rounded-lg border-2 border-brand-green bg-brand-green/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Users className="h-5 w-5 text-brand-green" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">
              🎉 You Were Invited!
            </h3>
            <p className="text-sm text-gray-300">
              You've been referred to DeCleanup Rewards! When you submit your first cleanup and it gets verified, both you and your referrer will earn <strong className="text-white">3 DCU</strong> each.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Submit a cleanup below to get started and claim your referral reward!
            </p>
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

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md">
          {/* Network notice */}
          <div className="mb-4 rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
            <p className="text-xs text-blue-300">
              <strong>Note:</strong> Make sure your wallet is connected to Base Sepolia chain to ensure smooth performance.
            </p>
          </div>
          
          {/* Only show back button if there's no referral */}
          {!referrerAddress && (
            <BackButton href="/" label="Go Back" />
          )}
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    // Get available connectors for wallet connection
    const availableConnectors = connectors.filter(c => c.ready)
    const metaMaskConnector = availableConnectors.find(
      c => c.id === 'metaMask' || c.id === 'injected' || c.name.toLowerCase().includes('metamask')
    )
    const primaryConnector = metaMaskConnector || availableConnectors[0]
    
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to submit a cleanup.
          </p>
          
          {/* Wallet connect button */}
          {primaryConnector && (
            <Button
              size="lg"
              onClick={async () => {
                try {
                  await connect({ connector: primaryConnector })
                } catch (error: any) {
                  console.error('Wallet connect failed:', error)
                  if (error?.code !== 4001) {
                    alert('Failed to connect wallet. Please try again or use the wallet button in the header.')
                  }
                }
              }}
              disabled={isConnecting}
              className="mb-4 w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
            >
              {isConnecting ? 'Connecting…' : `Connect ${primaryConnector.name}`}
            </Button>
          )}
          
          <p className="text-xs text-gray-500">
            You can also use the wallet button in the header.
          </p>
          
          {/* Only show back button if there's no referral */}
          {!referrerAddress && (
            <div className="mt-4">
              <BackButton href="/" label="Go Back" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Cooldown/Wrong Network banner component
  const CooldownBanner = () => {
    if (checkingPending) return null
    
    // Show wrong network warning first (higher priority)
    if (isWrongNetwork) {
      return (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-red-400">Wrong Network</h3>
              <p className="mb-3 text-sm text-gray-300">
                You're on Chain ID {chainId} ({describeChain(chainId)}). Please switch to the required network before submitting a cleanup.
              </p>
              <Button
                onClick={async () => {
                  try {
                    await switchChain({ chainId: REQUIRED_CHAIN_ID })
                  } catch {
                    alert(`Please switch to ${REQUIRED_CHAIN_NAME} manually in MetaMask.`)
                  }
                }}
                disabled={isSwitchingChain}
                size="sm"
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {isSwitchingChain ? 'Switching…' : `Switch to ${REQUIRED_CHAIN_NAME}`}
              </Button>
            </div>
          </div>
        </div>
      )
    }
    
    // Show cooldown warning if pending cleanup
    if (pendingCleanup && !pendingCleanup.verified) {
      const handleClearAndResubmit = async () => {
        if (!address) return
        
        setClearingPending(true)
        try {
          // First, check if cleanup actually exists on-chain
          try {
            const status = await getCleanupStatus(pendingCleanup.id)
            console.log('Cleanup status on-chain:', status)
            
            // If cleanup exists and is verified, just clear localStorage
            if (status.verified) {
              clearPendingCleanupData(address)
              setPendingCleanup(null)
              alert('Cleanup is already verified! Clearing local data. You can now claim it from your profile.')
              return
            }
            
            // If cleanup exists but not verified, ask for confirmation
            const confirmed = confirm(
              `Cleanup #${pendingCleanup.id.toString()} exists on-chain and is pending verification.\n\n` +
              `Are you sure you want to clear it? This won't delete it from the blockchain, ` +
              `but will allow you to submit a new cleanup.\n\n` +
              `Note: The old cleanup will still be in the verifier dashboard.`
            )
            
            if (!confirmed) {
              setClearingPending(false)
              return
            }
          } catch (error: any) {
            // Cleanup doesn't exist on-chain - safe to clear
            console.log('Cleanup does not exist on-chain, clearing localStorage:', error?.message)
          }
          
          // Clear localStorage
          clearPendingCleanupData(address)
          setPendingCleanup(null)
          alert('Pending cleanup data cleared! You can now submit a new cleanup.')
        } catch (error) {
          console.error('Error clearing cleanup data:', error)
          alert('Failed to clear cleanup data. Please try refreshing the page.')
        } finally {
          setClearingPending(false)
        }
      }
      
      return (
        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-semibold text-yellow-400">
                Submission on Cooldown
              </h3>
              <p className="text-sm text-gray-300">
                You have a cleanup submission (ID: {pendingCleanup.id.toString()}) pending verification. 
                Please wait until it's verified before submitting a new cleanup.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
              <Link 
                href="/profile" 
                  className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 underline"
              >
                Check status in your profile
                <ExternalLink className="h-3 w-3" />
              </Link>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleClearAndResubmit}
                    disabled={clearingPending}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
                  >
                    {clearingPending ? 'Clearing…' : 'Clear & Resubmit (if glitched)'}
                  </button>
                  <button
                    onClick={() => {
                      if (!address) return
                      if (confirm('Reset submission counting? This will clear all pending cleanup data and allow you to submit again immediately.')) {
                        resetSubmissionCounting(address)
                        setPendingCleanup(null)
                        alert('Submission counting reset! You can now submit a new cleanup.')
                      }
                    }}
                    disabled={clearingPending}
                    className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 underline disabled:opacity-50"
                  >
                    Reset Submission Counting
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    return null
  }

  // Step 1: Before Photo
  if (step === 'before') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20 overflow-y-auto">
        <div className="mx-auto max-w-md">
          {/* Only show back button if there's no referral */}
          {!referrerAddress && (
            <div className="mb-6">
              <BackButton href="/" />
            </div>
          )}
          
          <ReferralNotification />
          
          <CooldownBanner />
          
          {userLevel === 10 && (
            <div className="mb-6 rounded-lg border border-brand-yellow/50 bg-brand-yellow/10 p-4 text-center">
              <p className="text-sm font-medium text-brand-yellow">
                🎉 Currently you passed all the levels, stay updated for more...
              </p>
            </div>
          )}
          
          {userLevel === 10 ? (
            <div className="mb-6 text-center">
              <p className="text-gray-400">You've reached the maximum level. Thank you for your contributions!</p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
                  Upload Before Photo
                </h1>
                <p className="text-sm text-gray-400">
                  Upload before and after cleanup photos with geotag. Supported formats: JPEG, JPG, HEIC. Maximum size per image: 10 MB.
                </p>
                <div className="mt-3 rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-300">
                    <strong>Note:</strong> Make sure your wallet is connected to Base Sepolia chain to ensure smooth performance and successful transactions.
                  </p>
                </div>
              </div>

              <div className="mb-6">
            <p className="mb-4 text-sm font-medium text-gray-300">
              Step 1: Snap a photo of the area before you start. Show the impact your cleanup will make!
            </p>
            
            {photoError && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{photoError}</p>
                <button
                  onClick={() => setPhotoError(null)}
                  className="mt-2 text-xs text-red-300 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            {beforePhoto && beforePhotoUrl ? (
              <div className="relative mb-4">
                <img
                  src={beforePhotoUrl}
                  alt="Before cleanup"
                  className="h-64 w-full rounded-lg object-cover"
                  onError={(e) => {
                    console.error('Error loading image preview:', e)
                    setPhotoError('Failed to display image preview. The file may be corrupted.')
                    // Clean up the broken URL
                    if (beforePhotoUrl) {
                      URL.revokeObjectURL(beforePhotoUrl)
                      setBeforePhotoUrl(null)
                    }
                    setBeforePhoto(null)
                  }}
                />
                <button
                  onClick={() => {
                    if (beforePhotoUrl) {
                      URL.revokeObjectURL(beforePhotoUrl)
                    }
                    setBeforePhoto(null)
                    setBeforePhotoUrl(null)
                    setPhotoError(null)
                  }}
                  disabled={isSubmissionDisabled}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePhotoSelect('before')}
                disabled={isSubmissionDisabled}
                className="flex h-64 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
              >
                <Upload className={`mb-2 h-12 w-12 ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-500'}`} />
                <p className={`text-sm ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                  {isSubmissionDisabled ? 'Submission on cooldown' : isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
                </p>
                {isMobile && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Camera className="h-4 w-4" />
                    <span>Camera or Gallery</span>
                  </div>
                )}
              </button>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={beforePhotoAllowed}
                onChange={(e) => setBeforePhotoAllowed(e.target.checked)}
                className="rounded border-gray-700 bg-gray-800"
              />
              Agree if you allow us to post this picture on social platforms (X, Telegram)
            </label>
          </div>

          {/* Location Status */}
          <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-3">
            {isGettingLocation ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting location…
              </div>
            ) : location ? (
              <div className="flex items-center gap-2 text-sm text-brand-green">
                <Check className="h-4 w-4" />
                Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-400">Location not captured</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <button
                  onClick={getLocation}
                  className="text-sm text-brand-green hover:text-[#4a9a26]"
                >
                  Get Location
                </button>
                  <button
                    onClick={() => setManualLocationMode(true)}
                    className="text-xs text-gray-400 underline-offset-2 hover:text-gray-200"
                  >
                    Enter manually
                </button>
                </div>
              </div>
            )}
            {locationError && (
              <div className="mt-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                {locationError}
                {isBaseBuildHost && (
                  <p className="mt-2 text-[11px] text-yellow-300/90">
                    Base Build sandboxes block GPS prompts. Open https://decleanup-mini-app-base.vercel.app/cleanup in a new tab or enter approximate coordinates below.
                  </p>
                )}
              </div>
            )}
            {manualLocationMode && (
              <div className="mt-3 space-y-3 rounded-lg border border-gray-800 bg-gray-950 p-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Paste coordinates (e.g. 37.7749, -122.4194) from Google Maps. We'll store them locally for this session.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Latitude
                    </label>
                  <input
                    type="number"
                    value={manualLatInput}
                      onChange={(e) => {
                        const value = e.target.value
                        // Prevent scientific notation (e, E, +) but allow negative numbers
                        if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                          setManualLatInput(value)
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent e, E, and + keys from being entered
                        if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                          e.preventDefault()
                        }
                      }}
                      placeholder="e.g. 37.7749"
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    step="0.000001"
                  />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Longitude
                    </label>
                  <input
                    type="number"
                    value={manualLngInput}
                      onChange={(e) => {
                        const value = e.target.value
                        // Prevent scientific notation (e, E, +) but allow negative numbers
                        if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                          setManualLngInput(value)
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent e, E, and + keys from being entered (but allow - for negative numbers)
                        if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                          e.preventDefault()
                        }
                      }}
                      placeholder="e.g. -122.4194"
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    step="0.000001"
                  />
                </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleManualLocationApply}
                    className="w-full bg-brand-green text-black hover:bg-[#4a9a26] sm:w-auto sm:min-w-[160px]"
                >
                  Save Manual Location
                </Button>
                </div>
              </div>
            )}
          </div>

              <Button
                onClick={handleBeforeNext}
                disabled={!beforePhoto || isSubmitting || isGettingLocation || userLevel === 10}
                className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    Save and Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Step 2: After Photo
  if (step === 'after') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20 overflow-y-auto">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>
          
          <ReferralNotification />
          
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Upload After Photo
            </h1>
            <p className="text-sm text-gray-400">
              Upload before and after cleanup photos with geotag. Supported formats: JPEG, JPG, HEIC. Maximum size per image: 10 MB.
            </p>
          </div>

          <div className="mb-6">
            <p className="mb-4 text-sm font-medium text-gray-300">
              Step 2: Capture the transformed space! Upload your after photo to complete your submission and earn rewards.
            </p>
            
            {photoError && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{photoError}</p>
                <button
                  onClick={() => setPhotoError(null)}
                  className="mt-2 text-xs text-red-300 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            {afterPhoto && afterPhotoUrl ? (
              <div className="relative mb-4">
                <img
                  src={afterPhotoUrl}
                  alt="After cleanup"
                  className="h-64 w-full rounded-lg object-cover"
                  onError={(e) => {
                    console.error('Error loading image preview:', e)
                    setPhotoError('Failed to display image preview. The file may be corrupted.')
                    // Clean up the broken URL
                    if (afterPhotoUrl) {
                      URL.revokeObjectURL(afterPhotoUrl)
                      setAfterPhotoUrl(null)
                    }
                    setAfterPhoto(null)
                  }}
                />
                <button
                  onClick={() => {
                    if (afterPhotoUrl) {
                      URL.revokeObjectURL(afterPhotoUrl)
                    }
                    setAfterPhoto(null)
                    setAfterPhotoUrl(null)
                    setPhotoError(null)
                  }}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePhotoSelect('after')}
                className="flex h-64 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 hover:border-gray-600"
              >
                <Upload className="mb-2 h-12 w-12 text-gray-500" />
                <p className="text-sm text-gray-400">
                  {isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
                </p>
                {isMobile && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Camera className="h-4 w-4" />
                    <span>Camera or Gallery</span>
                  </div>
                )}
              </button>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={afterPhotoAllowed}
                onChange={(e) => setAfterPhotoAllowed(e.target.checked)}
                className="rounded border-gray-700 bg-gray-800"
              />
              Agree if you allow us to post this picture on social platforms (X, Telegram)
            </label>
          </div>

          <div className="flex gap-4">
            <BackButton />
            <Button
              onClick={handleAfterNext}
              disabled={!afterPhoto || isSubmitting}
              className="flex-1 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Save and Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }


  // Step 4: Impact Report (Optional)
  if (step === 'enhanced') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20 overflow-y-auto">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>
          
          <ReferralNotification />
          
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Impact Report
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-yellow">
              +5 DCU Bonus
            </p>
            <p className="text-sm text-gray-400">
              Provide more details on your cleanup (optional, rewarded with 5 DCU).
            </p>
          </div>

          {/* Full form (always visible) - scrollable on desktop if content is tall */}
          <div className="mb-6 space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto pr-2 sm:max-h-none sm:overflow-visible">
            {/* Location Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Location Type *
              </label>
              <select
                name="location-type"
                autoComplete="off"
                value={enhancedData.locationType}
                onChange={(e) => setEnhancedData({ ...enhancedData, locationType: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                required
              >
                <option value="">Select location type</option>
                {locationTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Area Cleaned */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Area Cleaned
              </label>
              <div className="flex gap-2">
              <input
                type="number"
                name="area"
                autoComplete="off"
                inputMode="decimal"
                value={enhancedData.area}
                onChange={(e) => {
                  const value = e.target.value
                  // Prevent scientific notation (e, E, +) but allow negative numbers
                  if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                    setEnhancedData({ ...enhancedData, area: value })
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent e, E, and + keys from being entered
                  if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                    e.preventDefault()
                  }
                }}
                spellCheck={false}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="50"
                min="0"
                step="0.1"
              />
                <select
                  name="area-unit"
                  autoComplete="off"
                  value={enhancedData.areaUnit}
                  onChange={(e) => setEnhancedData({ ...enhancedData, areaUnit: e.target.value as 'sqm' | 'sqft' })}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                >
                  <option value="sqm">m²</option>
                  <option value="sqft">ft²</option>
                </select>
              </div>
            </div>

            {/* Weight Removed */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Weight Removed
              </label>
              <div className="flex gap-2">
              <input
                type="number"
                name="weight"
                autoComplete="off"
                inputMode="decimal"
                value={enhancedData.weight}
                onChange={(e) => {
                  const value = e.target.value
                  // Prevent scientific notation (e, E, +) but allow negative numbers
                  if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                    setEnhancedData({ ...enhancedData, weight: value })
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent e, E, and + keys from being entered
                  if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                    e.preventDefault()
                  }
                }}
                spellCheck={false}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="5"
                min="0"
                step="0.1"
              />
                <select
                  name="weight-unit"
                  autoComplete="off"
                  value={enhancedData.weightUnit}
                  onChange={(e) => setEnhancedData({ ...enhancedData, weightUnit: e.target.value as 'kg' | 'lbs' })}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500">1 standard trash bag ≈ 2kg</p>
            </div>

            {/* Bags Filled */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Bags Filled
              </label>
              <input
                type="number"
                name="bags"
                autoComplete="off"
                inputMode="numeric"
                value={enhancedData.bags}
                onChange={(e) => {
                  const value = e.target.value
                  // Prevent scientific notation (e, E, +) but allow negative numbers
                  if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                    setEnhancedData({ ...enhancedData, bags: value })
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent e, E, and + keys from being entered
                  if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                    e.preventDefault()
                  }
                }}
                spellCheck={false}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="2"
                min="0"
              />
            </div>

            {/* Time Spent */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Time Spent
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="hours"
                  autoComplete="off"
                  inputMode="numeric"
                  value={enhancedData.hours}
                  onChange={(e) => {
                    const value = e.target.value
                    // Prevent scientific notation (e, E, +) but allow negative numbers
                    if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                      setEnhancedData({ ...enhancedData, hours: value })
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent e, E, and + keys from being entered
                    if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault()
                    }
                  }}
                  spellCheck={false}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="1"
                  min="0"
                />
                <span className="flex items-center text-gray-400">hrs</span>
                <input
                  type="number"
                  name="minutes"
                  autoComplete="off"
                  inputMode="numeric"
                  value={enhancedData.minutes}
                  onChange={(e) => {
                    const value = e.target.value
                    // Prevent scientific notation (e, E, +) but allow negative numbers
                    if (value === '' || value === '-' || (!/[eE+]/.test(value))) {
                      setEnhancedData({ ...enhancedData, minutes: value })
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent e, E, and + keys from being entered
                    if (e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault()
                    }
                  }}
                  spellCheck={false}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="30"
                  min="0"
                  max="59"
                />
                <span className="flex items-center text-gray-400">min</span>
              </div>
            </div>

            {/* Waste Types */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Waste Types (Select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {wasteTypeOptions.map((type) => (
                  <label key={type} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 p-2 hover:bg-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      name={`waste-type-${type}`}
                      checked={enhancedData.wasteTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEnhancedData({ ...enhancedData, wasteTypes: [...enhancedData.wasteTypes, type] })
                        } else {
                          setEnhancedData({ ...enhancedData, wasteTypes: enhancedData.wasteTypes.filter(t => t !== type) })
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-white">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contributors */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Contributors
              </label>
              <div className="space-y-2">
                <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">You</span>
                    <span className="font-mono text-xs text-gray-400">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                    </span>
                </div>
                </div>
                {enhancedData.contributors.map((contributor, idx) => {
                  const isResolving = contributorResolving[idx] || false
                  const error = contributorErrors[idx]
                  const inputValue = contributor
                  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(inputValue.trim())
                  
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                    <input
                      type="text"
                      name={`contributor-${idx}`}
                      autoComplete="off"
                      inputMode="text"
                      value={contributor}
                      onChange={(e) => {
                        const newContributors = [...enhancedData.contributors]
                        newContributors[idx] = e.target.value
                        setEnhancedData({ ...enhancedData, contributors: newContributors })
                              
                              // Clear previous error when typing
                              setContributorErrors(prev => {
                                const updated = { ...prev }
                                delete updated[idx]
                                return updated
                              })
                            }}
                            onPaste={(e) => {
                              // Allow paste - will be resolved when user clicks search
                              e.preventDefault()
                              const pasted = e.clipboardData.getData('text')
                              const newContributors = [...enhancedData.contributors]
                              newContributors[idx] = pasted
                              setEnhancedData({ ...enhancedData, contributors: newContributors })
                            }}
                            placeholder={
                              isMiniApp 
                                ? "Paste Farcaster FID, @username, or wallet address" 
                                : "Paste ENS name (e.g., vitalik.eth) or wallet address (0x...)"
                            }
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 text-sm"
                            disabled={isResolving}
                          />
                          {isResolving && (
                            <div className="absolute right-12 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                        {!isAddress && inputValue.trim() && (
                    <button
                            onClick={async () => {
                              const trimmed = inputValue.trim()
                              if (!trimmed) return
                              
                              // Check if it's already an address
                              if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
                                return // Already an address, no need to resolve
                              }

                              setContributorResolving(prev => ({ ...prev, [idx]: true }))
                              setContributorErrors(prev => {
                                const updated = { ...prev }
                                delete updated[idx]
                                return updated
                              })

                              try {
                                let resolved: Address | null = null
                                
                                // First check if it's already a valid address
                                if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
                                  resolved = trimmed as Address
                                } else if (isMiniApp) {
                                  // Farcaster flow: try FID or username
                                  if (isValidFIDFormat(trimmed)) {
                                    resolved = await resolveFID(trimmed)
                                  } else if (trimmed.startsWith('@')) {
                                    const fid = await getFIDFromUsername(trimmed)
                                    if (fid) {
                                      resolved = await resolveFID(fid)
                                    } else {
                                      throw new Error('Farcaster username not found')
                                    }
                                  } else {
                                    throw new Error('Enter FID (e.g., 12345), @username, or wallet address (0x...)')
                                  }
                                } else {
                                  // Web flow: try ENS or address
                                  if (isValidENSFormat(trimmed)) {
                                    resolved = await resolveENS(trimmed)
                                  } else {
                                    throw new Error('Enter ENS name (e.g., vitalik.eth) or wallet address (0x...)')
                                  }
                                }

                                if (resolved) {
                                  const newContributors = [...enhancedData.contributors]
                                  newContributors[idx] = resolved
                                  setEnhancedData({ ...enhancedData, contributors: newContributors })
                                } else {
                                  throw new Error(isMiniApp ? 'FID or username not found' : 'ENS name not found')
                                }
                              } catch (err: any) {
                                setContributorErrors(prev => ({ 
                                  ...prev, 
                                  [idx]: err?.message || 'Failed to resolve' 
                                }))
                              } finally {
                                setContributorResolving(prev => {
                                  const updated = { ...prev }
                                  delete updated[idx]
                                  return updated
                                })
                              }
                            }}
                            disabled={isResolving || !inputValue.trim() || isAddress}
                            className="rounded-lg border border-brand-green bg-brand-green/10 px-3 py-2 text-brand-green hover:bg-brand-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Search and resolve"
                          >
                            {isResolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEnhancedData({ ...enhancedData, contributors: enhancedData.contributors.filter((_, i) => i !== idx) })
                            setContributorErrors(prev => {
                              const updated = { ...prev }
                              delete updated[idx]
                              return updated
                            })
                            setContributorResolving(prev => {
                              const updated = { ...prev }
                              delete updated[idx]
                              return updated
                            })
                          }}
                      className="rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                      {error && (
                        <p className="text-xs text-red-400">{error}</p>
                      )}
                      {isAddress && (
                        <p className="text-xs text-green-400">✓ Valid address</p>
                      )}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setEnhancedData({ ...enhancedData, contributors: [...enhancedData.contributors, ''] })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  <span className="text-lg">+</span>
                  Add Contributor
                </button>
                {enhancedData.contributors.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {isMiniApp 
                      ? 'Search by Farcaster FID (e.g., 12345) or @username. Contributors are listed for attribution purposes only.'
                      : 'Search by ENS name (e.g., vitalik.eth) or enter address directly. Contributors are listed for attribution purposes only.'}
                  </p>
                )}
              </div>
            </div>

            {/* Scope of Work (Auto-generated) */}
            {enhancedData.scopeOfWork && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Scope of Work (Auto-generated)
                </label>
                <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">
                  {enhancedData.scopeOfWork}
                </div>
              </div>
            )}

            {/* Rights Assignment */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Rights Assignment
              </label>
              <select
                name="rights-assignment"
                autoComplete="off"
                value={enhancedData.rightsAssignment}
                onChange={(e) => setEnhancedData({ ...enhancedData, rightsAssignment: e.target.value as any })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
              >
                <option value="">Select license</option>
                <option value="attribution">Allow use with credit (CC BY)</option>
                <option value="non-commercial">Non-commercial use only (CC BY-NC)</option>
                <option value="no-derivatives">No modifications allowed (CC BY-ND)</option>
                <option value="share-alike">Share with same license (CC BY-SA)</option>
                <option value="all-rights-reserved">All rights reserved</option>
              </select>
            </div>

            {/* Environmental Challenges */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Environmental Challenges
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {environmentalChallengePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const current = enhancedData.environmentalChallenges
                      const newValue = current ? `${current}, ${preset}` : preset
                      setEnhancedData({ ...enhancedData, environmentalChallenges: newValue })
                    }}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <textarea
                name="environmental-challenges"
                autoComplete="off"
                value={enhancedData.environmentalChallenges}
                onChange={(e) => setEnhancedData({ ...enhancedData, environmentalChallenges: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="What issues did you observe?"
                rows={3}
                spellCheck={true}
              />
            </div>

            {/* Prevention Suggestions */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Prevention Suggestions
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {preventionPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const current = enhancedData.preventionIdeas
                      const newValue = current ? `${current}, ${preset}` : preset
                      setEnhancedData({ ...enhancedData, preventionIdeas: newValue })
                    }}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <textarea
                name="prevention-ideas"
                autoComplete="off"
                value={enhancedData.preventionIdeas}
                onChange={(e) => setEnhancedData({ ...enhancedData, preventionIdeas: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="How can we prevent this?"
                rows={3}
                spellCheck={true}
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Additional Notes (Optional)
              </label>
              <textarea
                name="additional-notes"
                autoComplete="off"
                value={enhancedData.additionalNotes}
                onChange={(e) => setEnhancedData({ ...enhancedData, additionalNotes: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="Any additional information…"
                rows={2}
                spellCheck={true}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleSkipEnhanced}
              disabled={isSubmitting}
              className="flex-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900"
            >
              Skip Impact Report
            </Button>
            <Button
              onClick={handleSubmitEnhanced}
              disabled={isSubmitting}
              className="flex-1 gap-2 bg-brand-yellow text-black hover:bg-[#e6e600]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit {enhancedData.area ? 'with Bonus' : ''}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Step 5: In Review
  return (
    <>
      {/* Onboarding Flow - shows for first-time users, including from referral links */}
      {showOnboarding && <OnboardingFlow onComplete={handleOnboardingComplete} />}
      
      {/* Add App Modal - shows after onboarding */}
      <AddAppModal
        isOpen={showAddAppModal}
        onClose={() => {
          setShowAddAppModal(false)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('decleanup_add_app_modal_seen', 'true')
          }
        }}
      />
      
      <TransactionModal
        open={modal.open}
        onClose={hideModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        transactionHash={modal.transactionHash}
        actionLabel={modal.actionLabel}
        onAction={modal.onAction}
      />
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6">
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-brand-green" />
          <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
            In Review
          </h1>
          <p className="text-sm text-gray-400">
            After the team reviews the proof of cleanup, come back to claim your level. Usually the process takes from 2 to 12 hours. Contact us in telegram group if you have questions or for troubleshooting.
          </p>
        </div>

        {((beforePhoto && afterPhoto) || (beforePhotoIPFSHash && afterPhotoIPFSHash)) && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-gray-400">BEFORE</p>
              <img
                src={
                  beforePhotoIPFSHash 
                    ? (getIPFSUrl(beforePhotoIPFSHash) ?? '')
                    : (beforePhotoUrl ?? '')
                }
                alt="Before"
                className="h-32 w-full rounded-lg object-cover"
                onError={(e) => {
                    const img = e.target as HTMLImageElement
                  const currentSrc = img.src
                  console.error('Error loading before photo in review:', currentSrc)
                  
                  // If current src is invalid (UUID or blob URL that's been revoked), try fallback
                  if (currentSrc && (currentSrc.includes('blob:') || currentSrc.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
                    // Invalid blob URL or UUID - try IPFS or hide image
                    if (beforePhotoIPFSHash) {
                      const ipfsUrl = getIPFSUrl(beforePhotoIPFSHash)
                      if (ipfsUrl && ipfsUrl !== currentSrc) {
                        img.src = ipfsUrl
                        return
                      }
                    }
                    // Hide image if no valid source
                    img.style.display = 'none'
                  } else if (beforePhotoIPFSHash && beforePhotoUrl && beforePhotoUrl !== currentSrc) {
                    // Try blob URL as fallback if IPFS fails
                    img.src = beforePhotoUrl
                  } else {
                    // Hide image if no valid source
                    img.style.display = 'none'
                  }
                }}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-400">AFTER</p>
              <img
                src={
                  afterPhotoIPFSHash 
                    ? (getIPFSUrl(afterPhotoIPFSHash) ?? '')
                    : (afterPhotoUrl ?? '')
                }
                alt="After"
                className="h-32 w-full rounded-lg object-cover"
                onError={(e) => {
                    const img = e.target as HTMLImageElement
                  const currentSrc = img.src
                  console.error('Error loading after photo in review:', currentSrc)
                  
                  // If current src is invalid (UUID or blob URL that's been revoked), try fallback
                  if (currentSrc && (currentSrc.includes('blob:') || currentSrc.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
                    // Invalid blob URL or UUID - try IPFS or hide image
                    if (afterPhotoIPFSHash) {
                      const ipfsUrl = getIPFSUrl(afterPhotoIPFSHash)
                      if (ipfsUrl && ipfsUrl !== currentSrc) {
                        img.src = ipfsUrl
                        return
                      }
                    }
                    // Hide image if no valid source
                    img.style.display = 'none'
                  } else if (afterPhotoIPFSHash && afterPhotoUrl && afterPhotoUrl !== currentSrc) {
                    // Try blob URL as fallback if IPFS fails
                    img.src = afterPhotoUrl
                  } else {
                    // Hide image if no valid source
                    img.style.display = 'none'
                  }
                }}
              />
            </div>
          </div>
        )}

        <Button
          disabled
          className="w-full bg-gray-800 text-gray-400"
        >
          In Review
        </Button>
        
        <p className="mt-4 text-xs text-gray-500">
          Redirecting to home page...
        </p>
      </div>
    </div>
    </>
  )
}

export default function CleanupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md">
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    }>
      <CleanupContent />
    </Suspense>
  )
}
