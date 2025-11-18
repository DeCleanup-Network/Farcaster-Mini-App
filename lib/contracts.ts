import { Address, encodeFunctionData, parseAbi } from 'viem'
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  simulateContract,
  getChainId,
  switchChain,
  getAccount,
} from 'wagmi/actions'
import {
  config,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_RPC_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from './wagmi'
import * as pointsLib from './points'

// Helper to safely extract error messages
function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  // Safely check nested error properties
  if (error?.error && typeof error.error === 'object') {
    if (error.error?.message) return error.error.message
    if (error.error) return String(error.error)
  }
  if (error?.reason) return error.reason
  if (error?.shortMessage) return error.shortMessage
  if (error?.cause) {
    const causeMsg = getErrorMessage(error.cause)
    if (causeMsg !== 'Unknown error') return causeMsg
  }
  return String(error)
}

const REQUIRED_CHAIN_SYMBOL = 'ETH'
const BLOCK_EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || REQUIRED_BLOCK_EXPLORER_URL
const BLOCK_EXPLORER_NAME =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_NAME ||
  (REQUIRED_CHAIN_IS_TESTNET ? 'Basescan (Sepolia)' : 'Basescan')

function getRequiredChain() {
  return config.chains.find((chain) => chain.id === REQUIRED_CHAIN_ID)
}

function getNetworkSetupMessage() {
  return (
    `You can add ${REQUIRED_CHAIN_NAME} to your wallet with these settings:\n` +
    `- Network Name: ${REQUIRED_CHAIN_NAME}\n` +
    `- RPC URL: ${REQUIRED_RPC_URL}\n` +
    `- Chain ID: ${REQUIRED_CHAIN_ID}\n` +
    `- Currency Symbol: ${REQUIRED_CHAIN_SYMBOL}\n` +
    `- Block Explorer: ${BLOCK_EXPLORER_BASE_URL}`
  )
}

function getTxExplorerUrl(transactionHash: string) {
  return `${BLOCK_EXPLORER_BASE_URL}/tx/${transactionHash}`
}

// Safely get chain ID with fallback for connectors that don't support getChainId
// Some connectors (like Farcaster) don't support getChainId, so we gracefully handle this
async function getCurrentChainId(): Promise<number | null> {
  // Set up error handler to suppress the getChainId error
  let suppressedError: Error | null = null
  const errorHandler = (event: ErrorEvent) => {
    if (event.message?.includes('getChainId') && event.message?.includes('is not a function')) {
      event.preventDefault()
      suppressedError = new Error(event.message)
    }
  }
  
  // Add error listener temporarily
  if (typeof window !== 'undefined') {
    window.addEventListener('error', errorHandler)
  }
  
  try {
    // Try the standard getChainId first
    // This will throw if the connector doesn't support it
    const chainId = await getChainId(config)
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', errorHandler)
    }
    return chainId
  } catch (error: any) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', errorHandler)
    }
    
    // Check if it's the specific connector.getChainId error
    const errorMessage = getErrorMessage(error)
    const isConnectorError = errorMessage.includes('getChainId') || 
                            errorMessage.includes('connector') ||
                            errorMessage.includes('is not a function') ||
                            suppressedError !== null
    
    if (isConnectorError) {
      // Silently skip chain verification for unsupported connectors
      // The wallet will validate the network when the transaction is sent
      return null
    }
    
    // For other errors, try getting from account as fallback
    try {
      const account = await getAccount(config)
      if (account.chainId) {
        return account.chainId
      }
    } catch (accountError: any) {
      // getAccount might also fail with the same error, so just return null
    }
    
    // If both fail, return null to indicate we couldn't determine the chain
    // The transaction will proceed and the wallet will reject if on wrong network
    return null
  }
}

// Contract addresses (will be set via environment variables)
// Support multiple naming conventions for flexibility
export const CONTRACT_ADDRESSES = {
  IMPACT_PRODUCT:
    (process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
      process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
      '') as Address,
  VERIFICATION:
    (process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
      '') as Address,
  REWARD_DISTRIBUTOR:
    (process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
      process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
      '') as Address,
}


const METADATA_CID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID || ''

// Impact Product NFT ABI
export const IMPACT_PRODUCT_ABI = parseAbi([
  'function claimLevelForUser(address user, uint256 cleanupId, uint8 level) external',
  'function getUserLevel(address user) external view returns (uint8)',
  'function getUserTokenId(address user) external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function tokenLevel(uint256 tokenId) external view returns (uint8)',
  'function userCurrentLevel(address user) external view returns (uint8)',
  'function getTokenURIForLevel(uint8 level) external view returns (string)',
  'function verificationContract() external view returns (address)',
  'function setVerificationContract(address _verificationContract) external',
])

// DCU Points are stored directly in RewardDistributor contract

// Verification Contract ABI
export const VERIFICATION_ABI = parseAbi([
  'function submitCleanup(string memory beforePhotoHash, string memory afterPhotoHash, uint256 latitude, uint256 longitude, address referrerAddress, bool hasImpactForm, string memory impactReportHash) external payable returns (uint256)',
  'function verifyCleanup(uint256 cleanupId, uint8 level) external',
  'function rejectCleanup(uint256 cleanupId) external',
  'function claimImpactProduct(uint256 cleanupId) external',
  'function getCleanupStatus(uint256 cleanupId) external view returns (address user, bool verified, bool claimed, uint8 level)',
'function getCleanup(uint256 cleanupId) external view returns ((address user, string beforePhotoHash, string afterPhotoHash, uint256 timestamp, uint256 latitude, uint256 longitude, bool verified, bool claimed, bool rejected, uint8 level, address referrer, bool hasImpactForm, string impactReportHash))',
  'function cleanupCounter() external view returns (uint256)',
  'function verifier() external view returns (address)', // Deprecated, returns address(0)
  'function isVerifier(address) external view returns (bool)',
  'function getSubmissionFee() external view returns (uint256 fee, bool enabled)',
  'function isRejected(uint256 cleanupId) external view returns (bool)',
])

// Reward Distributor ABI
// NOTE: Contract is upgradeable. V2 includes DCU token migration support.
// DCU Points are stored directly in RewardDistributor contract.
// After token deployment, points can be migrated to actual DCU tokens.
export const REWARD_DISTRIBUTOR_ABI = parseAbi([
  'function getStreakCount(address user) external view returns (uint256)',
  'function hasActiveStreak(address user) external view returns (bool)',
  'function getPointsBalance(address user) external view returns (uint256)',
  'function pointsBalance(address user) external view returns (uint256)',
  // V2 upgradeable functions (may not exist in V1)
  'function getDCUBalance(address user) external view returns (uint256 balance, bool isTokenBalance)',
  'function migratePointsToToken() external returns (uint256)',
  'function dcuToken() external view returns (address)',
  'function tokenMigrationEnabled() external view returns (bool)',
  'function hasMigrated(address user) external view returns (bool)',
])


// Impact Product Functions

/**
 * Get user's current Impact Product level
 */
export async function getUserLevel(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  const level = await readContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'userCurrentLevel',
    args: [userAddress],
  })

  return Number(level)
}

/**
 * Get user's Impact Product token ID
 */
export async function getUserTokenId(userAddress: Address): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'getUserTokenId',
    args: [userAddress],
  })
}

/**
 * Get token URI for a specific level
 */
export async function getTokenURIForLevel(level: number): Promise<string> {
  const fallback = METADATA_CID ? `ipfs://${METADATA_CID}/level${level}.json` : null

  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    if (fallback) {
      return fallback
    }
    throw new Error('Impact Product contract address not set')
  }

  try {
    return await readContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getTokenURIForLevel',
      args: [level],
    })
  } catch (error) {
    if (fallback) {
      console.warn('Falling back to static metadata CID for level', level, error)
      return fallback
    }
    throw error
  }
}

/**
 * Get token URI for a user's actual token ID
 */
export async function getTokenURI(tokenId: bigint): Promise<string> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
  })
}

/**
 * Claim Impact Product level
 */
export async function claimImpactProduct(cleanupId: bigint, level: number): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  const hash = await writeContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'claimLevel',
    args: [cleanupId, level],
    chainId: REQUIRED_CHAIN_ID, // Explicitly set chain ID to Base Sepolia
  })

  return hash
}

// DCU Points Functions
// NOTE: Currently uses points system. DCU token contract will be integrated soon.
// When DCU token is deployed, points will be migrated to actual tokens.
// The contract is upgradeable to support seamless migration without redeployment.

/**
 * Get user's DCU points balance from on-chain storage
 * Points are stored directly in RewardDistributor contract
 * 
 * TODO: After DCU token deployment, this will check if user has migrated
 * and return token balance instead of points balance
 */
export async function getPointsBalance(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    // Fallback to local storage for development
    return pointsLib.getPointsBalance(userAddress)
  }

  try {
    // Try to get DCU balance (handles both points and tokens if migrated)
    // First check if contract has getDCUBalance function (V2 upgradeable)
    try {
      const result = await readContract(config, {
        address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
        abi: REWARD_DISTRIBUTOR_ABI,
        functionName: 'getDCUBalance',
        args: [userAddress],
      })
      
      // V2 returns (balance, isTokenBalance)
      if (Array.isArray(result) && result.length === 2) {
        const balance = result[0] as bigint
        return Number(balance) / 1e18
      }
    } catch {
      // Fallback to getPointsBalance if getDCUBalance doesn't exist (V1)
    }
    
    // Read balance directly from RewardDistributor contract
    const balance = await readContract(config, {
      address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'getPointsBalance',
      args: [userAddress],
    })

    // Points use 18 decimals for consistency
    return Number(balance) / 1e18
  } catch (error) {
    console.warn('Error reading points from on-chain storage, using fallback:', error)
    // Fallback to local storage for development
    return pointsLib.getPointsBalance(userAddress)
  }
}

/**
 * Get user's DCU points balance (alias for getPointsBalance)
 * Points are stored directly in RewardDistributor contract
 */
export async function getDCUBalance(userAddress: Address): Promise<number> {
  return getPointsBalance(userAddress)
}

/**
 * Get user's staked DCU points
 * Note: Staking functionality may be implemented in the future
 */
export async function getStakedDCU(userAddress: Address): Promise<number> {
  // Staking not yet implemented - return 0
  // In the future, this could read from a staking contract
  return 0
}

// Verification Contract Functions

/**
 * Submit cleanup
 */
/**
 * Get submission fee info
 */
export async function getSubmissionFee(): Promise<{ fee: bigint; enabled: boolean }> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    return { fee: BigInt(0), enabled: false }
  }

  try {
    const result = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'getSubmissionFee',
    })

    if (Array.isArray(result)) {
      return {
        fee: result[0] as bigint,
        enabled: result[1] as boolean,
      }
    }

    return result as unknown as { fee: bigint; enabled: boolean }
  } catch (error: any) {
    // If function doesn't exist (old contract), return defaults silently
    // Suppress warnings for expected cases (old contracts without this function)
    const isExpectedError = 
      error?.message?.includes('revert') || 
      error?.message?.includes('function') || 
      error?.name === 'ContractFunctionExecutionError'
    
    if (!isExpectedError) {
      console.error('Error getting submission fee:', error)
    }
    return { fee: BigInt(0), enabled: false }
  }
}

export async function submitCleanup(
  beforePhotoHash: string,
  afterPhotoHash: string,
  latitude: number,
  longitude: number,
  referrerAddress: Address | null,
  hasImpactForm: boolean,
  impactReportHash: string,
  value?: bigint // Optional fee value
): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error(
      'Verification contract address not set. Please set NEXT_PUBLIC_VERIFICATION_CONTRACT in your .env.local file.'
    )
  }

  // Check if we're on the correct network
  try {
    const currentChainId = await getCurrentChainId()
    // If we couldn't determine chain ID (null), skip the check and let wallet handle it
    if (currentChainId === null) {
      console.warn('Could not verify chain ID, proceeding with transaction. Wallet will reject if on wrong network.')
    } else if (currentChainId !== REQUIRED_CHAIN_ID) {
      // Try to switch to the required chain
      const targetChain = getRequiredChain()
      if (!targetChain) {
        throw new Error(
          `${REQUIRED_CHAIN_NAME} chain not configured. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) manually in your wallet.`
        )
      }
      
      try {
        // Check if chain is configured in wagmi before attempting switch
        const chainExists = config.chains.find(chain => chain.id === REQUIRED_CHAIN_ID)
        if (!chainExists) {
          throw new Error(
            `${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) is not configured in the app.\n\n` +
            `Please contact support or check your environment configuration.`
          )
        }

        await switchChain(config, { chainId: REQUIRED_CHAIN_ID })
        // Wait a bit for the switch to complete and verify
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Verify the switch was successful
        const newChainId = await getCurrentChainId()
        if (newChainId === null) {
          console.warn('Could not verify chain switch, but switch was attempted. Proceeding...')
        } else if (newChainId !== REQUIRED_CHAIN_ID) {
          throw new Error(
            `Failed to switch to ${REQUIRED_CHAIN_NAME}. Please switch manually in your wallet. ` +
            `Current network: ${newChainId}, Required: ${REQUIRED_CHAIN_ID}`
          )
        }
      } catch (switchError: any) {
        // If switch fails, provide clear instructions
        const errorMessage = getErrorMessage(switchError)
        const isChainNotConfigured = 
          errorMessage.includes('Chain not configured') ||
          errorMessage.includes('chain not configured') ||
          errorMessage.includes('not configured') ||
          errorMessage.includes('Unrecognized chain') ||
          errorMessage.includes('Unrecognized chain ID') ||
          switchError?.name === 'ChainNotConfiguredError' ||
          switchError?.code === 4902 // MetaMask error code for chain not configured
        
        if (errorMessage.includes('User rejected') || errorMessage.includes('rejected') || errorMessage.includes('denied')) {
          throw new Error(
            `Network switch was rejected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) manually in your wallet and try again.`
          )
        }
        
        if (isChainNotConfigured) {
          throw new Error(
            `${REQUIRED_CHAIN_NAME} is not configured in your wallet.\n\n` +
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
        }
        
        throw new Error(
          `Failed to switch to ${REQUIRED_CHAIN_NAME}.\n\n` +
          `Please switch manually in your wallet:\n\n` +
          `Network Name: ${REQUIRED_CHAIN_NAME}\n` +
          `RPC URL: ${REQUIRED_RPC_URL}\n` +
          `Chain ID: ${REQUIRED_CHAIN_ID}\n` +
          `Currency Symbol: ETH\n` +
          `Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n\n` +
          `Current network: ${currentChainId}\n` +
          `Error: ${errorMessage}`
        )
      }
    }
  } catch (chainError: any) {
    // If it's already our custom error, re-throw it
    if (chainError?.message?.includes('switch') || chainError?.message?.includes(REQUIRED_CHAIN_NAME)) {
      throw chainError
    }
    // Otherwise, log warning but continue (might work if wallet handles it)
    console.warn('Could not verify/switch chain ID:', chainError)
  }

  // Scale coordinates by 1e6
  const latScaled = BigInt(Math.floor(latitude * 1e6))
  const lngScaled = BigInt(Math.floor(longitude * 1e6))

  // Double-check we're on the right chain before submitting
  const finalChainId = await getCurrentChainId()
  if (finalChainId === null) {
    console.warn('Could not verify final chain ID, proceeding with transaction. Wallet will reject if on wrong network.')
  } else if (finalChainId !== REQUIRED_CHAIN_ID) {
    throw new Error(
      `Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet. ` +
      `Current network: ${finalChainId}. ` +
      getNetworkSetupMessage()
    )
  }

  // Submit cleanup and get the return value (cleanup ID)
  let simulatedCleanupId: bigint | undefined
  
  try {
    // Use simulateContract to get the return value before submitting (for fallback)
    const { result } = await simulateContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'submitCleanup',
      args: [
        beforePhotoHash,
        afterPhotoHash,
        latScaled,
        lngScaled,
        referrerAddress || '0x0000000000000000000000000000000000000000',
        hasImpactForm,
        impactReportHash,
      ],
      value: value || BigInt(0),
    })
    
    // The result is the cleanup ID that will be returned
    simulatedCleanupId = result as bigint
    console.log('Simulated cleanup ID:', simulatedCleanupId.toString())
  } catch (simulateError: any) {
    // Simulation might fail, that's okay - we'll use counter method
    console.warn('Could not simulate contract call, will use counter method:', getErrorMessage(simulateError))
  }

  // Submit the actual transaction
  // Explicitly set chainId to ensure transaction is sent to Base Sepolia
  const hash = await writeContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'submitCleanup',
    args: [
      beforePhotoHash,
      afterPhotoHash,
      latScaled,
      lngScaled,
      referrerAddress || '0x0000000000000000000000000000000000000000',
        hasImpactForm,
        impactReportHash,
    ],
    value: value || BigInt(0), // Include fee if provided
    chainId: REQUIRED_CHAIN_ID, // Explicitly set chain ID to Base Sepolia
  })

  // Wait for transaction receipt
  const receipt = await waitForTransactionReceipt(config, { hash })
  console.log('Transaction confirmed in block:', receipt.blockNumber)
  
  // Get cleanup ID from counter (counter - 1, since counter increments after submission)
  let cleanupId: bigint
  try {
    // Wait a bit for the state to update
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const cleanupCounter = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'cleanupCounter',
    })
    
    // The cleanup ID is counter - 1 (since counter was incremented after submission)
    cleanupId = cleanupCounter - BigInt(1)
    console.log('Cleanup submitted successfully. ID:', cleanupId.toString(), 'Counter:', cleanupCounter.toString())
    
    // Validate the cleanup ID
    if (cleanupId < BigInt(1)) {
      // If counter is 1, it means counter didn't increment (transaction may have failed)
      if (cleanupCounter === BigInt(1)) {
        throw new Error('Counter did not increment after submission. Transaction may have failed.')
      }
      throw new Error(`Invalid cleanup ID: ${cleanupId.toString()}. Counter: ${cleanupCounter.toString()}`)
    }
    
    return cleanupId
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('Error getting cleanup ID:', errorMessage)
    
    // If we have a simulated ID, use it as fallback
    if (simulatedCleanupId && simulatedCleanupId >= BigInt(1)) {
      console.warn('Using simulated cleanup ID as fallback:', simulatedCleanupId.toString())
      return simulatedCleanupId
    }
    
    // Last resort: try to get counter one more time with longer wait
    try {
      console.log('Retrying cleanup counter check after 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      const finalCounter = await readContract(config, {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'cleanupCounter',
      })
      const fallbackId = finalCounter - BigInt(1)
      if (fallbackId >= BigInt(1)) {
        console.log('Got cleanup ID on retry:', fallbackId.toString())
        return fallbackId
      }
      console.error('Retry returned invalid ID:', fallbackId.toString(), 'Counter:', finalCounter.toString())
    } catch (retryError: any) {
      console.error('Retry also failed:', getErrorMessage(retryError))
    }
    
    // If all else fails, throw error but include transaction hash
    throw new Error(
      `Cleanup transaction submitted (hash: ${hash}) but could not retrieve ID. ` +
      `Please check the transaction on ${BLOCK_EXPLORER_NAME}: ${getTxExplorerUrl(hash)}. ` +
      `The cleanup may have been submitted successfully - check the transaction receipt. ` +
      `Error: ${errorMessage}`
    )
  }
}

/**
 * Claim Impact Product after verification
 */
export async function claimImpactProductFromVerification(cleanupId: bigint): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  const hash = await writeContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'claimImpactProduct',
    args: [cleanupId],
    chainId: REQUIRED_CHAIN_ID, // Explicitly set chain ID to Base Sepolia
  })

  return hash
}

/**
 * Get cleanup status
 * Returns: { user: Address, verified: boolean, claimed: boolean, level: number }
 */
export async function getCleanupStatus(cleanupId: bigint): Promise<{
  user: `0x${string}`
  verified: boolean
  claimed: boolean
  level: number
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  if (cleanupId < BigInt(1)) {
    throw new Error(`Invalid cleanup ID: ${cleanupId.toString()}`)
  }

  try {
    const result = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'getCleanupStatus',
      args: [cleanupId],
    })

    // Handle tuple return type
    let status: {
      user: `0x${string}`
      verified: boolean
      claimed: boolean
      level: number
    }
    
    if (Array.isArray(result)) {
      status = {
        user: result[0] as `0x${string}`,
        verified: result[1] as boolean,
        claimed: result[2] as boolean,
        level: Number(result[3]),
      }
    } else {
      status = result as unknown as {
        user: `0x${string}`
        verified: boolean
        claimed: boolean
        level: number
      }
    }
    
    // Check if cleanup actually exists (zero address means it doesn't exist)
    if (!status.user || status.user === '0x0000000000000000000000000000000000000000' || status.user === '0x') {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    
    return status
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    // If cleanup doesn't exist, throw a clear error
    if (errorMessage.includes('revert') || errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    // Re-throw with better error message
    throw new Error(`Failed to get cleanup status: ${errorMessage}`)
  }
}

/**
 * Get full cleanup details (for verifiers)
 */
export async function getCleanupDetails(cleanupId: bigint): Promise<{
  user: `0x${string}`
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: bigint
  longitude: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
  referrer: `0x${string}`
  hasImpactForm: boolean
  impactReportHash: string
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  const result = await readContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'getCleanup',
    args: [cleanupId],
  })

  if (Array.isArray(result)) {
    return {
      user: result[0] as `0x${string}`,
      beforePhotoHash: result[1] as string,
      afterPhotoHash: result[2] as string,
      timestamp: result[3] as bigint,
      latitude: result[4] as bigint,
      longitude: result[5] as bigint,
      verified: result[6] as boolean,
      claimed: result[7] as boolean,
      rejected: result[8] as boolean,
      level: Number(result[9]),
      referrer: result[10] as `0x${string}`,
      hasImpactForm: result[11] as boolean,
      impactReportHash: result[12] as string,
    }
  }

  return result as unknown as {
    user: `0x${string}`
    beforePhotoHash: string
    afterPhotoHash: string
    timestamp: bigint
    latitude: bigint
    longitude: bigint
    verified: boolean
    claimed: boolean
    rejected: boolean
    level: number
    referrer: `0x${string}`
    hasImpactForm: boolean
    impactReportHash: string
  }
}

/**
 * Get cleanup counter (total number of cleanups)
 */
export async function getCleanupCounter(): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'cleanupCounter',
  })
}

/**
 * Check if an address is a verifier (uses allowlist)
 */
export async function isVerifier(address: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  if (!address) {
    return false
  }

  // Debug: Log ABI to verify it includes isVerifier
  console.log('isVerifier - Contract address:', CONTRACT_ADDRESSES.VERIFICATION)
  console.log('isVerifier - Checking address:', address)
  
  // Check if ABI is properly parsed
  const abiHasFunction = Array.isArray(VERIFICATION_ABI) && VERIFICATION_ABI.some((item: any) => {
    if (typeof item === 'object' && item !== null) {
      return item.type === 'function' && item.name === 'isVerifier'
    }
    return false
  })
  console.log('isVerifier - ABI type:', typeof VERIFICATION_ABI, 'isArray:', Array.isArray(VERIFICATION_ABI))
  console.log('isVerifier - ABI includes isVerifier:', abiHasFunction)
  if (Array.isArray(VERIFICATION_ABI)) {
    console.log('isVerifier - ABI functions:', VERIFICATION_ABI.filter((item: any) => 
      typeof item === 'object' && item?.type === 'function'
    ).map((item: any) => item.name))
  }

  try {
    // First, try the standard approach
    // Wrap in additional try-catch to handle RPC errors gracefully
    let result: boolean
    try {
      result = await readContract(config, {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'isVerifier',
        args: [address],
      }) as boolean
    } catch (rpcError: any) {
      // Handle RPC-specific errors
      const rpcErrorMessage = getErrorMessage(rpcError)
      console.error('isVerifier - RPC call error:', {
        rpcError,
        message: rpcErrorMessage,
        type: typeof rpcError,
      })
      // Re-throw to be caught by outer catch
      throw rpcError
    }
    console.log('isVerifier - Result:', result)
    return result
  } catch (error: any) {
    // Safe error logging - use helper to extract error message
    const errorMessage = getErrorMessage(error)
    const errorName = error?.name || error?.error?.name || 'UnknownError'
    const errorCode = error?.code || error?.error?.code
    
    console.error('isVerifier - Error caught:', {
      error,
      message: errorMessage,
      name: errorName,
      code: errorCode,
      type: typeof error,
      hasError: !!error,
      hasErrorError: !!error?.error,
    })
    
    // Check if this is the specific "is not a function" error from viem
    const isViemFunctionError = 
      errorMessage?.includes('is not a function') || 
      errorMessage?.includes('does not have the function') ||
      (errorMessage?.includes('isVerifier') && errorMessage?.includes('false'))
    
    // Check if the function doesn't exist (old contract) or viem parsing issue
    if (isViemFunctionError || 
        errorName === 'ContractFunctionExecutionError' ||
        errorMessage?.includes('revert') ||
        errorMessage?.includes('InternalError')) {
      
      // If it's a viem parsing error, try using encodeFunctionData as workaround
      if (isViemFunctionError) {
        console.warn('isVerifier - Viem ABI parsing issue detected. Trying alternative approach...')
        try {
          // Use encodeFunctionData to manually encode the call
          const functionData = encodeFunctionData({
            abi: VERIFICATION_ABI,
            functionName: 'isVerifier',
            args: [address],
          })
          
          // This is a workaround - we'd need to use a different method to call
          // For now, let's try the fallback to old verifier() function
          console.log('isVerifier - Function data encoded successfully, but need alternative call method')
        } catch (encodeError: any) {
          console.error('isVerifier - Failed to encode function data:', encodeError?.message || encodeError)
        }
      }
      
      console.error('isVerifier function not found on contract or ABI parsing issue. The contract may be outdated or there is a viem parsing issue.', errorMessage)
      
      // Try the old deprecated verifier() function as fallback
      try {
        console.log('isVerifier - Trying fallback to verifier() function...')
        const oldVerifier = await readContract(config, {
          address: CONTRACT_ADDRESSES.VERIFICATION,
          abi: VERIFICATION_ABI,
          functionName: 'verifier',
        })
        console.log('isVerifier - Old verifier() result:', oldVerifier)
        // If old verifier function returns a non-zero address, check if it matches
        if (oldVerifier && oldVerifier !== '0x0000000000000000000000000000000000000000') {
          const matches = (oldVerifier as string).toLowerCase() === address.toLowerCase()
          console.log('isVerifier - Fallback check result:', matches)
          return matches
        }
      } catch (fallbackError: any) {
        const fallbackMessage = fallbackError?.message || fallbackError?.error?.message || String(fallbackError || 'Unknown error')
        console.error('Fallback verifier() check also failed:', fallbackMessage)
      }
      
      // Since the test script confirmed the function exists, this is likely a frontend issue
      // Return false but log that it's likely a parsing issue
      console.warn('isVerifier - Contract has function (confirmed by test), but frontend cannot call it. This may be a viem/wagmi parsing issue. Try clearing browser cache and restarting dev server.')
      return false
    }
    console.error('Error checking verifier status:', errorMessage)
    // Re-throw with safe error message
    throw new Error(errorMessage)
  }
}

/**
 * Get verifier address (deprecated - returns address(0) now)
 * @deprecated Use isVerifier(address) instead
 */
export async function getVerifierAddress(): Promise<Address> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'verifier',
  }) as Address
}

/**
 * Verify cleanup (only verifier can call)
 */
export async function verifyCleanup(cleanupId: bigint, level: number): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  if (level < 1 || level > 10) {
    throw new Error('Level must be between 1 and 10')
  }

  // Check network before submitting
  const currentChainId = await getCurrentChainId()
  if (currentChainId !== null && currentChainId !== REQUIRED_CHAIN_ID) {
    throw new Error(
      `Wrong network. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}). ` +
      `Current: ${currentChainId}`
    )
  }

  // Validate cleanup exists before submitting
  try {
    const status = await getCleanupStatus(cleanupId)
    if (status.verified) {
      throw new Error(`Cleanup ${cleanupId.toString()} is already verified`)
    }
    console.log('Cleanup status check passed:', { verified: status.verified, user: status.user })
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    if (errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    // If it's another error, log it but continue (might be RPC issue)
    console.warn('Could not verify cleanup status before submission:', errorMessage)
  }

  try {
        const hash = await writeContract(config, {
          address: CONTRACT_ADDRESSES.VERIFICATION,
          abi: VERIFICATION_ABI,
          functionName: 'verifyCleanup',
          args: [cleanupId, level],
          chainId: REQUIRED_CHAIN_ID, // Explicitly set chain ID to Base Sepolia
          // Don't specify blockNumber to avoid "block is out of range" errors
        })

    return hash
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('Error calling verifyCleanup:', errorMessage)
    
    // Provide more specific error messages
    if (errorMessage.includes('Not authorized') || errorMessage.includes('not authorized')) {
      throw new Error(
        `Not authorized to verify. Make sure your address is in the verifier allowlist. ` +
        `Check the transaction on ${BLOCK_EXPLORER_NAME} to see the exact error.`
      )
    }
    if (errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    if (errorMessage.includes('already verified')) {
      throw new Error(`Cleanup ${cleanupId.toString()} is already verified`)
    }
    
    // Re-throw with original message
    throw new Error(`Failed to verify cleanup: ${errorMessage}`)
  }
}

/**
 * Reject a cleanup submission (only verifiers)
 */
export async function rejectCleanup(cleanupId: bigint): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  // Check network before submitting
  const currentChainId = await getCurrentChainId()
  if (currentChainId !== null && currentChainId !== REQUIRED_CHAIN_ID) {
    throw new Error(
      `Wrong network. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}). ` +
      `Current: ${currentChainId}`
    )
  }

  // Validate cleanup exists before submitting
  try {
    const status = await getCleanupStatus(cleanupId)
    if (status.verified) {
      throw new Error(`Cleanup ${cleanupId.toString()} is already verified`)
    }
    console.log('Cleanup status check passed:', { verified: status.verified, user: status.user })
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    if (errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    // If it's another error, log it but continue (might be RPC issue)
    console.warn('Could not verify cleanup status before rejection:', errorMessage)
  }

  try {
        const hash = await writeContract(config, {
          address: CONTRACT_ADDRESSES.VERIFICATION,
          abi: VERIFICATION_ABI,
          functionName: 'rejectCleanup',
          args: [cleanupId],
          chainId: REQUIRED_CHAIN_ID, // Explicitly set chain ID to Base Sepolia
        })

    return hash
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('Error calling rejectCleanup:', errorMessage)
    
    // Provide more specific error messages
    if (errorMessage.includes('Not authorized') || errorMessage.includes('not authorized')) {
      throw new Error(
        `Not authorized to reject. Make sure your address is in the verifier allowlist. ` +
        `Check the transaction on ${BLOCK_EXPLORER_NAME} to see the exact error.`
      )
    }
    if (errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    if (errorMessage.includes('already verified')) {
      throw new Error(`Cleanup ${cleanupId.toString()} is already verified`)
    }
    if (errorMessage.includes('already rejected')) {
      throw new Error(`Cleanup ${cleanupId.toString()} is already rejected`)
    }
    
    // Re-throw with original message
    throw new Error(`Failed to reject cleanup: ${errorMessage}`)
  }
}

// Reward Distributor Functions

/**
 * Get user's streak count
 */
export async function getStreakCount(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    throw new Error('Reward Distributor contract address not set')
  }

  const streak = await readContract(config, {
    address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'getStreakCount',
    args: [userAddress],
  })

  return Number(streak)
}

/**
 * Check if user has active streak
 */
export async function hasActiveStreak(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    throw new Error('Reward Distributor contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'hasActiveStreak',
    args: [userAddress],
  })
}


