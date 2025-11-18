'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { Camera, Upload, ArrowRight, Check, Loader2, ExternalLink, X, Clock, AlertCircle } from 'lucide-react'
import { uploadToIPFS, uploadJSONToIPFS, getIPFSUrl } from '@/lib/ipfs'
import { submitCleanup, getSubmissionFee, getCleanupStatus, CONTRACT_ADDRESSES } from '@/lib/contracts'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from '@/lib/wagmi'

type Step = 'before' | 'after' | 'enhanced' | 'review'

const NATIVE_SYMBOL = 'ETH'
const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
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
    default:
      return 'Unknown Network'
  }
}

export default function CleanupPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('before')
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null)
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cleanupId, setCleanupId] = useState<bigint | null>(null)
  const [hasImpactForm, setHasImpactForm] = useState(false)
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

  useEffect(() => {
    // Get location on mount
    if (!location) {
      getLocation()
    }
    
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

  const handlePhotoCapture = (type: 'before' | 'after') => {
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
    // Go to enhanced form
    setStep('enhanced')
  }

  const handleSkipEnhanced = async () => {
    await submitCleanupFlow(false)
  }

  const handleSubmitEnhanced = async () => {
    setHasImpactForm(true)
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

      // Upload enhanced impact report data to IPFS if form was submitted
      let impactFormDataHash: string | null = null
      if (hasForm && enhancedData.locationType) {
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

      // Check network before submitting - try to auto-switch first
      if (chainId !== REQUIRED_CHAIN_ID) {
        console.log(`Wrong network detected: ${chainId}, attempting to switch to ${REQUIRED_CHAIN_ID}...`)
        
        try {
          // Try to auto-switch
          await switchChain({ chainId: REQUIRED_CHAIN_ID })
          // Wait a bit for the switch
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Re-check chain ID after switch attempt
          // Note: chainId from hook might not update immediately, so we'll proceed
          // The contract call will fail if still on wrong network
          console.log('Network switch attempted, continuing...')
        } catch (switchError: any) {
          // If auto-switch fails, show instructions
          const errorMessage = switchError?.message || switchError?.shortMessage || String(switchError) || 'Unknown error'
          const isChainNotConfigured = 
            errorMessage.includes('Chain not configured') ||
            errorMessage.includes('chain not configured') ||
            errorMessage.includes('not configured') ||
            errorMessage.includes('Unrecognized chain') ||
            switchError?.name === 'ChainNotConfiguredError' ||
            switchError?.code === 4902
          const wasRejected = errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('User rejected')
          
          if (isChainNotConfigured) {
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
          } else {
            alert(
              `❌ Wrong Network!\n\n` +
              `You're on Chain ID ${chainId} (${describeChain(chainId)}), ` +
              `but need ${REQUIRED_CHAIN_NAME} (Chain ID ${REQUIRED_CHAIN_ID}).\n\n` +
              `${wasRejected ? 'Network switch was rejected. ' : ''}Please switch manually:\n\n` +
              `1. Click the network dropdown in MetaMask (top of the extension)\n` +
              `2. Select "${REQUIRED_CHAIN_NAME}" if it's already added\n` +
              `3. OR click "Add Network" → "Add a network manually" and enter:\n` +
              `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
              `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
              `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
              `   • Currency Symbol: ETH\n` +
              `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n\n` +
              `4. Click "Save" and switch to it\n` +
              `5. Then try submitting again.\n\n` +
              `Error: ${errorMessage}`
            )
          }
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
          impactFormDataHash || '',
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
        console.error('Error submitting cleanup:', submitError)
        const errorMessage = submitError?.message || submitError?.shortMessage || String(submitError) || 'Unknown error'
        const errorName = submitError?.name || ''
        const errorDetails = submitError?.details || ''
        
        // Check if it's truly a "chain not configured" error (not just a switch error)
        const isChainNotConfigured = 
          errorDetails?.includes('Chain not configured') ||
          errorMessage.includes('Chain not configured') ||
          errorMessage.includes('chain not configured') ||
          errorMessage.includes('Unrecognized chain') ||
          submitError?.code === 4902 // MetaMask error code for chain not configured
        
        // Check if it's a switch chain error (could be configured but switch failed)
        const isSwitchError = 
          errorName === 'SwitchChainError' ||
          errorMessage.includes('switch chain') ||
          errorMessage.includes('SwitchChainError')
        
        if (isChainNotConfigured) {
          // Show detailed instructions for adding the network
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
          // Chain might be configured but switch failed - ask user to manually switch
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
        } else {
          alert(
            `Failed to submit cleanup:\n\n${errorMessage}\n\n` +
            `Please check:\n` +
            `- Your wallet is connected\n` +
            `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
            `- You have enough ETH for gas\n` +
            `- The contract address is correct`
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
      
      // Check if it's truly a "chain not configured" error (not just a switch error)
      const isChainNotConfigured = 
        errorDetails?.includes('Chain not configured') ||
        errorMessage.includes('Chain not configured') ||
        errorMessage.includes('chain not configured') ||
        errorMessage.includes('Unrecognized chain') ||
        errorCode === 4902 // MetaMask error code for chain not configured
      
      // Check if it's a switch chain error (could be configured but switch failed)
      const isSwitchError = 
        errorName === 'SwitchChainError' ||
        errorMessage.includes('switch chain') ||
        errorMessage.includes('SwitchChainError')
      
      if (isChainNotConfigured) {
        // Show detailed instructions for adding the network
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
        // Chain might be configured but switch failed - ask user to manually switch
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
      } else {
        alert(
          `Failed to submit cleanup:\n\n${errorMessage}\n\n` +
          `Please check:\n` +
          `- Your wallet is connected\n` +
          `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
          `- You have enough ETH for gas\n` +
          `- The contract address is correct`
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if submission is disabled due to pending cleanup or wrong network
  const isWrongNetwork = chainId !== REQUIRED_CHAIN_ID
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
                You're on Chain ID {chainId} ({describeChain(chainId)}). 
                Please switch to <span className="font-mono font-semibold">{REQUIRED_CHAIN_NAME}</span> (Chain ID {REQUIRED_CHAIN_ID}) to submit cleanups.
              </p>
              <Button
                onClick={async () => {
                  try {
                    await switchChain({ chainId: REQUIRED_CHAIN_ID })
                  } catch (error: any) {
                    alert(`Please switch to ${REQUIRED_CHAIN_NAME} manually in MetaMask.`)
                  }
                }}
                disabled={isSwitchingChain}
                size="sm"
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {isSwitchingChain ? 'Switching...' : `Switch to ${REQUIRED_CHAIN_NAME}`}
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


  // Step 4: Impact Report (Optional)
  if (step === 'enhanced') {
    return (
      <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>
          
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Impact Report
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-yellow">
              +5 Points Bonus
            </p>
            <p className="text-sm text-gray-400">
              Provide more details on your cleanup (optional, rewarded with 5 Points).
            </p>
          </div>

          {/* Full form (always visible) */}
          <div className="mb-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Location Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Location Type *
              </label>
              <select
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
                  value={enhancedData.area}
                  onChange={(e) => setEnhancedData({ ...enhancedData, area: e.target.value })}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="50"
                  min="0"
                  step="0.1"
                />
                <select
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
                  value={enhancedData.weight}
                  onChange={(e) => setEnhancedData({ ...enhancedData, weight: e.target.value })}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="5"
                  min="0"
                  step="0.1"
                />
                <select
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
                value={enhancedData.bags}
                onChange={(e) => setEnhancedData({ ...enhancedData, bags: e.target.value })}
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
                  value={enhancedData.hours}
                  onChange={(e) => setEnhancedData({ ...enhancedData, hours: e.target.value })}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="1"
                  min="0"
                />
                <span className="flex items-center text-gray-400">hrs</span>
                <input
                  type="number"
                  value={enhancedData.minutes}
                  onChange={(e) => setEnhancedData({ ...enhancedData, minutes: e.target.value })}
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
                  {address || 'Your wallet address'} (You)
                </div>
                {enhancedData.contributors.map((contributor, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={contributor}
                      onChange={(e) => {
                        const newContributors = [...enhancedData.contributors]
                        newContributors[idx] = e.target.value
                        setEnhancedData({ ...enhancedData, contributors: newContributors })
                      }}
                      placeholder="Contributor address (0x...)"
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 text-sm"
                    />
                    <button
                      onClick={() => setEnhancedData({ ...enhancedData, contributors: enhancedData.contributors.filter((_, i) => i !== idx) })}
                      className="rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEnhancedData({ ...enhancedData, contributors: [...enhancedData.contributors, ''] })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  <span className="text-lg">+</span>
                  Add Contributor
                </button>
                {enhancedData.contributors.length > 0 && (
                  <p className="text-xs text-gray-500">Contributors will receive +5 $DCU when they submit cleanup photos</p>
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
                value={enhancedData.rightsAssignment}
                onChange={(e) => setEnhancedData({ ...enhancedData, rightsAssignment: e.target.value as any })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
              >
                <option value="">Select license</option>
                <option value="attribution">Attribution (CC BY)</option>
                <option value="non-commercial">Non-Commercial (CC BY-NC)</option>
                <option value="no-derivatives">No Derivatives (CC BY-ND)</option>
                <option value="share-alike">Share Alike (CC BY-SA)</option>
                <option value="all-rights-reserved">All Rights Reserved</option>
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
                value={enhancedData.environmentalChallenges}
                onChange={(e) => setEnhancedData({ ...enhancedData, environmentalChallenges: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="What issues did you observe?"
                rows={3}
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
                value={enhancedData.preventionIdeas}
                onChange={(e) => setEnhancedData({ ...enhancedData, preventionIdeas: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="How can we prevent this?"
                rows={3}
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Additional Notes (Optional)
              </label>
              <textarea
                value={enhancedData.additionalNotes}
                onChange={(e) => setEnhancedData({ ...enhancedData, additionalNotes: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="Any additional information..."
                rows={2}
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
