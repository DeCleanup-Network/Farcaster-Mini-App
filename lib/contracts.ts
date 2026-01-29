import { Address, encodeFunctionData, parseAbi, parseAbiItem, formatUnits, createPublicClient, http } from 'viem'
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  simulateContract,
  getChainId,
  switchChain,
  getAccount,
  connect,
  getPublicClient,
} from 'wagmi/actions'
import { Attribution } from 'ox/erc8021'
import {
  getWagmiConfig,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_RPC_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from './wagmi'
import { tryAddRequiredChain, switchToRequiredChainViaProvider } from './network'
import * as pointsLib from './points'
import { getCurrentChainIdCached, clearChainIdCache } from './chain-detection'
import { validatePreFlight } from './preflight-validation'
import { withTimeout, TimeoutError, retryWithTimeout } from './timeout-utils'
import { logTransactionAttempt, logTransactionSuccess, logTransactionError, logChainSwitchAttempt, logChainSwitchSuccess, logChainSwitchError } from './structured-logging'
import { cleanupAddressStorage, setPendingCleanupId, setPendingCleanupLocation, removeReferrer } from './storage-manager'

// Base Builder Code for attribution
const BUILDER_CODE = 'bc_e7e2idp7'

// Helper to get Builder Code data suffix for attribution
function getBuilderCodeDataSuffix(): `0x${string}` {
  try {
    return Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  } catch (error) {
    console.warn('Failed to generate Builder Code data suffix:', error)
    return '0x' as `0x${string}`
  }
}

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
        const account = getAccount(getWagmiConfig())
        if (account.isConnected && account.connector?.id?.includes('walletconnect')) {
          const { disconnect } = await import('wagmi/actions')
          await disconnect(getWagmiConfig())
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
  return getWagmiConfig().chains.find((chain) => chain.id === REQUIRED_CHAIN_ID)
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

  // Use provided chainId if available, otherwise try to get it (with caching)
  let currentChainId: number | null = providedChainId !== undefined ? providedChainId : await getCurrentChainIdCached()
  console.log(`[${context}] Current chain ID: ${currentChainId}, required: ${REQUIRED_CHAIN_ID}`)
  
  // Log chain switch attempt
  if (currentChainId !== null && currentChainId !== REQUIRED_CHAIN_ID) {
    await logChainSwitchAttempt(currentChainId, REQUIRED_CHAIN_ID)
  }

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

    // Now try to switch with timeout
    try {
      console.log(`[${context}] Attempting to switch chain - wallet should prompt...`)
      await withTimeout(
        switchChain(getWagmiConfig(), { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 }),
        30000, // 30 seconds timeout for chain switch
        'Chain switch timeout - please switch manually in your wallet'
      )

      // Poll for chain update - optimized with shorter delays and fewer retries
      let retries = 0
      while (retries < 3) {
        await new Promise(resolve => setTimeout(resolve, 500)) // Reduced from 1000ms to 500ms
        const newChainId = await getCurrentChainIdCached(true) // Force refresh after switch
        if (newChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Successfully switched to ${REQUIRED_CHAIN_NAME}`)
          clearChainIdCache() // Clear cache after successful switch
          await logChainSwitchSuccess(REQUIRED_CHAIN_ID)
          return
        }
        retries++
      }

      // If switch didn't work after polling, try one more time with shorter delay
      console.log(`[${context}] Chain switch polling didn't detect change, trying one more switch attempt...`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Reduced from 2000ms
      await switchChain(getWagmiConfig(), { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
      await new Promise(resolve => setTimeout(resolve, 1000)) // Reduced from 3000ms
      const finalCheck = await getCurrentChainIdCached(true) // Force refresh
      if (finalCheck === REQUIRED_CHAIN_ID) {
        console.log(`[${context}] ✅ Successfully switched to ${REQUIRED_CHAIN_NAME} on retry`)
        clearChainIdCache() // Clear cache after successful switch
        await logChainSwitchSuccess(REQUIRED_CHAIN_ID)
        return
      }
      
      throw new Error(`Failed to switch network. Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet.`)
    } catch (error: any) {
      console.error(`[${context}] Switch failed:`, error)
      await logChainSwitchError(error, currentChainId, REQUIRED_CHAIN_ID)
      
      // Check for WalletConnect stale session error first
      if (isWalletConnectStaleSessionError(error)) {
        await handleWalletConnectStaleSession(error)
        return // This will throw, but TypeScript needs this
      }
      
      const errorMessage = getErrorMessage(error)
      
      // If user rejected the switch, throw a clear error
      if (errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('User rejected')) {
        throw new Error(
          `Network switch was rejected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet and try again.`
        )
      }

      // If user rejected, throw specific error
      if (error?.code === 4001 || errorMessage.includes('rejected') || errorMessage.includes('User rejected')) {
        throw new Error('Network switch rejected. Please switch manually to continue.')
      }

      // Handle "Chain not configured" errors
      if (errorMessage.includes('Chain not configured') || error?.code === 4902) {
        // For Safari/WalletConnect, we need to be more patient
        const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        const account = await getAccount(getWagmiConfig())
        const isWalletConnect = account.connector?.id?.includes('walletConnect') || 
                                account.connector?.name?.toLowerCase().includes('walletconnect')
        const isSafariWalletConnect = isSafari && isWalletConnect
        
        // For Safari/WalletConnect, use slightly longer delays (but still optimized)
        const addDelay = isSafariWalletConnect ? 1500 : 1000 // Reduced from 3000/2000
        const pollDelay = isSafariWalletConnect ? 1000 : 500 // Reduced from 2000/1000
        
        const added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
        if (added) {
          await new Promise(resolve => setTimeout(resolve, addDelay))
          try {
            await switchChain(getWagmiConfig(), { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
            // Poll again with optimized delays
            let retries = 0
            while (retries < 3) { // Reduced from 5 to 3 retries
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
      const account = await getAccount(getWagmiConfig())
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
// Helper to ensure wallet is connected before transactions
// CRITICAL: Must check connection status before writeContract to avoid WalletConnect QR hang
// Returns the locked wallet address to ensure we use the same address throughout the transaction
async function ensureWalletConnected(): Promise<Address> {
  const account = getAccount(getWagmiConfig())
  
  // Check if wallet is actually connected
  if (account.status !== 'connected' || !account.address) {
    throw new Error(
      'Wallet is not connected. Please connect your wallet before submitting a transaction.'
    )
  }
  
  // Ensure connector exists
  if (!account.connector) {
    throw new Error(
      'Wallet connector not found. Please reconnect your wallet and try again.'
    )
  }
  
  const walletAddress = account.address
  
  console.log('[ensureWalletConnected] ✅ Wallet connected:', {
    address: walletAddress,
    connector: account.connector.name || account.connector.id,
    status: account.status,
    chainId: account.chainId,
  })
  
  return walletAddress
}

// Check if wallet has sufficient balance for gas fees
// Uses 0.0001 ETH for both testnet and mainnet (Base gas is very low; 0.0001 ETH is enough for many txs)
async function checkGasBalance(walletAddress: Address, minBalance?: bigint): Promise<void> {
  try {
    const publicClient = getPublicClient(getWagmiConfig())
    if (!publicClient) {
      console.warn('[checkGasBalance] Public client not available, skipping balance check')
      return
    }
    
    // Verify we're checking balance on the correct chain
    const currentChainId = await getCurrentChainId()
    if (currentChainId !== null && currentChainId !== REQUIRED_CHAIN_ID) {
      console.warn(`[checkGasBalance] Chain mismatch: checking on chain ${currentChainId}, but required is ${REQUIRED_CHAIN_ID}. Skipping balance check.`)
      return // Don't check balance if we're on wrong chain - chain switch will handle it
    }
    
    // Use 0.0001 ETH for both (Base gas is cheap; 0.0001 ETH ≈ enough for many txs)
    const defaultMinBalance = BigInt('100000000000000') // 0.0001 ETH
    const requiredMinBalance = minBalance || defaultMinBalance
    
    // Use publicClient.getBalance() method instead of importing getBalance from viem
    const balance = await publicClient.getBalance({ address: walletAddress })
    
    if (balance < requiredMinBalance) {
      const balanceFormatted = formatUnits(balance, 18)
      const minFormatted = formatUnits(requiredMinBalance, 18)
      throw new Error(
        `Insufficient balance for gas fees.\n` +
        `Your balance: ${balanceFormatted} ETH\n` +
        `Minimum required: ${minFormatted} ETH\n` +
        `Please add funds to your wallet and try again.`
      )
    }
    
    console.log('[checkGasBalance] ✅ Sufficient balance:', {
      balance: formatUnits(balance, 18),
      minRequired: formatUnits(requiredMinBalance, 18),
      chainId: currentChainId,
    })
  } catch (error: any) {
    // If balance check fails due to RPC/network issues, log but don't block transaction
    // The wallet will reject the transaction if there's insufficient balance anyway
    const errorMessage = error?.message || String(error || '')
    const isBalanceError = errorMessage.includes('Insufficient balance')
    const isRpcError = errorMessage.includes('fetch') || 
                      errorMessage.includes('network') || 
                      errorMessage.includes('timeout') ||
                      errorMessage.includes('ECONNREFUSED') ||
                      errorMessage.includes('Failed to fetch')
    
    if (isBalanceError) {
      // Only throw if it's a real balance issue
      throw error
    } else if (isRpcError) {
      // RPC errors - don't block, wallet will handle it
      console.warn('[checkGasBalance] RPC error during balance check, continuing anyway:', errorMessage)
      return
    } else {
      // Other errors - log but don't block
      console.warn('[checkGasBalance] Balance check failed (non-critical), continuing anyway:', errorMessage)
      return
    }
  }
}

async function getCurrentChainId(): Promise<number | null> {
  // Use cached version to prevent race conditions
  try {
    return await getCurrentChainIdCached()
  } catch (error) {
    // Fallback to direct call if cache fails
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
    const chainId = await getChainId(getWagmiConfig())
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', errorHandler)
    }
    return chainId
    } catch (chainError: any) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', errorHandler)
    }
    
    // Check if it's the specific connector.getChainId error
      const errorMessage = getErrorMessage(chainError)
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
      const account = await getAccount(getWagmiConfig())
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
  // $bDCU Token contract (Clanker) - the actual bDCU token contract on Base
  // Token name: bDCU (DeCleanup Token on Base)
  // Mainnet: 0x30171b7014c02229497cde6745dd3ad821f12b07 (ClankerToken)
  // Note: "bDCU" = Base DeCleanup, "DCU" was the old name (deprecated)
  // 15% of tokens are reserved for rewards and are currently locked by Clanker
  //
  // Frontend usage:
  // - Used in ImportTokenModal to show users the token contract address for wallet import
  // - NOT used to read user balances (balances are read from Reward Distributor's totalDistributed mapping)
  //
  // Reward Distributor contract usage:
  // - The Reward Distributor contract was deployed with this token address in its constructor
  // - It uses this address to call token.transfer() when automatically distributing rewards to users
  // - TO Reward Distributor: Manual transfers from multisig (NOT automated, team must send tokens)
  // - FROM Reward Distributor: Automated transfers to users (AUTOMATED when users claim Impact Products, etc.)
  //
  // Token flow: Clanker (locked) → Unlock → Multisig → Reward Distributor (manual) → Users (automated)
  BDCU_TOKEN:
    (process.env.NEXT_PUBLIC_BDCU_TOKEN_ADDRESS || '') as Address,
  // PointsRewardDistributor: users earn DCU points and claim bDCU via claimTokens(points).
  // bDCURewardDistributor is no longer used by the app.
  POINTS_REWARD_DISTRIBUTOR:
    (process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS ||
      '') as Address,
}


const METADATA_CID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID || ''
// When contract was deployed with placeholder base URI (IPFS_BASE_URI not set), use this for metadata
const PLACEHOLDER_BASE = 'QmYourBaseURIHere'
const FALLBACK_METADATA_CID = METADATA_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'

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

// $bDCU Token: ERC20 from Clanker. Users earn DCU points in PointsRewardDistributor and claim bDCU via claimTokens(points).

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
  'function hasSubmittedCleanup(address user) external view returns (bool)',
  'function rewardDistributor() external view returns (address)',
  'function owner() external view returns (address)',
])

// ERC20 Token ABI (for Clanker $bDCU token)
export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
])

// Impact Product Functions

/**
 * Get user's current Impact Product level
 */
export async function getUserLevel(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  const level = await readContract(getWagmiConfig(), {
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

  return await readContract(getWagmiConfig(), {
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
    const uri = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getTokenURIForLevel',
      args: [level],
    })
    // Contract may have been deployed with placeholder base URI; use env/fallback CID
    if (typeof uri === 'string' && (uri.includes(PLACEHOLDER_BASE) || uri.includes('YourBaseURIHere'))) {
      return `ipfs://${FALLBACK_METADATA_CID}/level${level}.json`
    }
    return uri
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

  const uri = await readContract(getWagmiConfig(), {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
  })
  // Contract may have been deployed with placeholder base URI; use env/fallback CID
  if (typeof uri === 'string' && (uri.includes(PLACEHOLDER_BASE) || uri.includes('YourBaseURIHere'))) {
    // tokenURI from contract is like ipfs://QmYourBaseURIHere/levelN.json - we need level from token or keep path
    const match = uri.match(/level(\d+)\.json/)
    const level = match ? parseInt(match[1], 10) : 1
    return `ipfs://${FALLBACK_METADATA_CID}/level${level}.json`
  }
  return uri
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
// Integration Strategy (Mainnet):
// 1. Tokens are sent from multisig directly to Reward Distributor contract
// 2. Reward Distributor contract automatically distributes tokens to users on-chain
// 3. User balances are read from Reward Distributor's totalDistributed mapping
// 4. Local storage fallback (development only)
//
// Note: We read from Reward Distributor's totalDistributed() mapping, which tracks
// the cumulative tokens distributed to each user. This is more accurate than reading
// from the token contract balanceOf() since it shows total rewards earned, regardless
// of whether the user has spent/transferred tokens.

/**
 * Get user's $bDCU balance from Reward Distributor contract
 * 
 * Priority order:
 * 1. Read from Reward Distributor's totalDistributed mapping (shows total rewards earned)
 * 2. Fallback to local storage (development only)
 * 
 * Note: This reads the cumulative rewards distributed to the user, which is more
 * accurate than token contract balanceOf() since it shows total rewards earned.
 * 
 * @param userAddress User's wallet address
 * @returns Total rewards distributed to user (in $bDCU tokens)
 */
export async function getPointsBalance(userAddress: Address): Promise<number> {
  if (CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    try {
      const points = await readContract(getWagmiConfig(), {
        address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
        abi: POINTS_REWARD_DISTRIBUTOR_ABI,
        functionName: 'getPointsBalance',
        args: [userAddress],
      })
      return Number(points)
    } catch (error) {
      console.warn('Error reading from PointsRewardDistributor, falling back to local storage:', error)
    }
  }
  return pointsLib.getPointsBalance(userAddress)
}

/**
 * Get user's actual $bDCU token balance from their wallet
 * Reads from the ERC20 token contract's balanceOf function
 * 
 * @param userAddress User's wallet address
 * @returns Current token balance in wallet (in $bDCU tokens)
 */
export async function getDCUBalance(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.BDCU_TOKEN) {
    console.warn('bDCU token address not configured')
    return 0
  }

  try {
    const balance = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.BDCU_TOKEN,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint

    // Convert from wei (18 decimals) to tokens
    const { formatUnits } = await import('viem')
    return parseFloat(formatUnits(balance, 18))
  } catch (error) {
    console.error('Error reading token balance:', error)
    return 0
  }
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
    const result = await readContract(getWagmiConfig(), {
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
    const result = await readContract(getWagmiConfig(), {
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

/**
 * Submit a cleanup. hasImpactForm and impactReportHash are passed as false/'' for compatibility.
 */
export async function submitCleanup(
  beforePhotoHash: string,
  afterPhotoHash: string,
  latitude: number,
  longitude: number,
  referrerAddress: Address | null,
  value?: bigint, // Optional fee value
  providedChainId?: number | null, // Optional chainId from useChainId hook to avoid detection issues
  sendTransaction?: (params: {
    address: Address
    abi: typeof VERIFICATION_ABI
    functionName: 'submitCleanup'
    args: readonly unknown[]
    value: bigint
  }) => Promise<`0x${string}`> // Optional transaction sender (for Builder Code support)
): Promise<{ cleanupId: bigint; transactionHash: `0x${string}` }> {
  // CRITICAL: Ensure wallet is connected FIRST - before ANY other logic
  // This prevents WalletConnect QR hang bug by ensuring connector is bound before chain switching
  // Lock the wallet address to ensure we use the same address throughout the transaction
  const lockedWalletAddress = await ensureWalletConnected()
  
  // Double-check account after connection guard and verify address matches
  const account = getAccount(getWagmiConfig())
  if (account.status !== 'connected' || !account.address) {
    throw new Error('Wallet connection lost. Please reconnect and try again.')
  }
  
  // Verify the connected address matches the locked address
  // This prevents issues if user switches wallets during transaction
  if (account.address.toLowerCase() !== lockedWalletAddress.toLowerCase()) {
    throw new Error(
      'Wallet address changed during transaction. Please reconnect with the correct wallet and try again.'
    )
  }
  
  // Check gas balance before proceeding
  await checkGasBalance(lockedWalletAddress)
  
  // Pre-flight validation
  const validation = await validatePreFlight({
    checkWallet: true,
    checkChain: true,
    checkRewardBalance: false, // Don't check balance for submission
  })
  
  if (!validation.valid) {
    const errorMessage = validation.errors.join('\n')
    await logTransactionError('submitCleanup', new Error(errorMessage), { validation })
    throw new Error(`Pre-flight validation failed:\n${errorMessage}`)
  }
  
  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn('[submitCleanup] Validation warnings:', validation.warnings)
  }
  
  // Log transaction attempt
  await logTransactionAttempt('submitCleanup', {
    referrerAddress: referrerAddress || null,
    latitude,
    longitude,
  })
  
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

  // Verify chain before submission - this is critical for transaction success
  try {
    await ensureWalletOnRequiredChain('cleanup submission', providedChainId)
  } catch (chainError: any) {
    // If chain check fails, throw error to prevent transaction on wrong chain
    // This ensures user gets clear feedback before attempting transaction
    throw new Error(
      `Network Error: ${chainError?.message || `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet before submitting.`}`
    )
  }

  // Scale coordinates by 1e6 and offset to handle negative values
  // Contract uses uint256, so we need to offset negative coordinates
  // Longitude: -180 to 180 -> offset by 180 * 1e6 (so -180 becomes 0, 180 becomes 360*1e6)
  // Latitude: -90 to 90 -> offset by 90 * 1e6 (so -90 becomes 0, 90 becomes 180*1e6)
  const LONGITUDE_OFFSET = 180 * 1e6
  const LATITUDE_OFFSET = 90 * 1e6
  
  const latScaled = BigInt(Math.floor(latitude * 1e6) + LATITUDE_OFFSET)
  const lngScaled = BigInt(Math.floor(longitude * 1e6) + LONGITUDE_OFFSET)

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
    const { result } = await simulateContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'submitCleanup',
      args: [
        beforePhotoHash,
        afterPhotoHash,
        latScaled,
        lngScaled,
        referrerAddress || '0x0000000000000000000000000000000000000000',
        false, // hasImpactForm (unused)
        '', // impactReportHash (unused)
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
  // Explicitly set chain object to ensure transaction is sent to the required chain (Base)
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

  // Safari/WalletConnect/Farcaster specific handling
  // Note: account is already checked at the top of the function
  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isWalletConnect = account.connector?.id?.includes('walletConnect') || 
                          account.connector?.name?.toLowerCase().includes('walletconnect')
  const isFarcaster = account.connector?.id?.includes('farcaster') || 
                      account.connector?.name?.toLowerCase().includes('farcaster') ||
                      account.connector?.name?.toLowerCase().includes('miniapp') ||
                      account.connector?.id?.toLowerCase().includes('miniapp')
  const isSafariWalletConnect = isSafari && isWalletConnect
  const isFarcasterWalletConnect = isFarcaster && isWalletConnect

  // For Safari/WalletConnect/Farcaster, add extra delay and verification before transaction
  if (isSafariWalletConnect || isFarcaster || isFarcasterWalletConnect) {
    const context = isFarcaster ? 'Farcaster' : isSafariWalletConnect ? 'Safari/WalletConnect' : 'WalletConnect'
    console.log(`[submitCleanup] ${context} detected, ensuring chain is ready...`)
    
    // Verify provider is ready
    try {
      const connector = account.connector as any
      const provider = await connector?.getProvider?.()
      if (!provider) {
        console.warn(`[submitCleanup] ${context}: Provider not ready, waiting...`)
        await new Promise(resolve => setTimeout(resolve, isFarcaster ? 2000 : 2000))
      } else {
        // For Farcaster, verify the provider is actually functional
        if (isFarcaster) {
          try {
            // Test provider by checking chain ID
            const testChainId = await provider.request({ method: 'eth_chainId' })
            console.log(`[submitCleanup] Farcaster provider test successful, chainId: ${testChainId}`)
          } catch (testError) {
            console.warn(`[submitCleanup] Farcaster provider test failed, waiting longer...`, testError)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
    } catch (providerError) {
      console.warn(`[submitCleanup] ${context}: Provider check failed:`, providerError)
    }
    
    // Add delay before transaction to ensure everything is ready
    // Farcaster needs longer delay due to iframe communication
    const delay = isFarcaster ? 1500 : 1000
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Double-check chain one more time
    const finalCheckChainId = await getCurrentChainId()
    if (finalCheckChainId !== null && finalCheckChainId !== REQUIRED_CHAIN_ID) {
      console.warn(`[submitCleanup] ${context}: Chain mismatch detected, attempting final switch...`)
      try {
        await switchChain(getWagmiConfig(), { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
        // Farcaster needs longer wait after switch
        await new Promise(resolve => setTimeout(resolve, isFarcaster ? 3000 : 2000))
      } catch (switchError) {
        console.warn(`[submitCleanup] ${context}: Final chain switch failed:`, switchError)
        throw new Error(
          `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet app before submitting. ` +
          `Current chain: ${finalCheckChainId}, Required: ${REQUIRED_CHAIN_ID}`
        )
      }
    }
  }

  // Account is already verified at the top of the function
  let hash: `0x${string}`
  try {
    console.log('[submitCleanup] Sending transaction...', {
      isSafari,
      isWalletConnect,
      isFarcaster,
      isSafariWalletConnect,
      isFarcasterWalletConnect,
      chainId: await getCurrentChainId(),
      address: CONTRACT_ADDRESSES.VERIFICATION,
      connector: account.connector?.name || account.connector?.id,
      accountStatus: account.status,
    })

    // Use custom transaction sender if provided (for Builder Code attribution)
    // Otherwise, use standard writeContract
    if (sendTransaction) {
      hash = await sendTransaction({
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'submitCleanup',
        args: [
          beforePhotoHash,
          afterPhotoHash,
          latScaled,
          lngScaled,
          referrerAddress || '0x0000000000000000000000000000000000000000',
          false, // hasImpactForm (unused)
          '', // impactReportHash (unused)
        ],
        value: value || BigInt(0),
      })
    } else {
      // Standard transaction without Builder Code attribution
      hash = await writeContract(getWagmiConfig() as any, {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'submitCleanup',
        args: [
          beforePhotoHash,
          afterPhotoHash,
          latScaled,
          lngScaled,
          referrerAddress || '0x0000000000000000000000000000000000000000',
          false, // hasImpactForm (unused)
          '', // impactReportHash (unused)
        ],
        value: value || BigInt(0), // Include fee if provided
        chain: targetChain,
      })
    }

    console.log('[submitCleanup] Transaction sent, hash:', hash)
    await logTransactionSuccess('submitCleanup', hash, { cleanupId: simulatedCleanupId?.toString() })
  } catch (error: any) {
    console.error('[submitCleanup] Transaction failed:', error)
    await logTransactionError('submitCleanup', error, { 
      beforePhotoHash,
      afterPhotoHash,
      latitude,
      longitude,
    })
    
    // Check for WalletConnect stale session error
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    
    // For Safari/WalletConnect/Farcaster, provide more helpful error messages
    if (isSafariWalletConnect || isFarcaster || isFarcasterWalletConnect) {
      const errorMessage = getErrorMessage(error)
      const context = isFarcaster ? 'Farcaster' : 'Safari/WalletConnect'
      
      if (errorMessage.includes('User rejected') || error?.code === 4001) {
        throw new Error(
          `Transaction was rejected in ${context}. ` +
          `Please check your wallet app and approve the transaction. ` +
          `Make sure you're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).`
        )
      }
      if (errorMessage.includes('network') || errorMessage.includes('chain')) {
        throw new Error(
          `Network issue detected in ${context}. ` +
          `Please ensure you're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet app and try again.`
        )
      }
      // Farcaster-specific: Check for iframe communication errors
      if (isFarcaster && (errorMessage.includes('timeout') || errorMessage.includes('failed to fetch'))) {
        throw new Error(
          `Farcaster wallet communication timeout. ` +
          `Please try again - the transaction may have been submitted. ` +
          `Check your wallet app or transaction history.`
        )
      }
    }
    
    throw error // Re-throw if not a stale session error
  }

  // Wait for transaction receipt with timeout
  let receipt
  try {
    receipt = await withTimeout(
      waitForTransactionReceipt(getWagmiConfig(), { hash }),
      120000, // 2 minutes timeout
      'Transaction receipt timeout - transaction may still be pending. Please check the block explorer.'
    )
  console.log('Transaction confirmed in block:', receipt.blockNumber)
  } catch (timeoutError) {
    if (timeoutError instanceof TimeoutError) {
      throw new Error(
        `Transaction submitted but receipt timeout. ` +
        `Transaction hash: ${hash}. ` +
        `Please check the block explorer: ${getTxExplorerUrl(hash)}`
      )
    }
    throw timeoutError
  }
  
  // Get cleanup ID from counter (counter - 1, since counter increments after submission)
  let cleanupId: bigint
  try {
    // Wait a bit for the state to update
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const cleanupCounter = await readContract(getWagmiConfig(), {
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
    
    return { cleanupId, transactionHash: hash }
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('Error getting cleanup ID:', errorMessage)
    
    // If we have a simulated ID, use it as fallback
    if (simulatedCleanupId && simulatedCleanupId >= BigInt(1)) {
      console.warn('Using simulated cleanup ID as fallback:', simulatedCleanupId.toString())
      return { cleanupId: simulatedCleanupId, transactionHash: hash }
    }
    
    // Last resort: try to get counter one more time with longer wait
    try {
      console.log('Retrying cleanup counter check after 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      const finalCounter = await readContract(getWagmiConfig(), {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'cleanupCounter',
      })
      const fallbackId = finalCounter - BigInt(1)
      if (fallbackId >= BigInt(1)) {
        console.log('Got cleanup ID on retry:', fallbackId.toString())
        // Note: hash should be available from the outer scope where transaction was sent
        if (hash) {
          return { cleanupId: fallbackId, transactionHash: hash }
        }
        // If hash is not available (shouldn't happen), throw error
        throw new Error('Transaction hash not available for fallback cleanup ID')
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
  providedChainId?: number | null,
  sendTransaction?: (params: {
    address: Address
    abi: typeof VERIFICATION_ABI
    functionName: 'claimImpactProduct'
    args: readonly unknown[]
    value: bigint
  }) => Promise<`0x${string}`> // Optional transaction sender (for Builder Code support)
): Promise<`0x${string}`> {
  // CRITICAL: Ensure wallet is connected FIRST - before ANY other logic
  // This prevents WalletConnect QR hang bug by ensuring connector is bound before chain switching
  await ensureWalletConnected()
  
  // Double-check account after connection guard
  const account = getAccount(getWagmiConfig())
  if (account.status !== 'connected' || !account.address) {
    throw new Error('Wallet connection lost. Please reconnect and try again.')
  }
  
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  // Pre-flight validation (NO token balance check - we're only awarding DCU points, not tokens)
  // Users earn DCU points first, then claim tokens separately after reaching minimum level (3)
  const validation = await validatePreFlight({
    checkWallet: true,
    checkChain: true,
    checkRewardBalance: false, // No token balance check - only awarding points
    rewardType: 'level',
  })
  
  if (!validation.valid) {
    const errorMessage = validation.errors.join('\n')
    await logTransactionError('claimImpactProduct', new Error(errorMessage), { cleanupId: cleanupId.toString(), validation })
    throw new Error(`Pre-flight validation failed:\n${errorMessage}`)
  }
  
  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn('[claimImpactProduct] Validation warnings:', validation.warnings)
  }
  
  // Log transaction attempt
  await logTransactionAttempt('claimImpactProduct', { cleanupId: cleanupId.toString() })

  // Note: Chain switching is handled by wallet - user should ensure they're on the required chain (Base)
  try {
    await ensureWalletOnRequiredChain('claim impact product', providedChainId)
  } catch (chainError: any) {
    console.warn('Chain check warning:', chainError?.message)
  }

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

  // Farcaster-specific handling for claim transactions
  // Note: account is already checked at the top of the function
  const isFarcaster = account.connector?.id?.includes('farcaster') || 
                      account.connector?.name?.toLowerCase().includes('farcaster') ||
                      account.connector?.name?.toLowerCase().includes('miniapp') ||
                      account.connector?.id?.toLowerCase().includes('miniapp')
  
  if (isFarcaster) {
    console.log('[claimImpactProduct] Farcaster detected, ensuring provider is ready...')
    try {
      const connector = account.connector as any
      const provider = await connector?.getProvider?.()
      if (provider) {
        // Test provider functionality
        try {
          await provider.request({ method: 'eth_chainId' })
          console.log('[claimImpactProduct] Farcaster provider ready')
        } catch (testError) {
          console.warn('[claimImpactProduct] Farcaster provider test failed, waiting...', testError)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      // Add delay for Farcaster iframe communication
      await new Promise(resolve => setTimeout(resolve, 1500))
    } catch (providerError) {
      console.warn('[claimImpactProduct] Farcaster provider check failed:', providerError)
    }
  }

  // Account is already verified at the top of the function
  try {
    console.log('[claimImpactProduct] Account status:', account.status, 'Connector:', account.connector?.name || account.connector?.id)
    
    // Use custom transaction sender if provided (for Builder Code attribution)
    // Otherwise, use standard writeContract
    let hash: `0x${string}`
    if (sendTransaction) {
      hash = await sendTransaction({
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'claimImpactProduct',
        args: [cleanupId],
        value: claimFeeValue,
      })
    } else {
      hash = await writeContract(getWagmiConfig() as any, {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'claimImpactProduct',
        args: [cleanupId],
        value: claimFeeValue,
        chain: targetChain,
      })
    }

    await logTransactionSuccess('claimImpactProduct', hash, { cleanupId: cleanupId.toString() })
    return hash
  } catch (error: any) {
    await logTransactionError('claimImpactProduct', error, { cleanupId: cleanupId.toString() })
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
    
    // Farcaster-specific error handling
    if (isFarcaster) {
      if (errorMessage.includes('timeout') || errorMessage.includes('failed to fetch')) {
        throw new Error(
          `Farcaster wallet communication timeout. ` +
          `Please try again - the transaction may have been submitted. ` +
          `Check your wallet app or transaction history.`
        )
      }
      if (errorMessage.includes('User rejected') || error?.code === 4001) {
        throw new Error(
          `Transaction was rejected in Farcaster. ` +
          `Please check your wallet app and approve the transaction. ` +
          `Make sure you're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).`
        )
      }
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
/**
 * Fetch cleanup details from chain. hasImpactForm and impactReportHash are returned but unused.
 */
export async function getCleanupDetails(cleanupId: bigint): Promise<{
  user: `0x${string}`
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: number
  longitude: number
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
  referrer: `0x${string}`
  /** @deprecated Unused. */
  hasImpactForm: boolean
  /** @deprecated Unused. */
  impactReportHash: string
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  // Use retry logic for RPC calls to handle network issues.
  // Use required chain RPC via viem PublicClient for correct endpoint (Base mainnet or Base Sepolia).
  const requiredChain = getRequiredChain()
  if (!requiredChain) {
    throw new Error('Required chain not found in wagmi config')
  }

  let result: unknown
  try {
    result = await retryWithTimeout(
      async () => {
        const publicClient = createPublicClient({
          chain: requiredChain,
          transport: http(REQUIRED_RPC_URL),
        })
        return await publicClient.readContract({
          address: CONTRACT_ADDRESSES.VERIFICATION,
          abi: VERIFICATION_ABI,
          functionName: 'getCleanup',
          args: [cleanupId],
        })
      },
      {
        maxRetries: 2,
        timeoutMs: 10000, // 10 second timeout
        initialDelayMs: 1000,
        onRetry: (attempt, error) => {
          console.warn(`[getCleanupDetails] Retry attempt ${attempt} after RPC error:`, error?.message)
        },
        shouldRetry: (e) => !/429|rate limit|Too Many Requests/i.test(String(e?.message ?? e)),
      }
    )
  } catch (e) {
    if (/429|rate limit|Too Many Requests/i.test(String((e as Error)?.message ?? e))) {
      throw new Error('RPC rate limited (429). Set NEXT_PUBLIC_RPC_URL to a dedicated RPC (e.g. Alchemy, Infura) for production.')
    }
    throw e
  }

  if (Array.isArray(result)) {
    return {
      user: result[0] as `0x${string}`,
      beforePhotoHash: result[1] as string,
      afterPhotoHash: result[2] as string,
      timestamp: result[3] as bigint,
      // Convert back from offset coordinates
      // Longitude: subtract 180 * 1e6, Latitude: subtract 90 * 1e6
      latitude: (Number(result[4] as bigint) - 90 * 1e6) / 1e6,
      longitude: (Number(result[5] as bigint) - 180 * 1e6) / 1e6,
      verified: result[6] as boolean,
      claimed: result[7] as boolean,
      rejected: result[8] as boolean,
      level: Number(result[9]),
      referrer: result[10] as `0x${string}`,
      hasImpactForm: result[11] as boolean,
      impactReportHash: result[12] as string,
    }
  }

  const fallback = result as unknown as {
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
  
  return {
    ...fallback,
    // Convert back from offset coordinates
    latitude: (Number(fallback.latitude) - 90 * 1e6) / 1e6,
    longitude: (Number(fallback.longitude) - 180 * 1e6) / 1e6,
  }
}

/**
 * Get cleanup counter (total number of cleanups)
 */
export async function getCleanupCounter(): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  try {
    // Use retry logic for RPC calls to handle network issues.
    // Use required chain RPC via viem PublicClient (Base mainnet or Base Sepolia).
    const requiredChain = getRequiredChain()
    if (!requiredChain) {
      throw new Error('Required chain not found in wagmi config')
    }
    
    return await retryWithTimeout(
      async () => {
        const publicClient = createPublicClient({
          chain: requiredChain,
          transport: http(REQUIRED_RPC_URL),
        })
        return await publicClient.readContract({
          address: CONTRACT_ADDRESSES.VERIFICATION,
          abi: VERIFICATION_ABI,
          functionName: 'cleanupCounter',
        })
      },
      {
        maxRetries: 2,
        timeoutMs: 10000, // 10 second timeout
        initialDelayMs: 1000,
        onRetry: (attempt, error) => {
          console.warn(`[getCleanupCounter] Retry attempt ${attempt} after RPC error:`, error?.message)
        },
        shouldRetry: (e) => !/429|rate limit|Too Many Requests/i.test(String(e?.message ?? e)),
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (/429|rate limit|Too Many Requests/i.test(errorMessage)) {
      throw new Error('RPC rate limited (429). Set NEXT_PUBLIC_RPC_URL to a dedicated RPC (e.g. Alchemy, Infura) for production.')
    }
    const isRpcError = errorMessage.includes('Failed to fetch') || 
                      errorMessage.includes('HTTP request failed') ||
                      errorMessage.includes('network') ||
                      errorMessage.includes('timeout')
    if (isRpcError) {
      console.error('[getCleanupCounter] RPC error:', errorMessage)
      throw new Error('Network error: Unable to connect to blockchain. Please check your internet connection and try again.')
    }
    throw error
  }
}

/**
 * Check if an address is a verifier
 * @deprecated Use isUserVerifier() instead - this function now calls the new PointsRewardDistributor contract
 */
export async function isVerifier(address: Address): Promise<boolean> {
  if (!address) {
    return false
  }

  // Use the new PointsRewardDistributor contract for verifier status
  // This maintains backward compatibility while using the new system
  try {
    return await isUserVerifier(address)
  } catch (error) {
    console.error('Error checking verifier status (via isUserVerifier):', error)
    return false
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

  return await readContract(getWagmiConfig(), {
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
  providedChainId?: number | null,
  sendTransaction?: (params: {
    address: Address
    abi: typeof VERIFICATION_ABI
    functionName: 'verifyCleanup'
    args: readonly unknown[]
    value?: bigint
  }) => Promise<`0x${string}`> // Optional transaction sender (for Builder Code support)
): Promise<`0x${string}`> {
  // CRITICAL: Ensure wallet is connected FIRST - before ANY other logic
  // This prevents WalletConnect QR hang bug by ensuring connector is bound before chain switching
  // Lock the wallet address to ensure we use the same address throughout the transaction
  const lockedWalletAddress = await ensureWalletConnected()
  
  // Double-check account after connection guard and verify address matches
  const account = getAccount(getWagmiConfig())
  if (account.status !== 'connected' || !account.address) {
    throw new Error('Wallet connection lost. Please reconnect and try again.')
  }
  
  // Verify the connected address matches the locked address
  // This prevents issues if user switches wallets during transaction
  if (account.address.toLowerCase() !== lockedWalletAddress.toLowerCase()) {
    throw new Error(
      'Wallet address changed during transaction. Please reconnect with the correct wallet and try again.'
    )
  }
  
  // Check gas balance before proceeding
  await checkGasBalance(lockedWalletAddress)
  
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

  // Account is already verified at the top of the function
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
    console.log(`[verification] Account status:`, account.status, `Connector:`, account.connector?.name || account.connector?.id)

    // Use custom transaction sender if provided (for Builder Code attribution)
    // Otherwise, use standard writeContract
    let hash: `0x${string}`
    if (sendTransaction) {
      hash = await sendTransaction({
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'verifyCleanup',
        args: [cleanupId, level],
        value: undefined,
      })
    } else {
      hash = await writeContract(getWagmiConfig() as any, {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'verifyCleanup',
        args: [cleanupId, level],
        chain: targetChain, // Pass chain object explicitly instead of just chainId
        // Don't specify blockNumber to avoid "block is out of range" errors
      })
    }

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
  providedChainId?: number | null,
  sendTransaction?: (params: {
    address: Address
    abi: typeof VERIFICATION_ABI
    functionName: 'rejectCleanup'
    args: readonly unknown[]
    value?: bigint
  }) => Promise<`0x${string}`> // Optional transaction sender (for Builder Code support)
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  // CRITICAL: Ensure wallet is connected FIRST - before ANY other logic
  // Lock the wallet address to ensure we use the same address throughout the transaction
  const lockedWalletAddress = await ensureWalletConnected()
  
  // Double-check account after connection guard and verify address matches
  const account = getAccount(getWagmiConfig())
  if (account.status !== 'connected' || !account.address) {
    throw new Error('Wallet connection lost. Please reconnect and try again.')
  }
  
  // Verify the connected address matches the locked address
  // This prevents issues if user switches wallets during transaction
  if (account.address.toLowerCase() !== lockedWalletAddress.toLowerCase()) {
    throw new Error(
      'Wallet address changed during transaction. Please reconnect with the correct wallet and try again.'
    )
  }
  
  // Check gas balance before proceeding
  await checkGasBalance(lockedWalletAddress)

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

    // Use custom transaction sender if provided (for Builder Code attribution)
    // Otherwise, use standard writeContract
    let hash: `0x${string}`
    if (sendTransaction) {
      hash = await sendTransaction({
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'rejectCleanup',
        args: [cleanupId],
        value: undefined,
      })
    } else {
      hash = await writeContract(getWagmiConfig() as any, {
        address: CONTRACT_ADDRESSES.VERIFICATION,
        abi: VERIFICATION_ABI,
        functionName: 'rejectCleanup',
        args: [cleanupId],
        chain: targetChain, // Pass chain object explicitly instead of just chainId
      })
    }

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
// Streak tracking is in PointsRewardDistributor

/**
 * Get user's streak count
 * @param userAddress User address
 * @returns Current streak count (in weeks)
 */
export async function getStreakCount(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) return 0
  try {
    const count = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'getStreakCount',
      args: [userAddress],
    })
    return Number(count)
  } catch (error: any) {
    console.error('Error getting streak count:', error)
    return 0
  }
}

/**
 * Check if user has active streak
 * @param userAddress User address
 * @returns True if user has an active streak (last cleanup within 7 days)
 */
export async function hasActiveStreak(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) return false
  try {
    const hasStreak = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'hasActiveStreak',
      args: [userAddress],
    })
    return Boolean(hasStreak)
  } catch (error: any) {
    console.error('Error checking active streak:', error)
    return false
  }
}

/**
 * Check if user has already received a referral reward
 * Returns true if user already received referral reward (cannot use referral link again)
 */
export async function hasReceivedReferralReward(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) return false
  try {
    const hasReceived = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'hasReceivedReferralReward',
      args: [userAddress],
    })
    return Boolean(hasReceived)
  } catch (error: any) {
    console.error('Error checking referral reward status:', error)
    return false
  }
}

/**
 * Check if user has already submitted a cleanup
 * Returns true if user already submitted (cannot use referral link again)
 */
export async function hasSubmittedCleanup(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    return false
  }

  try {
    const hasSubmitted = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'hasSubmittedCleanup',
      args: [userAddress],
    })

    return Boolean(hasSubmitted)
  } catch (error: any) {
    console.error('Error checking cleanup submission status:', error)
    return false
  }
}

/**
 * Check if user is eligible for referral reward
 * Returns { eligible: boolean, reason?: string }
 */
export async function checkReferralEligibility(userAddress: Address): Promise<{ eligible: boolean; reason?: string }> {
  try {
    // Check if user already received referral reward
    const hasReceived = await hasReceivedReferralReward(userAddress)
    if (hasReceived) {
      return {
        eligible: false,
        reason: 'You have already received a referral reward. Each user can only receive referral rewards once.',
      }
    }

    // Check if user already submitted a cleanup
    const hasSubmitted = await hasSubmittedCleanup(userAddress)
    if (hasSubmitted) {
      return {
        eligible: false,
        reason: 'You have already submitted a cleanup. Referral rewards are only available for first-time users.',
      }
    }

    return { eligible: true }
  } catch (error: any) {
    console.error('Error checking referral eligibility:', error)
    // On error, allow referral (contract will reject if ineligible)
    return { eligible: true }
  }
}

/**
 * Get verifier's $bDCU token equivalent from PointsRewardDistributor.
 * Sums verifier PointsAwarded events, converts to bDCU via calculateClaimAmount.
 */
export async function getVerifierTokenEarnings(verifierAddress: Address): Promise<string> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) return '0'
  try {
    const breakdown = await getRewardsBreakdown(verifierAddress)
    if (breakdown.verifierRewards <= 0) return '0'
    const amt = await calculateClaimAmount(breakdown.verifierRewards)
    return formatUnits(amt, 18)
  } catch (error: any) {
    console.error('Error fetching verifier token earnings:', error)
    return '0'
  }
}

/**
 * Get total rewards distributed to a user
 * Tries new points system first, falls back to old token system
 * @param userAddress User's wallet address
 * @returns Total rewards distributed (DCU points from new system, or $bDCU tokens from old system)
 */
export async function getTotalRewardsDistributed(userAddress: Address): Promise<number> {
  // Try new points system first
  if (CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    try {
      const pointsBalance = await readContract(getWagmiConfig(), {
        address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
        abi: POINTS_REWARD_DISTRIBUTOR_ABI,
        functionName: 'pointsBalance',
        args: [userAddress],
      })
      
      const points = Number(pointsBalance)
      const pointsClaimed = await readContract(getWagmiConfig(), {
        address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
        abi: POINTS_REWARD_DISTRIBUTOR_ABI,
        functionName: 'pointsClaimed',
        args: [userAddress],
      })
      
      const totalPoints = points + Number(pointsClaimed)
      console.log(`Total DCU points distributed to ${userAddress}: ${totalPoints} DCU points (${points} available, ${Number(pointsClaimed)} claimed)`)
      return totalPoints
    } catch (error: any) {
      console.warn('Error reading from PointsRewardDistributor, falling back to old system:', error?.message)
      // Fall through to old system
    }
  }

  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    console.warn('getTotalRewardsDistributed: POINTS_REWARD_DISTRIBUTOR address not set')
    return 0
  }
  return 0
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
  verifierRewards: number
  retroRewards: number
  total: number
}> {
  // Try new points system first
  if (CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia, base } = await import('viem/chains')
      
      const chain = REQUIRED_CHAIN_ID === 84532 ? baseSepolia : base
      const publicClient = createPublicClient({
        chain,
        transport: http(REQUIRED_RPC_URL),
      })

      const distributorAddress = CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR
      
      // Query PointsAwarded events (skip on RPC 400/401 - e.g. invalid or truncated Alchemy key)
      let fromBlock = BigInt(0)
      try {
        const currentBlock = await publicClient.getBlockNumber()
        const blockRange = BigInt(50000)
        fromBlock = currentBlock > blockRange ? currentBlock - blockRange : BigInt(0)
      } catch (blockError: unknown) {
        const msg = String((blockError as Error)?.message ?? blockError)
        if (/400|401|429|rate limit|Unauthorized|Bad Request/i.test(msg)) {
          return { levelRewards: 0, cleanupCount: 0, streakRewards: 0, referralRewards: 0, impactFormRewards: 0, verifierRewards: 0, retroRewards: 0, total: 0 }
        }
        console.warn('Could not get current block number:', blockError)
      }

      let pointsLogs: { args: { points?: bigint; rewardType?: string } }[] = []
      try {
        pointsLogs = await publicClient.getLogs({
          address: distributorAddress,
          event: parseAbiItem('event PointsAwarded(address indexed user, uint256 points, string rewardType)'),
          args: { user: userAddress },
          fromBlock,
        }) as { args: { points?: bigint; rewardType?: string } }[]
      } catch (logsError: unknown) {
        const msg = String((logsError as Error)?.message ?? logsError)
        if (/400|401|429|rate limit|Unauthorized|Bad Request/i.test(msg)) {
          return { levelRewards: 0, cleanupCount: 0, streakRewards: 0, referralRewards: 0, impactFormRewards: 0, verifierRewards: 0, retroRewards: 0, total: 0 }
        }
        console.warn('Could not get points logs:', logsError)
      }

      // Group by reward type
      let levelRewards = 0
      let cleanupCount = 0
      let streakRewards = 0
      let referralRewards = 0
      let impactFormRewards = 0
      let verifierRewards = 0
      let retroRewards = 0 // Manual awards / retro rewards

      for (const log of pointsLogs) {
        const points = Number(log.args.points || 0)
        const rewardType = log.args.rewardType || ''

        if (rewardType === 'level') {
          levelRewards += points
          cleanupCount++ // Each level reward = 1 cleanup
        } else if (rewardType === 'streak') {
          streakRewards += points
        } else if (rewardType === 'referral') {
          referralRewards += points
        } else if (rewardType === 'impact_form') {
          impactFormRewards += points
        } else if (rewardType === 'verifier') {
          verifierRewards += points
        } else if (rewardType === 'manual' || rewardType === 'retro_rewards' || rewardType === 'retro') {
          retroRewards += points
        }
      }

      const total = levelRewards + streakRewards + referralRewards + impactFormRewards + verifierRewards + retroRewards

      return {
        levelRewards,
        cleanupCount,
        streakRewards,
        referralRewards,
        impactFormRewards,
        verifierRewards,
        retroRewards,
        total,
      }
    } catch (error) {
      console.warn('Error querying points system:', error)
    }
  }

  return { levelRewards: 0, cleanupCount: 0, streakRewards: 0, referralRewards: 0, impactFormRewards: 0, verifierRewards: 0, retroRewards: 0, total: 0 }
}


/**
 * Check if VerificationContract.rewardDistributor is set to PointsRewardDistributor
 */
export async function checkVerificationContractLinked(): Promise<{ linked: boolean; verificationContractAddress: Address | null }> {
  if (!CONTRACT_ADDRESSES.VERIFICATION || !CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return { linked: false, verificationContractAddress: null }
  }
  try {
    const rd = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'rewardDistributor',
    }) as Address
    const isLinked = rd !== '0x0000000000000000000000000000000000000000' &&
      rd.toLowerCase() === CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR.toLowerCase()
    return { linked: isLinked, verificationContractAddress: CONTRACT_ADDRESSES.VERIFICATION }
  } catch (error) {
    console.error('Error checking VerificationContract link:', error)
    return { linked: false, verificationContractAddress: null }
  }
}

/**
 * Check if PointsRewardDistributor has bDCU tokens (is funded).
 * Tokens are sent from multisig to this contract.
 */
export async function checkRewardDistributorFunded(): Promise<{ funded: boolean; balance: string }> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return { funded: false, balance: '0' }
  }
  try {
    const balance = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'getContractBalance',
    }) as bigint
    const formattedBalance = formatUnits(balance, 18)
    return { funded: balance > BigInt(0), balance: formattedBalance }
  } catch (error) {
    console.error('Error checking reward distributor funding:', error)
    return { funded: false, balance: '0' }
  }
}

// Points Reward Distributor ABI (new points-based system)
export const POINTS_REWARD_DISTRIBUTOR_ABI = parseAbi([
  'function bDCUToken() external view returns (address)',
  'function getContractBalance() external view returns (uint256)',
  'function getPointsBalance(address user) external view returns (uint256)',
  'function getPointsClaimed(address user) external view returns (uint256)',
  'function pointsBalance(address user) external view returns (uint256)',
  'function pointsClaimed(address user) external view returns (uint256)',
  'function claimTokens(uint256 pointsToClaim) external returns (uint256)',
  'function calculateClaimAmount(uint256 points) external view returns (uint256)',
  'function stakeTokens(uint256 amount) external',
  'function unstakeTokens(uint256 amount) external',
  'function stakedBalance(address user) external view returns (uint256)',
  'function isVerifier(address user) external view returns (bool)',
  'function getMinimumLevelForStaking() external pure returns (uint256)',
  'function hasMinimumLevel(address user) external view returns (bool)',
  'function currentTokenPriceUSD() external view returns (uint256)',
  'function targetRewardValueUSD() external view returns (uint256)',
  'function getStreakCount(address user) external view returns (uint256)',
  'function hasActiveStreak(address user) external view returns (bool)',
  'function hasReceivedReferralReward(address user) external view returns (bool)',
  'function impactProductNFT() external view returns (address)',
  'function verificationContract() external view returns (address)',
  'event PointsAwarded(address indexed user, uint256 points, string rewardType)',
  'event TokensClaimed(address indexed user, uint256 pointsUsed, uint256 tokensReceived)',
  'event TokensStaked(address indexed user, uint256 amount)',
  'event TokensUnstaked(address indexed user, uint256 amount)',
  'event VerifierStatusChanged(address indexed user, bool isVerifier)',
])

/**
 * Get user's DCU points balance
 * @param userAddress User's wallet address
 * @returns Points balance
 */
export async function getDCUPointsBalance(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    console.warn('PointsRewardDistributor address not set, falling back to getPointsBalance (Points or localStorage)')
    return getPointsBalance(userAddress)
  }

  try {
    const points = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'getPointsBalance',
      args: [userAddress],
    }) as bigint

    return Number(points)
  } catch (error) {
    console.error('Error reading points balance:', error)
    return 0
  }
}

/**
 * Calculate how many tokens a user would receive for claiming points
 * @param points Number of points to claim
 * @returns Amount of tokens that would be received (in wei, 18 decimals)
 */
export async function calculateClaimAmount(points: number): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    throw new Error('PointsRewardDistributor address not set')
  }

  try {
    const tokens = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'calculateClaimAmount',
      args: [BigInt(points)],
    }) as bigint

    return tokens
  } catch (error) {
    console.error('Error calculating claim amount:', error)
    throw error
  }
}

/**
 * Claim tokens using points
 * @param pointsToClaim Number of points to use for claiming
 * @param chainId Current chain ID
 * @returns Transaction hash
 */
export async function claimTokensFromPoints(
  pointsToClaim: number,
  chainId: number
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    throw new Error('PointsRewardDistributor address not set')
  }

  const account = getAccount(getWagmiConfig())
  if (!account.isConnected || !account.address) {
    throw new Error('Wallet not connected')
  }

  await ensureWalletOnRequiredChain('transaction', chainId)

  const lockedWalletAddress = await ensureWalletConnected()
  if (account.address.toLowerCase() !== lockedWalletAddress.toLowerCase()) {
    throw new Error('Wallet address changed during transaction')
  }

  // Calculate how many tokens will be claimed to validate balance
  try {
    const tokensToReceive = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'calculateClaimAmount',
      args: [BigInt(pointsToClaim)],
    }) as bigint

    // Validate token balance before claiming
    if (tokensToReceive > BigInt(0)) {
      const validation = await validatePreFlight({
        checkWallet: true,
        checkChain: true,
        checkRewardBalance: true,
        requiredRewardAmount: tokensToReceive,
        rewardType: 'level',
      })

      if (!validation.valid) {
        const errorMessage = validation.errors.join('\n')
        await logTransactionError('claimTokens', new Error(errorMessage), {
          pointsToClaim,
          tokensToReceive: tokensToReceive.toString(),
          userAddress: account.address,
        })
        throw new Error(`Pre-flight validation failed:\n${errorMessage}`)
      }

      if (validation.warnings.length > 0) {
        console.warn('[claimTokens] Validation warnings:', validation.warnings)
      }
    }
  } catch (error: any) {
    // If calculation fails, proceed anyway - contract will handle it
    console.warn('[claimTokens] Could not pre-validate balance:', error?.message)
  }

  // Check gas balance
  await checkGasBalance(account.address)

  try {
    // Get the chain object explicitly to ensure proper chain resolution
    const targetChain = getRequiredChain()
    if (!targetChain) {
      const errorMsg = `${REQUIRED_CHAIN_NAME} chain is not configured in this app. Please switch to ${REQUIRED_CHAIN_NAME} manually.\n\n${getNetworkSetupMessage()}`
      console.error('[claimTokens]', errorMsg)
      throw new Error(errorMsg)
    }

    console.log('[claimTokens] Calling writeContract with chain:', targetChain.id, targetChain.name)
    console.log('[claimTokens] Contract address:', CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR)
    console.log('[claimTokens] Function: claimTokens, args:', [pointsToClaim.toString()])
    console.log('[claimTokens] Account status:', account.status, 'Connector:', account.connector?.name || account.connector?.id)

    const hash = await writeContract(getWagmiConfig() as any, {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'claimTokens',
      args: [BigInt(pointsToClaim)],
      chain: targetChain, // Pass chain object explicitly instead of just chainId
    })

    console.log('[claimTokens] ✅ Transaction hash received:', hash)
    logTransactionSuccess('claimTokens', hash, {
      pointsToClaim,
      userAddress: account.address,
    })

    return hash
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    console.error('[claimTokens] Transaction failed:', errorMessage)

    // Check for chain mismatch errors
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

    logTransactionError('claimTokens', error, {
      pointsToClaim,
      userAddress: account.address,
    })
    throw error
  }
}

/**
 * Stake tokens to become a verifier
 * @param amount Amount of tokens to stake (in wei, 18 decimals)
 * @param chainId Current chain ID
 * @returns Transaction hash
 */
export async function stakeTokensForVerifier(
  amount: bigint,
  chainId: number
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    throw new Error('PointsRewardDistributor address not set')
  }

  const account = getAccount(getWagmiConfig())
  if (!account.isConnected || !account.address) {
    throw new Error('Wallet not connected')
  }

  await ensureWalletOnRequiredChain('transaction', chainId)

  const lockedWalletAddress = await ensureWalletConnected()
  if (account.address.toLowerCase() !== lockedWalletAddress.toLowerCase()) {
    throw new Error('Wallet address changed during transaction')
  }

  // Check gas balance
  await checkGasBalance(account.address)

  // Check if user has approved the contract
  const tokenAddress = await readContract(getWagmiConfig(), {
    address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
    abi: POINTS_REWARD_DISTRIBUTOR_ABI,
    functionName: 'bDCUToken',
  }) as Address

  // Check allowance
  const { parseAbiItem } = await import('viem')
  const allowance = await readContract(getWagmiConfig(), {
    address: tokenAddress,
    abi: [parseAbiItem('function allowance(address owner, address spender) external view returns (uint256)')],
    functionName: 'allowance',
    args: [account.address, CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR],
  }) as bigint

  if (allowance < amount) {
    // Need to approve first - approve max uint256 to avoid future approvals
    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const approveHash = await writeContract(getWagmiConfig(), {
      address: tokenAddress,
      abi: [parseAbiItem('function approve(address spender, uint256 amount) external returns (bool)')],
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR, MAX_UINT256],
      chainId: REQUIRED_CHAIN_ID,
    })

    await waitForTransactionReceipt(getWagmiConfig(), { hash: approveHash })
  }

  try {
    const hash = await writeContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'stakeTokens',
      args: [amount],
      chainId: REQUIRED_CHAIN_ID,
    })

    logTransactionSuccess('stakeTokens', hash, {
      amount: amount.toString(),
      userAddress: account.address,
    })

    return hash
  } catch (error: any) {
    logTransactionError('stakeTokens', error, {
      amount: amount.toString(),
      userAddress: account.address,
    })
    throw error
  }
}

/**
 * Unstake tokens
 * @param amount Amount of tokens to unstake (in wei, 18 decimals)
 * @param chainId Current chain ID
 * @returns Transaction hash
 */
export async function unstakeTokens(
  amount: bigint,
  chainId: number
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    throw new Error('PointsRewardDistributor address not set')
  }

  const account = getAccount(getWagmiConfig())
  if (!account.isConnected || !account.address) {
    throw new Error('Wallet not connected')
  }

  await ensureWalletOnRequiredChain('transaction', chainId)

  const lockedWalletAddress = await ensureWalletConnected()
  if (account.address.toLowerCase() !== lockedWalletAddress.toLowerCase()) {
    throw new Error('Wallet address changed during transaction')
  }

  // Check gas balance
  await checkGasBalance(account.address)

  try {
    const hash = await writeContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'unstakeTokens',
      args: [amount],
      chainId: REQUIRED_CHAIN_ID,
    })

    logTransactionSuccess('unstakeTokens', hash, {
      amount: amount.toString(),
      userAddress: account.address,
    })

    return hash
  } catch (error: any) {
    logTransactionError('unstakeTokens', error, {
      amount: amount.toString(),
      userAddress: account.address,
    })
    throw error
  }
}

/**
 * Get user's staked balance
 * @param userAddress User's wallet address
 * @returns Staked balance (in wei, 18 decimals)
 */
export async function getStakedBalance(userAddress: Address): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return BigInt(0)
  }

  try {
    const balance = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'stakedBalance',
      args: [userAddress],
    }) as bigint

    return balance
  } catch (error) {
    console.error('Error reading staked balance:', error)
    return BigInt(0)
  }
}

// In-memory cache for isUserVerifier to reduce RPC load (public Base RPC rate-limits heavily)
const isUserVerifierCache: { key: string; value: boolean; expiry: number }[] = []
const IS_USER_VERIFIER_CACHE_TTL_MS = 2 * 60 * 1000 // 2 min

/**
 * Check if user is a verifier.
 * Returns true if ANY of:
 * - PointsRewardDistributor.isVerifier (staking or manuallyAddedVerifiers), OR
 * - VerificationContract.isVerifier (allowlist; added via addVerifier by owner), OR
 * - VerificationContract.owner() (admin can verify/reject on-chain; app treats as verifier).
 * @param userAddress User's wallet address
 * @returns True if user is a verifier
 */
export async function isUserVerifier(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR && !CONTRACT_ADDRESSES.VERIFICATION) {
    return false
  }

  const cacheKey = `${userAddress.toLowerCase()}`
  const now = Date.now()
  const hit = isUserVerifierCache.find((e) => e.key === cacheKey && e.expiry > now)
  if (hit) return hit.value

  try {
    const requiredChain = getRequiredChain()
    if (!requiredChain) {
      console.warn('[isUserVerifier] Required chain not found, returning false')
      return false
    }

    const isVerifier = await retryWithTimeout(
      async () => {
        const publicClient = createPublicClient({
          chain: requiredChain,
          transport: http(REQUIRED_RPC_URL),
        })
        // PointsRewardDistributor: staking-based or manuallyAddedVerifiers
        let fromPRD = false
        if (CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
          fromPRD = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
            abi: POINTS_REWARD_DISTRIBUTOR_ABI,
            functionName: 'isVerifier',
            args: [userAddress],
          }) as boolean
        }
        if (fromPRD) return true
        // VerificationContract: allowlist (addVerifier by owner) or owner (admin can verify/reject on-chain)
        if (CONTRACT_ADDRESSES.VERIFICATION) {
          const fromVC = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.VERIFICATION,
            abi: VERIFICATION_ABI,
            functionName: 'isVerifier',
            args: [userAddress],
          }) as boolean
          if (fromVC) return true
          const owner = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.VERIFICATION,
            abi: VERIFICATION_ABI,
            functionName: 'owner',
          }) as Address
          if (owner && owner.toLowerCase() === userAddress.toLowerCase()) return true
        }
        return false
      },
      {
        maxRetries: 2,
        timeoutMs: 10000,
        initialDelayMs: 1000,
        onRetry: (attempt, error) => {
          console.warn(`[isUserVerifier] Retry attempt ${attempt} after RPC error:`, error?.message)
        },
        // Do not retry on 429 - avoids amplifying rate-limit load
        shouldRetry: (e) => !/429|rate limit|Too Many Requests/i.test(String(e?.message ?? e)),
      }
    )

    // Cache result
    const expired = isUserVerifierCache.filter((e) => e.expiry <= now)
    expired.forEach((e) => { const i = isUserVerifierCache.indexOf(e); if (i !== -1) isUserVerifierCache.splice(i, 1) })
    isUserVerifierCache.push({ key: cacheKey, value: isVerifier, expiry: now + IS_USER_VERIFIER_CACHE_TTL_MS })
    return isVerifier
  } catch (error) {
    // RPC failures - return false gracefully instead of breaking UI
    const errorMessage = error instanceof Error ? error.message : String(error)
    const fullError = String(error) + String((error as any)?.cause?.message || '')
    const is429 = errorMessage.includes('429') || errorMessage.includes('Too Many Requests') ||
                  fullError.includes('429') || fullError.includes('Too Many Requests')
    if (is429) {
      console.warn('[isUserVerifier] RPC rate limited (429), returning false. Set NEXT_PUBLIC_RPC_URL to a dedicated RPC (e.g. Alchemy, Infura) for production.')
      return false // Graceful: don't throw, don't retry
    }
    const isRpcError = errorMessage.includes('Failed to fetch') ||
                      errorMessage.includes('HTTP request failed') ||
                      errorMessage.includes('network') ||
                      errorMessage.includes('timeout')

    if (isRpcError) {
      console.warn('[isUserVerifier] RPC error, returning false (non-critical):', errorMessage)
      return false // Graceful degradation - UI won't break
    }

    console.error('[isUserVerifier] Error checking verifier status:', error)
    return false
  }
}

/**
 * Get minimum level required for staking/claiming
 * @returns Minimum level (3; was 10 before upgrade)
 */
export async function getMinimumLevelForStaking(): Promise<number> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return 10 // Default
  }

  try {
    const level = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'getMinimumLevelForStaking',
    }) as bigint

    return Number(level)
  } catch (error) {
    console.error('Error reading minimum level:', error)
    return 10 // Default
  }
}

/**
 * Check if user has minimum level to stake/claim
 * @param userAddress User's wallet address
 * @returns True if user has reached minimum level (3) for staking/claiming
 */
export async function hasMinimumLevelForStaking(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return false
  }

  try {
    const hasLevel = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'hasMinimumLevel',
      args: [userAddress],
    }) as boolean

    return hasLevel
  } catch (error) {
    console.error('Error checking minimum level:', error)
    return false
  }
}

/**
 * Get current token price in USD
 * @returns Token price (8 decimals, e.g., 785000 = $0.00000785)
 */
export async function getCurrentTokenPrice(): Promise<number> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return 0
  }

  try {
    const price = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'currentTokenPriceUSD',
    }) as bigint

    return Number(price)
  } catch (error) {
    console.error('Error reading token price:', error)
    return 0
  }
}

/**
 * Get target reward value in USD
 * @returns Target reward value (in cents, e.g., 50 = $0.50 for 10 points)
 */
export async function getTargetRewardValue(): Promise<number> {
  if (!CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR) {
    return 50 // Default
  }

  try {
    const value = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.POINTS_REWARD_DISTRIBUTOR,
      abi: POINTS_REWARD_DISTRIBUTOR_ABI,
      functionName: 'targetRewardValueUSD',
    }) as bigint

    return Number(value)
  } catch (error) {
    console.error('Error reading target reward value:', error)
    return 50 // Default
  }
}


