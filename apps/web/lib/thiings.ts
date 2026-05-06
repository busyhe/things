export type ThiingsItem = {
  id: string
  image: string
  name: string
  description: string
  tags: string[]
  model?: string
  modelPoster?: string
}

export function isNotionHostedResource(url: string | undefined): boolean {
  if (!url) return false

  if (url.startsWith('attachment:') || url.startsWith('/image') || url.startsWith('/images')) return true

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    return (
      hostname === 'file.notion.so' ||
      hostname === 'img.notionusercontent.com' ||
      hostname === 'www.notion.so' ||
      hostname.endsWith('.notion.so') ||
      hostname.includes('secure.notion-static.com') ||
      hostname.includes('prod-files-secure') ||
      parsed.pathname.includes('secure.notion-static.com') ||
      parsed.pathname.includes('prod-files-secure')
    )
  } catch {
    return false
  }
}

export function getThiingsItemByGridIndex(items: ThiingsItem[], gridIndex: number): ThiingsItem {
  const len = items.length
  const idx = ((gridIndex % len) + len) % len
  return items[idx]!
}
