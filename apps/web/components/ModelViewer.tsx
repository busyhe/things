'use client'

import { useEffect, useRef, useState } from 'react'
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

let modelViewerLoader: Promise<unknown> | null = null

function loadModelViewer(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!modelViewerLoader) {
    modelViewerLoader = import('@google/model-viewer')
  }
  return modelViewerLoader
}

const warmedSources = new Set<string>()

export function preloadModel(src: string | undefined): void {
  if (!src || typeof window === 'undefined') return
  const ext = getModelExtension(src)
  if (ext === 'glb' || ext === 'gltf') loadModelViewer()
  if (warmedSources.has(src)) return
  warmedSources.add(src)
  fetch(src, { mode: 'cors', credentials: 'omit' }).catch(() => {
    warmedSources.delete(src)
  })
}

type StlModelViewerProps = {
  src: string
  alt: string
  className?: string
}

function StlModelViewer({ src, alt, className }: StlModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let animationFrame = 0
    let cleanup: (() => void) | undefined

    setStatus('loading')

    Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/STLLoader.js'),
      import('three/examples/jsm/controls/OrbitControls.js')
    ])
      .then(([THREE, { STLLoader }, { OrbitControls }]) => {
        if (cancelled) return

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000)
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setClearColor(0x000000, 0)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.domElement.setAttribute('aria-label', alt)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.touchAction = 'none'
        renderer.domElement.style.width = '100%'
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.enablePan = false
        controls.minDistance = 0.1
        controls.maxDistance = 2000

        scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.2))
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
        keyLight.position.set(3, 4, 5)
        scene.add(keyLight)

        const loader = new STLLoader()
        let geometry: import('three').BufferGeometry | undefined
        let material: import('three').MeshStandardMaterial | undefined

        const resize = () => {
          const width = container.clientWidth
          const height = container.clientHeight
          if (width <= 0 || height <= 0) return
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height, false)
        }

        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(container)
        resize()

        loader.load(
          src,
          (loadedGeometry) => {
            if (cancelled) {
              loadedGeometry.dispose()
              return
            }

            geometry = loadedGeometry
            geometry.computeVertexNormals()
            geometry.computeBoundingBox()
            geometry.center()
            geometry.computeBoundingSphere()

            const radius = Math.max(geometry.boundingSphere?.radius ?? 1, 0.1)
            material = new THREE.MeshStandardMaterial({
              color: 0xd8d4cc,
              metalness: 0.05,
              roughness: 0.45
            })

            const mesh = new THREE.Mesh(geometry, material)
            scene.add(mesh)

            const distance = radius * 3.2
            camera.position.set(distance, distance * 0.8, distance)
            camera.near = Math.max(radius / 100, 0.01)
            camera.far = radius * 100
            camera.updateProjectionMatrix()
            controls.target.set(0, 0, 0)
            controls.minDistance = radius * 0.7
            controls.maxDistance = radius * 8
            controls.update()

            setStatus('ready')
          },
          undefined,
          () => {
            if (!cancelled) setStatus('error')
          }
        )

        const animate = () => {
          controls.update()
          renderer.render(scene, camera)
          animationFrame = window.requestAnimationFrame(animate)
        }
        animate()

        cleanup = () => {
          window.cancelAnimationFrame(animationFrame)
          resizeObserver.disconnect()
          controls.dispose()
          geometry?.dispose()
          material?.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [src, alt])

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-md bg-transparent', className)}
      role="img"
      aria-label={alt}
    >
      {status !== 'ready' && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-center text-sm text-black/40',
            status === 'error' && 'p-6 text-black/60'
          )}
          role="status"
        >
          {status === 'error' ? 'Unable to load 3D model' : 'Loading 3D viewer...'}
        </div>
      )}
    </div>
  )
}

export function ModelViewer({ src, alt, poster, className }: Props) {
  const ext = getModelExtension(src)
  const isWebNative = ext === 'glb' || ext === 'gltf'
  const isStl = ext === 'stl'
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    if (!isWebNative) return
    let cancelled = false
    loadModelViewer().then(() => {
      if (!cancelled) setRegistered(true)
    })
    return () => {
      cancelled = true
    }
  }, [isWebNative])

  if (isStl) {
    return <StlModelViewer src={src} alt={alt} className={className} />
  }

  if (!isWebNative) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-black/20 bg-black/[0.03] p-6 text-center text-black/60',
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
      <div className={cn('flex h-full w-full items-center justify-center text-black/40', className)} role="status">
        <span className="text-sm">Loading 3D viewer...</span>
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
      className={cn('block h-full w-full bg-transparent', className)}
    />
  )
}
