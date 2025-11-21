'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { SuccessModal } from '@/components/ui/success-modal'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { useAccount, useConnect, useChainId, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { Leaf, Award, Users, AlertCircle, Wallet, Heart, Loader2, ShieldCheck } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/verification'
import { claimImpactProductFromVerification, isVerifier as checkIsVerifier } from '@/lib/contracts'
import { isFarcasterContext, formatReferralMessage } from '@/lib/farcaster'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME, REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/wagmi'

const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const { context, isLoading } = useFarcaster()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { connectAsync, connectors, isPending } = useConnect()
  const [cleanupStatus, setCleanupStatus] = useState<{
    hasPendingCleanup: boolean
    canClaim: boolean
    cleanupId?: bigint
    reason?: string
    verified?: boolean
    claimed?: boolean
    level?: number
  } | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const [hasSwitchedNetwork, setHasSwitchedNetwork] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{
    title: string
    message: string
    transactionHash?: string
  } | null>(null)
  const [isVerifierWallet, setIsVerifierWallet] = useState(false)
  const [isCheckingVerifier, setIsCheckingVerifier] = useState(false)

  const farcasterConnector = connectors.find((c) => {
    const name = c.name.toLowerCase()
    const id = c.id?.toLowerCase() || ''
    return name.includes('farcaster') || name.includes('frame') || name.includes('miniapp') || id.includes('farcaster') || id.includes('frame') || id.includes('miniapp')
  })

  const externalConnectors = connectors.filter((c) => {
    const name = c.name.toLowerCase()
    const id = c.id?.toLowerCase() || ''
    return !name.includes('farcaster') && !name.includes('frame') && !name.includes('miniapp') && !id.includes('farcaster') && !id.includes('frame') && !id.includes('miniapp')
  })

  const primaryConnector: Connector | undefined = isInFarcaster && farcasterConnector ? farcasterConnector : externalConnectors[0]

  const handleConnect = async (connector?: Connector) => {
    if (!connector) return
    try {
      await connectAsync({ connector })
    } catch (error) {
      console.error('Wallet connect failed:', error)
    }
  }

  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
    setIsInFarcaster(isFarcasterContext())
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!address || !isConnected) {
      setIsVerifierWallet(false)
      setIsCheckingVerifier(false)
      return
    }

    let cancelled = false
    async function checkVerifierStatus() {
      setIsCheckingVerifier(true)
      try {
        const allowed = await checkIsVerifier(address as `0x${string}`)
        if (!cancelled) {
          setIsVerifierWallet(Boolean(allowed))
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to fetch verifier status:', error)
          setIsVerifierWallet(false)
        }
      } finally {
        if (!cancelled) {
          setIsCheckingVerifier(false)
        }
      }
    }

    checkVerifierStatus()

    return () => {
      cancelled = true
    }
  }, [mounted, address, isConnected])

  // Note: Chain switching is handled by ensureWalletOnRequiredChain() in contract functions
  // No need for auto-switch here - it will be handled when user tries to interact (claim, etc.)

  // Check cleanup status when connected (optimized single call)
  useEffect(() => {
    if (!mounted || !isConnected || !address) {
      setCleanupStatus(null)
      return
    }

    let isMounted = true
    let pollInterval: NodeJS.Timeout | null = null

    async function checkStatus() {
      if (!address || !isMounted) return
      try {
        const status = await getUserCleanupStatus(address)
        if (isMounted) {
          setCleanupStatus(status)

          // Only poll if there's something pending (pending cleanup or ready to claim)
          // Stop polling if already claimed or no cleanup exists
          if (status.hasPendingCleanup || status.canClaim) {
            // Poll every 30 seconds if pending, or every 60 seconds if ready to claim
            const pollDelay = status.hasPendingCleanup ? 30000 : 60000
            if (pollInterval) clearInterval(pollInterval)
            pollInterval = setTimeout(checkStatus, pollDelay)
          } else {
            // No need to poll if nothing is pending
            if (pollInterval) clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('Error checking status:', error)
        if (isMounted) {
          setCleanupStatus({
            hasPendingCleanup: false,
            canClaim: false,
            reason: 'Error checking cleanup status',
          })
        }
      }
    }

    // Initial check
    checkStatus()

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [mounted, isConnected, address])

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-black/95 backdrop-blur-sm">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green">
              <Leaf className="h-5 w-5 text-black" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold uppercase tracking-tight text-white sm:text-lg">
                DECLEANUP REWARDS
              </h1>
              <p className="hidden text-[10px] font-medium text-gray-400 sm:block sm:text-xs">
                TOKENIZE CLEANUPS ON BASE
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero Section */}
        <section className="mb-8 text-center sm:mb-12">
          <div className="mx-auto mb-6 max-w-3xl">
            <h2 className="mb-3 text-3xl font-bold uppercase leading-tight tracking-wide text-white sm:text-4xl md:text-5xl">
              DECLEANUP REWARDS
            </h2>
            <p className="mx-auto mb-6 text-sm leading-relaxed text-gray-400 sm:text-base md:text-lg">
              DeCleanup Rewards turns real-world cleanups into tokenized proof. Submit evidence, level up Impact Product NFTs, and stack $DCU rewards ahead of token launch.
            </p>
          </div>

          {!mounted ? (
            // Show consistent initial state on server and client
            <div className="mx-auto max-w-md">
              <Button
                size="lg"
                disabled
                className="w-full gap-2 bg-brand-green text-black"
              >
                LOG IN
              </Button>
              <p className="mt-4 text-xs text-gray-500">
                Connect your wallet to get started
              </p>
            </div>
          ) : isConnected ? (
            <div className="mx-auto max-w-md space-y-4">
              {/* Status Banner */}
              {cleanupStatus && (
                <div className={`mx-auto max-w-md rounded-lg border p-4 ${cleanupStatus.canClaim
                  ? 'border-brand-yellow bg-brand-yellow/10'
                  : cleanupStatus.hasPendingCleanup
                    ? 'border-brand-green bg-brand-green/10'
                    : 'border-gray-800 bg-gray-900'
                  }`}>
                  <div className="flex items-start gap-3">
                    {cleanupStatus.canClaim ? (
                      <>
                        <Award className="h-5 w-5 flex-shrink-0 text-brand-yellow" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-brand-yellow">
                            🎉 Your cleanup has been verified!
                          </p>
                          <p className="mt-1 text-xs text-gray-300">
                            You can now claim your Impact Product NFT (Level {cleanupStatus.level || 1})
                          </p>
                        </div>
                      </>
                    ) : cleanupStatus.hasPendingCleanup ? (
                      <>
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-brand-green" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-brand-green">
                            Cleanup Submitted
                          </p>
                          <p className="mt-1 text-xs text-gray-300">
                            Your cleanup is under review. This usually takes a few hours.
                          </p>
                        </div>
                      </>
                    ) : cleanupStatus.reason ? (
                      <>
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-300">
                            {cleanupStatus.reason}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/cleanup" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    disabled={cleanupStatus?.hasPendingCleanup || cleanupStatus?.canClaim || false}
                    className={`w-full gap-2 sm:w-auto ${cleanupStatus?.hasPendingCleanup || cleanupStatus?.canClaim
                      ? 'border-gray-700 bg-gray-900 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-yellow text-black hover:bg-[#e6e600]'
                      }`}
                    title={
                      cleanupStatus?.hasPendingCleanup
                        ? 'You have a cleanup pending verification. Please wait for verification before submitting a new cleanup.'
                        : cleanupStatus?.canClaim
                          ? 'Please claim your Impact Product NFT before submitting a new cleanup.'
                          : ''
                    }
                  >
                    <Leaf className="h-5 w-5" />
                    SUBMIT CLEANUP
                  </Button>
                </Link>
                <Button
                  size="lg"
                  disabled={!cleanupStatus?.canClaim || isClaiming}
                  onClick={async () => {
                    if (!cleanupStatus?.canClaim || !cleanupStatus?.cleanupId || isClaiming) return

                    try {
                      setIsClaiming(true)
                      const hash = await claimImpactProductFromVerification(cleanupStatus.cleanupId)

                      // Wait for transaction confirmation
                      const { waitForTransactionReceipt } = await import('wagmi/actions')
                      const { config } = await import('@/lib/wagmi')

                      try {
                        await waitForTransactionReceipt(config, { hash, timeout: 60000 })
                        console.log('✅ Claim transaction confirmed!')
                      } catch (waitError) {
                        console.warn('Transaction confirmation wait failed, but continuing:', waitError)
                      }

                      // Poll for status update (transaction confirmed, but state might take a moment)
                      let pollCount = 0
                      const maxPolls = 10
                      const pollInterval = setInterval(async () => {
                        pollCount++
                        try {
                          if (address) {
                            const status = await getUserCleanupStatus(address)
                            setCleanupStatus(status)
                            if (status.claimed || pollCount >= maxPolls) {
                              clearInterval(pollInterval)
                              setSuccessModalData({
                                title: 'Impact Product Minted!',
                                message: 'Your Impact Product NFT has been successfully minted!',
                                transactionHash: hash,
                              })
                              setShowSuccessModal(true)
                              // Redirect to profile after a short delay
                              setTimeout(() => {
                                window.location.href = '/profile'
                              }, 3000)
                            }
                          }
                        } catch (error) {
                          console.error('Error polling status:', error)
                          if (pollCount >= maxPolls) {
                            clearInterval(pollInterval)
                            setSuccessModalData({
                              title: 'Transaction Submitted',
                              message: 'Transaction submitted but status check failed. Please check your profile or explorer to confirm.',
                              transactionHash: hash,
                            })
                            setShowSuccessModal(true)
                            setTimeout(() => {
                              window.location.href = '/profile'
                            }, 3000)
                          }
                        }
                      }, 2000) // Poll every 2 seconds

                      // Fallback: redirect after max time even if polling doesn't complete
                      setTimeout(() => {
                        clearInterval(pollInterval)
                        window.location.href = '/profile'
                      }, 20000) // Max 20 seconds

                    } catch (error: any) {
                      console.error('Error claiming:', error)

                      // Check if user rejected the transaction
                      const errorMessage = error?.message || String(error)
                      if (
                        error?.code === 4001 ||
                        errorMessage.includes('User rejected') ||
                        errorMessage.includes('User denied') ||
                        errorMessage.includes('rejected the request')
                      ) {
                        console.log('User cancelled transaction')
                        // Don't show an error for user cancellation
                      } else {
                        // Show error for actual failures
                        alert(`Failed to claim: ${errorMessage}`)
                      }
                      setIsClaiming(false)
                    }
                  }}
                  className={`w-full gap-2 border-2 font-semibold uppercase sm:w-auto ${cleanupStatus?.canClaim
                    ? 'bg-brand-yellow text-black hover:bg-[#e6e600] border-brand-yellow'
                    : 'border-gray-700 bg-gray-900 text-gray-500 cursor-not-allowed'
                    }`}
                  title={cleanupStatus?.reason}
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Minting Impact Product...</span>
                    </>
                  ) : (
                    <>
                      <Award className="h-5 w-5" />
                      CLAIM LEVEL
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md space-y-4">
              <div>
                <p className="mb-3 text-xs text-gray-400">
                  {isInFarcaster
                    ? 'Your Farcaster wallet should connect automatically. Tap below if it does not.'
                    : 'Connect your wallet to get started.'}
                </p>
                <Button
                  size="lg"
                  className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
                  disabled={isPending || !primaryConnector}
                  onClick={() => handleConnect(primaryConnector)}
                >
                  <Wallet className="h-5 w-5" />
                  {isPending ? 'Connecting...' : isInFarcaster && farcasterConnector ? 'Connect Farcaster Wallet' : primaryConnector ? `Connect ${primaryConnector.name}` : 'No Wallets Available'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                You can also use the wallet button in the header.
              </p>
            </div>
          )}
        </section>

        {/* Features Grid */}
        <section className="mb-8 grid gap-4 sm:mb-12 sm:grid-cols-2 sm:gap-6">
          <Link href="/profile" className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-brand-yellow sm:p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-yellow/20">
              <Award className="h-6 w-6 text-brand-yellow" />
            </div>
            <h3 className="mb-2 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
              My Profile
            </h3>
            <p className="text-sm leading-relaxed text-gray-400 sm:text-base">
              View your Impact Products, track your progress, and see your environmental contributions.
            </p>
          </Link>

          <div className={`rounded-lg border p-4 sm:p-6 ${isVerifierWallet ? 'border-brand-green/70 bg-brand-green/10' : 'border-dashed border-gray-800 bg-gray-900'} transition-colors`}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-green/20">
              <ShieldCheck className={`h-6 w-6 ${isVerifierWallet ? 'text-brand-green' : 'text-gray-500'}`} />
            </div>
            <h3 className="mb-2 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
              Verify Cleanups
            </h3>
            <p className="text-sm leading-relaxed text-gray-400 sm:text-base">
              Reserved for registered verifiers while $DCU staking is finalized. Once staked, you&apos;ll unlock review rights and reward multipliers.
            </p>
            <Button
              size="lg"
              disabled={!isVerifierWallet || isCheckingVerifier}
              onClick={() => {
                if (isVerifierWallet) {
                  router.push('/verifier')
                }
              }}
              className={`mt-4 w-full gap-2 ${isVerifierWallet
                ? 'bg-brand-green text-black hover:bg-[#4a9a26]'
                : 'cursor-not-allowed border border-gray-700 bg-gray-900 text-gray-500'} ${isCheckingVerifier ? 'cursor-wait' : ''}`}
            >
              {isCheckingVerifier ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking Access...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  {isVerifierWallet ? 'Open Verifier' : 'Reserved Access'}
                </>
              )}
            </Button>
            {!isVerifierWallet && (
              <p className="mt-3 text-xs text-gray-500">
                Only approved verifiers can enter right now. This button will light up for you once your wallet is on the allowlist.
              </p>
            )}
          </div>
        </section>

        {/* Invite Friends Section */}
        {mounted && isConnected && address && (
          <section className="mb-8 rounded-lg border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-6 sm:mb-12 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-green/20">
                <Users className="h-6 w-6 text-brand-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
                  Invite Friends
                </h3>
                <p className="text-xs text-gray-400 sm:text-sm">
                  Earn 3 $DCU when friends submit and verify their first cleanup
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Share your referral link and earn rewards when your friends join DeCleanup Rewards!
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={async () => {
                    const { generateReferralLink, shareCast } = await import('@/lib/farcaster')
                    const referralLink = generateReferralLink(address)
                    await shareCast(formatReferralMessage(referralLink), referralLink)
                  }}
                  className="flex-1 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
                >
                  <Users className="h-4 w-4" />
                  Share on Farcaster
                </Button>

                <Button
                  onClick={async () => {
                    const { generateReferralLink } = await import('@/lib/farcaster')
                    const referralLink = generateReferralLink(address)
                    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(formatReferralMessage(referralLink))}`
                    window.open(xUrl, '_blank')
                  }}
                  variant="outline"
                  className="flex-1 gap-2 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </Button>

                <Button
                  onClick={async () => {
                    const { generateReferralLink } = await import('@/lib/farcaster')
                    const referralLink = generateReferralLink(address)
                    try {
                      const copyText = formatReferralMessage(referralLink)
                      await navigator.clipboard.writeText(copyText)
                      alert('Referral message copied to clipboard!')
                    } catch (error) {
                      alert(formatReferralMessage(referralLink))
                    }
                  }}
                  variant="outline"
                  className="flex-1 gap-2 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </Button>
              </div>

              <div className="mt-4 rounded-lg bg-gray-800/50 p-3">
                <p className="text-xs text-gray-400">
                  <strong className="text-brand-green">How it works:</strong> When someone uses your referral link to submit their first cleanup and it gets verified, you both earn <strong className="text-white">3 $DCU</strong>!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-4 sm:mb-12 sm:p-6">
          <h3 className="mb-4 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
            Quick Actions
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="https://t.me/DecentralizedCleanup"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-gray-700 bg-black font-semibold uppercase text-white hover:bg-gray-900"
              >
                <Users className="h-4 w-4" />
                Join the Community
              </Button>
            </a>
            <a
              href="https://paragraph.com/@decleanupnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-gray-700 bg-black font-semibold uppercase text-white hover:bg-gray-900"
              >
                <Award className="h-4 w-4" />
                Read Publications
              </Button>
            </a>
            <a
              href="https://giveth.io/project/decentralized-cleanup-network"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-gray-700 bg-black font-semibold uppercase text-white hover:bg-gray-900"
              >
                <Heart className="h-4 w-4" />
                Donate on Giveth
              </Button>
            </a>
          </div>
        </section>

        {/* Footer Links */}
        <footer className="mt-8 border-t border-gray-800 pt-6 sm:mt-12">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 sm:gap-6 sm:text-sm">
            <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">
              GITHUB
            </a>
            <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">
              LITEPAPER
            </a>
            <a href="https://x.com/decleanupnet" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green">
              X
            </a>
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <div className="flex h-6 items-center justify-center rounded bg-gray-800 px-2 font-bold text-white">
                BASE
              </div>
            </div>
          </div>
        </footer>

        {/* Success Modal */}
        {showSuccessModal && successModalData && (
          <SuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false)
              setSuccessModalData(null)
            }}
            title={successModalData.title}
            message={successModalData.message}
            transactionHash={successModalData.transactionHash}
            explorerUrl={successModalData.transactionHash ? getExplorerTxUrl(successModalData.transactionHash as `0x${string}`) : undefined}
            explorerName={BLOCK_EXPLORER_NAME}
            showShare={successModalData.title.includes('Minted')}
            userAddress={address || undefined}
            level={cleanupStatus?.level}
            onShare={() => {
              // Custom share handler is handled by SuccessModal now
            }}
          />
        )}

        {/* Farcaster User Info */}
        {context?.user && (
          <section className="mx-auto mt-8 max-w-md rounded-lg border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <h3 className="mb-2 text-base font-bold uppercase tracking-wide text-white sm:text-lg">
              Welcome, {context.user.displayName || context.user.username}!
            </h3>
            <p className="text-xs text-gray-400 sm:text-sm">
              Connected via Farcaster
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
