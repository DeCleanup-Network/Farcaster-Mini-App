'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { Camera, Upload, ArrowRight, Check, Loader2, ExternalLink, X, Clock, AlertCircle } from 'lucide-react'
import { uploadToIPFS } from '@/lib/ipfs'
import { submitCleanup, checkRecyclablesReserve, getSubmissionFee, getCleanupStatus, CONTRACT_ADDRESSES } from '@/lib/contracts'

type Step = 'before' | 'after' | 'recyclables' | 'enhanced' | 'review'

const CELO_SEPOLIA_CHAIN_ID = 11142220

export default function CleanupPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('before')
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null)
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null)
  const [recyclablesPhoto, setRecyclablesPhoto] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cleanupId, setCleanupId] = useState<bigint | null>(null)
  const [hasImpactForm, setHasImpactForm] = useState(false)
  const [reserveAvailable, setReserveAvailable] = useState(true)
  const [pendingCleanup, setPendingCleanup] = useState<{
    id: bigint
    verified: boolean
    claimed: boolean
  } | null>(null)
  const [checkingPending, setCheckingPending] = useState(true)
  
  // Fix hydration error by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Enhanced form data
  const [enhancedData, setEnhancedData] = useState({
    area: '',
    weight: '',
    bags: 2,
    hours: '1',
    minutes: '30',
    locationType: '',
    wasteTypes: [] as string[],
    environmentalChallenges: '',
    preventionIdeas: '',
  })

  useEffect(() => {
    // Get location on mount
    if (!location) {
      getLocation()
    }
    
    // Check recyclables reserve
    checkRecyclablesReserve().then(setReserveAvailable).catch(() => setReserveAvailable(false))
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
              
              // Only set pending if it's actually pending (not verified)
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

  const handlePhotoCapture = (type: 'before' | 'after' | 'recyclables') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/jpg,image/heic'
    input.capture = 'environment'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Image size must be less than 10 MB')
          return
        }
        if (type === 'before') {
          setBeforePhoto(file)
        } else if (type === 'after') {
          setAfterPhoto(file)
        } else {
          setRecyclablesPhoto(file)
        }
      }
    }
    input.click()
  }

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }

    setIsGettingLocation(true)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocation(locationData)
        setIsGettingLocation(false)
        console.log('Location obtained:', locationData)
        
        // Store location in localStorage as backup
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_cleanup_location', JSON.stringify(locationData))
        }
      },
      (error) => {
        setIsGettingLocation(false)
        console.error('Error getting location:', error)
        
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
        
        let errorMessage = 'Unable to get location. '
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please enable location permissions in your browser settings.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.'
            break
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.'
            break
          default:
            errorMessage += error.message
        }
        alert(errorMessage)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
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
    // Go to recyclables step if reserve is available
    if (reserveAvailable) {
      setStep('recyclables')
    } else {
      setStep('enhanced')
    }
  }

  const handleSkipRecyclables = () => {
    setStep('enhanced')
  }

  const handleSkipEnhanced = async () => {
    await submitCleanupFlow(false, false)
  }

  const handleSubmitEnhanced = async () => {
    setHasImpactForm(true)
    await submitCleanupFlow(true, !!recyclablesPhoto)
  }

  const submitCleanupFlow = async (hasForm: boolean, hasRecyclables: boolean) => {
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
      const [beforeHash, afterHash] = await Promise.all([
        uploadToIPFS(beforePhoto).catch((error) => {
          console.error('Error uploading before photo:', error)
          throw new Error(`Failed to upload before photo: ${error.message}`)
        }),
        uploadToIPFS(afterPhoto).catch((error) => {
          console.error('Error uploading after photo:', error)
          throw new Error(`Failed to upload after photo: ${error.message}`)
        }),
      ])

      console.log('Photos uploaded:', { beforeHash: beforeHash.hash, afterHash: afterHash.hash })
      console.log('Location:', { lat: location.lat, lng: location.lng })

      // Check if submission fee is required
      const feeInfo = await getSubmissionFee()
      const feeValue = feeInfo.enabled && feeInfo.fee > 0 ? feeInfo.fee : undefined
      
      if (feeInfo.enabled && feeInfo.fee > 0) {
        console.log('Submission fee required:', feeInfo.fee.toString(), 'wei')
      }

      // Check network before submitting - try to auto-switch first
      if (chainId !== CELO_SEPOLIA_CHAIN_ID) {
        console.log(`Wrong network detected: ${chainId}, attempting to switch to ${CELO_SEPOLIA_CHAIN_ID}...`)
        
        try {
          // Try to auto-switch
          await switchChain({ chainId: CELO_SEPOLIA_CHAIN_ID })
          // Wait a bit for the switch
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Re-check chain ID after switch attempt
          // Note: chainId from hook might not update immediately, so we'll proceed
          // The contract call will fail if still on wrong network
          console.log('Network switch attempted, continuing...')
        } catch (switchError: any) {
          // If auto-switch fails, show instructions
          const errorMessage = switchError?.message || 'Unknown error'
          const wasRejected = errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('User rejected')
          
          alert(
            `❌ Wrong Network!\n\n` +
            `You're on Chain ID ${chainId} (${chainId === 1 ? 'Ethereum Mainnet' : chainId === 11155111 ? 'Sepolia' : 'Unknown Network'}), ` +
            `but need Celo Sepolia Testnet (Chain ID ${CELO_SEPOLIA_CHAIN_ID}).\n\n` +
            `${wasRejected ? 'Network switch was rejected. ' : ''}Please switch manually:\n\n` +
            `1. Click the network dropdown in MetaMask (top of the extension)\n` +
            `2. Select "Celo Sepolia Testnet" if it's already added\n` +
            `3. OR click "Add Network" → "Add a network manually" and enter:\n` +
            `   • Network Name: Celo Sepolia Testnet\n` +
            `   • RPC URL: https://forno.celo-sepolia.celo-testnet.org\n` +
            `   • Chain ID: 11142220\n` +
            `   • Currency Symbol: CELO\n` +
            `   • Block Explorer: https://sepolia.celoscan.io\n\n` +
            `4. Click "Save" and switch to it\n` +
            `5. Then try submitting again.`
          )
          setIsSubmitting(false)
          return
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
        const cleanupId = await submitCleanup(
          beforeHash.hash,
          afterHash.hash,
          location.lat,
          location.lng,
          null, // No referrer for now
          hasForm,
          feeValue // Include fee if required
        )

        console.log('Cleanup submitted with ID:', cleanupId.toString())
        setCleanupId(cleanupId)
        setStep('review')
        
        // Store cleanup ID in localStorage for verification checking (scoped to user address)
        if (typeof window !== 'undefined' && address) {
          const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
          const locationKey = `pending_cleanup_location_${address.toLowerCase()}`
          localStorage.setItem(pendingKey, cleanupId.toString())
          localStorage.setItem(locationKey, JSON.stringify(location))
          
          // Also clear old global keys if they exist
          localStorage.removeItem('pending_cleanup_id')
          localStorage.removeItem('pending_cleanup_location')
        }
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } catch (submitError: any) {
        console.error('Failed to submit cleanup:', submitError)
        const errorMessage = submitError?.message || submitError?.shortMessage || 'Unknown error'
        
        // Handle user rejection gracefully
        if (errorMessage.includes('User rejected') || 
            errorMessage.includes('denied') ||
            errorMessage.includes('rejected the request')) {
          // Don't show alert for user rejection - they know what they did
          console.log('User rejected the transaction')
        } else {
          alert(`Failed to submit cleanup: ${errorMessage}\n\nPlease check:\n- Your wallet is connected\n- You're on Celo Sepolia Testnet\n- You have enough CELO for gas\n- The contract address is correct`)
        }
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error submitting cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to submit cleanup: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if submission is disabled due to pending cleanup or wrong network
  const isWrongNetwork = chainId !== CELO_SEPOLIA_CHAIN_ID
  const isSubmissionDisabled = (pendingCleanup && !pendingCleanup.verified) || isWrongNetwork || isSwitchingChain

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-md">
          <BackButton href="/" label="Go Back" />
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to submit a cleanup.
          </p>
          <BackButton href="/" label="Go Back" />
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
                You're on Chain ID {chainId} ({chainId === 1 ? 'Ethereum Mainnet' : chainId === 11155111 ? 'Sepolia' : 'Unknown'}). 
                Please switch to <span className="font-mono font-semibold">Celo Sepolia Testnet</span> (Chain ID {CELO_SEPOLIA_CHAIN_ID}) to submit cleanups.
              </p>
              <Button
                onClick={async () => {
                  try {
                    await switchChain({ chainId: CELO_SEPOLIA_CHAIN_ID })
                  } catch (error: any) {
                    alert('Please switch to Celo Sepolia Testnet manually in MetaMask.')
                  }
                }}
                disabled={isSwitchingChain}
                size="sm"
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {isSwitchingChain ? 'Switching...' : 'Switch to Celo Sepolia'}
              </Button>
            </div>
          </div>
        </div>
      )
    }
    
    // Show cooldown warning if pending cleanup
    if (pendingCleanup && !pendingCleanup.verified) {
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
              <Link 
                href="/profile" 
                className="mt-2 inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 underline"
              >
                Check status in your profile
                <ExternalLink className="h-3 w-3" />
              </Link>
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
      <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton href="/" />
          </div>
          
          <CooldownBanner />
          
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Upload Before Photo
            </h1>
            <p className="text-sm text-gray-400">
              Upload before and after cleanup photos with geotag. Supported formats: JPEG, JPG, HEIC. Maximum size per image: 10 MB.
            </p>
          </div>

          <div className="mb-6">
            <p className="mb-4 text-sm font-medium text-gray-300">
              Step 1: Snap a photo of the area before you start. Show the impact your cleanup will make!
            </p>
            
            {beforePhoto ? (
              <div className="relative mb-4">
                <img
                  src={URL.createObjectURL(beforePhoto)}
                  alt="Before cleanup"
                  className="h-64 w-full rounded-lg object-cover"
                />
                <button
                  onClick={() => setBeforePhoto(null)}
                  disabled={isSubmissionDisabled}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePhotoCapture('before')}
                disabled={isSubmissionDisabled}
                className="flex h-64 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera className={`mb-2 h-12 w-12 ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-500'}`} />
                <p className={`text-sm ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                  {isSubmissionDisabled ? 'Submission on cooldown' : 'Tap to upload photo'}
                </p>
              </button>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                className="rounded border-gray-700 bg-gray-800"
              />
              Agree if you allow us to post your pictures on social platforms (X, Telegram)
            </label>
          </div>

          {/* Location Status */}
          <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-3">
            {isGettingLocation ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting location...
              </div>
            ) : location ? (
              <div className="flex items-center gap-2 text-sm text-brand-green">
                <Check className="h-4 w-4" />
                Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Location not captured</span>
                <button
                  onClick={getLocation}
                  className="text-sm text-brand-green hover:text-[#4a9a26]"
                >
                  Get Location
                </button>
              </div>
            )}
          </div>

          <Button
            onClick={handleBeforeNext}
            disabled={!beforePhoto || isSubmitting || isGettingLocation}
            className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
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
    )
  }

  // Step 2: After Photo
  if (step === 'after') {
    return (
      <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>
          
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
            
            {afterPhoto ? (
              <div className="relative mb-4">
                <img
                  src={URL.createObjectURL(afterPhoto)}
                  alt="After cleanup"
                  className="h-64 w-full rounded-lg object-cover"
                />
                <button
                  onClick={() => setAfterPhoto(null)}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePhotoCapture('after')}
                className="flex h-64 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900"
              >
                <Camera className="mb-2 h-12 w-12 text-gray-500" />
                <p className="text-sm text-gray-400">Tap to upload photo</p>
              </button>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                className="rounded border-gray-700 bg-gray-800"
              />
              Agree if you allow us to post your pictures on social platforms (X, Telegram)
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

  // Step 3: Recyclables (Optional)
  if (step === 'recyclables') {
    return (
      <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>
          
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Submit Recyclables
            </h1>
            <p className="mb-4 text-sm text-gray-400">
              Optional: Submit proof of separated recyclables to earn 10 cRECY tokens per submission.
            </p>
            
            {/* Recy App Partner Info */}
            <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="mb-2 text-xs font-medium text-gray-300">
                In Partnership with Recy App
              </p>
              <p className="mb-3 text-xs text-gray-400">
                Recy App helps end waste pollution at its source. Transform how we think about trash and recycling.
              </p>
              <a
                href="https://app.recy.life/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-green hover:text-[#4a9a26]"
              >
                Learn more about Recy App
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="mb-6">
            {recyclablesPhoto ? (
              <div className="relative mb-4">
                <img
                  src={URL.createObjectURL(recyclablesPhoto)}
                  alt="Recyclables"
                  className="h-64 w-full rounded-lg object-cover"
                />
                <button
                  onClick={() => setRecyclablesPhoto(null)}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePhotoCapture('recyclables')}
                className="flex h-64 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900"
              >
                <Camera className="mb-2 h-12 w-12 text-gray-500" />
                <p className="text-sm text-gray-400">Tap to upload recyclables photo</p>
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleSkipRecyclables}
              disabled={isSubmitting}
              className="flex-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900"
            >
              Skip
            </Button>
            <Button
              onClick={() => setStep('enhanced')}
              disabled={isSubmitting}
              className="flex-1 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
            >
              {recyclablesPhoto ? (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                'Skip and Continue'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Step 4: Enhanced Impact Report (Optional)
  if (step === 'enhanced') {
    return (
      <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>
          
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Enhanced Impact Report
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-yellow">
              +5 Points Bonus
            </p>
            <p className="text-sm text-gray-400">
              Provide more details on your cleanup (optional, rewarded with 5 Points).
            </p>
          </div>

          {/* Full form (always visible) */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Area Cleaned (m²)
              </label>
              <input
                type="number"
                value={enhancedData.area}
                onChange={(e) => setEnhancedData({ ...enhancedData, area: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Weight Removed (kg)
              </label>
              <input
                type="number"
                value={enhancedData.weight}
                onChange={(e) => setEnhancedData({ ...enhancedData, weight: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="5"
              />
              <p className="mt-1 text-xs text-gray-500">1 standard trash bag ≈ 2kg</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Environmental Challenges
              </label>
              <textarea
                value={enhancedData.environmentalChallenges}
                onChange={(e) => setEnhancedData({ ...enhancedData, environmentalChallenges: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="What issues did you observe?"
                rows={3}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Prevention Ideas
              </label>
              <textarea
                value={enhancedData.preventionIdeas}
                onChange={(e) => setEnhancedData({ ...enhancedData, preventionIdeas: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="How can we prevent this?"
                rows={3}
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
              Skip Enhanced Report
            </Button>
            <Button
              onClick={handleSubmitEnhanced}
              disabled={isSubmitting}
              className="flex-1 gap-2 bg-brand-yellow text-black hover:bg-[#e6e600]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
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

        {beforePhoto && afterPhoto && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-gray-400">BEFORE</p>
              <img
                src={URL.createObjectURL(beforePhoto)}
                alt="Before"
                className="h-32 w-full rounded-lg object-cover"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-400">AFTER</p>
              <img
                src={URL.createObjectURL(afterPhoto)}
                alt="After"
                className="h-32 w-full rounded-lg object-cover"
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
  )
}
