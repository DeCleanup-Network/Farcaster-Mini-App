'use client'

import { useSendCalls } from 'wagmi'
import { Attribution } from 'ox/erc8021'
import { encodeFunctionData, type Address, type Abi } from 'viem'

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
    try {
      // Encode function call
      const data = encodeFunctionData({
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
      })

      // Get Builder Code data suffix for attribution
      const dataSuffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] })

      // Send transaction with Builder Code attribution via capabilities
      const hash = await sendCalls({
        calls: [
          {
            to: params.to,
            data: data,
            value: params.value || BigInt(0),
          },
        ],
        capabilities: {
          dataSuffix: dataSuffix,
        },
      })

      console.log('✅ Transaction with Builder Code sent:', hash)
      return hash
    } catch (err) {
      console.error('❌ Failed to send transaction with Builder Code:', err)
      throw err
    }
  }

  return {
    sendWithBuilderCode,
    isPending,
    error,
  }
}

