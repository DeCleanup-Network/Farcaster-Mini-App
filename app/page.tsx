'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SuccessModal } from '@/components/ui/success-modal'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { useAccount, useConnect, useChainId } from 'wagmi'
import { useFarcasterReady } from '@/lib/hooks/useFarcasterReady'
import { useFarcasterAutoConnect } from '@/lib/hooks/useFarcasterAutoConnect'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { AddAppModal } from '@/components/onboarding/AddAppModal'
import type { Connector } from 'wagmi'
import { Leaf, Award, Users, AlertCircle, Wallet, Heart, Loader2, X } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/verification'
import { claimImpactProductFromVerification, getClaimFee, getUserLevel } from '@/lib/contracts'
import { formatFeeEth } from '@/lib/utils'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_NAME } from '@/lib/wagmi'

const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'Basescan (Sepolia)'
  : 'Basescan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

export default function Home() {
  const router = useRouter()
  // Ensure ready() is called early on this landing page
  useFarcasterReady()
  // Auto-connect Farcaster wallet and account when in Mini App
  useFarcasterAutoConnect()
  
  const [mounted, setMounted] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showAddAppModal, setShowAddAppModal] = useState(false)
  const { isMiniApp } = useFarcaster()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
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
  const [hasSwitchedNetwork, setHasSwitchedNetwork] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{
    title: string
    message: string
    transactionHash?: string
  } | null>(null)
  const [claimFeeDisplay, setClaimFeeDisplay] = useState<{ fee: bigint; enabled: boolean } | null>(null)
  const [isIOSSafari, setIsIOSSafari] = useState(false)
  
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

  // In Mini App, prioritize Farcaster connector; otherwise use external connectors
  const primaryConnector: Connector | undefined = isMiniApp && farcasterConnector ? farcasterConnector : externalConnectors[0]

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setIsIOSSafari(true)
    }
  }, [])

  // Load claim fee when user can claim so they see it before pressing CLAIM LEVEL
  useEffect(() => {
    if (!cleanupStatus?.canClaim) {
      setClaimFeeDisplay(null)
      return
    }
    let cancelled = false
    getClaimFee()
      .then((info) => { if (!cancelled) setClaimFeeDisplay(info) })
      .catch(() => { if (!cancelled) setClaimFeeDisplay({ fee: BigInt(0), enabled: false }) })
    return () => { cancelled = true }
  }, [cleanupStatus?.canClaim])

  const handleConnect = async (connector?: Connector) => {
    if (!connector) {
      console.warn('No connector provided to handleConnect')
      return
    }
    
    // On desktop Safari, ensure connector is ready before connecting
    if (!connector.ready) {
      console.log('Connector not ready, waiting...', connector.name)
      // Wait up to 2 seconds for connector to become ready
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500))
        if (connector.ready) {
          console.log('Connector ready after waiting')
          break
        }
      }
      
      if (!connector.ready) {
        console.warn('Connector still not ready after waiting:', connector.name)
        alert('Wallet is not ready. Please ensure your wallet extension is unlocked and try again.')
        return
      }
    }
    
    try {
      console.log('Connecting with connector:', connector.name, connector.id, 'ready:', connector.ready)
      await connectAsync({ connector })
    } catch (error: any) {
      console.error('Wallet connect failed:', error)
      // Don't show alert for user rejections
      if (error?.code !== 4001 && !error?.message?.includes('rejected')) {
        // Show alert for other errors on desktop Safari
        const errorMsg = error?.message || String(error || 'Unknown error')
        if (!errorMsg.toLowerCase().includes('user') && !errorMsg.toLowerCase().includes('reject')) {
          alert(`Connection failed: ${errorMsg}. Please ensure your wallet is unlocked and try again.`)
        }
      }
    }
  }

  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
    
    // Show onboarding for new sessions (check sessionStorage)
    // This ensures onboarding appears on each new session (when opening links)
    // but not on page reloads within the same session
    if (typeof window !== 'undefined') {
      const hasSeenOnboardingThisSession = sessionStorage.getItem('decleanup_onboarding_seen_session')
      if (!hasSeenOnboardingThisSession) {
        setShowOnboarding(true)
      }
    }
  }, [])
  
  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    if (typeof window !== 'undefined') {
      // Mark onboarding as seen for this session only
      sessionStorage.setItem('decleanup_onboarding_seen_session', 'true')
      
      // Check if user has already seen the add app modal
      const hasSeenAddAppModal = sessionStorage.getItem('decleanup_add_app_modal_seen')
      if (!hasSeenAddAppModal && (isMiniApp || typeof (window as any).minikit !== 'undefined')) {
        // Show add app modal after a short delay
        setTimeout(() => {
          setShowAddAppModal(true)
        }, 500)
      }
    }
  }

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
                <X className="h-4 w-4" aria-hidden="true" />
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
            <p className="mx-auto mt-4 text-xs text-muted-foreground sm:text-sm">
              Connect your wallet on {REQUIRED_CHAIN_NAME} to get started
            </p>
          </div>

          {mounted && isConnected ? (
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
                          {claimFeeDisplay !== null && (
                            <p className="mt-1 text-xs text-gray-400">
                              {claimFeeDisplay.enabled && claimFeeDisplay.fee > BigInt(0)
                                ? `Claim Impact Product fee: ${formatFeeEth(claimFeeDisplay.fee)} ETH (you pay when you confirm below). Have some ETH on Base for gas.`
                                : 'No Claim Impact Product fee. Only have some ETH on Base for gas.'}
                            </p>
                          )}
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

              {/* Claim Impact Product fee — shown before Claim Level button so user sees it first */}
              {cleanupStatus?.canClaim && claimFeeDisplay !== null && (
                <div className="mx-auto max-w-md rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2">
                  <p className="text-xs text-gray-400">
                    {claimFeeDisplay.enabled && claimFeeDisplay.fee > BigInt(0)
                      ? `Claim Impact Product fee: ${formatFeeEth(claimFeeDisplay.fee)} ETH (you pay when you confirm). Have some ETH on Base for gas.`
                      : 'No Claim Impact Product fee. Only have some ETH on Base for gas.'}
                  </p>
                </div>
              )}

              {mounted && isIOSSafari && isConnected && (
                <p className="mx-auto max-w-md text-center text-xs text-muted-foreground">
                  On iOS Safari: if the wallet opens but no transaction appears, return here and tap again.
                </p>
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
                  title={
                    /* single title: fee when can claim, reason when disabled */
                    cleanupStatus?.canClaim
                      ? (claimFeeDisplay?.enabled && claimFeeDisplay?.fee && claimFeeDisplay.fee > BigInt(0)
                          ? `Claim Impact Product fee: ${formatFeeEth(claimFeeDisplay.fee)} ETH`
                          : undefined)
                      : cleanupStatus?.reason
                  }
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
                            // BUG FIX: Only show success modal when actually claimed, not on timeout
                            if (status.claimed) {
                              clearInterval(pollInterval)
                              setSuccessModalData({
                                title: 'Impact Product Minted!',
                                message: 'Your Impact Product has been successfully minted!',
                                transactionHash: hash,
                              })
                              setShowSuccessModal(true)
                              // Don't auto-redirect - let user close modal manually
                            } else if (pollCount >= maxPolls) {
                              // Timeout reached but not claimed - show different message
                              clearInterval(pollInterval)
                              setSuccessModalData({
                                title: 'Transaction Submitted',
                                message: 'Transaction submitted but confirmation is taking longer than expected. Please check your profile or explorer to confirm the mint status.',
                                transactionHash: hash,
                              })
                              setShowSuccessModal(true)
                              // Don't auto-redirect - let user close modal manually
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
                            // Don't auto-redirect - let user close modal manually
                          }
                        }
                      }, 2000) // Poll every 2 seconds

                      // Fallback: stop polling after max time (but don't auto-redirect)
                      setTimeout(() => {
                        clearInterval(pollInterval)
                        // Don't auto-redirect - let user check status manually
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
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Minting Impact Product…</span>
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
          ) : null}
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
                  Earn 3 DCU when friends submit and verify their first cleanup
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-foreground/90">
                Share your referral link and earn rewards when your friends join DeCleanup Rewards!
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                {/* Share button - only show in Farcaster Mini App */}
                {isMiniApp && (
                  <Button
                    onClick={async () => {
                      try {
                      const { generateReferralLink, shareCast, formatReferralMessage } = await import('@/lib/farcaster')
                        // Use Farcaster miniapp URL for Farcaster sharing
                        const referralLink = generateReferralLink(address, 'farcaster', false)
                        // Format message with link text - link will also be passed as embed for pressability
                        const message = formatReferralMessage(referralLink, 'farcaster').trim()
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
                        Share
                  </Button>
                )}

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
                  <strong className="text-brand-green">How it works:</strong> When someone uses your referral link to submit their first cleanup and it gets verified, you both earn <strong className="text-foreground">3 DCU</strong>!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Footer - Powered by Base */}
        <footer className="mt-8 border-t border-border pt-6 sm:mt-12">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <span>Powered by</span>
            <div className="flex h-6 items-center justify-center rounded bg-muted px-2 font-bold text-foreground">
              Base
            </div>
          </div>
        </footer>

        {/* Success Modal */}
        {showSuccessModal && successModalData && (
          <SuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              // Store title before clearing state to check for redirect
              const shouldRedirect = successModalData.title.includes('Impact Product') || successModalData.title.includes('Minted')
              setShowSuccessModal(false)
              setSuccessModalData(null)
              // Redirect to profile page after claiming Impact Product
              if (shouldRedirect) {
                // Use setTimeout to ensure state updates complete before navigation
                setTimeout(() => {
                  router.push('/profile')
                }, 100)
              }
            }}
            title={successModalData.title}
            message={successModalData.message}
            transactionHash={successModalData.transactionHash}
            explorerUrl={successModalData.transactionHash ? getExplorerTxUrl(successModalData.transactionHash as `0x${string}`) : undefined}
            explorerName={BLOCK_EXPLORER_NAME}
            showShare={successModalData.title.includes('Minted')}
            level={cleanupStatus?.level}
          />
        )}

      </main>

      {/* Onboarding Flow */}
      {showOnboarding && <OnboardingFlow onComplete={handleOnboardingComplete} />}

      {/* Add App Modal - shows after onboarding */}
      <AddAppModal
        isOpen={showAddAppModal}
        onClose={() => {
          setShowAddAppModal(false)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('decleanup_add_app_modal_seen', 'true')
          }
        }}
      />
    </div>
  )
}
