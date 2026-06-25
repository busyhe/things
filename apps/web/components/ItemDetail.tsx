'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Box, ChevronDown, Download, Flag, ImageIcon, Share2, Volume2, X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { shouldBypassImageOptimization, type ThiingsItem } from '@/lib/thiings'
import { ModelViewer, getModelExtension } from '@/components/ModelViewer'
import { ParticleField } from '@/components/ParticleField'

type Props = {
  item: ThiingsItem
}

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 p-2 text-black/80 transition-colors hover:bg-black/20'

const actionButton =
  'h-9 min-w-0 rounded-full bg-black px-2 py-2 text-xs text-white shadow transition-colors hover:bg-gray-800 sm:px-3 sm:text-sm xl:px-4'

const downloadButton =
  'h-9 w-full min-w-0 rounded-full bg-black px-2 py-2 text-xs text-white shadow transition-colors hover:bg-gray-800 sm:px-3 sm:text-sm xl:px-4'

type DownloadTarget = 'image' | 'model'

type ModelStage = {
  left: number
  top: number
  width: number
  height: number
  frameScale: number
}

export function ItemDetail({ item }: Props) {
  const router = useRouter()
  const downloadMenuRef = useRef<HTMLDivElement>(null)
  const modelAnchorRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [canHover, setCanHover] = useState(false)
  const [mode, setMode] = useState<'image' | 'model'>('image')
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [modelStage, setModelStage] = useState<ModelStage | null>(null)
  // Once the 3D view has been opened we keep the viewer mounted (just paused
  // via `active`) so toggling back and forth doesn't reload the model.
  const [modelMounted, setModelMounted] = useState(false)
  const hasModel = Boolean(item.model)

  useEffect(() => {
    if (mode === 'model') setModelMounted(true)
  }, [mode])
  const bypassImageOptimization = shouldBypassImageOptimization(item.image)

  // The model renders at the anchor (the original image spot), but its canvas
  // is oversized so it covers the whole window: centered on the anchor and
  // extended until every viewport edge is reached. frameScale compensates the
  // camera distance so the default model size still matches the anchor box.
  useEffect(() => {
    if (!hasModel) return
    const anchor = modelAnchorRef.current
    if (!anchor) return

    const update = () => {
      const rect = anchor.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const width = 2 * Math.max(cx, vw - cx)
      const height = 2 * Math.max(cy, vh - cy)
      setModelStage({
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        frameScale: height / rect.height
      })
    }

    update()
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(anchor)
    window.addEventListener('resize', update)
    document.addEventListener('scroll', update, true)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', update)
      document.removeEventListener('scroll', update, true)
    }
  }, [hasModel])

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)')
    const update = () => setCanHover(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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

  const handleDownload = useCallback(
    async (downloadTarget: DownloadTarget) => {
      const isModel = downloadTarget === 'model' && item.model
      const target = isModel ? item.model! : item.image
      const ext = isModel ? getModelExtension(item.model!) || 'glb' : 'png'
      try {
        const res = await fetch(target)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${item.name}.${ext}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch {
        // network failed — no-op
      }
    },
    [item.model, item.image, item.name]
  )

  const handleDownloadClick = useCallback(() => {
    if (!hasModel) {
      void handleDownload('image')
      return
    }

    setDownloadMenuOpen((open) => !open)
  }, [hasModel, handleDownload])

  const handleDownloadOption = useCallback(
    (downloadTarget: DownloadTarget) => {
      setDownloadMenuOpen(false)
      void handleDownload(downloadTarget)
    },
    [handleDownload]
  )

  useEffect(() => {
    if (!downloadMenuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (downloadMenuRef.current?.contains(event.target as Node)) return
      setDownloadMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [downloadMenuOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && downloadMenuOpen) {
        setDownloadMenuOpen(false)
        return
      }
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [downloadMenuOpen, handleClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#FEFCF7] text-black md:flex-row"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div
        className="absolute z-10 flex gap-2"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))'
        }}
      >
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

      <div className="relative mb-6 flex w-full items-center justify-center pt-14 md:mb-0 md:h-full md:min-h-[200px] md:w-[58%] md:pt-0 xl:w-[62%]">
        <ParticleField
          active={!loaded && mode === 'image'}
          label="Loading image"
          className="absolute inset-x-0 top-14 z-0 mx-auto aspect-square w-[min(100%,500px)] overflow-hidden md:inset-y-0 md:my-auto"
        />
        <motion.div
          className="relative z-10 mx-auto aspect-square w-[min(100%,500px)]"
          initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
          animate={
            mode === 'model' && item.model
              ? { opacity: 0, scale: 0.88, rotate: -4 }
              : loaded
                ? { opacity: 1, scale: 1, rotate: 0 }
                : { opacity: 0, scale: 0.85, rotate: -4 }
          }
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          whileHover={canHover && mode === 'image' ? { scale: 1.03, rotate: 1 } : undefined}
          style={{ pointerEvents: mode === 'model' && item.model ? 'none' : undefined }}
        >
          <Image
            src={item.image}
            alt={item.name}
            width={1080}
            height={1080}
            sizes="(max-width: 768px) 100vw, 500px"
            className="h-full w-full object-contain"
            priority
            unoptimized={bypassImageOptimization}
            onLoad={() => setLoaded(true)}
          />
        </motion.div>
        {hasModel && (
          /* Invisible anchor marking the original image-preview spot: the model
             renders centered here at its normal size. */
          <div
            ref={modelAnchorRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-14 mx-auto aspect-square w-[min(100%,500px)] md:inset-y-0 md:my-auto md:w-[min(92%,720px,82vh)] xl:w-[min(92%,820px,84vh)]"
          />
        )}
        {hasModel && item.model && (
          /* Fullscreen stage: the whole window is the 3D interaction/zoom area,
             while the canvas inside is centered on the anchor so the model sits
             at the original preview position. */
          <motion.div
            className="fixed inset-0 z-0 overflow-hidden"
            initial={{ opacity: 0, scale: 0.88, rotate: 4 }}
            animate={mode === 'model' ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.88, rotate: 4 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: mode === 'model' ? 'auto' : 'none' }}
          >
            {modelMounted && modelStage && (
              <div
                className="absolute"
                style={{
                  left: modelStage.left,
                  top: modelStage.top,
                  width: modelStage.width,
                  height: modelStage.height
                }}
              >
                <ModelViewer
                  src={item.model}
                  alt={item.name}
                  poster={item.modelPoster ?? item.image}
                  className="h-full w-full"
                  frameScale={modelStage.frameScale}
                  active={mode === 'model'}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="pointer-events-none relative z-10 flex w-full flex-col justify-center md:w-[42%] md:p-8 xl:w-[38%]">
        <div className="pointer-events-auto mb-4 flex flex-wrap gap-2">
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

        <div
          className={cn(
            'pointer-events-auto mt-6 grid gap-2 md:mt-8 md:gap-3',
            hasModel ? 'grid-cols-3' : 'grid-cols-2'
          )}
        >
          <Button className={cn(actionButton)} onClick={handleClose} aria-label="Back to grid">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline xl:hidden">Back</span>
            <span className="hidden xl:inline">Back to Grid</span>
          </Button>
          {hasModel && (
            <Button
              className={cn(actionButton)}
              onClick={() => setMode((m) => (m === 'image' ? 'model' : 'image'))}
              aria-label={mode === 'image' ? 'View 3D model' : 'View image'}
            >
              {mode === 'image' ? (
                <>
                  <Box className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline xl:hidden">3D</span>
                  <span className="hidden xl:inline">View 3D Model</span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline xl:hidden">Image</span>
                  <span className="hidden xl:inline">View Image</span>
                </>
              )}
            </Button>
          )}
          <div ref={downloadMenuRef} className="relative flex min-w-0">
            <Button
              className={cn(downloadButton)}
              onClick={handleDownloadClick}
              aria-label="Download"
              aria-haspopup={hasModel ? 'menu' : undefined}
              aria-expanded={hasModel ? downloadMenuOpen : undefined}
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Download</span>
              {hasModel && (
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', downloadMenuOpen && 'rotate-180')}
                  aria-hidden
                />
              )}
            </Button>

            {hasModel && downloadMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 overflow-hidden rounded-md border border-black/15 bg-white py-1 text-sm text-black shadow-lg md:w-52"
                role="menu"
              >
                <button
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none"
                  onClick={() => handleDownloadOption('image')}
                  role="menuitem"
                >
                  <ImageIcon className="mr-2 h-4 w-4" aria-hidden />
                  Download Image
                </button>
                <button
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none"
                  onClick={() => handleDownloadOption('model')}
                  role="menuitem"
                >
                  <Box className="mr-2 h-4 w-4" aria-hidden />
                  Download 3D File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
