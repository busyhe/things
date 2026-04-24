import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ItemDetail } from '@/components/ItemDetail'
import { getThiingsItem, thiingsItems } from '@/lib/thiings-data'

type Params = { id: string }

export function generateStaticParams(): Params[] {
  return thiingsItems.map((item) => ({ id: item.id }))
}

export async function generateMetadata({
  params
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { id } = await params
  const item = getThiingsItem(id)
  if (!item) return {}
  return {
    title: item.name,
    description: item.description,
    openGraph: {
      title: item.name,
      description: item.description,
      images: [{ url: item.image, width: 1080, height: 1080, alt: item.name }]
    },
    twitter: {
      card: 'summary_large_image',
      title: item.name,
      description: item.description,
      images: [item.image]
    }
  }
}

export default async function ItemPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  const item = getThiingsItem(id)
  if (!item) notFound()
  return <ItemDetail item={item} />
}
