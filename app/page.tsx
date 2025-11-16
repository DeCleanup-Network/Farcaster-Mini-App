'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { useFarcaster } from '@/components/farcaster/FarcasterProvider'
import { useAccount, useConnect, useChainId, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { Trash2, Award, Users, AlertCircle, Wallet, Heart, Loader2 } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/verification'
import { claimImpactProductFromVerification } from '@/lib/contracts'
import { isFarcasterContext } from '@/lib/farcaster'

const CELO_SEPOLIA_CHAIN_ID = 11142220

export default function Home() {
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

  // Auto-switch to Celo Sepolia after connection
  useEffect(() => {
    if (isConnected && chainId !== CELO_SEPOLIA_CHAIN_ID && !hasSwitchedNetwork) {
      const attemptSwitch = async () => {
        try {
          console.log(`Auto-switching from chain ${chainId} to Celo Sepolia (${CELO_SEPOLIA_CHAIN_ID})...`)
          await switchChain({ chainId: CELO_SEPOLIA_CHAIN_ID })
          setHasSwitchedNetwork(true)
        } catch (error: any) {
          console.log('Auto network switch failed or was rejected:', error)
          // Don't set hasSwitchedNetwork so user can try again if needed
        }
      }
      // Wait a bit after connection before attempting switch
      const timeout = setTimeout(attemptSwitch, 1000)
      return () => clearTimeout(timeout)
    } else if (chainId === CELO_SEPOLIA_CHAIN_ID) {
      setHasSwitchedNetwork(true)
    }
  }, [isConnected, chainId, hasSwitchedNetwork, switchChain])

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
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green">
              <Trash2 className="h-5 w-5 text-black" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold uppercase tracking-tight text-white sm:text-lg">
                DECLEANUP NETWORK
              </h1>
              <p className="text-[10px] font-medium text-gray-400 sm:text-xs">
                CLEAN UP, SNAP, EARN
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              Self-tokenize environmental cleanup efforts. Apply with your cleanup results to receive a DeCleanup Impact Product, earn community token and progress through levels.
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
                <div className={`mx-auto max-w-md rounded-lg border p-4 ${
                  cleanupStatus.canClaim
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
                    disabled={cleanupStatus?.hasPendingCleanup || false}
                    className={`w-full gap-2 sm:w-auto ${
                      cleanupStatus?.hasPendingCleanup
                        ? 'border-gray-700 bg-gray-900 text-gray-500 cursor-not-allowed'
                        : 'bg-brand-yellow text-black hover:bg-[#e6e600]'
                    }`}
                    title={cleanupStatus?.hasPendingCleanup ? 'You have a cleanup pending verification. Please wait for verification before submitting a new cleanup.' : ''}
                  >
                    <Trash2 className="h-5 w-5" />
                    APPLY WITH CLEANUP
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
                              alert(
                                `✅ Claim successful!\n\n` +
                                `Transaction Hash: ${hash}\n\n` +
                                `Your Impact Product NFT has been minted!\n\n` +
                                `View on CeloScan: https://sepolia.celoscan.io/tx/${hash}`
                              )
                              // Redirect to profile to see the new NFT
                              window.location.href = '/profile'
                            }
                          }
                        } catch (error) {
                          console.error('Error polling status:', error)
                          if (pollCount >= maxPolls) {
                            clearInterval(pollInterval)
                            alert(
                              `⚠️ Transaction submitted but status check failed.\n\n` +
                              `Transaction Hash: ${hash}\n\n` +
                              `Please check your profile or CeloScan to confirm.\n\n` +
                              `View on CeloScan: https://sepolia.celoscan.io/tx/${hash}`
                            )
                            window.location.href = '/profile'
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
                      const errorMessage = error?.message || String(error)
                      alert(`Failed to claim: ${errorMessage}`)
                      setIsClaiming(false)
                    }
                  }}
                  className={`w-full gap-2 border-2 font-semibold uppercase sm:w-auto ${
                    cleanupStatus?.canClaim
                      ? 'bg-brand-yellow text-black hover:bg-[#e6e600] border-brand-yellow'
                      : 'border-gray-700 bg-gray-900 text-gray-500 cursor-not-allowed'
                  }`}
                  title={cleanupStatus?.reason}
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      CLAIMING...
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

        {/* Features Grid - Two Cards */}
        <section className="mb-8 grid gap-4 sm:mb-12 sm:grid-cols-2 sm:gap-6">
          <Link href="/cleanup" className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-brand-green sm:p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-green/20">
              <Trash2 className="h-6 w-6 text-brand-green" />
            </div>
            <h3 className="mb-2 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
              Submit Cleanup
            </h3>
            <p className="text-sm leading-relaxed text-gray-400 sm:text-base">
              Document your cleanup efforts with before/after photos and geotagged locations.
            </p>
          </Link>

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
        </section>

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
                CELO
              </div>
            </div>
          </div>
        </footer>

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
