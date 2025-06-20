'use client'
import ThiingsGrid, { type ItemConfig } from '@/components/ThiingsGrid'
import Image from 'next/image'

const ThiingsIconCell = ({ gridIndex }: ItemConfig) => {
  const images = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <div className="group absolute inset-5 flex cursor-pointer items-center justify-center text-white">
      <Image
        draggable={false}
        className="h-full w-full transition-transform group-hover:scale-110 active:scale-95"
        src={`/thiings/${images[gridIndex % images.length]}.png`}
        alt={`thiings-${images[gridIndex % images.length]}`}
        width={160}
        height={160}
      />
    </div>
  )
}

export default function Page() {
  return <ThiingsGrid gridSize={200} renderItem={ThiingsIconCell} initialPosition={{ x: 0, y: 0 }} />
}
