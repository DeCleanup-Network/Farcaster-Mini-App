'use client'

import { useSendCalls } from 'wagmi'
import { writeContract } from 'wagmi/actions'
import { Attribution } from 'ox/erc8021'
import { encodeFunctionData, type Address, type Abi } from 'viem'
import { getWagmiConfig } from '@/lib/wagmi'
import { getAccount } from 'wagmi/actions'

// Base Builder Code for attribution
const BUILDER_CODE = 'bc_ktu8dqm4'

/**
 * Hook to get Builder Code attribution capabilities
 * Use this with useSendCalls for transactions that need Builder Code attribution
 * 
 * Example usage:
 * ```tsx
 * const { sendWithBuilderCode, isPending } = useBuilderCodeAttribution()
 * 
 * await sendWithBuilderCode({
 *   to: CONTRACT_ADDRESS,
 *   abi: CONTRACT_ABI,
 *   functionName: 'submitCleanup',
 *   args: [beforeHash, afterHash, ...],
 *   value: fee,
 * })
 * ```
 */
export function useBuilderCodeAttribution() {
  const { sendCalls, isPending, error } = useSendCalls()

  const sendWithBuilderCode = async (params: {
    to: Address
    abi: Abi
    functionName: string
    args: readonly unknown[]
    value?: bigint
  }): Promise<`0x${string}`> => {
    return new Promise((resolve, reject) => {
      try {
        // Encode function call
        const data = encodeFunctionData({
          abi: params.abi,
          functionName: params.functionName,
          args: params.args,
        })

        // Get Builder Code data suffix for attribution
        const dataSuffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
        
        // Ensure dataSuffix is a hex string (ox/erc8021 should return this, but verify)
        const dataSuffixHex = typeof dataSuffix === 'string' 
          ? (dataSuffix as `0x${string}`)
          : String(dataSuffix)

        // Send transaction with Builder Code attribution via capabilities
        // useSendCalls uses mutation pattern with callbacks
        // Note: Some wallets may expect capabilities at call level, but EIP-5792 specifies top-level
        sendCalls(
          {
            calls: [
              {
                to: params.to,
                data: data,
                value: params.value || BigInt(0),
              },
            ],
            capabilities: {
              dataSuffix: dataSuffixHex,
            },
          },
          {
            onSuccess: (result) => {
              // useSendCalls returns an object with id property containing the transaction hash
              const hash = (result?.id || result) as `0x${string}`
              console.log('✅ Transaction with Builder Code sent:', hash)
              resolve(hash)
            },
            onError: async (err: Error) => {
              // Check if error is due to unsupported wallet_sendCalls method
              const errorMessage = err?.message || String(err || '')
              const errorString = JSON.stringify(err)
              
              const isUnsupportedMethod = errorMessage.includes('wallet_sendCalls') || 
                                        errorMessage.includes('does not exist') ||
                                        errorMessage.includes('is not available') ||
                                        errorMessage.includes('unsupported')
              
              // Check for capabilities/dataSuffix validation errors
              const isCapabilitiesError = errorMessage.includes('capabilities') ||
                                         errorMessage.includes('dataSuffix') ||
                                         errorMessage.includes('invalid_type') ||
                                         errorMessage.includes('Expected object') ||
                                         errorString.includes('dataSuffix')
              
              if (isUnsupportedMethod || isCapabilitiesError) {
                const reason = isCapabilitiesError 
                  ? 'Wallet does not support Builder Code capabilities format'
                  : 'Wallet does not support wallet_sendCalls'
                console.warn(`⚠️ ${reason}, falling back to standard transaction (no Builder Code attribution)`)
                
                try {
                  // Fallback to standard writeContract without Builder Code
                  const account = getAccount(getWagmiConfig())
                  if (account.status !== 'connected' || !account.chain) {
                    throw new Error('Wallet not connected or chain not available')
                  }
                  
                  const hash = await writeContract(getWagmiConfig() as any, {
                    address: params.to,
                    abi: params.abi,
                    functionName: params.functionName,
                    args: params.args,
                    value: params.value || BigInt(0),
                    chain: account.chain,
                  })
                  
                  console.log('✅ Transaction sent via fallback (standard method):', hash)
                  resolve(hash as `0x${string}`)
                } catch (fallbackError: any) {
                  console.error('❌ Fallback transaction also failed:', fallbackError)
                  reject(fallbackError)
                }
              } else {
                // Other errors - reject normally
                console.error('❌ Failed to send transaction with Builder Code:', err)
                reject(err)
              }
            },
          }
        )
      } catch (err) {
        console.error('❌ Failed to prepare Builder Code transaction:', err)
        reject(err)
      }
    })
  }

  return {
    sendWithBuilderCode,
    isPending,
    error,
  }
}

