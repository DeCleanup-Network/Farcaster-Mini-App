'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SuccessModal } from '@/components/ui/success-modal'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { useAccount, useConnect, useChainId, useSwitchChain } from 'wagmi'
import { useFarcasterReady } from '@/lib/hooks/useFarcasterReady'
import type { Connector } from 'wagmi'
import { Leaf, Award, Users, AlertCircle, Wallet, Heart, Loader2, X } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/verification'
import { claimImpactProductFromVerification, getClaimFee, getUserLevel } from '@/lib/contracts'
import { isFarcasterContext } from '@/lib/farcaster'
import { REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/wagmi'

const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

export default function Home() {
  // Ensure ready() is called early on this landing page
  useFarcasterReady()
  
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
    rejected?: boolean
  } | null>(null)
  const [userLevel, setUserLevel] = useState<number | null>(null)
  const [showRejectionAlert, setShowRejectionAlert] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const [hasSwitchedNetwork, setHasSwitchedNetwork] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{
    title: string
    message: string
    transactionHash?: string
  } | null>(null)
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
    if (!connector) {
      console.warn('No connector provided to handleConnect')
      return
    }
    try {
      console.log('Connecting with connector:', connector.name, connector.id)
      await connectAsync({ connector })
    } catch (error: any) {
      console.error('Wallet connect failed:', error)
      // Don't show alert for user rejections
      if (error?.code !== 4001 && !error?.message?.includes('rejected')) {
        // Only log, don't alert - user can retry
      }
    }
  }

  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
    setIsInFarcaster(isFarcasterContext())
  }, [])

  // Note: Chain switching is handled by ensureWalletOnRequiredChain() in contract functions
  // No need for auto-switch here - it will be handled when user tries to interact (claim, etc.)

  // Check cleanup status and user level when connected
  useEffect(() => {
    if (!mounted || !isConnected || !address) {
      setCleanupStatus(null)
      setUserLevel(null)
      return
    }

    let isMounted = true
    let pollInterval: NodeJS.Timeout | null = null

    async function checkStatus() {
      if (!address || !isMounted) return
      try {
        const [status, level] = await Promise.all([
          getUserCleanupStatus(address),
          getUserLevel(address).catch(() => 0),
        ])
        if (isMounted) {
          setCleanupStatus(status)
          setUserLevel(level)
          
          // Show rejection alert if cleanup was rejected
          if (status.rejected) {
            setShowRejectionAlert(true)
          }

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

  // Scroll to top on mount
  useEffect(() => {
    if (mounted) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [mounted])

  return (
    <div className="min-h-screen bg-background">
      {/* Rejection Alert */}
      {showRejectionAlert && (
        <div className="container mx-auto px-4 pt-4 sm:px-6">
          <div className="mx-auto max-w-2xl rounded-lg border-2 border-red-500 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-sm font-bold uppercase text-red-500">
                  Cleanup Rejected
                </h3>
                <p className="text-sm text-gray-300">
                  Your latest cleanup submission was rejected. Please review the requirements and submit a new cleanup.
                </p>
              </div>
              <button
                onClick={() => setShowRejectionAlert(false)}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-20 sm:px-6 sm:py-8">
        {/* Hero Section */}
        <section className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-4 max-w-3xl">
            <h2 className="mb-1 text-3xl font-bold uppercase leading-tight tracking-wide text-foreground sm:text-4xl md:text-5xl">
              DeCleanup Rewards
            </h2>
            <p className="mx-auto text-base font-semibold text-brand-green sm:text-lg">
              Self-tokenize environmental cleanup efforts
            </p>
            <p className="mx-auto mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
              Apply with your cleanup results to receive a DeCleanup Impact Product, earn community token $bDCU, and progress through levels.
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
              <p className="mt-4 text-xs text-muted-foreground">
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
                    : 'border-border bg-card'
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
                            You can now claim your Impact Product (Level {cleanupStatus.level || 1})
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
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
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
                {userLevel === 10 ? (
                  <div className="w-full rounded-lg border border-brand-yellow/50 bg-brand-yellow/10 p-4 text-center">
                    <p className="text-sm font-medium text-brand-yellow">
                      🎉 Currently you passed all the levels, stay updated for more...
                    </p>
                  </div>
                ) : (
                  <Link href="/cleanup" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      disabled={cleanupStatus?.hasPendingCleanup || cleanupStatus?.canClaim || false}
                      className={`w-full gap-2 sm:w-auto ${cleanupStatus?.hasPendingCleanup || cleanupStatus?.canClaim
                        ? 'border-muted bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-brand-yellow text-black hover:bg-[#e6e600]'
                        }`}
                      title={
                        cleanupStatus?.hasPendingCleanup
                          ? 'You have a cleanup pending verification. Please wait for verification before submitting a new cleanup.'
                          : cleanupStatus?.canClaim
                            ? 'Please claim your Impact Product before submitting a new cleanup.'
                            : ''
                      }
                    >
                      <Leaf className="h-5 w-5" />
                      SUBMIT CLEANUP
                    </Button>
                  </Link>
                )}
                <Button
                  size="lg"
                  disabled={!cleanupStatus?.canClaim || isClaiming}
                  onClick={async () => {
                    if (!cleanupStatus?.canClaim || !cleanupStatus?.cleanupId || isClaiming) return

                    try {
                      setIsClaiming(true)
                      
                      // Double-check cleanup status before claiming
                      try {
                        const { getCleanupStatus } = await import('@/lib/contracts')
                        const status = await getCleanupStatus(cleanupStatus.cleanupId)
                        if (status.claimed) {
                          alert('This Impact Product has already been claimed. Refreshing...')
                          // Refresh status
                          if (address) {
                            const updatedStatus = await getUserCleanupStatus(address)
                            setCleanupStatus(updatedStatus)
                          }
                          setIsClaiming(false)
                          return
                        }
                      } catch (statusCheckError) {
                        console.warn('Could not check cleanup status before claim:', statusCheckError)
                        // Continue anyway - the claim function will check
                      }
                      
                      // Check claim fee before claiming
                      let claimFeeInfo: { fee: bigint; enabled: boolean } | null = null
                      try {
                        claimFeeInfo = await getClaimFee()
                        if (claimFeeInfo.enabled && claimFeeInfo.fee > 0) {
                          const feeInEth = Number(claimFeeInfo.fee) / 1e18
                          const feeInCents = feeInEth * 2800 // Approximate ETH price
                          console.log(`Claim fee: ${feeInCents.toFixed(2)} cents USD (${feeInEth.toFixed(8)} ETH)`)
                        }
                      } catch (feeError) {
                        console.warn('Could not fetch claim fee:', feeError)
                      }
                      
                      // Pass chainId to avoid false chain detection
                      const hash = await claimImpactProductFromVerification(cleanupStatus.cleanupId, chainId)

                      // Wait for transaction confirmation with better error handling
                      const { waitForTransactionReceipt } = await import('wagmi/actions')
                      const { config } = await import('@/lib/wagmi')

                      try {
                        // Use a longer timeout and handle "block not found" errors gracefully
                        await waitForTransactionReceipt(config, { 
                          hash, 
                          timeout: 120000, // 2 minutes
                          retryCount: 10,
                          retryDelay: 2000,
                        })
                        console.log('✅ Claim transaction confirmed!')
                      } catch (waitError: any) {
                        // "Block not found" errors are often temporary - transaction might still succeed
                        const errorMessage = String(waitError?.message || waitError || '')
                        if (
                          errorMessage.includes('block not found') ||
                          errorMessage.includes('Requested resource not found') ||
                          errorMessage.includes('ResourceNotFound')
                        ) {
                          console.warn('Transaction receipt check failed (block not found - may be temporary):', waitError)
                          console.log('Transaction was submitted. It may still be processing. Polling for status...')
                        } else {
                          console.warn('Transaction confirmation wait failed, but continuing:', waitError)
                        }
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
                              message: 'Your Impact Product has been successfully minted!',
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
                      } else if (
                        errorMessage.includes('already been claimed') ||
                        errorMessage.includes('already claimed')
                      ) {
                        // Already claimed - refresh status and show message
                        alert(
                          'This Impact Product has already been claimed.\n\n' +
                          'If you don\'t see it in your profile, please refresh the page.'
                        )
                        // Refresh cleanup status
                        if (address) {
                          try {
                            const status = await getUserCleanupStatus(address)
                            setCleanupStatus(status)
                          } catch (e) {
                            console.error('Error refreshing status:', e)
                          }
                        }
                      } else {
                        // Show error for actual failures
                        alert(`Failed to claim: ${errorMessage}`)
                      }
                      setIsClaiming(false)
                    }
                  }}
                  className={`w-full gap-2 border-2 font-semibold uppercase sm:w-auto ${cleanupStatus?.canClaim
                    ? 'bg-brand-yellow text-black hover:bg-[#e6e600] border-brand-yellow'
                    : 'border-muted bg-muted text-muted-foreground cursor-not-allowed'
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
                <p className="mb-3 text-xs text-muted-foreground">
                  Connect your wallet to get started.
                </p>
                <Button
                  size="lg"
                  className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
                  disabled={isPending || !primaryConnector}
                  onClick={() => handleConnect(primaryConnector)}
                >
                  <Wallet className="h-5 w-5" />
                  {isPending ? 'Connecting...' : 'Log In'}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  Use, when on Farcaster. Connects you with FC wallet
                </p>
              </div>
            </div>
          )}
        </section>


        {/* Invite Friends Section */}
        {mounted && isConnected && address && (
          <section className="mb-8 rounded-lg border border-border bg-gradient-to-br from-card to-muted p-6 sm:mb-12 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-green/20">
                <Users className="h-6 w-6 text-brand-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
                  Invite Friends
                </h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Earn 3 $bDCU when friends submit and verify their first cleanup
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-foreground/90">
                Share your referral link and earn rewards when your friends join DeCleanup Rewards!
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={async () => {
                    try {
                    const { generateReferralLink, shareCast, formatReferralMessage } = await import('@/lib/farcaster')
                      // Use Farcaster miniapp URL for Farcaster sharing
                      const referralLink = generateReferralLink(address, 'farcaster', false)
                      const message = formatReferralMessage(referralLink, 'farcaster')
                      console.log('Sharing to Farcaster:', { message, embedLink: referralLink })
                      await shareCast(message, referralLink)
                    } catch (error) {
                      console.error('Failed to share to Farcaster:', error)
                      alert('Failed to share. Please try again or copy the link manually.')
                    }
                  }}
                  className="flex-1 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
                >
                  <Users className="h-4 w-4" />
                  Share on Farcaster
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      const { generateReferralLink, formatReferralMessage, shareToX } = await import('@/lib/farcaster')
                      const referralLink = generateReferralLink(address, 'web', true)
                      const text = formatReferralMessage(referralLink, 'web')
                      await shareToX(text, referralLink)
                    } catch (error) {
                      console.error('Failed to share to X:', error)
                      alert('Failed to share. Please try again.')
                    }
                  }}
                  variant="outline"
                  className="flex-1 gap-2 border-border bg-card text-foreground hover:bg-accent"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </Button>

                <Button
                  onClick={async () => {
                    const { generateReferralLink, formatReferralMessage } = await import('@/lib/farcaster')
                    const referralLink = generateReferralLink(address, 'copy', true)
                    try {
                      const copyText = formatReferralMessage(referralLink, 'copy')
                      await navigator.clipboard.writeText(copyText)
                      alert('Referral link copied to clipboard!')
                    } catch (error) {
                      alert(formatReferralMessage(referralLink, 'copy'))
                    }
                  }}
                  variant="outline"
                  className="flex-1 gap-2 border-border bg-card text-foreground hover:bg-accent"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </Button>
              </div>

              <div className="mt-4 rounded-lg bg-gray-800/50 p-3">
                <p className="text-xs text-gray-400">
                  <strong className="text-brand-green">How it works:</strong> When someone uses your referral link to submit their first cleanup and it gets verified, you both earn <strong className="text-foreground">3 $bDCU</strong>!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Quick Links */}
        <section className="mb-8 rounded-lg border border-border bg-card p-4 sm:mb-12 sm:p-6">
          <h3 className="mb-4 text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
            Quick Links
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="https://decleanup.net"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-border bg-background font-semibold uppercase text-foreground hover:bg-accent"
              >
                <Award className="h-4 w-4" />
                Website
              </Button>
            </a>
            <a
              href="https://t.me/DecentralizedCleanup"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-border bg-background font-semibold uppercase text-foreground hover:bg-accent"
              >
                <Users className="h-4 w-4" />
                Telegram
              </Button>
            </a>
            <a
              href="https://x.com/decleanupnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-border bg-background font-semibold uppercase text-foreground hover:bg-accent"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X
              </Button>
            </a>
            <a
              href="https://farcaster.xyz/decleanupnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-2 border-border bg-background font-semibold uppercase text-foreground hover:bg-accent"
              >
                <Users className="h-4 w-4" />
                Farcaster
              </Button>
            </a>
          </div>
        </section>

        {/* Footer Links */}
        <footer className="mt-8 border-t border-border pt-6 sm:mt-12">
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground sm:grid-cols-4 sm:gap-6 sm:text-sm">
            <a href="https://giveth.io/project/decentralized-cleanup-network" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              DONATE ON GIVETH
            </a>
            <a href="https://paragraph.com/@decleanupnet" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              READ PUBLICATIONS
            </a>
            <a href="https://decleanup.net/litepaper" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              LITEPAPER
            </a>
            <a href="https://decleanup.net/tokenomics" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              TOKENOMICS
            </a>
            <a href="https://decleanup.net/userguide" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              USER GUIDE
            </a>
            <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              GITHUB
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfWCK4WmO9T-WJOOZwuDiG3yEJVX23RX_AkIa6tZHZ0J9Tf3w/viewform?usp=header" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              BUG REPORT
            </a>
            <a href="https://decleanup.net/docs" target="_blank" rel="noopener noreferrer" className="hover:text-brand-green text-center">
              DOCS
            </a>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <span>Powered by</span>
            <div className="flex h-6 items-center justify-center rounded bg-muted px-2 font-bold text-foreground">
              BASE
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
            <h3 className="mb-2 text-base font-bold uppercase tracking-wide text-foreground sm:text-lg">
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
