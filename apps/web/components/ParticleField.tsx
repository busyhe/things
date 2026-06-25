'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@workspace/ui/lib/utils'

type Props = {
  /**
   * Whether the asset is still loading. While true the particles swirl in a
   * loose, object-shaped cloud. When it flips to false the cloud assembles onto
   * the target and fades out, revealing the real image/model underneath
   * (the "dissolve / materialize" transition).
   */
  active: boolean
  className?: string
  label?: string
}

// Detail-page palette: coral, slate-blue, gold, ink — on the warm cream bg.
const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [241, 126, 88],
  [51, 108, 138],
  [236, 188, 82],
  [28, 28, 28]
]

type Particle = {
  tx: number
  ty: number
  ca: number
  cr: number
  cs: number
  size: number
  col: readonly [number, number, number]
  tw: number
}

const RESOLVE_MS = 900
const MAX_RADIUS = 260

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function ParticleField({ active, className, label = 'Loading' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const activeRef = useRef(active)
  const reduceMotion = useReducedMotion()
  const reduceRef = useRef(Boolean(reduceMotion))
  const kickRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    reduceRef.current = Boolean(reduceMotion)
  }, [reduceMotion])

  // Surface prop changes to the render loop without tearing it down, then make
  // sure the loop is running so it can pick the transition up.
  useEffect(() => {
    activeRef.current = active
    kickRef.current?.()
  }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0
    let H = 0
    let CX = 0
    let CY = 0
    let R = 0
    let dpr = 1
    let particles: Particle[] = []

    // Particles target a disc roughly where the asset will appear; each also
    // carries an orbit (ca/cr/cs) describing its loose-cloud offset while loading.
    const buildParticles = () => {
      const count = reduceRef.current ? 90 : 260
      const targetR = R * 0.56
      particles = []
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.sqrt(Math.random()) * targetR
        particles.push({
          tx: CX + Math.cos(angle) * radius,
          ty: CY + Math.sin(angle) * radius,
          ca: Math.random() * Math.PI * 2,
          cr: R * (0.26 + Math.random() * 0.3),
          cs: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random()),
          size: 1.3 + Math.random() * 2.4,
          col: PALETTE[(Math.random() * PALETTE.length) | 0]!,
          tw: 0.6 + Math.random() * 1.4
        })
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = rect.width
      H = rect.height
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      CX = W / 2
      CY = H / 2
      R = Math.min(Math.min(W, H) / 2, MAX_RADIUS)
      buildParticles()
    }

    let phase: 'loading' | 'resolving' | 'idle' = activeRef.current ? 'loading' : 'idle'
    let phaseStart = performance.now()
    let lastActive = activeRef.current
    let raf = 0
    let intersecting = true

    const shouldPlay = () => phase !== 'idle' && intersecting && document.visibilityState !== 'hidden'

    const draw = (now: number) => {
      if (activeRef.current && !lastActive) {
        phase = 'loading'
        phaseStart = now
        buildParticles()
      } else if (!activeRef.current && lastActive && phase === 'loading') {
        phase = 'resolving'
        phaseStart = now
      }
      lastActive = activeRef.current

      if (phase === 'resolving' && now - phaseStart >= RESOLVE_MS) phase = 'idle'

      ctx.clearRect(0, 0, W, H)
      if (phase === 'idle') {
        raf = 0
        return
      }

      const t = now / 1000
      const reduce = reduceRef.current
      const p = phase === 'resolving' ? Math.min(1, (now - phaseStart) / RESOLVE_MS) : 0
      const k = easeInOutCubic(p)

      for (const q of particles) {
        let x: number
        let y: number
        let a: number

        if (phase === 'loading') {
          if (reduce) {
            x = q.tx
            y = q.ty
            a = 0.32 + 0.22 * Math.sin(t * 1.2 + q.ca)
          } else {
            q.ca += 0.01 * q.cs
            const breath = 0.78 + 0.22 * Math.sin(t * 1.2 + q.ca)
            x = q.tx + Math.cos(q.ca) * q.cr * breath
            y = q.ty + Math.sin(q.ca * 1.1) * q.cr * 0.72 * breath
            a = 0.5 + 0.32 * Math.sin(t * q.tw + q.ca)
          }
        } else {
          // resolving: lerp the cloud offset back onto the target, hold, then fade
          if (reduce) {
            x = q.tx
            y = q.ty
            a = 0.4 * (1 - k)
          } else {
            const ox = Math.cos(q.ca) * q.cr * 0.8
            const oy = Math.sin(q.ca * 1.1) * q.cr * 0.56
            x = q.tx + ox * (1 - k)
            y = q.ty + oy * (1 - k)
            const fade = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45
            a = (0.55 + 0.3 * Math.sin(t * q.tw + q.ca)) * Math.max(0, fade)
          }
        }

        if (a <= 0.01) continue
        ctx.globalAlpha = Math.min(1, a)
        ctx.fillStyle = `rgb(${q.col[0]},${q.col[1]},${q.col[2]})`
        ctx.beginPath()
        ctx.arc(x, y, q.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (shouldPlay()) raf = requestAnimationFrame(draw)
      else raf = 0
    }

    const kick = () => {
      if (!raf && (activeRef.current || phase !== 'idle')) {
        raf = requestAnimationFrame(draw)
      }
    }
    kickRef.current = kick

    const resizeObserver = new ResizeObserver(() => {
      resize()
      kick()
    })
    resizeObserver.observe(canvas)
    resize()

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        intersecting = entry.isIntersecting
        kick()
      },
      { threshold: 0 }
    )
    intersectionObserver.observe(canvas)

    const onVisibility = () => kick()
    document.addEventListener('visibilitychange', onVisibility)

    if (activeRef.current) raf = requestAnimationFrame(draw)

    return () => {
      kickRef.current = null
      if (raf) cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div className={cn('pointer-events-none', className)} role="status" aria-live="polite" aria-hidden={!active}>
      <span className="sr-only">{label}</span>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  )
}
