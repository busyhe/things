'use client'

import { useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Flag, Share2, Volume2, X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import type { ThiingsItem } from '@/lib/thiings-data'

type Props = {
  item: ThiingsItem
}

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 p-2 text-black/80 transition-colors hover:bg-black/20'

const actionButton =
  'mt-6 h-9 w-full rounded-full bg-black px-6 py-2 text-white shadow transition-colors hover:bg-gray-800 md:mt-8 md:w-auto'

export function ItemDetail({ item }: Props) {
  const router = useRouter()

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }, [router])

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    const shareData = {
      title: item.name,
      text: item.description,
      url: window.location.href
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // user cancelled — no-op
      }
      return
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href)
      } catch {
        // clipboard blocked — no-op
      }
    }
  }, [item.name, item.description])

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(item.image)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.name}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // network failed — no-op
    }
  }, [item.image, item.name])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#FEFCF7] p-4 text-black md:flex-row md:p-8">
      <div className="absolute top-4 right-4 z-10 flex gap-2 md:top-8 md:right-8">
        <button type="button" aria-label="Play audio" className={iconButton}>
          <Volume2 className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" aria-label="Share" className={iconButton} onClick={handleShare}>
          <Share2 className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" aria-label="Report issue" className={iconButton}>
          <Flag className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" aria-label="Close" className={iconButton} onClick={handleClose}>
          <X className="h-6 w-6" aria-hidden />
        </button>
      </div>

      <div className="relative mb-6 flex min-h-[200px] w-full items-center justify-center max-md:mt-8 md:mb-0 md:h-full md:w-1/2">
        <Image
          src={item.image}
          alt={item.name}
          width={1080}
          height={1080}
          sizes="(max-width: 768px) 100vw, 500px"
          className="mx-auto w-full max-w-[500px]"
          priority
        />
      </div>

      <div className="flex w-full flex-col justify-center p-4 md:w-1/2 md:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex cursor-pointer items-center rounded-md border border-black/30 bg-black/10 px-2 py-0.5 text-xs font-normal text-black/80"
            >
              {tag}
            </span>
          ))}
        </div>

        <h2 className="mb-2 text-3xl font-bold md:text-4xl">{item.name}</h2>

        <p className="text-base text-black/80 md:text-lg">{item.description}</p>

        <div className="flex gap-4">
          <Button className={cn(actionButton)} onClick={handleClose}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            <span className="max-md:hidden">Back to Grid</span>
            <span className="md:hidden">Back</span>
          </Button>
          <Button className={cn(actionButton)} onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            <span className="max-md:hidden">Download Image</span>
            <span className="md:hidden">Download</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
