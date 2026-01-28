import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, isAddress } from 'viem'
import { base, baseSepolia } from 'viem/chains'

const IS_VERIFIER_ABI = [
  { inputs: [{ name: 'user', type: 'address' }], name: 'isVerifier', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
] as const
const OWNER_ABI = [
  { inputs: [], name: 'owner', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const

/**
 * GET /api/verifier-telegram-invite?address=0x...
 *
 * Returns the Verifier Telegram invite URL only if the given address is an on-chain verifier.
 * The URL is kept server-side (VERIFIER_TELEGRAM_INVITE_URL); it is never exposed in the client bundle.
 */
export async function GET(req: NextRequest) {
  try {
    const url = process.env.VERIFIER_TELEGRAM_INVITE_URL
    if (!url || url.length === 0) {
      return NextResponse.json({ error: 'Verifier Telegram invite not configured' }, { status: 503 })
    }

    const address = req.nextUrl.searchParams.get('address')
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Missing or invalid address' }, { status: 400 })
    }

    const distributorAddress = process.env.NEXT_PUBLIC_POINTS_REWARD_DISTRIBUTOR_ADDRESS
    const verificationAddress = process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT
    if (!distributorAddress && !verificationAddress) {
      return NextResponse.json({ error: 'Contract not configured' }, { status: 503 })
    }

    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453)
    const rpcUrl = chainId === 84532
      ? (process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://sepolia.base.org')
      : (process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org')
    const chain = chainId === 84532 ? baseSepolia : base

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    // PointsRewardDistributor: staking or manuallyAddedVerifiers
    let isVerifier = false
    if (distributorAddress) {
      isVerifier = await publicClient.readContract({
        address: distributorAddress as `0x${string}`,
        abi: IS_VERIFIER_ABI,
        functionName: 'isVerifier',
        args: [address as `0x${string}`],
      }) as boolean
    }
    // VerificationContract: allowlist (addVerifier by owner) or owner (admin can verify on-chain)
    if (!isVerifier && verificationAddress) {
      isVerifier = await publicClient.readContract({
        address: verificationAddress as `0x${string}`,
        abi: IS_VERIFIER_ABI,
        functionName: 'isVerifier',
        args: [address as `0x${string}`],
      }) as boolean
      if (!isVerifier) {
        const owner = await publicClient.readContract({
          address: verificationAddress as `0x${string}`,
          abi: OWNER_ABI,
          functionName: 'owner',
        }) as string
        if (owner && owner.toLowerCase() === (address as string).toLowerCase()) isVerifier = true
      }
    }

    if (!isVerifier) {
      return NextResponse.json({ error: 'Not a verifier' }, { status: 403 })
    }

    return NextResponse.json({ url })
  } catch (e) {
    console.error('[verifier-telegram-invite]', e)
    return NextResponse.json({ error: 'Unable to verify' }, { status: 500 })
  }
}
