/**
 * Structured Logging
 * 
 * Provides structured logging with wallet type, chain ID, and environment context.
 */

import { Address } from 'viem'
import { getAccount } from 'wagmi/actions'
import { getWagmiConfig } from './wagmi'
import { isFarcasterSDKAvailable } from './farcaster-ready'

export interface LogContext {
  walletType?: string
  connectorId?: string
  chainId?: number | null
  address?: Address
  environment?: 'browser' | 'farcaster' | 'unknown'
  userAgent?: string
  timestamp?: string
}

/**
 * Get current log context
 */
export async function getLogContext(): Promise<LogContext> {
  const context: LogContext = {
    timestamp: new Date().toISOString(),
  }

  try {
    // Get wallet info
    const account = getAccount(getWagmiConfig())
    if (account.status === 'connected') {
      context.address = account.address
      context.connectorId = account.connector?.id
      context.walletType = account.connector?.name || account.connector?.id || 'unknown'
    }

    // Get chain ID
    try {
      const { getChainId } = await import('wagmi/actions')
      context.chainId = await getChainId(getWagmiConfig())
    } catch {
      context.chainId = null
    }

    // Detect environment
    if (typeof window !== 'undefined') {
      context.userAgent = navigator.userAgent
      
      if (isFarcasterSDKAvailable()) {
        context.environment = 'farcaster'
      } else {
        context.environment = 'browser'
      }
    } else {
      context.environment = 'unknown'
    }
  } catch (error) {
    console.warn('[structured-logging] Error getting context:', error)
  }

  return context
}

/**
 * Log with structured context
 */
export async function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, any>
): Promise<void> {
  const context = await getLogContext()
  const logData = {
    ...context,
    ...data,
    message,
  }

  const logMessage = `[${level.toUpperCase()}] ${message}`
  
  switch (level) {
    case 'error':
      console.error(logMessage, logData)
      break
    case 'warn':
      console.warn(logMessage, logData)
      break
    case 'debug':
      console.debug(logMessage, logData)
      break
    default:
      console.log(logMessage, logData)
  }
}

/**
 * Log transaction attempt
 */
export async function logTransactionAttempt(
  functionName: string,
  params: Record<string, any>
): Promise<void> {
  await logWithContext('info', `Transaction attempt: ${functionName}`, {
    functionName,
    ...params,
  })
}

/**
 * Log transaction success
 */
export async function logTransactionSuccess(
  functionName: string,
  transactionHash: string,
  additionalData?: Record<string, any>
): Promise<void> {
  await logWithContext('info', `Transaction success: ${functionName}`, {
    functionName,
    transactionHash,
    ...additionalData,
  })
}

/**
 * Log transaction error
 */
export async function logTransactionError(
  functionName: string,
  error: Error | unknown,
  additionalData?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  await logWithContext('error', `Transaction error: ${functionName}`, {
    functionName,
    error: errorMessage,
    errorStack: error instanceof Error ? error.stack : undefined,
    ...additionalData,
  })
}

/**
 * Log chain switch attempt
 */
export async function logChainSwitchAttempt(
  fromChainId: number | null,
  toChainId: number
): Promise<void> {
  await logWithContext('info', 'Chain switch attempt', {
    fromChainId,
    toChainId,
  })
}

/**
 * Log chain switch success
 */
export async function logChainSwitchSuccess(
  chainId: number
): Promise<void> {
  await logWithContext('info', 'Chain switch success', {
    chainId,
  })
}

/**
 * Log chain switch error
 */
export async function logChainSwitchError(
  error: Error | unknown,
  fromChainId: number | null,
  toChainId: number
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  await logWithContext('error', 'Chain switch error', {
    error: errorMessage,
    fromChainId,
    toChainId,
  })
}

/**
 * Log IPFS upload attempt
 */
export async function logIPFSUploadAttempt(
  fileName: string,
  fileSize: number
): Promise<void> {
  await logWithContext('info', 'IPFS upload attempt', {
    fileName,
    fileSize,
  })
}

/**
 * Log IPFS upload success
 */
export async function logIPFSUploadSuccess(
  fileName: string,
  hash: string
): Promise<void> {
  await logWithContext('info', 'IPFS upload success', {
    fileName,
    hash,
  })
}

/**
 * Log IPFS upload error
 */
export async function logIPFSUploadError(
  fileName: string,
  error: Error | unknown
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  await logWithContext('error', 'IPFS upload error', {
    fileName,
    error: errorMessage,
  })
}

