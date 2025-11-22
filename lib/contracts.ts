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
import { tryAddRequiredChain } from './network'
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

function getManualNetworkAddInstructions() {
  return (
    `Please add ${REQUIRED_CHAIN_NAME} to your wallet:\n` +
    `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
    `2. Go to Settings → Networks → Add Network\n` +
    `3. Enter these details:\n` +
    `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
    `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
    `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
    `   • Currency Symbol: ETH\n` +
    `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
    (REQUIRED_CHAIN_IS_TESTNET
      ? `4. Request Base Sepolia ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n` +
      `5. Switch to ${REQUIRED_CHAIN_NAME} and try again.`
      : `4. Switch to ${REQUIRED_CHAIN_NAME} and try again.`)
  )
}

async function ensureWalletOnRequiredChain(context = 'transaction', providedChainId?: number | null): Promise<void> {
  // If providedChainId is valid and matches required, trust it and return early
  // This fixes the issue where useChainId() shows correct chain but getCurrentChainId() returns null
  if (providedChainId !== undefined && providedChainId !== null && providedChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain (from provided chainId: ${providedChainId})`)
    return
  }
  
  // Use provided chainId if available (from useChainId hook), otherwise try to get it
  let currentChainId: number | null = providedChainId !== undefined ? providedChainId : await getCurrentChainId()
  console.log(`[${context}] Current chain ID: ${currentChainId}, required: ${REQUIRED_CHAIN_ID}`)

  // If we can't determine chain (e.g., WalletConnect), try to add the chain first
  // This helps WalletConnect-MetaMask users who might not have the chain configured
  if (currentChainId === null) {
    console.log(`[${context}] Chain ID is null, attempting to add chain for WalletConnect...`)
    try {
      const added = await tryAddRequiredChain()
      if (added) {
        // Wait a moment for the chain to be added
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Try to get chain ID again
        currentChainId = await getCurrentChainId()
        if (currentChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and switched successfully`)
          return
        }
      }
      // If we still can't determine chain after adding, proceed with transaction
      // The wallet will validate the network when the transaction is sent
      console.log(`[${context}] ⚠️ Could not determine chain ID, but proceeding - wallet will validate on transaction`)
      return
    } catch (addError) {
      console.error(`[${context}] Failed to add chain:`, addError)
      // Don't throw error here - let the transaction proceed and wallet will handle it
      return
    }
  }

  // Already on correct chain - no need to switch
  if (currentChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain`)
    return
  }

  // Check for unsupported chains
  if (currentChainId === 11142220) {
    throw new Error(
      `VeChain wallet detected (Chain ID: 11142220). Please disable the VeChain extension or use MetaMask, Coinbase Wallet, or the Farcaster wallet.\n\n` +
      `Then switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).`
    )
  }

  // Check for Ethereum mainnet (common mistake)
  if (currentChainId === 1) {
    throw new Error(
      `Ethereum Mainnet detected (Chain ID: 1). This app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
      `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet and try again.`
    )
  }

  // Check for Celo Sepolia (another common mistake - wrong testnet!)
  if (currentChainId === 44787) {
    throw new Error(
      `Celo Sepolia Testnet detected (Chain ID: 44787). This app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}), not Celo!\n\n` +
      `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet and try again.`
    )
  }

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(
      `${REQUIRED_CHAIN_NAME} chain is not configured in this app. Please switch to ${REQUIRED_CHAIN_NAME} manually.\n\n${getNetworkSetupMessage()}`
    )
  }

  // Force switch if on wrong chain
  if (currentChainId !== REQUIRED_CHAIN_ID) {
    console.log(`[${context}] Wrong chain (${currentChainId}), attempting to switch to ${REQUIRED_CHAIN_NAME} (${REQUIRED_CHAIN_ID})`)

    // For WalletConnect and similar connectors, try adding the chain FIRST before switching
    // This prevents "Chain not configured" errors
    try {
      console.log(`[${context}] Attempting to add chain first (for WalletConnect compatibility)...`)
      const added = await tryAddRequiredChain()
      if (added) {
        // Wait a moment for the chain to be added
        await new Promise(resolve => setTimeout(resolve, 1500))
        // Check if we're now on the correct chain
        const checkChainId = await getCurrentChainId()
        if (checkChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and automatically switched`)
          return
        }
      }
    } catch (addError) {
      console.warn(`[${context}] Pre-add chain attempt failed (may not be needed):`, addError)
      // Continue to try switching anyway
    }

    // Now try to switch
    try {
      await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })

      // Poll for chain update
      let retries = 0
      while (retries < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const newChainId = await getCurrentChainId()
        if (newChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Successfully switched to ${REQUIRED_CHAIN_NAME}`)
          return
        }
        retries++
      }

      // If polling didn't confirm the switch, check one more time
      const finalCheck = await getCurrentChainId()
      if (finalCheck === REQUIRED_CHAIN_ID) {
        console.log(`[${context}] ✅ Chain switch confirmed`)
        return
      }

      throw new Error(`Failed to switch network. Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet.`)
    } catch (error: any) {
      console.error(`[${context}] Switch failed:`, error)
      const errorMessage = getErrorMessage(error)

      // If user rejected, throw specific error
      if (error?.code === 4001 || errorMessage.includes('rejected') || errorMessage.includes('User rejected')) {
        throw new Error('Network switch rejected. Please switch manually to continue.')
      }

      // Try adding the chain again if switch failed with "not configured"
      if (errorMessage.includes('Unrecognized chain') || 
          errorMessage.includes('not configured') || 
          errorMessage.includes('Chain not configured') ||
          error?.code === 4902) {
        console.log(`[${context}] Chain missing, attempting to add after switch failure...`)
        
        // Try multiple times with increasing delays
        let added = false
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            added = await tryAddRequiredChain()
            if (added) {
              // Wait longer for the chain to be added (especially for WalletConnect)
              await new Promise(resolve => setTimeout(resolve, 2000 + (attempt * 1000)))
              
              // Try switching again
              try {
                await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
                // Wait and check
                await new Promise(resolve => setTimeout(resolve, 1500))
                const newChainId = await getCurrentChainId()
                if (newChainId === REQUIRED_CHAIN_ID) {
                  console.log(`[${context}] ✅ Chain added and switched successfully`)
                  return
                }
              } catch (retryError: any) {
                console.warn(`[${context}] Retry switch after add failed (attempt ${attempt + 1}):`, retryError)
                // If user rejected, don't retry
                if (retryError?.code === 4001 || retryError?.message?.includes('rejected')) {
                  throw new Error('Network switch rejected. Please switch manually to continue.')
                }
              }
            }
          } catch (addError) {
            console.warn(`[${context}] Add chain attempt ${attempt + 1} failed:`, addError)
          }
        }
        
        // If we still couldn't add/switch, provide helpful error message
        // Check if we're using WalletConnect
        const account = await getAccount(config)
        const isWalletConnect = account.connector?.id?.includes('walletConnect') || 
                                account.connector?.name?.toLowerCase().includes('walletconnect')
        
        const walletInstructions = isWalletConnect
          ? `\n\nFor WalletConnect users:\n` +
            `1. Open your wallet app (MetaMask, etc.)\n` +
            `2. Go to Settings → Networks → Add Network\n` +
            `3. Add ${REQUIRED_CHAIN_NAME} with the details below\n` +
            `4. Return to this app and try again`
          : `\n\nPlease add the network in your wallet and try again.`
        
        throw new Error(
          `${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) is not configured in your wallet.${walletInstructions}\n\n` +
          `Network Details:\n` +
          `• Network Name: ${REQUIRED_CHAIN_NAME}\n` +
          `• RPC URL: ${REQUIRED_RPC_URL}\n` +
          `• Chain ID: ${REQUIRED_CHAIN_ID}\n` +
          `• Currency Symbol: ETH\n` +
          `• Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}`
        )
      }

      throw new Error(`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) to continue.`)
    }
  }

  // If switch wasn't successful but we didn't throw an error, allow to proceed
  // Wagmi will enforce the correct chain when sending the transaction
  // The previous block now handles all error cases and returns/throws, so this line is unreachable.
  // It's kept here for context if future changes reintroduce a non-throwing path.
  // if (!switchSuccessful) {
  //   console.warn(`[${context}] ⚠️ Chain switch not verified, but allowing transaction to proceed - wagmi will enforce correct chain`)
  // }
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
 * Claim Impact Product level (DEPRECATED - use claimImpactProductFromVerification instead)
 * This function is not used in the current flow but kept for backwards compatibility
 * @deprecated Use claimImpactProductFromVerification instead
 */
export async function claimImpactProduct(cleanupId: bigint, level: number): Promise<`0x${string}`> {
  // This function is deprecated - the actual flow uses claimImpactProductFromVerification
  // which calls VerificationContract.claimImpactProduct() which then calls
  // ImpactProductNFT.claimLevelForUser()
  throw new Error('claimImpactProduct is deprecated. Use claimImpactProductFromVerification instead.')
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
  value?: bigint, // Optional fee value
  providedChainId?: number | null // Optional chainId from useChainId hook to avoid detection issues
): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error(
      'Verification contract address not set. Please set NEXT_PUBLIC_VERIFICATION_CONTRACT in your .env.local file.'
    )
  }

  // Pass providedChainId to avoid false positives when wallet is already on correct chain
  await ensureWalletOnRequiredChain('cleanup submission', providedChainId)

  // Scale coordinates by 1e6
  const latScaled = BigInt(Math.floor(latitude * 1e6))
  const lngScaled = BigInt(Math.floor(longitude * 1e6))

  // Trust providedChainId if it was provided and matches required chain
  // Only do additional checks if providedChainId is not available
  // This prevents false positives where getCurrentChainId() returns null/wrong value
  // even though useChainId() hook shows the correct chain
  if (providedChainId !== undefined && providedChainId !== null && providedChainId === REQUIRED_CHAIN_ID) {
    console.log('[cleanup submission] ✅ Chain validated via providedChainId, proceeding with submission')
    // Skip redundant checks - ensureWalletOnRequiredChain already validated
  } else {
    // Fallback: only check if providedChainId wasn't available
  const finalChainId = await getCurrentChainId()
    
    // For WalletConnect, chainId might be null even after adding chain
    // In that case, proceed and let the wallet validate on transaction
  if (finalChainId === null) {
      console.warn('[cleanup submission] Could not verify final chain ID, but proceeding - wallet will validate on transaction')
      // Don't throw error - let the transaction proceed and wallet will handle validation
      // This helps WalletConnect-MetaMask users
    } else {
      // CRITICAL: Explicitly block Celo Sepolia - this is a common mistake
      if (finalChainId === 44787) {
    throw new Error(
          `❌ CELO SEPOLIA DETECTED!\n\n` +
          `You are on Celo Sepolia Testnet (Chain ID: 44787), but this app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
          `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet before submitting.\n\n` +
          `To add ${REQUIRED_CHAIN_NAME}:\n` +
          `1. Open your wallet settings\n` +
          `2. Go to Networks → Add Network\n` +
          `3. Enter:\n` +
          `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
          `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
          `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
          `   • Currency Symbol: ETH\n` +
          `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
          `4. Switch to ${REQUIRED_CHAIN_NAME} and try again.`
        )
      }
      
      if (finalChainId !== REQUIRED_CHAIN_ID) {
        throw new Error(
          `Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet. ` +
      `Current network: ${finalChainId}. ` +
          getNetworkSetupMessage()
        )
      }
    }
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
  // Explicitly set chain object to ensure transaction is sent to Base Sepolia
  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  // FINAL CHECK: Only verify chain if providedChainId wasn't available
  // If providedChainId was provided and matches, trust it (already validated by ensureWalletOnRequiredChain)
  if (providedChainId === undefined || providedChainId === null || providedChainId !== REQUIRED_CHAIN_ID) {
    const preTxChainId = await getCurrentChainId()
    // Only check if we got a valid chain ID (not null)
    if (preTxChainId !== null) {
      if (preTxChainId === 44787) {
        throw new Error(
          `❌ STOP! You are on Celo Sepolia (Chain ID: 44787). ` +
          `This transaction would fail. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) first.`
        )
      }
      if (preTxChainId !== REQUIRED_CHAIN_ID) {
        throw new Error(
          `Wrong network detected right before transaction. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}). ` +
          `Current: ${preTxChainId}`
        )
      }
    }
    // If preTxChainId is null, proceed - wallet will validate on transaction
  } else {
    console.log('[cleanup submission] ✅ Chain validated via providedChainId, skipping pre-tx check')
  }

  const hash = await writeContract(config as any, {
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
    chain: targetChain,
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
export async function claimImpactProductFromVerification(
  cleanupId: bigint,
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  await ensureWalletOnRequiredChain('claim impact product', providedChainId)

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  const hash = await writeContract(config as any, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'claimImpactProduct',
    args: [cleanupId],
    chain: targetChain,
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
  rejected: boolean
  level: number
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  if (cleanupId < BigInt(1)) {
    throw new Error(`Invalid cleanup ID: ${cleanupId.toString()}`)
  }

  try {
    // Use getCleanupDetails to get full status including rejected flag
    const details = await getCleanupDetails(cleanupId)
    
    // Check if cleanup actually exists (zero address means it doesn't exist)
    if (!details.user || details.user === '0x0000000000000000000000000000000000000000' || details.user === '0x') {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    
    return {
      user: details.user,
      verified: details.verified,
      claimed: details.claimed,
      rejected: details.rejected,
      level: details.level,
    }
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
export async function verifyCleanup(
  cleanupId: bigint,
  level: number,
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  if (level < 1 || level > 10) {
    throw new Error('Level must be between 1 and 10')
  }

  // Ensure wallet is on the required chain - this handles switching and validation
  await ensureWalletOnRequiredChain('verification', providedChainId)

  console.log(`[verification] Chain check passed, proceeding with transaction`)

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
    // Get the chain object explicitly to ensure proper chain resolution
    const targetChain = getRequiredChain()
    if (!targetChain) {
      const errorMsg = `${REQUIRED_CHAIN_NAME} chain is not configured in this app. Please switch to ${REQUIRED_CHAIN_NAME} manually.\n\n${getNetworkSetupMessage()}`
      console.error('[verification]', errorMsg)
      throw new Error(errorMsg)
    }

    console.log(`[verification] Calling writeContract with chain:`, targetChain.id, targetChain.name)
    console.log(`[verification] Contract address:`, CONTRACT_ADDRESSES.VERIFICATION)
    console.log(`[verification] Function: verifyCleanup, args:`, [cleanupId.toString(), level])

    const hash = await writeContract(config as any, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'verifyCleanup',
      args: [cleanupId, level],
      chain: targetChain, // Pass chain object explicitly instead of just chainId
      // Don't specify blockNumber to avoid "block is out of range" errors
    })

    console.log(`[verification] ✅ Transaction hash received:`, hash)
    return hash
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('Error calling verifyCleanup:', errorMessage)

    // Check for chain mismatch errors first
    if (
      errorMessage.includes('ChainMismatchError') ||
      errorMessage.includes('chain mismatch') ||
      errorMessage.includes('does not match the target chain') ||
      errorMessage.includes('11142220') // VeChain chain ID
    ) {
      const currentChainId = await getCurrentChainId()
      if (currentChainId === 11142220) {
        throw new Error(
          `VeChain wallet detected (Chain ID: 11142220). Please disable the VeChain extension or use MetaMask, Coinbase Wallet, or the Farcaster wallet.\n\n` +
          `Then switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) and try again.`
        )
      }
      throw new Error(
        `Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
        `Current network: ${currentChainId || 'unknown'}\n${getNetworkSetupMessage()}`
      )
    }
    
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
export async function rejectCleanup(
  cleanupId: bigint,
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  // Ensure wallet is on the required chain - this handles switching and validation
  await ensureWalletOnRequiredChain('rejection', providedChainId)

  console.log(`[rejection] Chain check passed, proceeding with transaction`)

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
    // Get the chain object explicitly to ensure proper chain resolution
    const targetChain = getRequiredChain()
    if (!targetChain) {
      throw new Error(
        `${REQUIRED_CHAIN_NAME} chain is not configured in this app. Please switch to ${REQUIRED_CHAIN_NAME} manually.\n\n${getNetworkSetupMessage()}`
      )
    }

    const hash = await writeContract(config as any, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'rejectCleanup',
      args: [cleanupId],
      chain: targetChain, // Pass chain object explicitly instead of just chainId
    })

    return hash
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('Error calling rejectCleanup:', errorMessage)

    // Check for chain mismatch errors first
    if (
      errorMessage.includes('ChainMismatchError') ||
      errorMessage.includes('chain mismatch') ||
      errorMessage.includes('does not match the target chain') ||
      errorMessage.includes('11142220') // VeChain chain ID
    ) {
      const currentChainId = await getCurrentChainId()
      if (currentChainId === 11142220) {
        throw new Error(
          `VeChain wallet detected (Chain ID: 11142220). Please disable the VeChain extension or use MetaMask, Coinbase Wallet, or the Farcaster wallet.\n\n` +
          `Then switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) and try again.`
        )
      }
      throw new Error(
        `Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
        `Current network: ${currentChainId || 'unknown'}\n${getNetworkSetupMessage()}`
      )
    }
    
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


