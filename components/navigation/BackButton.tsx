'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

// DeCleanup logo icon URL from manifest
const LOGO_ICON_URL = 'https://gateway.pinata.cloud/ipfs/bafkreig6ctmk5it4ppu67ljtmxjcrv2zug7rvccj5i52ji5s2qli5nww7a?filename=DCUIconNEW.png'

interface BackButtonProps {
  href?: string
  label?: string
}

export function BackButton({ href, label = 'Back' }: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900"
    >
      <div className="relative h-5 w-5 rounded overflow-hidden bg-black border border-gray-700 flex items-center justify-center p-0.5">
        <Image
          src={LOGO_ICON_URL}
          alt="DeCleanup"
          fill
          className="object-contain"
          style={{
            // Remove white background - make white transparent
            filter: 'brightness(1.1) contrast(1.1)',
            mixBlendMode: 'normal',
          }}
          sizes="20px"
        />
      </div>
      {label}
    </Button>
  )
}

