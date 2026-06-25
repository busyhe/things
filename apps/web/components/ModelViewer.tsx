'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { ParticleField } from '@/components/ParticleField'

type Props = {
  src: string
  alt: string
  poster?: string
  className?: string
  /**
   * Whether the viewer is the active/visible view. When false the WebGL render
   * loop is paused so an off-screen or hidden model doesn't keep burning CPU/GPU.
   */
  active?: boolean
  /**
   * Camera distance multiplier (viewer height / anchor height). Lets the canvas
   * cover a much larger area (e.g. the whole window) while the model still
   * renders at the size it would have inside the smaller anchor box.
   */
  frameScale?: number
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

type ThreeModelExtension = 'stl' | '3mf'

type ThreeModelViewerProps = {
  src: string
  alt: string
  extension: ThreeModelExtension
  className?: string
  active?: boolean
  frameScale?: number
}

const appleTechGray = 0xaeb4bc
const autoRotateSpeed = 0.001
const defaultNativeCameraTarget = 'auto auto auto'
const defaultNativeFieldOfView = 'auto'

type NativeCameraState = {
  radius: number
  target: string
  fieldOfView: string
}

type NativeModelViewerElement = HTMLElement & {
  cameraOrbit: string
  cameraTarget: string
  fieldOfView: string
  loaded: boolean
  getCameraOrbit?: () => { theta: number; phi: number; radius: number }
  getFieldOfView?: () => number
  jumpCameraToGoal?: () => void
}

function createDefaultMaterial(THREE: typeof import('three')) {
  return new THREE.MeshStandardMaterial({
    color: appleTechGray,
    emissive: appleTechGray,
    emissiveIntensity: 0.14,
    metalness: 0.04,
    roughness: 0.42,
    side: THREE.DoubleSide
  })
}

function disposeMaterial(material: import('three').Material | import('three').Material[]) {
  const materials = Array.isArray(material) ? material : [material]
  materials.forEach((entry) => entry.dispose())
}

function disposeObject(object: import('three').Object3D) {
  object.traverse((child) => {
    const mesh = child as import('three').Mesh
    mesh.geometry?.dispose()
    if (mesh.material) disposeMaterial(mesh.material)
  })
}

function ThreeModelViewer({ src, alt, extension, className, active = true, frameScale = 1 }: ThreeModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Live signals the render loop reads to decide whether to keep drawing frames.
  const activeRef = useRef(active)
  const prevActiveRef = useRef(active)
  const syncPlaybackRef = useRef<(() => void) | null>(null)
  const frameScaleRef = useRef(Math.max(frameScale, 1))
  const reframeRef = useRef<(() => void) | null>(null)
  const resetViewRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const wasActive = prevActiveRef.current
    prevActiveRef.current = active
    activeRef.current = active
    syncPlaybackRef.current?.()
    // Re-entering the 3D view restores the default framing so the model shows
    // at its original size instead of whatever zoom the user left behind.
    if (active && !wasActive) resetViewRef.current?.()
  }, [active])

  useEffect(() => {
    frameScaleRef.current = Math.max(frameScale, 1)
    reframeRef.current?.()
  }, [frameScale])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let animationFrame = 0
    let cleanup: (() => void) | undefined

    setStatus('loading')

    const loaderImports =
      extension === '3mf'
        ? Promise.all([
            import('three'),
            import('three/examples/jsm/loaders/3MFLoader.js'),
            import('three/examples/jsm/controls/OrbitControls.js')
          ])
        : Promise.all([
            import('three'),
            import('three/examples/jsm/loaders/STLLoader.js'),
            import('three/examples/jsm/controls/OrbitControls.js')
          ])

    loaderImports
      .then(([THREE, loaderModule, { OrbitControls }]) => {
        if (cancelled) return

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000)
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setClearColor(0x000000, 0)
        renderer.outputColorSpace = THREE.SRGBColorSpace
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

        scene.add(new THREE.AmbientLight(0xffffff, 0.9))
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8f96a3, 2.4))
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
        keyLight.position.set(3, 4, 5)
        scene.add(keyLight)
        const fillLight = new THREE.DirectionalLight(0xffffff, 1.1)
        fillLight.position.set(-4, 2, -3)
        scene.add(fillLight)

        const pivot = new THREE.Group()
        scene.add(pivot)
        let loadedObject: import('three').Object3D | undefined
        let rotating = false
        let initialCameraPosition: import('three').Vector3 | undefined
        let initialTarget: import('three').Vector3 | undefined
        let modelRadius = 0.1
        let appliedFrameScale = 1
        let cameraTween:
          | {
              fromPosition: import('three').Vector3
              fromTarget: import('three').Vector3
              toPosition: import('three').Vector3
              toTarget: import('three').Vector3
              start: number
              duration: number
            }
          | undefined

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

        const frameObject = (object: import('three').Object3D) => {
          const box = new THREE.Box3().setFromObject(object)
          if (box.isEmpty()) return

          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          object.position.sub(center)

          const radius = Math.max(size.length() * 0.5, 0.1)
          modelRadius = radius
          appliedFrameScale = frameScaleRef.current
          const distance = radius * 3.1 * appliedFrameScale

          camera.position.set(distance, distance * 0.8, distance)
          camera.near = Math.max(radius / 100, 0.01)
          camera.far = radius * 120 * appliedFrameScale
          camera.updateProjectionMatrix()
          controls.target.set(0, 0, 0)
          controls.minDistance = radius * 0.7
          controls.maxDistance = radius * 8 * appliedFrameScale
          controls.update()
          initialCameraPosition = camera.position.clone()
          initialTarget = controls.target.clone()
          resize()
        }

        const isAtDefaultView = () => {
          if (!initialCameraPosition || !initialTarget) return true
          const initialDistance = initialCameraPosition.distanceTo(initialTarget)
          return (
            Math.abs(camera.position.distanceTo(controls.target) - initialDistance) < initialDistance * 0.1 &&
            controls.target.distanceTo(initialTarget) < modelRadius * 0.05
          )
        }

        // Re-derive the "normal size" framing when the anchor/viewport ratio
        // changes (e.g. window resize) without rebuilding the scene.
        const reframe = () => {
          const nextScale = frameScaleRef.current
          if (!initialCameraPosition || !initialTarget || nextScale === appliedFrameScale) return
          const wasDefault = isAtDefaultView()
          const ratio = nextScale / appliedFrameScale
          initialCameraPosition = initialTarget
            .clone()
            .add(initialCameraPosition.clone().sub(initialTarget).multiplyScalar(ratio))
          appliedFrameScale = nextScale
          controls.maxDistance = modelRadius * 8 * nextScale
          camera.far = modelRadius * 120 * nextScale
          camera.updateProjectionMatrix()
          if (wasDefault) {
            cameraTween = undefined
            camera.position.copy(initialCameraPosition)
            controls.target.copy(initialTarget)
            controls.update()
          }
        }
        reframeRef.current = reframe

        // Instantly restore the fitted "normal size" view (keeping the current
        // viewing direction). Used when the viewer becomes active again.
        const resetView = () => {
          if (!initialCameraPosition || !initialTarget) return
          cameraTween = undefined
          const initialDistance = initialCameraPosition.distanceTo(initialTarget)
          const direction = camera.position.clone().sub(controls.target).normalize()
          if (direction.lengthSq() === 0) {
            direction.copy(initialCameraPosition).sub(initialTarget).normalize()
          }
          camera.position.copy(initialTarget.clone().add(direction.multiplyScalar(initialDistance)))
          controls.target.copy(initialTarget)
          controls.update()
          renderFrame()
        }
        resetViewRef.current = resetView

        const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

        const animateCameraTo = (toPosition: import('three').Vector3, toTarget: import('three').Vector3) => {
          cameraTween = {
            fromPosition: camera.position.clone(),
            fromTarget: controls.target.clone(),
            toPosition,
            toTarget,
            start: performance.now(),
            duration: 450
          }
        }

        // Double-click adaptively toggles the view: from the fitted "normal"
        // view it zooms in for a closer look; from any zoomed/offset state it
        // smoothly restores the fitted view.
        const toggleZoom = () => {
          if (!initialCameraPosition || !initialTarget) return

          const initialDistance = initialCameraPosition.distanceTo(initialTarget)
          const direction = camera.position.clone().sub(controls.target).normalize()
          if (direction.lengthSq() === 0) {
            direction.copy(initialCameraPosition).sub(initialTarget).normalize()
          }

          // When the canvas is much larger than the anchor (fullscreen stage),
          // zoom in until the model roughly fills the window; otherwise use the
          // classic 0.55x close-up.
          const zoomFactor = appliedFrameScale > 1.05 ? 0.7 / appliedFrameScale : 0.55
          const nextDistance = isAtDefaultView()
            ? Math.min(Math.max(initialDistance * zoomFactor, controls.minDistance), controls.maxDistance)
            : initialDistance

          animateCameraTo(initialTarget.clone().add(direction.multiplyScalar(nextDistance)), initialTarget.clone())
        }

        const applyAppleTechGray = (object: import('three').Object3D) => {
          object.traverse((child) => {
            const mesh = child as import('three').Mesh
            if (!mesh.isMesh) return
            mesh.geometry.deleteAttribute('color')
            mesh.geometry.computeVertexNormals()
            mesh.castShadow = true
            mesh.receiveShadow = true
            if (mesh.material) disposeMaterial(mesh.material)
            mesh.material = createDefaultMaterial(THREE)
          })
        }

        const handleObjectLoad = (object: import('three').Object3D) => {
          if (cancelled) {
            disposeObject(object)
            return
          }

          applyAppleTechGray(object)
          pivot.add(object)
          frameObject(object)
          loadedObject = object
          rotating = true
          setStatus('ready')
        }

        if (extension === '3mf') {
          const { ThreeMFLoader } = loaderModule as typeof import('three/examples/jsm/loaders/3MFLoader.js')
          const loader = new ThreeMFLoader()
          loader.load(
            src,
            (group) => {
              group.rotation.set(-Math.PI / 2, 0, 0)
              handleObjectLoad(group)
            },
            undefined,
            () => {
              if (!cancelled) setStatus('error')
            }
          )
        } else {
          const { STLLoader } = loaderModule as typeof import('three/examples/jsm/loaders/STLLoader.js')
          const loader = new STLLoader()
          loader.load(
            src,
            (geometry) => {
              if (cancelled) {
                geometry.dispose()
                return
              }
              geometry.computeVertexNormals()
              const mesh = new THREE.Mesh(geometry, createDefaultMaterial(THREE))
              handleObjectLoad(mesh)
            },
            undefined,
            () => {
              if (!cancelled) setStatus('error')
            }
          )
        }

        let intersecting = true

        // Only keep the WebGL loop alive while the viewer is actually on screen,
        // the tab is visible, and the parent marks it as the active view.
        // Otherwise an off-screen/hidden model keeps pegging the CPU/GPU.
        const shouldPlay = () =>
          !cancelled && intersecting && activeRef.current && document.visibilityState !== 'hidden'

        const renderFrame = () => {
          if (rotating) pivot.rotation.y += autoRotateSpeed
          if (cameraTween) {
            const t = Math.min((performance.now() - cameraTween.start) / cameraTween.duration, 1)
            const eased = easeInOutCubic(t)
            camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased)
            controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased)
            if (t >= 1) cameraTween = undefined
          }
          controls.update()
          renderer.render(scene, camera)
        }

        const animate = () => {
          renderFrame()
          if (shouldPlay()) {
            animationFrame = window.requestAnimationFrame(animate)
          } else {
            animationFrame = 0
          }
        }

        const syncPlayback = () => {
          if (shouldPlay()) {
            if (!animationFrame) animationFrame = window.requestAnimationFrame(animate)
          } else if (animationFrame) {
            window.cancelAnimationFrame(animationFrame)
            animationFrame = 0
          }
        }
        syncPlaybackRef.current = syncPlayback

        const handleVisibilityChange = () => syncPlayback()
        document.addEventListener('visibilitychange', handleVisibilityChange)

        const intersectionObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[0]
            if (!entry) return
            intersecting = entry.isIntersecting
            syncPlayback()
          },
          { threshold: 0 }
        )
        intersectionObserver.observe(container)

        animate()

        // User input takes over immediately: cancel any in-flight camera animation.
        const cancelTween = () => {
          cameraTween = undefined
        }

        renderer.domElement.addEventListener('dblclick', toggleZoom)
        renderer.domElement.addEventListener('pointerdown', cancelTween)
        renderer.domElement.addEventListener('wheel', cancelTween, { passive: true })

        cleanup = () => {
          if (animationFrame) window.cancelAnimationFrame(animationFrame)
          syncPlaybackRef.current = null
          reframeRef.current = null
          resetViewRef.current = null
          document.removeEventListener('visibilitychange', handleVisibilityChange)
          intersectionObserver.disconnect()
          renderer.domElement.removeEventListener('dblclick', toggleZoom)
          renderer.domElement.removeEventListener('pointerdown', cancelTween)
          renderer.domElement.removeEventListener('wheel', cancelTween)
          resizeObserver.disconnect()
          controls.dispose()
          if (loadedObject) disposeObject(loadedObject)
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
  }, [src, alt, extension])

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-md bg-transparent', className)}
      role="img"
      aria-label={alt}
    >
      <ParticleField active={status === 'loading'} label="Loading 3D model" className="absolute inset-0 z-10" />
      {status === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-black/60"
          role="status"
        >
          Unable to load 3D model
        </div>
      )}
    </div>
  )
}

export function ModelViewer({ src, alt, poster, className, active = true, frameScale = 1 }: Props) {
  const ext = getModelExtension(src)
  const isWebNative = ext === 'glb' || ext === 'gltf'
  const isThreeRenderable = ext === 'stl' || ext === '3mf'
  const [registered, setRegistered] = useState(false)
  const [nativeLoaded, setNativeLoaded] = useState(false)
  const nativeViewerRef = useRef<NativeModelViewerElement | null>(null)
  const nativeInitialCameraRef = useRef<NativeCameraState | null>(null)
  // Radius model-viewer picked to frame the model in the (possibly oversized)
  // element — the "fills the canvas" distance, recorded once per src.
  const nativeBaseRef = useRef<{ src: string; radius: number } | null>(null)
  const prevActiveRef = useRef(active)

  // Re-entering the 3D view restores the default framing so the model shows at
  // its original size instead of whatever zoom the user left behind.
  useEffect(() => {
    const wasActive = prevActiveRef.current
    prevActiveRef.current = active
    if (!active || wasActive || !isWebNative) return
    const viewer = nativeViewerRef.current
    const initialCamera = nativeInitialCameraRef.current
    const orbit = viewer?.getCameraOrbit?.()
    if (!viewer || !initialCamera || !orbit) return
    viewer.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${initialCamera.radius}m`
    viewer.cameraTarget = initialCamera.target
    viewer.fieldOfView = initialCamera.fieldOfView
    viewer.jumpCameraToGoal?.()
  }, [active, isWebNative])

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

  // A new model means a fresh load: show the particle loader until it fires `load`.
  useEffect(() => {
    setNativeLoaded(false)
  }, [src])

  useEffect(() => {
    if (!isWebNative || !registered) {
      nativeInitialCameraRef.current = null
      return
    }

    const viewer = nativeViewerRef.current
    if (!viewer) return

    // Scale the framing radius so the model renders at the anchor-box size even
    // though the element itself may cover the whole window.
    const applyFraming = () => {
      const orbit = viewer.getCameraOrbit?.()
      if (!orbit) return

      if (nativeBaseRef.current?.src !== src) {
        nativeBaseRef.current = { src, radius: orbit.radius }
      }

      const scale = Math.max(frameScale, 1)
      const previous = nativeInitialCameraRef.current
      const radius = nativeBaseRef.current.radius * scale

      nativeInitialCameraRef.current = {
        radius,
        target: previous?.target ?? (viewer.cameraTarget || defaultNativeCameraTarget),
        fieldOfView: previous?.fieldOfView ?? (viewer.fieldOfView || defaultNativeFieldOfView)
      }
      viewer.setAttribute('min-camera-orbit', `auto auto ${nativeBaseRef.current.radius * 0.4}m`)
      viewer.setAttribute('max-camera-orbit', `auto auto ${radius * 4}m`)

      // Snap to the new normal view unless the user has already zoomed away.
      const atDefault = !previous || Math.abs(orbit.radius - previous.radius) < previous.radius * 0.1
      if (atDefault) {
        viewer.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${radius}m`
        viewer.jumpCameraToGoal?.()
      }
    }

    const onLoad = () => {
      setNativeLoaded(true)
      applyFraming()
    }
    viewer.addEventListener('load', onLoad)
    if (viewer.loaded) onLoad()

    return () => viewer.removeEventListener('load', onLoad)
  }, [isWebNative, registered, src, frameScale])

  // Double-click adaptively toggles the view: from the default framing it zooms
  // in for a closer look; from any zoomed state it restores the normal size.
  // Camera changes are interpolated by model-viewer, so the move is smooth.
  const toggleNativeZoom = useCallback(() => {
    const viewer = nativeViewerRef.current
    const initialCamera = nativeInitialCameraRef.current
    const currentOrbit = viewer?.getCameraOrbit?.()
    if (!viewer || !initialCamera || !currentOrbit) return

    const atDefaultView = Math.abs(currentOrbit.radius - initialCamera.radius) < initialCamera.radius * 0.1
    // Fullscreen stage: zoom toward the element-filling (window-filling) radius;
    // plain usage: classic 0.55x close-up.
    const base = nativeBaseRef.current?.radius ?? initialCamera.radius
    const scale = initialCamera.radius / base
    const zoomRadius = scale > 1.05 ? base * 0.7 : initialCamera.radius * 0.55
    const nextRadius = atDefaultView ? zoomRadius : initialCamera.radius

    viewer.cameraOrbit = `${currentOrbit.theta}rad ${currentOrbit.phi}rad ${nextRadius}m`
    viewer.cameraTarget = initialCamera.target
    viewer.fieldOfView = initialCamera.fieldOfView
  }, [])

  if (isThreeRenderable) {
    return (
      <ThreeModelViewer
        src={src}
        alt={alt}
        extension={ext}
        className={className}
        active={active}
        frameScale={frameScale}
      />
    )
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

  return (
    <div className={cn('relative h-full w-full', className)}>
      {registered && (
        <model-viewer
          ref={(element) => {
            nativeViewerRef.current = element as NativeModelViewerElement | null
          }}
          src={src}
          alt={alt}
          poster={poster}
          camera-controls
          {...(active ? { 'auto-rotate': true } : {})}
          shadow-intensity="1"
          exposure="1"
          touch-action="pan-y"
          interpolation-decay="160"
          onDoubleClick={toggleNativeZoom}
          className="block h-full w-full bg-transparent"
        />
      )}
      <ParticleField active={!registered || !nativeLoaded} label="Loading 3D model" className="absolute inset-0 z-10" />
    </div>
  )
}
