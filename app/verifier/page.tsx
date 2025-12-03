'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { CheckCircle, XCircle, Clock, MapPin, User, Calendar, ExternalLink, Loader2, Shield, RefreshCw } from 'lucide-react'
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
import { waitForTransactionReceipt, getEnsName } from 'wagmi/actions'
import { config, REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_NAME, REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/wagmi'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { getIPFSUrl, getIPFSFallbackUrls } from '@/lib/ipfs'
import { findCleanupsByWallet } from '@/lib/find-cleanup-by-wallet'
import { tryAddRequiredChain } from '@/lib/network'

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`
const NETWORK_DETAILS = [
  `Network Name: ${REQUIRED_CHAIN_NAME}`,
  `RPC URL: ${REQUIRED_RPC_URL}`,
  `Chain ID: ${REQUIRED_CHAIN_ID}`,
  `Currency: ETH`,
  `Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}`,
].join('\n')

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
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain()
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
  const [activeTx, setActiveTx] = useState<{ cleanupId: bigint; hash: `0x${string}` } | null>(null)
  const [searchWallet, setSearchWallet] = useState<string>('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<{ cleanupId: bigint; verified: boolean; claimed: boolean; level: number; user: Address }>>([])
  const [isLoadingCleanups, setIsLoadingCleanups] = useState(false)
  const [isAddingNetwork, setIsAddingNetwork] = useState(false)
  const [copiedNetworkDetails, setCopiedNetworkDetails] = useState(false)
  const [ensNames, setEnsNames] = useState<Map<string, string>>(new Map())
  const [verifierStats, setVerifierStats] = useState<{
    totalVerified: number
    totalDistributed: string
    verifierEarned: string
    totalEarnings: string // All rewards combined (verifier + level + impact form + referral + streak)
    isLoading: boolean
  }>({
    totalVerified: 0,
    totalDistributed: '0',
    verifierEarned: '0',
    totalEarnings: '0',
    isLoading: true,
  })

  const { signMessageAsync, isPending: isSigning } = useSignMessage()
  const isWrongNetwork = Boolean(
    isConnected &&
      (typeof chainId !== 'number' || chainId !== REQUIRED_CHAIN_ID)
  )

  const attemptSwitchToRequiredChain = async (context: string) => {
    if (!switchChain) {
      throw new Error(
        `Automatic network switching is not supported by this wallet. Please switch to ${REQUIRED_CHAIN_NAME} manually:\n\n${NETWORK_DETAILS}`
      )
    }

    try {
      await switchChain({ chainId: REQUIRED_CHAIN_ID })
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error: any) {
      console.warn(`[${context}] switchChain failed:`, error)
      const message = (error?.message || '').toLowerCase()
      const requiresImport =
        message.includes('not configured') ||
        message.includes('unrecognized chain') ||
        message.includes('unknown chain') ||
        error?.code === 4902

      if (requiresImport) {
        const added = await tryAddRequiredChain()
        if (added) {
          await new Promise(resolve => setTimeout(resolve, 1200))
          try {
            await switchChain({ chainId: REQUIRED_CHAIN_ID })
            await new Promise(resolve => setTimeout(resolve, 500))
            return
          } catch (retryError) {
            console.warn(`[${context}] Retry switch after add failed:`, retryError)
          }
        }
        throw new Error(
          `${REQUIRED_CHAIN_NAME} is not configured in your wallet. Please add it manually:\n\n${NETWORK_DETAILS}`
        )
      }

      if (message.includes('rejected')) {
        throw new Error('Network switch was rejected. Approve the prompt in your wallet or switch manually.')
      }

      throw new Error(
        `Unable to switch to ${REQUIRED_CHAIN_NAME}. Please switch manually and try again.\n\n${NETWORK_DETAILS}`
      )
    }
  }

  const ensureCorrectNetwork = async (context: string) => {
    if (!isConnected) {
      throw new Error('Please connect your wallet first.')
    }
    if (typeof chainId === 'number' && chainId === REQUIRED_CHAIN_ID) {
      return
    }
    await attemptSwitchToRequiredChain(context)
  }

  const handleAddNetwork = async () => {
    if (isAddingNetwork) return
    setIsAddingNetwork(true)
    try {
      const added = await tryAddRequiredChain()
      if (added) {
        alert(`${REQUIRED_CHAIN_NAME} was sent to your wallet. Approve the prompt there, then tap "Switch Network".`)
      } else {
        alert(`We couldn't add ${REQUIRED_CHAIN_NAME} automatically. Please add it manually:\n\n${NETWORK_DETAILS}`)
      }
    } finally {
      setIsAddingNetwork(false)
    }
  }

  const handleCopyNetworkDetails = async () => {
    try {
      await navigator.clipboard.writeText(NETWORK_DETAILS)
      setCopiedNetworkDetails(true)
      setTimeout(() => setCopiedNetworkDetails(false), 2000)
    } catch {
      alert(`Copy failed. Details:\n\n${NETWORK_DETAILS}`)
    }
  }

  const handleNetworkBannerSwitch = async () => {
    try {
      await ensureCorrectNetwork('network banner')
    } catch (error: any) {
      alert(error?.message || String(error))
    }
  }

  const WrongNetworkBanner = () => {
    if (!isWrongNetwork) return null
    return (
      <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-left">
        <div className="flex flex-col gap-2 text-sm text-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-yellow-300">Wrong network detected</p>
            <p className="text-xs text-gray-400">
              Please switch to {REQUIRED_CHAIN_NAME} before verifying or rejecting cleanups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleNetworkBannerSwitch}
              disabled={isSwitchingNetwork}
              className="bg-brand-green text-black hover:bg-brand-green/90"
            >
              {isSwitchingNetwork ? 'Switching...' : `Switch to ${REQUIRED_CHAIN_NAME}`}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddNetwork}
              disabled={isAddingNetwork}
              className="bg-black/30 text-white hover:bg-black/60"
            >
              {isAddingNetwork ? 'Adding...' : 'Add network'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyNetworkDetails}
              className="border-gray-600 text-gray-200"
            >
              {copiedNetworkDetails ? 'Copied!' : 'Copy details'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs font-mono text-gray-400 whitespace-pre-wrap">{NETWORK_DETAILS}</p>
      </div>
    )
  }

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
      // Only refresh if not currently loading
      if (!isLoadingCleanups) {
      loadCleanups()
      }
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
            // Clean the hash - remove ipfs:// prefix if present
            const cleanHash = cleanup.impactReportHash.replace(/^ipfs:\/\//, '').trim()
            if (!cleanHash || cleanHash.length === 0) continue
            
            const url = getIPFSUrl(cleanHash)
            if (!url) continue // Skip if URL is null
            
            const response = await fetch(url, {
              mode: 'cors',
              cache: 'no-cache',
            })
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
            console.debug('Could not preload impact data for cleanup', cleanup.id.toString(), error)
          }
        }
      }
    }

    preloadImpactData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanups]) // Only depend on isVerifier, not loading

  // Fetch ENS names for all unique addresses in cleanups
  useEffect(() => {
    if (cleanups.length === 0) return

    async function fetchEnsNames() {
      const uniqueAddresses = new Set<string>()
      cleanups.forEach(cleanup => {
        uniqueAddresses.add(cleanup.user.toLowerCase())
        if (cleanup.referrer && cleanup.referrer !== '0x0000000000000000000000000000000000000000') {
          uniqueAddresses.add(cleanup.referrer.toLowerCase())
        }
      })

      const newEnsNames = new Map<string, string>()
      
      // Fetch ENS names in parallel (but limit concurrency)
      const addressArray = Array.from(uniqueAddresses)
      const batchSize = 5
      for (let i = 0; i < addressArray.length; i += batchSize) {
        const batch = addressArray.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (addr) => {
            try {
              // Only fetch if not already cached
              if (!ensNames.has(addr)) {
                const name = await getEnsName(config, { 
                  address: addr as `0x${string}`
                })
                if (name) {
                  newEnsNames.set(addr, name)
                }
              }
            } catch (error) {
              // Silently fail - most addresses won't have ENS names
              console.debug('ENS lookup failed for', addr, error)
            }
          })
        )
      }

      if (newEnsNames.size > 0) {
        setEnsNames(prev => {
          const merged = new Map(prev)
          newEnsNames.forEach((name, addr) => merged.set(addr, name))
          return merged
        })
      }
    }

    fetchEnsNames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanups])

  // Load verifier stats
  useEffect(() => {
    if (!isVerifier || !address || cleanups.length === 0) {
      setVerifierStats({ totalVerified: 0, totalDistributed: '0', verifierEarned: '0', totalEarnings: '0', isLoading: false })
      return
    }

    async function loadVerifierStats() {
      try {
        setVerifierStats(prev => ({ ...prev, isLoading: true }))
        
        // Count verified cleanups (both approved and rejected count as verifications)
        const verifiedCount = cleanups.filter(c => c.verified || c.rejected).length
        
        // Calculate verifier rewards separately (1 $bDCU per verification)
        // Note: totalDistributed[address] includes ALL rewards (verifier + level + impact form + referral + streak)
        // So we calculate verifier rewards separately based on verification count
        const verifierRewardsOnly = verifiedCount * 1 // 1 $bDCU per verification
        const verifierEarned = verifierRewardsOnly.toFixed(2)
        
        // Also get total earnings (all rewards combined) for reference
        let totalEarnings = '0'
        if (address) {
          try {
            const contractsModule = await import('@/lib/contracts')
            const totalEarningsFromContract = await contractsModule.getVerifierTokenEarnings(address)
            console.log('Total earnings from contract (all rewards):', totalEarningsFromContract)
            totalEarnings = parseFloat(totalEarningsFromContract).toFixed(2)
            
            // Log breakdown for debugging
            const totalEarningsNum = parseFloat(totalEarningsFromContract)
            if (totalEarningsNum > verifierRewardsOnly) {
              const otherRewards = totalEarningsNum - verifierRewardsOnly
              console.log(`Verifier rewards: ${verifierRewardsOnly} $bDCU, Other rewards: ${otherRewards.toFixed(2)} $bDCU (level claims, impact forms, referrals, streaks)`)
            }
          } catch (error) {
            console.error('Error fetching total earnings:', error)
            // If we can't fetch, assume total equals verifier rewards
            totalEarnings = verifierEarned
          }
        } else {
          totalEarnings = verifierEarned
        }
        
        // Try to get total distributed from reward distributor (if using token system)
        let totalDistributed = '0'
        try {
          const { readContract } = await import('wagmi/actions')
          const { config } = await import('@/lib/wagmi')
          const { CONTRACT_ADDRESSES, BDCU_REWARD_DISTRIBUTOR_ABI } = await import('@/lib/contracts')
          
          if (CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
            console.log('Fetching globalTotalDistributed from:', CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR)
            const globalTotal = await readContract(config, {
              address: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
              abi: BDCU_REWARD_DISTRIBUTOR_ABI,
              functionName: 'globalTotalDistributed',
            }) as bigint
            
            console.log('Raw globalTotalDistributed value:', globalTotal.toString())
            // Format as $bDCU (18 decimals)
            totalDistributed = (Number(globalTotal) / 1e18).toFixed(2)
            console.log('Formatted total distributed:', totalDistributed)
          } else {
            console.warn('BDCU_REWARD_DISTRIBUTOR address not set')
            // Fallback to points system
            const { CONTRACT_ADDRESSES: CONTRACT_ADDRS, REWARD_DISTRIBUTOR_ABI: REWARD_ABI } = await import('@/lib/contracts')
            if (CONTRACT_ADDRS.REWARD_DISTRIBUTOR) {
              const totalPoints = await readContract(config, {
                address: CONTRACT_ADDRS.REWARD_DISTRIBUTOR,
                abi: REWARD_ABI,
                functionName: 'totalPointsDistributed',
              }) as bigint
              
              totalDistributed = (Number(totalPoints) / 1e18).toFixed(2)
            }
          }
        } catch (error: any) {
          console.error('Error loading total distributed:', error)
          console.error('Error details:', {
            message: error?.message,
            code: error?.code,
            name: error?.name,
          })
          // Keep default '0' if query fails
        }
        
        setVerifierStats({
          totalVerified: verifiedCount,
          totalDistributed,
          verifierEarned,
          totalEarnings,
          isLoading: false,
        })
      } catch (error) {
        console.error('Error loading verifier stats:', error)
        setVerifierStats({ totalVerified: 0, totalDistributed: '0', verifierEarned: '0', totalEarnings: '0', isLoading: false })
      }
    }

    loadVerifierStats()

    // Listen for manual refresh events
    const handleRefresh = () => {
      loadVerifierStats()
    }
    window.addEventListener('verifier-stats-refresh', handleRefresh)

    return () => {
      window.removeEventListener('verifier-stats-refresh', handleRefresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerifier, address, cleanups])

  // Helper component to display address with ENS name
  function AddressDisplay({ address }: { address: Address | string }) {
    const addr = typeof address === 'string' ? address : address
    const addrLower = addr.toLowerCase()
    const ensName = ensNames.get(addrLower)
    
    return (
      <span className="font-mono text-xs">
        {ensName ? (
          <span title={addr}>
            {ensName} <span className="text-gray-500">({addr.slice(0, 6)}...{addr.slice(-4)})</span>
          </span>
        ) : (
          <span>{addr}</span>
        )}
      </span>
    )
  }

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
      await ensureCorrectNetwork('verifier sign-in')

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
      
      // Handle chain configuration errors
      if (errorMessage?.toLowerCase().includes('chain not configured') || 
          errorMessage?.toLowerCase().includes('not configured')) {
        setError(
          `Chain configuration error: ${errorMessage}\n\n` +
          `Please ensure ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) is added to your wallet, ` +
          `then switch to it and try signing again.`
        )
      } else if (errorMessage?.toLowerCase().includes('rejected') || 
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
    // Prevent concurrent calls
    if (isLoadingCleanups) {
      console.log('loadCleanups already in progress, skipping...')
      return
    }
    
    try {
      setIsLoadingCleanups(true)
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
      
      // Always try to load a wider range to catch any cleanups that might exist
      // Start from 1, go up to counter-1, but also try a few more in case counter is off
      const startId = 1
      // Load up to counter-1, but also try a few more IDs in case counter is slightly off
      // Use counter-1 as primary, but extend to at least 20 to catch any missed cleanups
      const endId = Math.max(maxCleanupId, 20) // Try at least up to ID 20, or counter-1 if higher
      
      console.log(`Attempting to load cleanups from ${startId} to ${endId}...`)
      
      for (let i = startId; i <= endId; i++) {
        try {
          const details = await getCleanupDetails(BigInt(i))
          
          // Filter out empty/invalid cleanups (zero address means cleanup doesn't exist)
          if (details.user === '0x0000000000000000000000000000000000000000' || 
              !details.user || 
              details.user === '0x') {
            // Skip empty cleanups silently
            continue
          }
          
          // Only log found cleanups, not every attempt
          console.log(`Found cleanup ${i}:`, {
            user: details.user,
            verified: details.verified,
            claimed: details.claimed,
            level: details.level,
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
            // Continue checking - don't stop early as counter might be off
            // Only stop if we've checked many IDs and found nothing
            if (i > 50) {
              console.log(`Checked up to ID ${i}, stopping search...`)
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
      console.log('Pending cleanups:', cleanupList.filter(c => !c.verified && !c.rejected).length)
      console.log('Verified cleanups:', cleanupList.filter(c => c.verified).length)

      // Sort by timestamp (newest first)
      cleanupList.sort((a, b) => Number(b.timestamp - a.timestamp))
      setCleanups(cleanupList)
    } catch (error) {
      console.error('Error loading cleanups:', error)
      setError('Failed to load cleanups')
    } finally {
      setLoading(false)
      setIsLoadingCleanups(false)
    }
  }

  async function handleVerify(cleanupId: bigint) {
    setVerifying(true)
    setError(null)

    try {
      await ensureCorrectNetwork('verify cleanup')
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

      // Verify with automatically calculated level - pass chainId to avoid false detection
      const hash = await verifyCleanup(cleanupId, nextLevel, chainId)
      setActiveTx({ cleanupId, hash })
      console.log(`Verifying cleanup ${cleanupId.toString()} with level ${nextLevel}`)
      console.log(`Transaction hash: ${hash}`)
      
      // Show initial success message
      const explorerUrl = getExplorerTxUrl(hash)
      setPollingStatus({ cleanupId, count: 0 })
      
      // Wait for transaction receipt first to ensure it was confirmed
      try {
        console.log('Waiting for transaction receipt...')
        const receipt = await waitForTransactionReceipt(config, { 
          hash,
          timeout: 120000, // 2 minute timeout
        })
        console.log('Transaction confirmed in block:', receipt.blockNumber)
        
        // Transaction confirmed, now check if verification was successful
        // Give it a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Check verification status
      let pollCount = 0
        const maxPolls = 30 // Poll for up to 1 minute after confirmation (30 * 2 seconds)
      const pollInterval = setInterval(async () => {
        pollCount++
        setPollingStatus({ cleanupId, count: pollCount })
        console.log(`Polling for verification status (attempt ${pollCount}/${maxPolls})...`)
        try {
          const status = await getCleanupStatus(cleanupId)
          console.log(`Cleanup ${cleanupId.toString()} status check:`, { verified: status.verified, level: status.level })
          if (status.verified) {
            console.log('✅ Cleanup verified confirmed on-chain, reloading cleanups...')
            clearInterval(pollInterval)
            setPollingStatus(null)
            await loadCleanups()
              setSelectedCleanup(null)
              alert(
                `✅ Cleanup ${cleanupId.toString()} is now verified!\n\n` +
                `View on ${BLOCK_EXPLORER_NAME}: ${explorerUrl}`
              )
          } else if (pollCount >= maxPolls) {
              console.log('Max polls reached after confirmation, stopping check')
            clearInterval(pollInterval)
            setPollingStatus(null)
              await loadCleanups()
              setSelectedCleanup(null)
              alert(
                `⚠️ Transaction confirmed but verification status not updated yet.\n\n` +
                `This may be a temporary RPC issue. Check ${BLOCK_EXPLORER_NAME}:\n${explorerUrl}`
              )
          }
        } catch (checkError: any) {
          const errorMsg = checkError?.message || String(checkError)
          console.log(`Poll attempt ${pollCount} failed:`, errorMsg)
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval)
            setPollingStatus(null)
              await loadCleanups()
              setSelectedCleanup(null)
          }
        }
      }, 2000) // Poll every 2 seconds
      
        // Cleanup interval after 1 minute
      setTimeout(() => {
        clearInterval(pollInterval)
        if (pollingStatus?.cleanupId === cleanupId) {
          setPollingStatus(null)
        }
        }, 60000)
      } catch (receiptError: any) {
        // Transaction receipt wait failed (timeout or error)
        console.error('Error waiting for transaction receipt:', receiptError)
        setPollingStatus(null)
        await loadCleanups()
        setSelectedCleanup(null)
        
        const errorMsg = receiptError?.message || String(receiptError)
        if (errorMsg.includes('timeout')) {
          alert(
            `⏱️ Transaction submitted but confirmation is taking longer than expected.\n\n` +
            `Transaction Hash: ${hash}\n\n` +
            `Please check ${BLOCK_EXPLORER_NAME} for status:\n${explorerUrl}\n\n` +
            `The cleanup will be verified once the transaction confirms.`
          )
        } else {
          alert(
            `⚠️ Transaction submitted but could not confirm receipt.\n\n` +
            `Transaction Hash: ${hash}\n\n` +
            `Please check ${BLOCK_EXPLORER_NAME} for status:\n${explorerUrl}`
          )
        }
      }
    } catch (error) {
      console.error('Error verifying cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to verify: ${errorMessage}`)
      
      // Show alert for critical errors (chain mismatches, etc.)
      if (errorMessage.includes('CRITICAL') || errorMessage.includes('Chain') || errorMessage.includes('network')) {
        alert(`❌ ${errorMessage}`)
      } else {
        // For other errors, show a more user-friendly message
        alert(`Failed to verify cleanup:\n\n${errorMessage}\n\nPlease check your wallet connection and network settings.`)
      }
    } finally {
      setVerifying(false)
      setActiveTx(null)
    }
  }

  async function handleReject(cleanupId: bigint) {
    setRejecting(true)
    setError(null)

    try {
      await ensureCorrectNetwork('reject cleanup')
      // Pass chainId to avoid false chain detection
      const hash = await rejectCleanup(cleanupId, chainId)
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
    // Use a unique key based on hash to persist expanded state per cleanup
    const expandedKey = `impact_expanded_${impactReportHash}`
    const [expanded, setExpanded] = useState(() => {
      if (typeof window === 'undefined') return false
      try {
        return localStorage.getItem(expandedKey) === 'true'
      } catch {
        return false
      }
    })
    
    // Persist expanded state to localStorage
    const toggleExpanded = (newValue: boolean) => {
      setExpanded(newValue)
      try {
        if (newValue) {
          localStorage.setItem(expandedKey, 'true')
        } else {
          localStorage.removeItem(expandedKey)
        }
      } catch (e) {
        console.warn('Failed to save expanded state:', e)
      }
    }

    useEffect(() => {
      async function fetchImpactData() {
        if (!impactReportHash || expanded === false) {
          return // Only fetch when expanded
        }
        
        // Check if we already have this data cached
        if (impactDataMap.has(impactReportHash)) {
          setImpactData(impactDataMap.get(impactReportHash))
          return
        }
        
        try {
          const { getIPFSUrl, getIPFSFallbackUrls } = await import('@/lib/ipfs')
          
          // Clean the hash - remove ipfs:// prefix if present
          const cleanHash = impactReportHash.replace(/^ipfs:\/\//, '').trim()
          if (!cleanHash || cleanHash.length === 0) {
            return
          }
          
          const primaryUrl = getIPFSUrl(cleanHash)
          const fallbackUrls = getIPFSFallbackUrls(cleanHash)
          
          // Filter out null values and combine URLs
          const urls = [primaryUrl, ...fallbackUrls].filter((url): url is string => url !== null)
          
          if (urls.length === 0) {
            return
          }
          
          setImpactDataUrl(urls[0])
          
          // Try each gateway until one works
          let data: any = null
          for (const url of urls) {
            if (!url) continue
            try {
              const response = await fetch(url, { 
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                  'Accept': 'application/json',
                }
              })
              if (response.ok) {
                data = await response.json()
                break
              }
            } catch (err) {
              continue
            }
          }
          
          if (data) {
            setImpactData(data)
            // Store in map for easy access
            setImpactDataMap(prev => {
              const newMap = new Map(prev)
              newMap.set(impactReportHash, data)
              return newMap
            })
          }
        } catch (err) {
          console.error('Error fetching impact report data:', err)
        }
      }

      if (expanded) {
        fetchImpactData()
      }
    }, [impactReportHash, expanded])

    // Simple indicator - just show if submitted or not
    if (!impactReportHash || impactReportHash.trim() === '') {
      return (
        <div className="mt-3 rounded-xl border border-gray-500/30 bg-gray-500/10 p-3 text-sm">
          <p className="font-semibold text-gray-400">Impact Report: Not submitted</p>
        </div>
      )
    }

    if (!expanded) {
      return (
        <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-green-300">Impact Report: Submitted</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleExpanded(true)}
              className="border-green-500/60 text-green-200 hover:bg-green-500/20"
            >
              View Details
            </Button>
          </div>
        </div>
      )
    }

    if (!impactData) {
      return (
        <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-green-300">Impact Report: Submitted</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleExpanded(false)}
              className="border-green-500/60 text-green-200 hover:bg-green-500/20"
            >
              Hide Details
            </Button>
          </div>
          <p className="mt-2 text-gray-300">Loading details...</p>
        </div>
      )
    }

    return (
      <div className="mt-3 rounded-xl border border-green-500/40 bg-green-500/5 p-4 text-sm text-gray-100">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold uppercase tracking-wide text-green-300">Impact Report Details</p>
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleExpanded(false)}
              className="border-green-500/60 text-green-200 hover:bg-green-500/20"
            >
              Hide Details
            </Button>
          </div>
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
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Contributors</dt>
              <dd className="mt-1 space-y-1">
                {impactData.contributors.map((contributor: string, index: number) => (
                  <div key={index} className="font-mono text-sm text-white">
                    {contributor}
                  </div>
                ))}
              </dd>
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

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
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
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
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

            <WrongNetworkBanner />

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

  if (!isVerifier) {
    const contractAddress = CONTRACT_ADDRESSES.VERIFICATION
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
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

            <WrongNetworkBanner />

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
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/" />
        
        <div className="mb-8 mt-6 flex items-start justify-between">
          <div>
          <h1 className="mb-2 text-4xl font-bold uppercase tracking-wide text-white sm:text-5xl">
            Verifier Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Review and verify cleanup submissions. Assign levels (1-10) based on impact and quality.
          </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setLoading(true)
                loadCleanups()
              }}
              disabled={loading}
              variant="outline"
              className="gap-2 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        <WrongNetworkBanner />

        {/* Search by Wallet Address */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400">Search Cleanups by Wallet</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter wallet address (e.g., ...2493)"
              value={searchWallet}
              onChange={(e) => setSearchWallet(e.target.value)}
              className="flex-1 rounded-lg border border-gray-700 bg-black px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-green focus:outline-none"
            />
            <Button
              onClick={async () => {
                if (!searchWallet.trim()) return
                setSearching(true)
                setSearchResults([])
                setError(null)
                try {
                  // Search for cleanups by wallet (supports partial addresses like "2493")
                  const results = await findCleanupsByWallet(searchWallet.trim(), 100)
                  setSearchResults(results)
                  if (results.length > 0) {
                    // Reload cleanups to include the found ones
                    await loadCleanups()
                  } else {
                    setError(`No cleanups found for wallet ending in "${searchWallet.trim()}"`)
                  }
                } catch (error: any) {
                  setError(`Search failed: ${error?.message || String(error)}`)
                } finally {
                  setSearching(false)
                }
              }}
              disabled={searching || !searchWallet.trim()}
              variant="outline"
              className="border-brand-green text-brand-green hover:bg-brand-green/10"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3">
              <p className="text-sm font-semibold text-green-400">Found {searchResults.length} cleanup(s):</p>
              <ul className="mt-2 space-y-2 text-xs">
                {searchResults.map((result) => (
                  <li key={result.cleanupId.toString()} className="rounded border border-gray-700 bg-gray-800 p-2">
                    <div className="font-mono text-white">Cleanup #{result.cleanupId.toString()}</div>
                    <div className="mt-1 text-gray-400">
                      Wallet: {result.user}
                    </div>
                    <div className="mt-1">
                      Status: {result.verified ? '✓ Verified' : '⏳ Pending'} | Level: {result.level} | {result.claimed ? 'Claimed' : 'Not Claimed'}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
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

        {/* Verifier Stats */}
        <div className="mb-8 rounded-lg border border-blue-500/50 bg-blue-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold uppercase text-white">Verifier Statistics</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isVerifier && address && cleanups.length > 0) {
                  // Trigger stats reload
                  const event = new Event('verifier-stats-refresh')
                  window.dispatchEvent(event)
                }
              }}
              disabled={verifierStats.isLoading}
              className="text-gray-400 hover:text-white"
              title="Refresh stats"
            >
              <RefreshCw className={`h-4 w-4 ${verifierStats.isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="text-sm text-gray-400">Total Verified by You</div>
              <div className="mt-1 text-3xl font-bold text-blue-400">
                {verifierStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  verifierStats.totalVerified
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Cleanups you have verified (approved or rejected)
              </div>
            </div>
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <div className="text-sm text-gray-400">Verifier Rewards</div>
              <div className="mt-1 text-3xl font-bold text-green-400">
                {verifierStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `${verifierStats.verifierEarned} $bDCU`
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                1 $bDCU per verification ({verifierStats.totalVerified} × 1 $bDCU)
              </div>
              {parseFloat(verifierStats.totalEarnings) > parseFloat(verifierStats.verifierEarned) && (
                <div className="mt-2 text-xs text-blue-400">
                  Total earnings: {verifierStats.totalEarnings} $bDCU (includes level claims, impact forms, referrals, streaks)
                </div>
              )}
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="text-sm text-gray-400">Total $bDCU Distributed</div>
              <div className="mt-1 text-3xl font-bold text-blue-400">
                {verifierStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `${verifierStats.totalDistributed} $bDCU`
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Total tokens distributed to all users (all rewards combined)
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <p className="text-xs text-gray-400">
              <strong className="text-green-300">Verifier Rewards:</strong> You receive <strong className="text-green-300">1 $bDCU</strong> for each cleanup you verify, whether you approve or reject it. 
              This rewards your verification activity and helps maintain quality standards.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              <strong>Note:</strong> If you've also claimed Impact Products, submitted impact forms, received referrals, or maintained streaks using this wallet address, 
              those rewards are included in your total earnings but shown separately above.
            </p>
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
                          <AddressDisplay address={cleanup.user} />
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
                          <div className="text-xs text-yellow-400">
                            <span className="font-semibold">Referred by:</span>{' '}
                            <AddressDisplay address={cleanup.referrer} />
                          </div>
                        )}
                        {cleanup.hasImpactForm && (
                          <div className="text-xs text-green-400">
                            ✓ Enhanced impact form submitted
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
                              return <CheckCircle className="h-4 w-4 text-green-400" aria-label="User allowed use of this image" />
                            } else if (allowed === false) {
                              return <XCircle className="h-4 w-4 text-red-400" aria-label="User did not allow use of this image" />
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
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.beforePhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                            {(() => {
                              const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                              const allowed = impactData?.beforePhotoAllowed
                              if (allowed === true) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1.5" title="Allowed for social media">
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  </div>
                                )
                              } else if (allowed === false) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5" title="Not allowed for social media">
                                    <XCircle className="h-4 w-4 text-white" />
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
                              return <CheckCircle className="h-4 w-4 text-green-400" aria-label="User allowed use of this image" />
                            } else if (allowed === false) {
                              return <XCircle className="h-4 w-4 text-red-400" aria-label="User did not allow use of this image" />
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
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.afterPhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                            {(() => {
                              const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                              const allowed = impactData?.afterPhotoAllowed
                              if (allowed === true) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1.5" title="Allowed for social media">
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  </div>
                                )
                              } else if (allowed === false) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5" title="Not allowed for social media">
                                    <XCircle className="h-4 w-4 text-white" />
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
                  
                  {/* Impact Report Section - Always show, even if not submitted */}
                  <div className="mt-4">
                    <ImpactReportDetails impactReportHash={cleanup.impactReportHash} />
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
                  {activeTx && activeTx.cleanupId === cleanup.id && (
                    <div className="mt-4 rounded-lg border border-brand-green/40 bg-brand-green/5 p-4 text-sm text-white">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
                        <span>Verification transaction submitted. Waiting for Base confirmation…</span>
                      </div>
                      <a
                        href={getExplorerTxUrl(activeTx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-xs text-brand-green underline hover:text-brand-green/80"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View on {BLOCK_EXPLORER_NAME}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verified Cleanups */}
        <div className="mb-8">
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
                      <div className="mt-1 text-xs text-gray-500">
                        User: <span className="font-mono">{cleanup.user.slice(0, 10)}...{cleanup.user.slice(-8)}</span>
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

        {/* Rejected Cleanups */}
        <div>
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Rejected Cleanups</h2>
          {rejectedCleanups.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No rejected cleanups.
            </div>
          ) : (
            <div className="space-y-4">
              {rejectedCleanups.map((cleanup) => (
                <div
                  key={cleanup.id.toString()}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 p-6"
                >
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-400" />
                        <span className="font-bold text-white">Cleanup #{cleanup.id.toString()}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="h-4 w-4" />
                          <AddressDisplay address={cleanup.user} />
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(cleanup.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span>{formatCoordinates(cleanup.latitude, cleanup.longitude)}</span>
                        </div>
                        {cleanup.hasImpactForm && (
                          <div className="text-xs text-gray-500">
                            Enhanced impact form submitted
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-2 text-xs text-gray-400">Before Photo</div>
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
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.beforePhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-gray-400">After Photo</div>
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
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.afterPhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {cleanup.hasImpactForm && (
                    <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-semibold">Enhanced impact form submitted</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Impact Report Section for Rejected Cleanups - Always show */}
                  <div className="mt-4">
                    <ImpactReportDetails impactReportHash={cleanup.impactReportHash} />
                  </div>
                  
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <XCircle className="h-4 w-4" />
                      <span className="font-semibold">This cleanup was rejected</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Rejected cleanups cannot be verified. The user will need to submit a new cleanup.
                    </p>
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

