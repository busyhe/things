'use client'
import ThiingsGrid, { type ItemConfig } from '@/components/ThiingsGrid'
import { getThiingsItemByGridIndex, type ThiingsItem } from '@/lib/thiings-data'
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
        className="h-full w-full transition-transform group-hover:scale-110 active:scale-95"
        src={item.image}
        alt={item.name}
        width={160}
        height={160}
        onLoad={() => setLoaded(true)}
      />
    </motion.div>
  )
}

export default function Page() {
  const router = useRouter()
  const gridRef = useRef<ThiingsGrid>(null)
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number } | null>(null)
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
      const item = getThiingsItemByGridIndex(gridIndex)
      return <GridItem item={item} onNavigate={handleNavigate} />
    },
    [handleNavigate]
  )

  if (!initialPosition) return null

  return <ThiingsGrid ref={gridRef} gridSize={200} renderItem={renderItem} initialPosition={initialPosition} />
}
