'use client'

import ThiingsGrid, { type ItemConfig } from '@/components/ThiingsGrid'
import { getThiingsItemByGridIndex, isNotionHostedResource, type ThiingsItem } from '@/lib/thiings'
import { motion } from 'motion/react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'things:grid-position'

function GridItem({ item, onNavigate }: { item: ThiingsItem; onNavigate: (id: string) => void }) {
  const delay = useMemo(() => Math.random() * 0.4, [])
  const [loaded, setLoaded] = useState(false)

  return (
    <motion.div
      className="group absolute inset-5 flex cursor-pointer items-center justify-center text-white"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay }}
      onClick={() => onNavigate(item.id)}
    >
      <Image
        draggable={false}
        priority
        className="h-full w-full object-contain transition-transform active:scale-95 md:group-hover:scale-110"
        src={item.image}
        alt={item.name}
        width={160}
        height={160}
        unoptimized={isNotionHostedResource(item.image)}
        onLoad={() => setLoaded(true)}
      />
    </motion.div>
  )
}

export function ThiingsHome({ items }: { items: ThiingsItem[] }) {
  const router = useRouter()
  const gridRef = useRef<ThiingsGrid>(null)
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number } | null>(null)
  const [gridSize, setGridSize] = useState(200)
  const isMovingRef = useRef(false)

  useEffect(() => {
    let pos = { x: 0, y: 0 }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) pos = JSON.parse(raw)
    } catch {
      // ignore
    }
    setInitialPosition(pos)
  }, [])

  useEffect(() => {
    const update = () => setGridSize(window.innerWidth < 768 ? 140 : 200)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const handleNavigate = useCallback(
    (id: string) => {
      if (isMovingRef.current) return
      try {
        const current = gridRef.current?.publicGetCurrentPosition()
        if (current) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
      } catch {
        // ignore
      }
      router.push(`/item/${id}`)
    },
    [router]
  )

  const renderItem = useCallback(
    ({ gridIndex, isMoving }: ItemConfig) => {
      isMovingRef.current = isMoving
      const item = getThiingsItemByGridIndex(items, gridIndex)
      return <GridItem item={item} onNavigate={handleNavigate} />
    },
    [handleNavigate, items]
  )

  if (!items.length) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#FEFCF7] p-6 text-center text-black/60">
        <p className="max-w-sm text-sm">No thiings found. Set NOTION_PAGE_ID and publish at least one item.</p>
      </main>
    )
  }

  if (!initialPosition) return null

  return <ThiingsGrid ref={gridRef} gridSize={gridSize} renderItem={renderItem} initialPosition={initialPosition} />
}
