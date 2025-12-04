import { Address, encodeFunctionData, parseAbi, parseAbiItem, formatUnits } from 'viem'
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
import { tryAddRequiredChain, switchToRequiredChainViaProvider } from './network'
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

// Helper to check if error is a WalletConnect stale session error
function isWalletConnectStaleSessionError(error: any): boolean {
  if (!error) return false
  const errorMessage = getErrorMessage(error).toLowerCase()
  const errorString = String(error).toLowerCase()
  return errorMessage.includes('session topic doesn\'t exist') ||
    errorMessage.includes('no matching key') ||
    errorMessage.includes('session topic') ||
    errorString.includes('session topic doesn\'t exist') ||
    errorString.includes('no matching key') ||
    // Additional patterns for WalletConnect v2 errors
    errorMessage.includes('session topic') ||
    errorString.includes('session topic') ||
    // Check error code or reason fields
    (error?.code === 3000 && errorMessage.includes('unauthorized')) ||
    (error?.reason?.toLowerCase().includes('session topic')) ||
    (error?.reason?.toLowerCase().includes('no matching key'))
}

// Helper to handle WalletConnect stale session errors
async function handleWalletConnectStaleSession(error: any): Promise<void> {
  if (!isWalletConnectStaleSessionError(error)) return
  
  console.log('WalletConnect stale session detected. Clearing session data...')
  
  // Clear WalletConnect storage
  if (typeof window !== 'undefined') {
    try {
      const wcKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('wc@2:') || key.startsWith('walletconnect')
      )
      wcKeys.forEach(key => localStorage.removeItem(key))
      sessionStorage.removeItem('wallet_connected_this_session')
      
      // Try to disconnect if possible
      try {
        const { getAccount } = await import('wagmi/actions')
        const account = getAccount(config)
        if (account.isConnected && account.connector?.id?.includes('walletconnect')) {
          const { disconnect } = await import('wagmi/actions')
          await disconnect(config)
        }
      } catch (disconnectError) {
        console.warn('Failed to disconnect during stale session cleanup:', disconnectError)
      }
    } catch (e) {
      console.warn('Failed to clear WalletConnect storage:', e)
    }
  }
  
  throw new Error('WalletConnect session expired. Please reconnect your wallet and try again.')
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
  if (providedChainId !== undefined && providedChainId !== null && providedChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain (from provided chainId: ${providedChainId})`)
    return
  }

  // Use provided chainId if available, otherwise try to get it
  let currentChainId: number | null = providedChainId !== undefined ? providedChainId : await getCurrentChainId()
  console.log(`[${context}] Current chain ID: ${currentChainId}, required: ${REQUIRED_CHAIN_ID}`)

  // If we can't determine chain (e.g., WalletConnect), try to add the chain first
  if (currentChainId === null) {
    console.log(`[${context}] Chain ID is null, attempting to add chain for WalletConnect...`)
    try {
      const added = await tryAddRequiredChain()
      if (added) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        currentChainId = await getCurrentChainId()
        if (currentChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and switched successfully`)
          return
        }
      }
      console.log(`[${context}] ⚠️ Could not determine chain ID, but proceeding - wallet will validate on transaction`)
      return
    } catch (addError) {
      console.error(`[${context}] Failed to add chain:`, addError)
      return
    }
  }

  // Already on correct chain
  if (currentChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain`)
    return
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

    // ALWAYS try adding the chain FIRST before switching to prevent "Chain not configured" errors
    try {
      console.log(`[${context}] Attempting to add chain first (required for WalletConnect compatibility)...`)
      const added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
      if (added) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        const checkChainId = await getCurrentChainId()
        if (checkChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and automatically switched`)
          return
        }
        console.log(`[${context}] Chain added but not switched automatically, attempting manual switch...`)
      }
    } catch (addError) {
      console.warn(`[${context}] Pre-add chain attempt failed:`, addError)
    }

    // Now try to switch
    try {
      console.log(`[${context}] Attempting to switch chain - wallet should prompt...`)
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

      throw new Error(`Failed to switch network. Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet.`)
    } catch (error: any) {
      console.error(`[${context}] Switch failed:`, error)
      
      // Check for WalletConnect stale session error first
      if (isWalletConnectStaleSessionError(error)) {
        await handleWalletConnectStaleSession(error)
        return // This will throw, but TypeScript needs this
      }
      
      const errorMessage = getErrorMessage(error)

      // If user rejected, throw specific error
      if (error?.code === 4001 || errorMessage.includes('rejected') || errorMessage.includes('User rejected')) {
        throw new Error('Network switch rejected. Please switch manually to continue.')
      }

      // Handle "Chain not configured" errors
      if (errorMessage.includes('Chain not configured') || error?.code === 4902) {
        // For Safari/WalletConnect, we need to be more patient
        const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        const account = await getAccount(config)
        const isWalletConnect = account.connector?.id?.includes('walletConnect') || 
                                account.connector?.name?.toLowerCase().includes('walletconnect')
        const isSafariWalletConnect = isSafari && isWalletConnect
        
        // For Safari/WalletConnect, use longer delays
        const addDelay = isSafariWalletConnect ? 3000 : 2000
        const pollDelay = isSafariWalletConnect ? 2000 : 1000
        
        const added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
        if (added) {
          await new Promise(resolve => setTimeout(resolve, addDelay))
          try {
            await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
            // Poll again with longer delays for Safari
            let retries = 0
            while (retries < 5) {
              await new Promise(resolve => setTimeout(resolve, pollDelay))
              const newChainId = await getCurrentChainId()
              if (newChainId === REQUIRED_CHAIN_ID) {
                console.log(`[${context}] ✅ Chain added and switched successfully`)
                return
              }
              retries++
            }
          } catch (retryError: any) {
            console.warn(`[${context}] Retry switch after add failed:`, retryError)
            if (retryError?.code === 4001 || retryError?.message?.includes('rejected')) {
              throw new Error('Network switch rejected. Please switch manually to continue.')
            }
          }
        }
      }

      // If we still couldn't add/switch, provide helpful error message
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
  // $bDCU Token contract (from Clanker)
  // Token name: bDCU (DeCleanup Token on Base)
  // Note: "bDCU" = Base DeCleanup, "DCU" was the old name (deprecated)
  BDCU_TOKEN:
    (process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS || '') as Address,
  // bDCU Reward Distributor contract (for automatic token distributions)
  BDCU_REWARD_DISTRIBUTOR:
    (process.env.NEXT_PUBLIC_BDCU_REWARD_DISTRIBUTOR_ADDRESS ||
      process.env.NEXT_PUBLIC_BDCU_DISTRIBUTOR_ADDRESS ||
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

// $bDCU Token Integration Strategy:
// 1. Direct ERC20 token balance from Clanker token contract
// 2. bDCURewardDistributor contract automatically distributes tokens on user actions

// Verification Contract ABI
export const VERIFICATION_ABI = parseAbi([
  'function submitCleanup(string memory beforePhotoHash, string memory afterPhotoHash, uint256 latitude, uint256 longitude, address referrerAddress, bool hasImpactForm, string memory impactReportHash) external payable returns (uint256)',
  'function verifyCleanup(uint256 cleanupId, uint8 level) external',
  'function rejectCleanup(uint256 cleanupId) external',
  'function claimImpactProduct(uint256 cleanupId) external payable',
  'function getCleanupStatus(uint256 cleanupId) external view returns (address user, bool verified, bool claimed, uint8 level)',
  'function getCleanup(uint256 cleanupId) external view returns ((address user, string beforePhotoHash, string afterPhotoHash, uint256 timestamp, uint256 latitude, uint256 longitude, bool verified, bool claimed, bool rejected, uint8 level, address referrer, bool hasImpactForm, string impactReportHash))',
  'function cleanupCounter() external view returns (uint256)',
  'function verifier() external view returns (address)', // Deprecated, returns address(0)
  'function isVerifier(address) external view returns (bool)',
  'function getSubmissionFee() external view returns (uint256 fee, bool enabled)',
  'function getClaimFee() external view returns (uint256 fee, bool enabled)',
  'function isRejected(uint256 cleanupId) external view returns (bool)',
])

// ERC20 Token ABI (for Clanker $bDCU token)
export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
])

// bDCU Reward Distributor ABI (contract for automatic token distributions)
export const BDCU_REWARD_DISTRIBUTOR_ABI = parseAbi([
  'function bDCUToken() external view returns (address)',
  'function getContractBalance() external view returns (uint256)',
  'function getTotalDistributed(address user) external view returns (uint256)',
  'function globalTotalDistributed() external view returns (uint256)',
  'function totalDistributed(address user) external view returns (uint256)', // Mapping for verifier earnings
  'function verificationContract() external view returns (address)',
  'event LevelRewardDistributed(address indexed user, uint256 amount)',
  'event StreakRewardDistributed(address indexed user, uint256 amount)',
  'event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount)',
  'event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount)',
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

// $bDCU Token Functions
// 
// Integration Strategy:
// 1. Direct ERC20 token balance from Clanker token contract (if deployed)
// 2. bDCURewardDistributor contract automatically distributes tokens on user actions
// 3. Local storage fallback (development only)

/**
 * Get user's $bDCU balance from on-chain storage
 * 
 * Priority order:
 * 1. Direct ERC20 token balance from Clanker token contract (if deployed)
 * 2. Local storage fallback (development only)
 * 
 * @param userAddress User's wallet address
 * @returns Balance in $bDCU tokens
 */
export async function getPointsBalance(userAddress: Address): Promise<number> {
  // Priority 1: Try to read from Clanker token contract (if deployed)
  if (CONTRACT_ADDRESSES.BDCU_TOKEN) {
    try {
      const tokenBalance = await readContract(config, {
        address: CONTRACT_ADDRESSES.BDCU_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      })
      
      // ERC20 tokens use 18 decimals
      const balance = Number(tokenBalance) / 1e18
      console.log(`Read $bDCU balance from token contract: ${balance}`)
      return balance
    } catch (error) {
      console.warn('Error reading from Clanker token contract, falling back to points:', error)
      // Fall through to points system
    }
  }

  // Fallback to local storage for development if token not deployed
  return pointsLib.getPointsBalance(userAddress)
}

/**
 * Get user's $bDCU balance (alias for getPointsBalance)
 * Reads from $bDCU token contract (if deployed) or local storage fallback
 */
export async function getDCUBalance(userAddress: Address): Promise<number> {
  return getPointsBalance(userAddress)
}

/**
 * Get user's staked $bDCU
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

/**
 * Get claim fee info
 */
export async function getClaimFee(): Promise<{ fee: bigint; enabled: boolean }> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    return { fee: BigInt(0), enabled: false }
  }

  try {
    const result = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'getClaimFee',
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
    const isExpectedError = 
      error?.message?.includes('revert') || 
      error?.message?.includes('function') || 
      error?.name === 'ContractFunctionExecutionError'
    
    if (!isExpectedError) {
      console.error('Error getting claim fee:', error)
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
  // Log referrer for debugging
  if (referrerAddress && referrerAddress !== '0x0000000000000000000000000000000000000000') {
    console.log('[submitCleanup] Referrer address provided:', referrerAddress)
  } else {
    console.log('[submitCleanup] No referrer address provided')
  }
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

  // Safari/WalletConnect specific handling
  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const account = await getAccount(config)
  const isWalletConnect = account.connector?.id?.includes('walletConnect') || 
                          account.connector?.name?.toLowerCase().includes('walletconnect')
  const isSafariWalletConnect = isSafari && isWalletConnect

  // For Safari/WalletConnect, add extra delay and verification before transaction
  if (isSafariWalletConnect) {
    console.log('[submitCleanup] Safari/WalletConnect detected, ensuring chain is ready...')
    
    // Verify WalletConnect provider is ready
    try {
      const connector = account.connector as any
      const provider = await connector?.getProvider?.()
      if (!provider) {
        console.warn('[submitCleanup] Safari/WalletConnect: Provider not ready, waiting...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (providerError) {
      console.warn('[submitCleanup] Safari/WalletConnect: Provider check failed:', providerError)
    }
    
    // Add delay before transaction to ensure everything is ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Double-check chain one more time for Safari/WalletConnect
    const finalCheckChainId = await getCurrentChainId()
    if (finalCheckChainId !== null && finalCheckChainId !== REQUIRED_CHAIN_ID) {
      console.warn('[submitCleanup] Safari/WalletConnect: Chain mismatch detected, attempting final switch...')
      try {
        await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (switchError) {
        console.warn('[submitCleanup] Final chain switch failed:', switchError)
        throw new Error(
          `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet app before submitting. ` +
          `Current chain: ${finalCheckChainId}, Required: ${REQUIRED_CHAIN_ID}`
        )
      }
    }
  }

  let hash: `0x${string}`
  try {
    console.log('[submitCleanup] Sending transaction...', {
      isSafari,
      isWalletConnect,
      isSafariWalletConnect,
      chainId: await getCurrentChainId(),
      address: CONTRACT_ADDRESSES.VERIFICATION
    })

    hash = await writeContract(config as any, {
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

    console.log('[submitCleanup] Transaction sent, hash:', hash)
  } catch (error: any) {
    console.error('[submitCleanup] Transaction failed:', error)
    
    // Check for WalletConnect stale session error
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    
    // For Safari/WalletConnect, provide more helpful error messages
    if (isSafariWalletConnect) {
      const errorMessage = getErrorMessage(error)
      if (errorMessage.includes('User rejected') || error?.code === 4001) {
        throw new Error('Transaction was rejected. Please check your wallet app and approve the transaction.')
      }
      if (errorMessage.includes('network') || errorMessage.includes('chain')) {
        throw new Error(`Network issue detected. Please ensure you're on ${REQUIRED_CHAIN_NAME} in your wallet app and try again.`)
      }
    }
    
    throw error // Re-throw if not a stale session error
  }

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

  // Check cleanup status before attempting to claim
  try {
    const status = await getCleanupStatus(cleanupId)
    if (status.claimed) {
      throw new Error('This Impact Product has already been claimed. Please check your profile.')
    }
    if (!status.verified) {
      throw new Error('This cleanup has not been verified yet. Please wait for verification.')
    }
    if (status.rejected) {
      throw new Error('This cleanup was rejected and cannot be claimed.')
    }
  } catch (statusError: any) {
    // If status check fails, still try to claim (might be a read error)
    // But if it's a clear "already claimed" error, throw it
    if (statusError?.message?.includes('already been claimed') || 
        statusError?.message?.includes('already claimed')) {
      throw statusError
    }
    console.warn('Could not check cleanup status before claim, proceeding anyway:', statusError)
  }

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  // Get claim fee if enabled
  let claimFeeValue: bigint = BigInt(0)
  try {
    const claimFeeInfo = await getClaimFee()
    if (claimFeeInfo.enabled && claimFeeInfo.fee > 0) {
      claimFeeValue = claimFeeInfo.fee
    }
  } catch (error) {
    console.warn('Could not fetch claim fee, proceeding without fee:', error)
  }

  try {
    const hash = await writeContract(config as any, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'claimImpactProduct',
      args: [cleanupId],
      value: claimFeeValue,
      chain: targetChain,
    })

    return hash
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    
    // Check for specific "already claimed" errors
    if (
      errorMessage.includes('already claimed') ||
      errorMessage.includes('Impact form reward already claimed') ||
      errorMessage.includes('Already claimed') ||
      errorMessage.includes('already been claimed')
    ) {
      throw new Error(
        'This Impact Product has already been claimed. ' +
        'If you don\'t see it in your profile, please refresh the page or check the transaction history.'
      )
    }
    
    // Check for other common errors
    if (errorMessage.includes('Not your cleanup') || errorMessage.includes('not your cleanup')) {
      throw new Error('This cleanup does not belong to your wallet address.')
    }
    
    if (errorMessage.includes('Cleanup not verified') || errorMessage.includes('not verified')) {
      throw new Error('This cleanup has not been verified yet. Please wait for verification.')
    }
    
    if (errorMessage.includes('Cleanup does not exist') || errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup #${cleanupId.toString()} does not exist.`)
    }
    
    // Re-throw with better error message
    throw new Error(`Failed to claim Impact Product: ${errorMessage}`)
  }
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
  // This will throw an error if chain switch is rejected or fails
  try {
    await ensureWalletOnRequiredChain('verification', providedChainId)
  } catch (chainError: any) {
    const chainErrorMessage = getErrorMessage(chainError)
    // If user rejected chain switch, throw a clear error
    if (chainErrorMessage.includes('rejected') || chainErrorMessage.includes('Network switch rejected')) {
      throw new Error('Network switch was rejected. Please switch to the correct network in your wallet and try again.')
    }
    // Re-throw other chain errors
    throw chainError
  }

  // Double-check chain before proceeding with transaction
  const finalChainCheck = await getCurrentChainId()
  if (finalChainCheck !== null && finalChainCheck !== REQUIRED_CHAIN_ID) {
    throw new Error(
      `Wallet is still on the wrong network (Chain ID: ${finalChainCheck}). ` +
      `Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) and try again.`
    )
  }

  // Add a small delay after chain switch to ensure wallet has fully updated
  // This prevents race conditions where the transaction is attempted before the chain switch is complete
  await new Promise(resolve => setTimeout(resolve, 500))
  
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
    // Check for WalletConnect stale session error first
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    
    const errorMessage = getErrorMessage(error)
    console.error('Error calling verifyCleanup:', errorMessage)

    // Check for chain mismatch errors first
    if (
      errorMessage.includes('ChainMismatchError') ||
      errorMessage.includes('chain mismatch') ||
      errorMessage.includes('does not match the target chain')
    ) {
      const currentChainId = await getCurrentChainId()
      throw new Error(
        `Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
        `Current network: ${currentChainId || 'unknown'}\n${getNetworkSetupMessage()}`
      )
    }
    
    // Check if user rejected the transaction (not the chain switch)
    if (
      error?.code === 4001 || 
      errorMessage.includes('User rejected') || 
      errorMessage.includes('User denied') ||
      errorMessage.includes('rejected the request') ||
      errorMessage.includes('denied transaction signature')
    ) {
      // Check if we're on the correct chain - if not, the rejection might be due to wrong network
      const currentChainId = await getCurrentChainId()
      if (currentChainId !== null && currentChainId !== REQUIRED_CHAIN_ID) {
        throw new Error(
          `Transaction was rejected. Your wallet is on the wrong network (Chain ID: ${currentChainId}). ` +
          `Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) and try again.`
        )
      }
      // If on correct chain, user explicitly rejected the transaction
      throw new Error(
        `Transaction was rejected. Please approve the transaction in your wallet to verify the cleanup. ` +
        `If you're unsure about the transaction, check that you're on ${REQUIRED_CHAIN_NAME} and have enough ETH for gas.`
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
    // Check for WalletConnect stale session error first
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    
    const errorMessage = getErrorMessage(error)
    console.error('Error calling rejectCleanup:', errorMessage)

    // Check for chain mismatch errors first
    if (
      errorMessage.includes('ChainMismatchError') ||
      errorMessage.includes('chain mismatch') ||
      errorMessage.includes('does not match the target chain')
    ) {
      const currentChainId = await getCurrentChainId()
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

// Streak Functions
// Note: Streak tracking is not currently implemented in bDCURewardDistributor
// These functions return default values for UI compatibility

/**
 * Get user's streak count
 * @deprecated Streak tracking not available - returns 0
 */
export async function getStreakCount(userAddress: Address): Promise<number> {
  // Streak tracking not implemented in bDCURewardDistributor
  return 0
}

/**
 * Check if user has active streak
 * @deprecated Streak tracking not available - returns false
 */
export async function hasActiveStreak(userAddress: Address): Promise<boolean> {
  // Streak tracking not implemented in bDCURewardDistributor
  return false
}

/**
 * Get verifier's actual $bDCU token earnings from bDCURewardDistributor
 * Returns the total tokens distributed to the verifier address
 */
export async function getVerifierTokenEarnings(verifierAddress: Address): Promise<string> {
  if (!CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
    console.warn('getVerifierTokenEarnings: BDCU_REWARD_DISTRIBUTOR address not set')
    return '0'
  }

  try {
    console.log('Fetching verifier token earnings for:', verifierAddress)
    console.log('Using contract address:', CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR)
    
    const totalDistributed = await readContract(config, {
      address: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
      abi: BDCU_REWARD_DISTRIBUTOR_ABI,
      functionName: 'totalDistributed',
      args: [verifierAddress],
    })
    
    console.log('Raw totalDistributed value:', totalDistributed)
    
    // Convert from wei (18 decimals) to tokens
    const { formatUnits } = await import('viem')
    const formatted = formatUnits(totalDistributed as bigint, 18)
    console.log('Formatted verifier earnings:', formatted)
    return formatted
  } catch (error: any) {
    console.error('Error fetching verifier token earnings:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      cause: error?.cause,
    })
    return '0'
  }
}

/**
 * Get total rewards distributed to a user from bDCURewardDistributor
 * This shows the cumulative rewards tracked by the contract (may differ from actual balance)
 * @param userAddress User's wallet address
 * @returns Total rewards distributed according to contract (in $bDCU tokens)
 */
export async function getTotalRewardsDistributed(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
    console.warn('getTotalRewardsDistributed: BDCU_REWARD_DISTRIBUTOR address not set')
    return 0
  }

  try {
    const totalDistributed = await readContract(config, {
      address: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
      abi: BDCU_REWARD_DISTRIBUTOR_ABI,
      functionName: 'totalDistributed',
      args: [userAddress],
    })
    
    // Convert from wei (18 decimals) to tokens
    const { formatUnits } = await import('viem')
    const formatted = parseFloat(formatUnits(totalDistributed as bigint, 18))
    console.log(`Total rewards distributed to ${userAddress}: ${formatted} $bDCU`)
    return formatted
  } catch (error: any) {
    console.error('Error fetching total rewards distributed:', error)
    return 0
  }
}

/**
 * Get detailed breakdown of rewards distributed to a user by querying events
 * @param userAddress User's wallet address
 * @returns Breakdown of rewards by type
 */
export async function getRewardsBreakdown(userAddress: Address): Promise<{
  levelRewards: number
  cleanupCount: number // Number of cleanups (each cleanup = 1 level claim)
  streakRewards: number
  referralRewards: number
  impactFormRewards: number
  total: number
}> {
  if (!CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
    return { levelRewards: 0, cleanupCount: 0, streakRewards: 0, referralRewards: 0, impactFormRewards: 0, total: 0 }
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const { baseSepolia, base } = await import('viem/chains')
    
    const chain = REQUIRED_CHAIN_ID === 84532 ? baseSepolia : base
    const publicClient = createPublicClient({
      chain,
      transport: http(REQUIRED_RPC_URL),
    })

    const distributorAddress = CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR
    
    // RPC has max block range of 100,000 blocks
    // Query from the last 50,000 blocks to stay well within limits
    // This should cover several months of activity
    let fromBlock = BigInt(0)
    try {
      const currentBlock = await publicClient.getBlockNumber()
      const blockRange = BigInt(50000) // Last 50k blocks (safe margin)
      fromBlock = currentBlock > blockRange ? currentBlock - blockRange : BigInt(0)
      console.log(`Current block: ${currentBlock}, querying from block: ${fromBlock} (last ${blockRange} blocks)`)
    } catch (error) {
      console.warn('Could not get current block number:', error)
      // If we can't get current block, we'll try from 0 and let error handling catch it
      fromBlock = BigInt(0)
    }
    
    console.log(`Querying reward events for ${userAddress} from block ${fromBlock}...`)
    console.log(`Contract address: ${distributorAddress}`)
    
    // Query all reward events (try with args filter first, fallback to no filter if that fails)
    let levelLogs: any[] = []
    let streakLogs: any[] = []
    let referralLogs: any[] = []
    let impactFormLogs: any[] = []
    
    try {
      // Try with indexed args filter (more efficient)
      const [levelLogsFiltered, streakLogsFiltered, referralLogsAll, impactFormLogsFiltered] = await Promise.all([
        publicClient.getLogs({
          address: distributorAddress,
          event: parseAbiItem('event LevelRewardDistributed(address indexed user, uint256 amount)'),
          args: { user: userAddress },
          fromBlock,
        }).catch((error: any) => {
          if (error?.message?.includes('max block range')) {
            console.warn('Block range too large for LevelRewardDistributed, trying from latest block only')
            // Try from latest block only as fallback
            return publicClient.getBlockNumber().then(async (currentBlock) => {
              return publicClient.getLogs({
                address: distributorAddress,
                event: parseAbiItem('event LevelRewardDistributed(address indexed user, uint256 amount)'),
                args: { user: userAddress },
                fromBlock: currentBlock - BigInt(50000), // Last 50k blocks
              }).catch(() => [])
            })
          }
          throw error
        }),
        publicClient.getLogs({
          address: distributorAddress,
          event: parseAbiItem('event StreakRewardDistributed(address indexed user, uint256 amount)'),
          args: { user: userAddress },
          fromBlock,
        }).catch((error: any) => {
          if (error?.message?.includes('max block range')) {
            return publicClient.getBlockNumber().then(async (currentBlock) => {
              return publicClient.getLogs({
                address: distributorAddress,
                event: parseAbiItem('event StreakRewardDistributed(address indexed user, uint256 amount)'),
                args: { user: userAddress },
                fromBlock: currentBlock - 50000n,
              }).catch(() => [])
            })
          }
          throw error
        }),
        publicClient.getLogs({
          address: distributorAddress,
          event: parseAbiItem('event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount)'),
          fromBlock,
        }).catch((error: any) => {
          if (error?.message?.includes('max block range')) {
            return publicClient.getBlockNumber().then(async (currentBlock) => {
              return publicClient.getLogs({
                address: distributorAddress,
                event: parseAbiItem('event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount)'),
                fromBlock: currentBlock - 50000n,
              }).catch(() => [])
            })
          }
          throw error
        }),
        publicClient.getLogs({
          address: distributorAddress,
          event: parseAbiItem('event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount)'),
          args: { user: userAddress },
          fromBlock,
        }).catch((error: any) => {
          if (error?.message?.includes('max block range')) {
            return publicClient.getBlockNumber().then(async (currentBlock) => {
              return publicClient.getLogs({
                address: distributorAddress,
                event: parseAbiItem('event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount)'),
                args: { user: userAddress },
                fromBlock: currentBlock - 50000n,
              }).catch(() => [])
            })
          }
          throw error
        }),
      ])
      
      levelLogs = levelLogsFiltered
      streakLogs = streakLogsFiltered
      impactFormLogs = impactFormLogsFiltered
      
      // Filter referral logs client-side (user can be referrer or referee)
      const userLower = userAddress.toLowerCase()
      referralLogs = referralLogsAll.filter((log: any) => {
        const referrer = log.args?.referrer?.toLowerCase()
        const referee = log.args?.referee?.toLowerCase()
        return referrer === userLower || referee === userLower
      })
      
      console.log(`Query with args filter succeeded`)
    } catch (error: any) {
      console.warn('Query with args filter failed:', error?.message)
      
      // If it's a block range error, try querying from a more recent block
      if (error?.message?.includes('max block range')) {
        try {
          const currentBlock = await publicClient.getBlockNumber()
          const recentFromBlock = currentBlock - BigInt(50000) // Last 50k blocks
          console.log(`Retrying from recent block ${recentFromBlock} (last 50k blocks)`)
          
          const [allLevelLogs, allStreakLogs, allReferralLogs, allImpactFormLogs] = await Promise.all([
            publicClient.getLogs({
              address: distributorAddress,
              event: parseAbiItem('event LevelRewardDistributed(address indexed user, uint256 amount)'),
              fromBlock: recentFromBlock,
            }),
            publicClient.getLogs({
              address: distributorAddress,
              event: parseAbiItem('event StreakRewardDistributed(address indexed user, uint256 amount)'),
              fromBlock: recentFromBlock,
            }),
            publicClient.getLogs({
              address: distributorAddress,
              event: parseAbiItem('event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount)'),
              fromBlock: recentFromBlock,
            }),
            publicClient.getLogs({
              address: distributorAddress,
              event: parseAbiItem('event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount)'),
              fromBlock: recentFromBlock,
            }),
          ])
          
          // Filter client-side
          const userLower = userAddress.toLowerCase()
          levelLogs = allLevelLogs.filter((log: any) => log.args?.user?.toLowerCase() === userLower)
          streakLogs = allStreakLogs.filter((log: any) => log.args?.user?.toLowerCase() === userLower)
          referralLogs = allReferralLogs.filter((log: any) => {
            const referrer = log.args?.referrer?.toLowerCase()
            const referee = log.args?.referee?.toLowerCase()
            return referrer === userLower || referee === userLower
          })
          impactFormLogs = allImpactFormLogs.filter((log: any) => log.args?.user?.toLowerCase() === userLower)
          
          console.log(`Query from recent block succeeded`)
        } catch (recentError: any) {
          console.error('Query from recent block also failed:', recentError)
          // Return empty arrays - we'll show 0 but at least the page won't crash
          levelLogs = []
          streakLogs = []
          referralLogs = []
          impactFormLogs = []
        }
      } else {
        // Other error, throw it
        throw error
      }
    }
    
    console.log(`Found events:`, {
      levelLogs: levelLogs.length,
      streakLogs: streakLogs.length,
      referralLogs: referralLogs.length,
      impactFormLogs: impactFormLogs.length,
    })

    // Calculate totals
    // Each LevelRewardDistributed event = 1 cleanup that was claimed
    const cleanupCount = levelLogs.length
    const levelRewards = levelLogs.reduce((sum, log) => {
      const amount = log.args.amount as bigint
      return sum + parseFloat(formatUnits(amount, 18))
    }, 0)

    const streakRewards = streakLogs.reduce((sum, log) => {
      const amount = log.args.amount as bigint
      return sum + parseFloat(formatUnits(amount, 18))
    }, 0)

    const referralRewards = referralLogs.reduce((sum, log) => {
      const amount = log.args.amount as bigint
      return sum + parseFloat(formatUnits(amount, 18))
    }, 0)

    const impactFormRewards = impactFormLogs.reduce((sum, log) => {
      const amount = log.args.amount as bigint
      return sum + parseFloat(formatUnits(amount, 18))
    }, 0)

    const total = levelRewards + streakRewards + referralRewards + impactFormRewards

    console.log(`Rewards breakdown for ${userAddress}:`, {
      cleanupCount,
      levelLogs: levelLogs.length,
      streakLogs: streakLogs.length,
      referralLogs: referralLogs.length,
      impactFormLogs: impactFormLogs.length,
      levelRewards,
      streakRewards,
      referralRewards,
      impactFormRewards,
      total,
    })

    // If no events found but we have a total from contract, log a warning
    if (total === 0) {
      console.warn(`No reward events found for ${userAddress}. This could mean:`)
      console.warn(`1. Events weren't emitted (check contract)`)
      console.warn(`2. RPC doesn't support querying from block 0`)
      console.warn(`3. Contract address might be wrong: ${distributorAddress}`)
    }

    return {
      levelRewards,
      cleanupCount,
      streakRewards,
      referralRewards,
      impactFormRewards,
      total,
    }
  } catch (error: any) {
    console.error('Error fetching rewards breakdown:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
    })
    return { levelRewards: 0, cleanupCount: 0, streakRewards: 0, referralRewards: 0, impactFormRewards: 0, total: 0 }
  }
}

/**
 * Check if VerificationContract is linked to bDCURewardDistributor
 */
export async function checkVerificationContractLinked(): Promise<{ linked: boolean; verificationContractAddress: Address | null }> {
  if (!CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
    return { linked: false, verificationContractAddress: null }
  }

  try {
    const verificationContractAddress = await readContract(config, {
      address: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
      abi: BDCU_REWARD_DISTRIBUTOR_ABI,
      functionName: 'verificationContract',
    }) as Address

    const isLinked = verificationContractAddress !== '0x0000000000000000000000000000000000000000' &&
      verificationContractAddress.toLowerCase() === CONTRACT_ADDRESSES.VERIFICATION?.toLowerCase()

    console.log('VerificationContract linking check:', {
      linked: isLinked,
      distributorAddress: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
      verificationContractInDistributor: verificationContractAddress,
      expectedVerificationContract: CONTRACT_ADDRESSES.VERIFICATION,
    })

    return { linked: isLinked, verificationContractAddress }
  } catch (error) {
    console.error('Error checking VerificationContract link:', error)
    return { linked: false, verificationContractAddress: null }
  }
}

/**
 * Check if bDCURewardDistributor has tokens (is funded)
 */
export async function checkRewardDistributorFunded(): Promise<{ funded: boolean; balance: string }> {
  if (!CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
    return { funded: false, balance: '0' }
  }

  try {
    const balance = await readContract(config, {
      address: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
      abi: BDCU_REWARD_DISTRIBUTOR_ABI,
      functionName: 'getContractBalance',
    }) as bigint

    const { formatUnits } = await import('viem')
    const formattedBalance = formatUnits(balance, 18)
    const isFunded = balance > BigInt(0)

    console.log('Reward distributor funding check:', {
      funded: isFunded,
      balance: formattedBalance,
      rawBalance: balance.toString(),
    })

    return { funded: isFunded, balance: formattedBalance }
  } catch (error) {
    console.error('Error checking reward distributor funding:', error)
    return { funded: false, balance: '0' }
  }
}


