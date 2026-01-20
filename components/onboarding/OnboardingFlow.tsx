'use client'

import { useState, useEffect } from 'react'
import { X, Leaf, Award, Users, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface OnboardingFlowProps {
  onComplete: () => void
}

// IPFS gateways with fallbacks for faster loading
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
]

/**
 * Check if a string is a full URL (starts with http:// or https://)
 */
function isFullUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

/**
 * Get image URL - supports both full URLs (with ?filename=) and IPFS hashes
 */
function getImageUrl(value: string, gatewayIndex: number = 0): string {
  // If it's already a full URL, use it directly (preserves ?filename= parameter)
  if (isFullUrl(value)) {
    return value
  }
  // Otherwise, treat it as an IPFS hash and construct URL
  const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0]
  return `${gateway}${value}`
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({})
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set())

  // Onboarding images - supports full URLs (with ?filename=) or IPFS hashes
  const imageSources = [
    process.env.NEXT_PUBLIC_ONBOARDING_IMAGE_1 || 'bafybeigfymrdokx3hkl2asb7zjtqzy3e5n2ffvzx6fbsfkedmortfhivvy',
    process.env.NEXT_PUBLIC_ONBOARDING_IMAGE_2 || 'bafybeihphf34gm5ivemhhmkvq5csyaohow3bk2gxj54fclpfacnv3euniu',
    process.env.NEXT_PUBLIC_ONBOARDING_IMAGE_3 || 'bafybeid5buaqdqqriiexbw7wyntmq5z4ptvqoojxe52j5a657n47k3qdqa',
    process.env.NEXT_PUBLIC_ONBOARDING_IMAGE_4 || 'bafybeibk6v4ozxyrpjvumaeavway2taejbq536rrogon4bfhmnr7ixzvpa',
  ]

  const steps = [
    {
      icon: Leaf,
      title: 'Submit Your Cleanup',
      description: 'Take before and after photos of your environmental cleanup. Add location and details to show your impact.',
      imageSource: imageSources[0],
    },
    {
      icon: Award,
      title: 'Earn Impact Products',
      description: 'Get your cleanup verified by the community. Claim your Impact Product NFT and progress through 10 levels.',
      imageSource: imageSources[1],
    },
    {
      icon: TrendingUp,
      title: 'Earn Token Rewards',
      description: 'Receive $bDCU tokens for each level, maintain streaks, refer friends, and contribute to the community.',
      imageSource: imageSources[2],
    },
    {
      icon: Users,
      title: 'Join the Movement',
      description: 'Tokenize your environmental impact and be part of a global community making a real difference.',
      imageSource: imageSources[3],
    },
  ]

  // Preload all images on mount for faster transitions
  useEffect(() => {
    const preloadImages = async () => {
      const promises = steps.map(async (step, index) => {
        const img = new window.Image()
        return new Promise<void>((resolve) => {
          // If it's a full URL, use it directly (no fallback needed)
          if (isFullUrl(step.imageSource)) {
            img.src = step.imageSource
            img.onload = () => {
              setPreloadedImages((prev) => new Set([...prev, index]))
              resolve()
            }
            img.onerror = () => {
              console.warn(`Failed to preload image ${index}:`, step.imageSource)
              resolve() // Continue even if preload fails
            }
          } else {
            // For IPFS hashes, try gateways with fallback
            let gatewayIndex = 0
            const tryGateway = () => {
              if (gatewayIndex < IPFS_GATEWAYS.length) {
                img.src = getImageUrl(step.imageSource, gatewayIndex)
              } else {
                console.warn(`Failed to preload image ${index} from all gateways`)
                resolve() // All gateways failed
              }
            }
            img.onload = () => {
              setPreloadedImages((prev) => new Set([...prev, index]))
              resolve()
            }
            img.onerror = () => {
              gatewayIndex++
              tryGateway()
            }
            tryGateway()
          }
        })
      })
      await Promise.allSettled(promises)
    }
    preloadImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Get current image URL with fallback
  const getCurrentImageUrl = (stepIndex: number): string => {
    const imageSource = steps[stepIndex].imageSource
    
    // If it's a full URL, use it directly
    if (isFullUrl(imageSource)) {
      return imageSource
    }
    
    // For IPFS hashes, try fallback gateway if primary failed
    if (imageErrors[stepIndex]) {
      return getImageUrl(imageSource, 1) // Try fallback gateway
    }
    return getImageUrl(imageSource, 0) // Primary gateway
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  const currentStepData = steps[currentStep]
  const Icon = currentStepData.icon

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-4 overscroll-contain safe-area-inset" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}>
      <div className="relative mx-auto w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-lg border-2 border-brand-green bg-gray-900 p-4 sm:p-6 shadow-2xl flex flex-col overscroll-contain">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors z-10"
          aria-label="Skip onboarding"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Step indicator */}
        <div className="mb-4 flex items-center justify-center gap-2 flex-shrink-0">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-[width,background-color] duration-300 ${
                index === currentStep
                  ? 'w-8 bg-brand-green'
                  : index < currentStep
                    ? 'w-2 bg-brand-green/50'
                    : 'w-2 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 text-center overflow-y-auto min-h-0">
          {/* Icon */}
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-brand-green/20 p-4">
              <Icon className="h-12 w-12 text-brand-green" />
            </div>
          </div>

          {/* Image */}
          <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800 relative max-h-[180px] sm:max-h-[240px]">
            {imageLoading[currentStep] && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <Loader2 className="h-8 w-8 text-brand-green motion-safe:animate-spin" />
              </div>
            )}
            <Image
              src={getCurrentImageUrl(currentStep)}
              alt={currentStepData.title}
              width={600}
              height={400}
              className={`h-full w-full object-cover transition-opacity duration-300 motion-safe:transition-opacity ${
                imageLoading[currentStep] ? 'opacity-0' : 'opacity-100'
              }`}
              unoptimized
              priority={currentStep === 0} // Priority load first image
              onLoadStart={() => {
                setImageLoading((prev) => ({ ...prev, [currentStep]: true }))
              }}
              onLoad={() => {
                setImageLoading((prev) => ({ ...prev, [currentStep]: false }))
              }}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement
                const imageSource = currentStepData.imageSource
                
                // If it's a full URL and failed, don't try fallbacks (URL is already complete)
                if (isFullUrl(imageSource)) {
                  console.error(`Failed to load image from URL:`, imageSource)
                  setImageErrors((prev) => ({ ...prev, [currentStep]: true }))
                  setImageLoading((prev) => ({ ...prev, [currentStep]: false }))
                  img.style.display = 'none'
                  return
                }
                
                // For IPFS hashes, try next gateway
                let currentGatewayIndex = 0
                for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
                  if (img.src.includes(IPFS_GATEWAYS[i].replace('/ipfs/', ''))) {
                    currentGatewayIndex = i
                    break
                  }
                }
                
                if (currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
                  // Try next gateway
                  img.src = getImageUrl(imageSource, currentGatewayIndex + 1)
                } else {
                  // All gateways failed
                  console.error(`Failed to load image from all IPFS gateways:`, imageSource)
                  setImageErrors((prev) => ({ ...prev, [currentStep]: true }))
                  setImageLoading((prev) => ({ ...prev, [currentStep]: false }))
                  img.style.display = 'none'
                }
              }}
            />
          </div>

          {/* Title */}
          <h2 className="mb-2 text-2xl font-bold uppercase tracking-wide text-white">
            {currentStepData.title}
          </h2>

          {/* Description */}
          <p className="text-sm leading-relaxed text-gray-300">
            {currentStepData.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-shrink-0 mt-4">
          {currentStep > 0 && (
            <Button
              onClick={() => setCurrentStep(currentStep - 1)}
              variant="outline"
              className="flex-1 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            className="flex-1 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
          >
            {currentStep === steps.length - 1 ? (
              <>
                Get Started
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

