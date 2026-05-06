import { ThiingsHome } from '@/components/ThiingsHome'
import { getThiingsItems } from '@/lib/thiings-data'

export const revalidate = 300

export default async function Page() {
  const items = await getThiingsItems()
  return <ThiingsHome items={items} />
}
