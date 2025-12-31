/**
 * Pre-flight Validation
 * 
 * Validates wallet state, chain, and contract balances before transactions.
 * Prevents silent failures by checking conditions upfront.
 */

import { Address, formatUnits } from 'viem'
import { readContract, getAccount } from 'wagmi/actions'
import { getWagmiConfig, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from './wagmi'
import { getCurrentChainIdCached, isOnRequiredChain } from './chain-detection'
import { CONTRACT_ADDRESSES } from './contracts'

// Reward Distributor ABI for balance checks
const REWARD_DISTRIBUTOR_ABI = [
  {
    inputs: [],
    name: 'bDCUToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ERC20_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate wallet connection
 */
export async function validateWalletConnection(): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const account = getAccount(getWagmiConfig())
    
    if (account.status !== 'connected') {
      errors.push('Wallet is not connected. Please connect your wallet first.')
      return { valid: false, errors, warnings }
    }

    if (!account.address) {
      errors.push('Wallet address not available. Please reconnect your wallet.')
      return { valid: false, errors, warnings }
    }

    // Check connector
    if (!account.connector) {
      warnings.push('Wallet connector not available. Some features may not work.')
    }

    return { valid: true, errors, warnings }
  } catch (error: any) {
    errors.push(`Wallet validation failed: ${error?.message || 'Unknown error'}`)
    return { valid: false, errors, warnings }
  }
}

/**
 * Validate chain
 */
export async function validateChain(forceRefresh = false): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const isOnChain = await isOnRequiredChain(forceRefresh)
    
    if (!isOnChain) {
      const currentChainId = await getCurrentChainIdCached(forceRefresh)
      errors.push(
        `Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n` +
        `Current network: ${currentChainId || 'unknown'}`
      )
      return { valid: false, errors, warnings }
    }

    return { valid: true, errors, warnings }
  } catch (error: any) {
    errors.push(`Chain validation failed: ${error?.message || 'Unknown error'}`)
    return { valid: false, errors, warnings }
  }
}

/**
 * Validate Reward Distributor balance
 * Checks if the Reward Distributor has sufficient balance for rewards
 */
export async function validateRewardDistributorBalance(
  requiredAmount: bigint,
  rewardType: 'level' | 'streak' | 'referral' | 'impact' | 'verifier' = 'level'
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    if (!CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR) {
      errors.push('Reward Distributor contract address not configured')
      return { valid: false, errors, warnings }
    }

    // Get token address from Reward Distributor
    const tokenAddress = await readContract(getWagmiConfig(), {
      address: CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'bDCUToken',
    }) as Address

    // Get balance of Reward Distributor
    const balance = await readContract(getWagmiConfig(), {
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [CONTRACT_ADDRESSES.BDCU_REWARD_DISTRIBUTOR],
    }) as bigint

    if (balance < requiredAmount) {
      const balanceFormatted = formatUnits(balance, 18)
      const requiredFormatted = formatUnits(requiredAmount, 18)
      errors.push(
        `Insufficient reward balance in Reward Distributor.\n` +
        `Required: ${requiredFormatted} $bDCU\n` +
        `Available: ${balanceFormatted} $bDCU\n` +
        `Please contact support to fund the Reward Distributor contract.`
      )
      return { valid: false, errors, warnings }
    }

    // Warn if balance is getting low (less than 10x required amount)
    if (balance < requiredAmount * BigInt(10)) {
      const balanceFormatted = formatUnits(balance, 18)
      warnings.push(
        `Reward Distributor balance is getting low: ${balanceFormatted} $bDCU. ` +
        `Consider funding the contract soon.`
      )
    }

    return { valid: true, errors, warnings }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error'
    // Don't fail validation on read errors - contract might handle it
    warnings.push(`Could not validate reward balance: ${errorMessage}. Proceeding anyway.`)
    return { valid: true, errors, warnings }
  }
}

/**
 * Comprehensive pre-flight validation
 */
export async function validatePreFlight(options: {
  checkWallet?: boolean
  checkChain?: boolean
  checkRewardBalance?: boolean
  requiredRewardAmount?: bigint
  rewardType?: 'level' | 'streak' | 'referral' | 'impact' | 'verifier'
}): Promise<ValidationResult> {
  const {
    checkWallet = true,
    checkChain = true,
    checkRewardBalance = false,
    requiredRewardAmount,
    rewardType = 'level',
  } = options

  const allErrors: string[] = []
  const allWarnings: string[] = []

  // Validate wallet
  if (checkWallet) {
    const walletResult = await validateWalletConnection()
    allErrors.push(...walletResult.errors)
    allWarnings.push(...walletResult.warnings)
    if (!walletResult.valid) {
      return { valid: false, errors: allErrors, warnings: allWarnings }
    }
  }

  // Validate chain
  if (checkChain) {
    const chainResult = await validateChain()
    allErrors.push(...chainResult.errors)
    allWarnings.push(...chainResult.warnings)
    if (!chainResult.valid) {
      return { valid: false, errors: allErrors, warnings: allWarnings }
    }
  }

  // Validate reward balance
  if (checkRewardBalance && requiredRewardAmount) {
    const balanceResult = await validateRewardDistributorBalance(requiredRewardAmount, rewardType)
    allErrors.push(...balanceResult.errors)
    allWarnings.push(...balanceResult.warnings)
    if (!balanceResult.valid) {
      return { valid: false, errors: allErrors, warnings: allWarnings }
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}

