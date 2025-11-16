'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/navigation/BackButton'
import { Camera, Upload, Loader2, Check, ExternalLink, X } from 'lucide-react'
import {
  checkRecyclablesReserve,
  getRemainingRecyclablesReserve,
  submitRecyclables,
  getUserRecyclablesCount,
} from '@/lib/contracts'
import { uploadToIPFS } from '@/lib/ipfs'

export default function RecyclablesPage() {
  const { address, isConnected } = useAccount()
  const router = useRouter()
  const [photo, setPhoto] = useState<File | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reserveAvailable, setReserveAvailable] = useState(true)
  const [remainingReserve, setRemainingReserve] = useState(0)
  const [userCount, setUserCount] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isConnected || !address) return

    async function checkReserve() {
      try {
        const available = await checkRecyclablesReserve()
        const remaining = await getRemainingRecyclablesReserve()
        const count = await getUserRecyclablesCount(address)
        
        setReserveAvailable(available)
        setRemainingReserve(remaining)
        setUserCount(count)
      } catch (error) {
        console.error('Error checking reserve:', error)
      }
    }

    checkReserve()
  }, [address, isConnected])

  const handlePhotoCapture = (type: 'photo' | 'receipt') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/jpg,image/heic'
    input.capture = 'environment'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Image size must be less than 10 MB')
          return
        }
        if (type === 'photo') {
          setPhoto(file)
        } else {
          setReceipt(file)
        }
      }
    }
    input.click()
  }

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first')
      return
    }

    if (!photo) {
      alert('Please upload a photo of separated recyclables')
      return
    }

    if (!reserveAvailable) {
      // Redirect to Recy App
      window.open('https://app.recy.life/', '_blank')
      return
    }

    setIsSubmitting(true)
    try {
      // Upload photos to IPFS
      console.log('Uploading recyclables photos to IPFS...')
      const photoHash = await uploadToIPFS(photo).catch((error) => {
        console.error('Error uploading recyclables photo:', error)
        throw new Error(`Failed to upload photo: ${error.message}`)
      })
      
      const receiptHash = receipt 
        ? await uploadToIPFS(receipt).catch((error) => {
            console.error('Error uploading receipt:', error)
            throw new Error(`Failed to upload receipt: ${error.message}`)
          })
        : { hash: '', url: '' }

      console.log('Photos uploaded:', { photoHash: photoHash.hash, receiptHash: receiptHash.hash })

      // Submit to contract
      console.log('Submitting to contract...')
      await submitRecyclables(photoHash.hash, receiptHash.hash)
      
      setSubmitted(true)
      setPhoto(null)
      setReceipt(null)
      
      // Refresh user count
      const count = await getUserRecyclablesCount(address)
      setUserCount(count)
      
      // Refresh reserve
      const available = await checkRecyclablesReserve()
      const remaining = await getRemainingRecyclablesReserve()
      setReserveAvailable(available)
      setRemainingReserve(remaining)
      
      // Redirect to home after 3 seconds
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch (error) {
      console.error('Error submitting recyclables:', error)
      alert('Failed to submit recyclables. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-white">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to submit recyclables.
          </p>
          <BackButton href="/" />
        </div>
      </div>
    )
  }

  // Reserve finished - redirect to Recy App
  if (!reserveAvailable) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <Check className="mx-auto mb-4 h-16 w-16 text-brand-green" />
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-white">
            Reserve Finished
          </h2>
          <p className="mb-6 text-gray-400">
            The cRECY token reserve has been exhausted. Please visit Recy App to continue earning rewards for recycling.
          </p>
          <Button
            onClick={() => window.open('https://app.recy.life/', '_blank')}
            className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
          >
            Visit Recy App
            <ExternalLink className="h-4 w-4" />
          </Button>
          <div className="mt-4">
            <BackButton href="/" />
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <Check className="mx-auto mb-4 h-16 w-16 text-brand-green" />
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-white">
            Submission Successful!
          </h2>
          <p className="mb-6 text-gray-400">
            Your recyclables submission has been received. After verification, you will receive 10 cRECY tokens.
          </p>
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-800 p-4">
            <p className="text-sm font-medium text-brand-green">
              Your Submissions: {userCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Remaining Reserve: {remainingReserve.toFixed(0)} cRECY
            </p>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Redirecting to home page...
          </p>
          <BackButton href="/" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <BackButton href="/" />
        </div>
        
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
            Submit Recyclables
          </h1>
          <p className="mb-4 text-sm text-gray-400">
            Submit proof of separated recyclables to earn 10 cRECY tokens per submission.
          </p>
          
          {/* Recy App Partner Info */}
          <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="mb-2 text-xs font-medium text-gray-300">
              In Partnership with Recy App
            </p>
            <p className="mb-3 text-xs text-gray-400">
              Recy App helps end waste pollution at its source. Transform how we think about trash and recycling.
            </p>
            <a
              href="https://app.recy.life/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-green hover:text-[#4a9a26]"
            >
              Learn more about Recy App
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm font-medium text-brand-green">
              Remaining Reserve: {remainingReserve.toFixed(0)} cRECY
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Your Submissions: {userCount}
            </p>
            {remainingReserve === 5000 && (
              <p className="mt-2 text-xs text-gray-500 italic">
                * Placeholder for testing. Actual reserve will be available on mainnet.
              </p>
            )}
          </div>
        </div>

        {/* Photo Upload */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Photo of Separated Recyclables *
          </label>
          {photo ? (
            <div className="relative mb-4">
              <img
                src={URL.createObjectURL(photo)}
                alt="Recyclables"
                className="h-64 w-full rounded-lg object-cover"
              />
              <button
                onClick={() => setPhoto(null)}
                className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handlePhotoCapture('photo')}
              className="flex h-64 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900"
            >
              <Camera className="mb-2 h-12 w-12 text-gray-500" />
              <p className="text-sm text-gray-400">Tap to upload photo</p>
            </button>
          )}
        </div>

        {/* Receipt Upload (Optional) */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Receipt (Optional)
          </label>
          {receipt ? (
            <div className="relative mb-4">
              <img
                src={URL.createObjectURL(receipt)}
                alt="Receipt"
                className="h-64 w-full rounded-lg object-cover"
              />
              <button
                onClick={() => setReceipt(null)}
                className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handlePhotoCapture('receipt')}
              className="flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900"
            >
              <Upload className="mb-2 h-8 w-8 text-gray-500" />
              <p className="text-xs text-gray-400">Tap to upload receipt (optional)</p>
            </button>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!photo || isSubmitting || !reserveAvailable}
          className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Submit Recyclables
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-xs text-gray-500">
          After verification, you will receive 10 cRECY tokens. Reserve: {remainingReserve.toFixed(0)} cRECY remaining.
        </p>
      </div>
    </div>
  )
}
