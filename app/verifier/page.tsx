'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { CheckCircle, XCircle, Clock, MapPin, User, Calendar, ExternalLink, Loader2, Shield } from 'lucide-react'
import * as contractsLib from '@/lib/contracts'
const {
  getCleanupCounter,
  getCleanupDetails,
  verifyCleanup,
  rejectCleanup,
  getCleanupStatus,
  getUserLevel,
  CONTRACT_ADDRESSES,
} = contractsLib
import { Address } from 'viem'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config, REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { getIPFSUrl } from '@/lib/ipfs'

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

interface CleanupItem {
  id: bigint
  user: Address
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: bigint
  longitude: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
  referrer: Address
  hasImpactForm: boolean
  impactReportHash: string
}


// Message to sign for verifier authentication
const VERIFIER_AUTH_MESSAGE = 'I am requesting access to the DeCleanup Verifier Dashboard. This signature proves I control this wallet address.'

// Storage key for verified verifier address
const VERIFIED_VERIFIER_KEY = 'decleanup_verified_verifier'

export default function VerifierPage() {
  const { address, isConnected } = useAccount()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isVerifier, setIsVerifier] = useState(false)
  const [needsSignature, setNeedsSignature] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cleanups, setCleanups] = useState<CleanupItem[]>([])
  const [selectedCleanup, setSelectedCleanup] = useState<CleanupItem | null>(null)
  // Level is now calculated automatically based on user's current level
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingAddress, setSigningAddress] = useState<Address | null>(null)
  const [pollingStatus, setPollingStatus] = useState<{ cleanupId: bigint | null; count: number } | null>(null)
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set())
  const [impactDataMap, setImpactDataMap] = useState<Map<string, any>>(new Map())

  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  // Fix hydration error by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if we have a verified verifier in storage
  useEffect(() => {
    if (isConnected && address) {
      checkStoredVerification()
    } else {
      setLoading(false)
    }
  }, [address, isConnected])

  // Load cleanups when verifier is authenticated
  useEffect(() => {
    if (!isVerifier) return
    
    // Load cleanups initially
    loadCleanups()
    
    // Refresh cleanups every 30 seconds
    const interval = setInterval(() => {
      loadCleanups()
    }, 30000)
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerifier])

  // Preload impact data for all cleanups with impact reports (so permissions are visible)
  useEffect(() => {
    if (cleanups.length === 0) return

    async function preloadImpactData() {
      for (const cleanup of cleanups) {
        if (cleanup.impactReportHash && !impactDataMap.has(cleanup.impactReportHash)) {
          try {
            const url = getIPFSUrl(cleanup.impactReportHash)
            const response = await fetch(url)
            if (response.ok) {
              const data = await response.json()
              setImpactDataMap(prev => {
                const newMap = new Map(prev)
                newMap.set(cleanup.impactReportHash, data)
                return newMap
              })
            }
          } catch (error) {
            // Silently fail - will load when form is expanded
            console.debug('Could not preload impact data for cleanup', cleanup.id.toString())
          }
        }
      }
    }

    preloadImpactData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanups]) // Only depend on isVerifier, not loading

  function checkStoredVerification() {
    try {
      const stored = localStorage.getItem(VERIFIED_VERIFIER_KEY)
      if (stored && address) {
        const { verifiedAddress, timestamp } = JSON.parse(stored)
        // Check if it's the same address and not expired (24 hours)
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000
        if (verifiedAddress?.toLowerCase() === address.toLowerCase() && !isExpired) {
          // Address matches and not expired, verify against contract
          verifyAgainstContract(address)
          return
        }
      }
      // Need to sign
      setNeedsSignature(true)
      setLoading(false)
    } catch (error) {
      console.error('Error checking stored verification:', error)
      setNeedsSignature(true)
      setLoading(false)
    }
  }

  async function verifyAgainstContract(addr: Address) {
    try {
      const contractAddress = CONTRACT_ADDRESSES.VERIFICATION
      if (!contractAddress) {
        setError('Verification contract address not configured. Please set NEXT_PUBLIC_VERIFICATION_CONTRACT in .env.local')
        setLoading(false)
        return
      }

      // Get isVerifier from the contracts library
      const isVerifierFn = contractsLib.isVerifier
      
      // Verify isVerifier function is available
      if (!isVerifierFn || typeof isVerifierFn !== 'function') {
        console.error('isVerifier is not a function:', typeof isVerifierFn, isVerifierFn)
        console.error('Available exports from contractsLib:', Object.keys(contractsLib))
        setError(`Verifier check function not available. Type: ${typeof isVerifierFn}. Please check contract configuration.`)
        setLoading(false)
        return
      }

      console.log('Verifying address against contract:', addr)
      console.log('isVerifier function type:', typeof isVerifierFn)
      const isAuthorized = await isVerifierFn(addr)
      console.log('Verifier check result:', isAuthorized)
      
      setIsVerifier(isAuthorized)
      
      if (isAuthorized) {
        // Store verification
        localStorage.setItem(VERIFIED_VERIFIER_KEY, JSON.stringify({
          verifiedAddress: addr,
          timestamp: Date.now(),
        }))
        await loadCleanups()
      } else {
        setError(`Address ${addr} is not in the verifier allowlist.`)
        setIsVerifier(false)
      }
    } catch (error) {
      console.error('Error verifying against contract:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to verify: ${errorMessage}`)
      setIsVerifier(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn() {
    if (!address) {
      setError('Please connect your wallet first')
      return
    }

    // Check if signMessageAsync is available
    if (!signMessageAsync || typeof signMessageAsync !== 'function') {
      setError('Signature functionality not available. Please ensure your wallet supports message signing.')
      console.error('signMessageAsync is not a function:', signMessageAsync)
      return
    }

    setError(null)
    setSigningAddress(address)

    try {
      // Request signature - if user can sign, they control the wallet
      // This is proof enough, no need to verify the signature
      console.log('Requesting signature...')
      console.log('signMessageAsync function:', typeof signMessageAsync)
      console.log('Message to sign:', VERIFIER_AUTH_MESSAGE)
      
      // Call signMessageAsync - this should trigger the wallet prompt
      // signMessageAsync returns a promise that resolves with the signature
      const signature = await signMessageAsync({ message: VERIFIER_AUTH_MESSAGE })
      
      console.log('Signature received:', signature)
      console.log('Signature type:', typeof signature)
      console.log('Signature value:', signature)

      // Only validate after we've actually received something
      // If signature is undefined, it means the user rejected or there was an error
      if (signature === undefined || signature === null) {
        setError('Signature request was cancelled or rejected. Please try again.')
        setSigningAddress(null)
        return
      }

      // Check if it's a valid string signature
      if (typeof signature !== 'string' || signature.length === 0) {
        console.error('Unexpected signature format:', typeof signature, signature)
        setError('Invalid signature format received. Please try again.')
        setSigningAddress(null)
        return
      }

      // If we got a valid signature string, the user controls the wallet
      // Now verify the address is in the allowlist
      console.log('Signature is valid, checking allowlist...')
      setLoading(true)
      await verifyAgainstContract(address)
    } catch (error: any) {
      console.error('Error during signature:', error)
      console.error('Error details:', {
        message: error?.message,
        shortMessage: error?.shortMessage,
        name: error?.name,
        code: error?.code,
        cause: error?.cause,
      })
      
      const errorMessage = error?.message || error?.shortMessage || String(error || 'Unknown error')
      
      // Handle user rejection
      if (errorMessage?.toLowerCase().includes('rejected') || 
          errorMessage?.toLowerCase().includes('denied') ||
          errorMessage?.toLowerCase().includes('user rejected') ||
          errorMessage?.toLowerCase().includes('user denied') ||
          errorMessage?.toLowerCase().includes('user cancelled')) {
        setError('Signature was rejected. Please try again when ready.')
      } else if (errorMessage?.toLowerCase().includes('invalid signature')) {
        setError('Invalid signature received. Please try again.')
      } else {
        setError(`Failed to sign message: ${errorMessage}`)
      }
      setSigningAddress(null)
      setLoading(false)
    }
  }

  async function loadCleanups() {
    // Prevent multiple simultaneous loads
    if (loading) {
      console.log('Already loading cleanups, skipping...')
      return
    }
    
    try {
      setLoading(true)
      const counter = await getCleanupCounter()
      console.log('Cleanup counter:', counter.toString())
      const cleanupList: CleanupItem[] = []

      // Load all cleanups (from 1 to counter-1, since counter is the next ID to use)
      // If counter is 0, no cleanups exist yet
      // If counter is 1, no cleanups exist (counter points to next ID: 1)
      // If counter is 2, cleanup ID 1 exists (counter points to next ID: 2)
      const totalCleanups = Number(counter)
      const maxCleanupId = totalCleanups > 0 ? totalCleanups - 1 : 0
      console.log(`Counter: ${totalCleanups}, Loading cleanups 1 to ${maxCleanupId}...`)
      
      // If counter suggests no cleanups, still try to load ID 1 in case counter is wrong
      // This can happen if there's a timing issue or counter wasn't updated
      const startId = maxCleanupId === 0 ? 1 : 1
      const endId = maxCleanupId === 0 ? 10 : maxCleanupId // Try up to 10 if counter is 0/1
      
      console.log(`Attempting to load cleanups from ${startId} to ${endId}...`)
      
      for (let i = startId; i <= endId; i++) {
        try {
          console.log(`Loading cleanup ${i}...`)
          const details = await getCleanupDetails(BigInt(i))
          
          // Filter out empty/invalid cleanups (zero address means cleanup doesn't exist)
          if (details.user === '0x0000000000000000000000000000000000000000' || 
              !details.user || 
              details.user === '0x') {
            console.log(`Cleanup ${i} is empty (zero address), skipping...`)
            // If we're past the expected range, stop trying
            if (i > maxCleanupId && maxCleanupId > 0) {
              console.log(`Reached end of valid cleanups at ${i}, stopping...`)
              break
            }
            continue
          }
          
          console.log(`Cleanup ${i} details:`, {
            id: i,
            user: details.user,
            verified: details.verified,
            claimed: details.claimed,
            level: details.level,
            timestamp: details.timestamp.toString(),
            beforeHash: details.beforePhotoHash,
            afterHash: details.afterPhotoHash,
          })
          cleanupList.push({
            id: BigInt(i),
            ...details,
            rejected: details.rejected || false,
          })
        } catch (error: any) {
          // If cleanup doesn't exist (e.g., deleted or never created), skip it
          // This can happen if counter is higher than actual cleanups
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('revert') || 
              errorMessage.includes('does not exist') || 
              errorMessage.includes('Invalid cleanup ID') ||
              errorMessage.includes('Failed to get cleanup')) {
            // If we're past the expected range and hit a "does not exist", stop trying
            if (i > maxCleanupId && maxCleanupId > 0) {
              console.log(`Reached end of expected cleanups at ${i}, stopping...`)
              break
            }
            // If counter was 0/1 and we're checking beyond, continue trying a few more
            if (maxCleanupId === 0 && i > 5) {
              console.log(`No cleanups found after checking ${i}, stopping...`)
              break
            }
            continue
          }
          // For other errors (RPC issues), log but continue
          console.warn(`Unexpected error loading cleanup ${i}:`, errorMessage)
          // Don't break on RPC errors, continue trying
        }
      }

      console.log(`Loaded ${cleanupList.length} cleanup(s) total`)
      console.log('Pending cleanups:', cleanupList.filter(c => !c.verified).length)
      console.log('Verified cleanups:', cleanupList.filter(c => c.verified).length)

      // Sort by timestamp (newest first)
      cleanupList.sort((a, b) => Number(b.timestamp - a.timestamp))
      setCleanups(cleanupList)
    } catch (error) {
      console.error('Error loading cleanups:', error)
      setError('Failed to load cleanups')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(cleanupId: bigint) {
    setVerifying(true)
    setError(null)

    try {
      // Get the cleanup details to find the user
      const cleanup = cleanups.find(c => c.id === cleanupId)
      if (!cleanup) {
        throw new Error('Cleanup not found')
      }

      // Get user's current level from Impact Product NFT
      let nextLevel = 1 // Default to level 1 for new users
      try {
        const currentLevel = await getUserLevel(cleanup.user)
        // Next level is current + 1, capped at 10
        nextLevel = Math.min(currentLevel + 1, 10)
        console.log(`User ${cleanup.user} current level: ${currentLevel}, assigning level: ${nextLevel}`)
      } catch (levelError) {
        console.warn('Could not get user level, defaulting to 1:', levelError)
        // If user has no NFT yet, they start at level 1
        nextLevel = 1
      }

      // Verify with automatically calculated level
      const hash = await verifyCleanup(cleanupId, nextLevel)
      console.log(`Verifying cleanup ${cleanupId.toString()} with level ${nextLevel}`)
      console.log(`Transaction hash: ${hash}`)
      
      // Transaction was submitted successfully
      // Instead of waiting for receipt (which can fail with RPC errors),
      // we'll just reload cleanups and let the user know the transaction was sent
      console.log('Verification transaction submitted, hash:', hash)
      
      // Reload cleanups - the transaction will process on-chain
      await loadCleanups()
      setSelectedCleanup(null)
      
      // Show success with transaction hash
      const explorerUrl = getExplorerTxUrl(hash)
      alert(
        `✅ Verification transaction submitted!\n\n` +
        `Transaction Hash: ${hash}\n\n` +
        `The cleanup will be verified once the transaction confirms (usually within 1-2 minutes).\n\n` +
        `View on ${BLOCK_EXPLORER_NAME}: ${explorerUrl}`
      )
      
      // Poll for verification status by checking the cleanup directly
      // This is more reliable than waiting for transaction receipt
      setPollingStatus({ cleanupId, count: 0 })
      let pollCount = 0
      const maxPolls = 90 // Poll for up to 3 minutes (90 * 2 seconds)
      const pollInterval = setInterval(async () => {
        pollCount++
        setPollingStatus({ cleanupId, count: pollCount })
        console.log(`Polling for verification status (attempt ${pollCount}/${maxPolls})...`)
        try {
          // Check if the cleanup is now verified by reading from contract
          const status = await getCleanupStatus(cleanupId)
          console.log(`Cleanup ${cleanupId.toString()} status check:`, { verified: status.verified, level: status.level })
          if (status.verified) {
            console.log('✅ Cleanup verified confirmed on-chain, reloading cleanups...')
            clearInterval(pollInterval)
            setPollingStatus(null)
            // Reload cleanups to show updated verified status
            await loadCleanups()
            alert(`✅ Cleanup ${cleanupId.toString()} is now verified!`)
          } else if (pollCount >= maxPolls) {
            console.log('Max polls reached, stopping background check')
            clearInterval(pollInterval)
            setPollingStatus(null)
            alert(
              `Polling stopped after ${maxPolls} attempts. The transaction may still be pending. Check ${BLOCK_EXPLORER_NAME} for status.`
            )
          }
        } catch (checkError: any) {
          const errorMsg = checkError?.message || String(checkError)
          console.log(`Poll attempt ${pollCount} failed:`, errorMsg)
          // If check fails, continue polling (might be RPC issues)
          if (pollCount >= maxPolls) {
            console.log('Max polls reached, stopping background check')
            clearInterval(pollInterval)
            setPollingStatus(null)
          }
        }
      }, 2000) // Poll every 2 seconds
      
      // Cleanup interval after 3 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        if (pollingStatus?.cleanupId === cleanupId) {
          setPollingStatus(null)
        }
      }, 180000)
    } catch (error) {
      console.error('Error verifying cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to verify: ${errorMessage}`)
    } finally {
      setVerifying(false)
    }
  }

  async function handleReject(cleanupId: bigint) {
    setRejecting(true)
    setError(null)

    try {
      const hash = await rejectCleanup(cleanupId)
      console.log(`Rejecting cleanup ${cleanupId.toString()}`)
      console.log(`Transaction hash: ${hash}`)
      
      // Reload cleanups
      await loadCleanups()
      setSelectedCleanup(null)
      
      // Show success with transaction hash
      const explorerUrl = getExplorerTxUrl(hash)
      alert(
        `✅ Rejection transaction submitted!\n\n` +
        `Transaction Hash: ${hash}\n\n` +
        `The cleanup will be marked as rejected once the transaction confirms.\n\n` +
        `View on ${BLOCK_EXPLORER_NAME}: ${explorerUrl}`
      )
    } catch (error) {
      console.error('Error rejecting cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to reject: ${errorMessage}`)
    } finally {
      setRejecting(false)
    }
  }

  function getIPFSUrl(hash: string): string | null {
    if (!hash || hash === '' || hash === '0x' || hash.length === 0) return null
    // Remove ipfs:// prefix if present
    const cleanHash = hash.replace(/^ipfs:\/\//, '')
    if (!cleanHash || cleanHash.length === 0) return null
    return `${IPFS_GATEWAY}${cleanHash}`
  }

  function formatDate(timestamp: bigint): string {
    return new Date(Number(timestamp) * 1000).toLocaleString()
  }

  function formatCoordinates(lat: bigint, lng: bigint): string {
    const latNum = Number(lat) / 1e6
    const lngNum = Number(lng) / 1e6
    return `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`
  }

  function getLevelName(level: number): string {
    if (level >= 1 && level <= 3) return 'Newbie'
    if (level >= 4 && level <= 6) return 'Pro'
    if (level >= 7 && level <= 9) return 'Hero'
    if (level >= 10) return 'Guardian'
    return 'Unassigned'
  }


  // Component to fetch and display impact report details from IPFS
  function ImpactReportDetails({ impactReportHash }: { impactReportHash?: string | null }) {
    const [impactData, setImpactData] = useState<any>(null)
    const [impactDataUrl, setImpactDataUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      async function fetchImpactData() {
        if (!impactReportHash) {
          setError('Impact report data was not provided with this cleanup.')
          setLoading(false)
          return
        }
        try {
          setLoading(true)
          const url = getIPFSUrl(impactReportHash)
          setImpactDataUrl(url)
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error('Failed to fetch impact report data from IPFS')
          }
          const data = await response.json()
          setImpactData(data)
          // Store in map for easy access by cleanup ID
          if (impactReportHash) {
            setImpactDataMap(prev => {
              const newMap = new Map(prev)
              newMap.set(impactReportHash, data)
              return newMap
            })
          }
        } catch (err: any) {
          console.error('Error fetching impact report data:', err)
          setError(err.message || 'Failed to load impact report data')
        } finally {
          setLoading(false)
        }
      }

      fetchImpactData()
    }, [impactReportHash])

    if (loading) {
      return (
        <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
          <p className="font-semibold text-green-300">Impact Report</p>
          <p className="mt-2 text-gray-200">Loading impact report data…</p>
        </div>
      )
    }

    if (error || !impactData) {
      return (
        <div className="mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          <p className="font-semibold text-yellow-200">Impact Report</p>
          <p className="mt-2 text-gray-200">
            {error || 'Impact report metadata is unavailable. Ask the submitter to re-open the cleanup and re-send the enhanced form if needed.'}
          </p>
        </div>
      )
    }

    return (
      <div className="mt-3 rounded-xl border border-green-500/40 bg-green-500/5 p-4 text-sm text-gray-100">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold uppercase tracking-wide text-green-300">Impact Report Details</p>
          {impactDataUrl && (
            <a
              href={impactDataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-200 underline hover:text-green-100"
            >
              View raw IPFS JSON
            </a>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {impactData.locationType && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Location Type</dt>
              <dd className="text-base text-white">{impactData.locationType}</dd>
            </div>
          )}
          {impactData.area && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Area Cleaned</dt>
              <dd className="text-base text-white">
                {impactData.area} {impactData.areaUnit === 'sqm' ? 'm²' : 'ft²'}
              </dd>
            </div>
          )}
          {impactData.weight && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Weight Removed</dt>
              <dd className="text-base text-white">
                {impactData.weight} {impactData.weightUnit}
              </dd>
            </div>
          )}
          {impactData.bags && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Bags Filled</dt>
              <dd className="text-base text-white">{impactData.bags}</dd>
            </div>
          )}
          {(impactData.hours || impactData.minutes) && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Time Spent</dt>
              <dd className="text-base text-white">
                {impactData.hours || 0}h {impactData.minutes || 0}m
              </dd>
            </div>
          )}
          {impactData.wasteTypes && impactData.wasteTypes.length > 0 && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Waste Types</dt>
              <dd className="text-base text-white">{impactData.wasteTypes.join(', ')}</dd>
            </div>
          )}
          {impactData.contributors && impactData.contributors.length > 0 && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Contributors</dt>
              <dd className="text-base text-white">{impactData.contributors.length} address(es)</dd>
            </div>
          )}
          {impactData.scopeOfWork && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Scope of Work</dt>
              <dd className="text-base text-white">{impactData.scopeOfWork}</dd>
            </div>
          )}
          {impactData.rightsAssignment && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Rights Assignment</dt>
              <dd className="text-base text-white">{impactData.rightsAssignment}</dd>
            </div>
          )}
          {impactData.environmentalChallenges && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Environmental Challenges</dt>
              <dd className="text-base text-white">{impactData.environmentalChallenges}</dd>
            </div>
          )}
          {impactData.preventionIdeas && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Prevention Suggestions</dt>
              <dd className="text-base text-white">{impactData.preventionIdeas}</dd>
            </div>
          )}
          {impactData.additionalNotes && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Additional Notes</dt>
              <dd className="text-base text-white whitespace-pre-wrap">{impactData.additionalNotes}</dd>
            </div>
          )}
        </dl>

        <p className="mt-4 text-xs text-gray-400">
          * Impact report data is self-reported; verify details against the provided photos before approving.
        </p>
      </div>
    )
  }

  const pendingCleanups = cleanups.filter((c) => !c.verified && !c.rejected)
  const verifiedCleanups = cleanups.filter((c) => c.verified)
  const rejectedCleanups = cleanups.filter((c) => c.rejected)

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
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
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
            <h2 className="mb-4 text-2xl font-bold uppercase text-white">Verifier Login</h2>
            <p className="mb-6 text-gray-400">
              Connect your wallet to access the verifier dashboard. Only whitelisted verifier addresses can access this page.
            </p>
            <div className="flex justify-center">
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show signature request screen
  if (needsSignature && !isVerifier) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
            <Shield className="mx-auto mb-4 h-16 w-16 text-brand-green" />
            <h2 className="mb-4 text-2xl font-bold uppercase text-white">Verify Your Identity</h2>
            <p className="mb-6 text-gray-400">
              Please sign a message with your wallet to verify you control a whitelisted verifier address.
            </p>
            
            {address && (
              <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4 text-left">
                <p className="mb-2 text-sm text-gray-400">Connected Address:</p>
                <p className="font-mono text-sm text-white break-all">{address}</p>
              </div>
            )}

            <div className="mb-6 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-blue-400">Message to sign:</p>
              <p className="text-sm text-gray-300 italic">"{VERIFIER_AUTH_MESSAGE}"</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
                {error}
              </div>
            )}

            <Button
              onClick={handleSignIn}
              disabled={isSigning || loading}
              className="bg-brand-green text-black hover:bg-brand-green/90"
            >
              {isSigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Sign Message to Verify
                </>
              )}
            </Button>

            <p className="mt-6 text-xs text-gray-500">
              This signature proves you control the wallet address. We'll check if it's whitelisted as a verifier.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  if (!isVerifier) {
    const contractAddress = CONTRACT_ADDRESSES.VERIFICATION
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-4 text-2xl font-bold uppercase text-white">Access Denied</h2>
            {error && (
              <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-left">
                <p className="text-sm text-yellow-400 font-mono break-all">{error}</p>
              </div>
            )}
            <p className="mb-4 text-gray-400">
              This address is not authorized as a verifier. Only whitelisted verifier addresses can access this dashboard.
            </p>
            <div className="mb-6 space-y-2 text-left">
              <p className="text-sm text-gray-500 font-mono break-all">
                <span className="text-gray-400">Your address:</span> {address}
              </p>
              {contractAddress && (
                <p className="text-sm text-gray-500 font-mono break-all">
                  <span className="text-gray-400">Contract address:</span> {contractAddress}
                </p>
              )}
              {!contractAddress && (
                <p className="text-sm text-red-400">
                  ⚠ Contract address not configured. Set NEXT_PUBLIC_VERIFICATION_CONTRACT in .env.local
                </p>
              )}
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-white">Troubleshooting:</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
                <li>Ensure contracts are deployed with your address in VERIFIER_ADDRESSES</li>
                <li>Check that NEXT_PUBLIC_VERIFICATION_CONTRACT matches the deployed contract</li>
                <li>Verify you're connected to the correct network ({REQUIRED_CHAIN_NAME})</li>
                <li>Check browser console for detailed error messages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/" />
        
        <div className="mb-8 mt-6">
          <h1 className="mb-2 text-4xl font-bold uppercase tracking-wide text-white sm:text-5xl">
            Verifier Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Review and verify cleanup submissions. Assign levels (1-10) based on impact and quality.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-sm text-gray-400">Total Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-white">{cleanups.length}</div>
            {pollingStatus && (
              <div className="mt-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Waiting for verification... (check {pollingStatus.count}/90)</span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="text-sm text-gray-400">Pending Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-yellow-400">{pendingCleanups.length}</div>
          </div>
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
            <div className="text-sm text-gray-400">Verified Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-green-400">{verifiedCleanups.length}</div>
          </div>
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <div className="text-sm text-gray-400">Rejected Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-red-400">{rejectedCleanups.length}</div>
          </div>
        </div>

        {/* Pending Cleanups */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Pending Verification</h2>
          {pendingCleanups.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No pending cleanups to verify.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCleanups.map((cleanup) => (
                <div
                  key={cleanup.id.toString()}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-6"
                >
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-lg font-bold text-white">Cleanup #{cleanup.id.toString()}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="h-4 w-4" />
                          <span className="font-mono text-xs">{cleanup.user}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(cleanup.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span>{formatCoordinates(cleanup.latitude, cleanup.longitude)}</span>
                        </div>
                        {cleanup.referrer !== '0x0000000000000000000000000000000000000000' && (
                          <div className="text-xs text-yellow-400">Referred by: {cleanup.referrer.slice(0, 10)}...</div>
                        )}
                        {cleanup.hasImpactForm && (
                          <div className="text-xs">
                            <button
                              onClick={() => {
                                const formId = cleanup.id.toString()
                                setExpandedForms(prev => {
                                  const newSet = new Set(prev)
                                  if (newSet.has(formId)) {
                                    newSet.delete(formId)
                                  } else {
                                    newSet.add(formId)
                                  }
                                  return newSet
                                })
                              }}
                              className="flex items-center gap-1 text-green-400 hover:text-green-300"
                            >
                              ✓ Enhanced impact form submitted
                              <span className="text-xs text-gray-400">(click to {expandedForms.has(cleanup.id.toString()) ? 'collapse' : 'expand'})</span>
                            </button>
                            {expandedForms.has(cleanup.id.toString()) && (
                              <ImpactReportDetails impactReportHash={cleanup.impactReportHash} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>Before Photo</span>
                          {(() => {
                            const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                            const allowed = impactData?.beforePhotoAllowed
                            if (allowed === true) {
                              return <CheckCircle className="h-4 w-4 text-green-400" title="User allowed use of this image" />
                            } else if (allowed === false) {
                              return <XCircle className="h-4 w-4 text-red-400" title="User did not allow use of this image" />
                            }
                            return null
                          })()}
                        </div>
                        {getIPFSUrl(cleanup.beforePhotoHash) ? (
                          <a
                            href={getIPFSUrl(cleanup.beforePhotoHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block overflow-hidden rounded-lg border border-gray-700"
                          >
                            <img
                              src={getIPFSUrl(cleanup.beforePhotoHash)!}
                              alt="Before"
                              className="h-32 w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-image.png'
                              }}
                            />
                            {(() => {
                              const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                              const allowed = impactData?.beforePhotoAllowed
                              if (allowed === true) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1.5">
                                    <CheckCircle className="h-4 w-4 text-white" title="Allowed for social media" />
                                  </div>
                                )
                              } else if (allowed === false) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5">
                                    <XCircle className="h-4 w-4 text-white" title="Not allowed for social media" />
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>After Photo</span>
                          {(() => {
                            const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                            const allowed = impactData?.afterPhotoAllowed
                            if (allowed === true) {
                              return <CheckCircle className="h-4 w-4 text-green-400" title="User allowed use of this image" />
                            } else if (allowed === false) {
                              return <XCircle className="h-4 w-4 text-red-400" title="User did not allow use of this image" />
                            }
                            return null
                          })()}
                        </div>
                        {getIPFSUrl(cleanup.afterPhotoHash) ? (
                          <a
                            href={getIPFSUrl(cleanup.afterPhotoHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block overflow-hidden rounded-lg border border-gray-700"
                          >
                            <img
                              src={getIPFSUrl(cleanup.afterPhotoHash)!}
                              alt="After"
                              className="h-32 w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-image.png'
                              }}
                            />
                            {(() => {
                              const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                              const allowed = impactData?.afterPhotoAllowed
                              if (allowed === true) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1.5">
                                    <CheckCircle className="h-4 w-4 text-white" title="Allowed for social media" />
                                  </div>
                                )
                              } else if (allowed === false) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5">
                                    <XCircle className="h-4 w-4 text-white" title="Not allowed for social media" />
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-gray-400">
                      Level will be assigned automatically based on user's current Impact Product level (next level up, max 10)
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleReject(cleanup.id)}
                        disabled={rejecting || verifying}
                        variant="outline"
                        className="border-red-500 text-red-400 hover:bg-red-500/10"
                      >
                        {rejecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleVerify(cleanup.id)}
                        disabled={verifying || rejecting}
                        className="bg-brand-green text-black hover:bg-brand-green/90"
                      >
                        {verifying ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Verify & Assign Level
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verified Cleanups */}
        <div>
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Verified Cleanups</h2>
          {verifiedCleanups.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No verified cleanups yet.
            </div>
          ) : (
            <div className="space-y-4">
              {verifiedCleanups.map((cleanup) => (
                <div
                  key={cleanup.id.toString()}
                  className="rounded-lg border border-green-500/50 bg-green-500/10 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <span className="font-bold text-white">Cleanup #{cleanup.id.toString()}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">
                        Level {cleanup.level} ({getLevelName(cleanup.level)}) • {formatDate(cleanup.timestamp)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {cleanup.claimed ? (
                        <span className="text-green-400">✓ Claimed</span>
                      ) : (
                        <span className="text-yellow-400">Pending Claim</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

