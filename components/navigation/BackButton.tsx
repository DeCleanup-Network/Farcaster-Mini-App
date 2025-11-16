'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

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
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  )
}

