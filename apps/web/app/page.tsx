'use client'
import ThiingsGrid, { type ItemConfig } from '@/components/ThiingsGrid'
import { getThiingsItemByGridIndex } from '@/lib/thiings-data'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'things:grid-position'

export default function Page() {
  const router = useRouter()
  const gridRef = useRef<ThiingsGrid>(null)
  const [initialPosition, setInitialPosition] = useState<{ x: number; y: number } | null>(null)

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

  const renderItem = useCallback(
    ({ gridIndex, isMoving }: ItemConfig) => {
      const item = getThiingsItemByGridIndex(gridIndex)
      const handleClick = () => {
        if (isMoving) return
        try {
          const current = gridRef.current?.publicGetCurrentPosition()
          if (current) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        } catch {
          // ignore
        }
        router.push(`/item/${item.id}`)
      }
      return (
        <div
          className="group absolute inset-5 flex cursor-pointer items-center justify-center text-white"
          onClick={handleClick}
        >
          <Image
            draggable={false}
            className="h-full w-full transition-transform group-hover:scale-110 active:scale-95"
            src={item.image}
            alt={item.name}
            width={160}
            height={160}
          />
        </div>
      )
    },
    [router]
  )

  if (!initialPosition) return null

  return (
    <ThiingsGrid
      ref={gridRef}
      gridSize={200}
      renderItem={renderItem}
      initialPosition={initialPosition}
    />
  )
}
