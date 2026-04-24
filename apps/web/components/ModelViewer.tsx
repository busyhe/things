'use client'

import { useEffect, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'

type Props = {
  src: string
  alt: string
  poster?: string
  className?: string
}

export function getModelExtension(url: string): string {
  const cleaned = url.split('?')[0]?.split('#')[0] ?? ''
  const dot = cleaned.lastIndexOf('.')
  if (dot < 0) return ''
  return cleaned.slice(dot + 1).toLowerCase()
}

export function isModelFile(url: string | undefined): boolean {
  if (!url) return false
  const ext = getModelExtension(url)
  return ext === 'glb' || ext === 'gltf' || ext === 'stl' || ext === '3mf'
}

export function ModelViewer({ src, alt, poster, className }: Props) {
  const ext = getModelExtension(src)
  const isWebNative = ext === 'glb' || ext === 'gltf'
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    if (!isWebNative) return
    let cancelled = false
    import('@google/model-viewer').then(() => {
      if (!cancelled) setRegistered(true)
    })
    return () => {
      cancelled = true
    }
  }, [isWebNative])

  if (!isWebNative) {
    return (
      <div
        style={{ width: '500px', height: '500px', maxWidth: '100%' }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-black/20 bg-black/[0.03] p-6 text-center text-black/60',
          className
        )}
        role="status"
      >
        <span className="text-sm font-medium uppercase tracking-wide">.{ext || 'unknown'}</span>
        <span className="text-xs">
          该格式的在线预览即将上线
          <br />
          Preview for this format is coming soon
        </span>
      </div>
    )
  }

  if (!registered) {
    return (
      <div
        style={{ width: '500px', height: '500px', maxWidth: '100%' }}
        className={cn('flex items-center justify-center text-black/40', className)}
        role="status"
      >
        <span className="text-sm">Loading 3D viewer…</span>
      </div>
    )
  }

  return (
    <model-viewer
      src={src}
      alt={alt}
      poster={poster}
      camera-controls
      auto-rotate
      shadow-intensity="1"
      exposure="1"
      touch-action="pan-y"
      style={{ width: '500px', height: '500px', maxWidth: '100%' }}
      className={cn('block bg-transparent', className)}
    />
  )
}
