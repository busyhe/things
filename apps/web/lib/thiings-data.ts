import 'server-only'

import type { ThiingsItem } from '@/lib/thiings'
import { unstable_cache } from 'next/cache'
import { NotionAPI } from 'notion-client'

export const THIINGS_REVALIDATE_SECONDS = 300
export type { ThiingsItem } from '@/lib/thiings'
export { getThiingsItemByGridIndex } from '@/lib/thiings'

type NotionBox = {
  role?: string
  value?: unknown
}

type NotionRecordMap = {
  block?: Record<string, NotionBox>
  collection?: Record<string, NotionBox>
  collection_view?: Record<string, NotionBox>
}

type NotionBlock = {
  id?: string
  type?: string
  collection_id?: string
  view_ids?: string[]
  properties?: Record<string, unknown>
  format?: {
    collection_pointer?: {
      id?: string
    }
  }
}

type NotionCollection = {
  schema?: Record<string, { name?: string; type?: string }>
}

type CollectionInfo = {
  collectionId: string
  collectionViewId: string
  collectionView?: unknown
}

type CollectionReducerResult = {
  blockIds?: string[]
  block_ids?: string[]
}

type CollectionQueryResult = {
  blockIds?: string[]
  block_ids?: string[]
  reducerResults?: Record<string, CollectionReducerResult>
  reducer_results?: Record<string, CollectionReducerResult>
}

type ResourceField = 'image' | 'model' | 'modelPoster'

type ThiingsItemDraft = ThiingsItem & {
  notionPageId: string
}

const FIELD_NAMES = {
  name: 'Name',
  description: 'Description',
  tags: 'Tags',
  image: 'Image',
  model: 'Model',
  modelPoster: 'Model Poster',
  order: 'Order',
  published: 'Published'
} as const

const notion = new NotionAPI()

function unwrapNotionValue<T = unknown>(box: unknown): T | undefined {
  if (!isRecord(box)) return undefined
  const value = box.value
  if (isRecord(value) && isRecord(value.value)) return value.value as T
  return value as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''

  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (Array.isArray(item)) return extractText(item[0])
      return ''
    })
    .join('')
    .trim()
}

function isResourceReference(value: string): boolean {
  return /^(https?:\/\/|attachment:|\/image|\/images)/i.test(value)
}

function normalizeResourceReference(value: string): string {
  if (value.startsWith('/image') || value.startsWith('/images')) {
    return `https://www.notion.so${value}`
  }
  return value
}

function shouldSignResource(value: string): boolean {
  return (
    value.includes('secure.notion-static.com') || value.includes('prod-files-secure') || value.includes('attachment:')
  )
}

function extractResource(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return isResourceReference(value) ? normalizeResourceReference(value) : undefined
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractResource(item)
      if (url) return url
    }
  }

  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      const url = extractResource(nested)
      if (url) return url
    }
  }

  return undefined
}

function getSchemaPropertyId(collection: NotionCollection | undefined, fieldName: string): string | undefined {
  if (!collection?.schema) return undefined
  const entry = Object.entries(collection.schema).find(([, property]) => property.name === fieldName)
  return entry?.[0]
}

function getProperty(page: NotionBlock, collection: NotionCollection | undefined, fieldName: string): unknown {
  const propertyId = getSchemaPropertyId(collection, fieldName)
  if (propertyId) return page.properties?.[propertyId]
  if (fieldName === FIELD_NAMES.name) return page.properties?.title
  return undefined
}

function getPropertyText(page: NotionBlock, collection: NotionCollection | undefined, fieldName: string): string {
  return extractText(getProperty(page, collection, fieldName))
}

function getPropertyUrl(
  page: NotionBlock,
  collection: NotionCollection | undefined,
  fieldName: string
): string | undefined {
  const property = getProperty(page, collection, fieldName)
  return extractResource(property) ?? (getPropertyText(page, collection, fieldName) || undefined)
}

function getTags(page: NotionBlock, collection: NotionCollection | undefined): string[] {
  return getPropertyText(page, collection, FIELD_NAMES.tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function isPublished(page: NotionBlock, collection: NotionCollection | undefined): boolean {
  const value = getPropertyText(page, collection, FIELD_NAMES.published).toLowerCase()
  return value !== 'no' && value !== 'false'
}

function getOrder(page: NotionBlock, collection: NotionCollection | undefined): number {
  const value = Number.parseFloat(getPropertyText(page, collection, FIELD_NAMES.order))
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

function getCollectionInfo(recordMap: NotionRecordMap): CollectionInfo | undefined {
  const envCollectionId = process.env.NOTION_COLLECTION_ID
  const envCollectionViewId = process.env.NOTION_COLLECTION_VIEW_ID

  if (envCollectionId && envCollectionViewId) {
    return {
      collectionId: envCollectionId,
      collectionViewId: envCollectionViewId,
      collectionView: unwrapNotionValue(recordMap.collection_view?.[envCollectionViewId])
    }
  }

  const blocks = Object.values(recordMap.block ?? {})
    .map((block) => unwrapNotionValue<NotionBlock>(block))
    .filter((block): block is NotionBlock => Boolean(block))

  for (const block of blocks) {
    if (block.type !== 'collection_view' && block.type !== 'collection_view_page') continue

    const collectionId = block.collection_id ?? block.format?.collection_pointer?.id
    const collectionViewId = block.view_ids?.[0]
    if (!collectionId || !collectionViewId) continue

    return {
      collectionId,
      collectionViewId,
      collectionView: unwrapNotionValue(recordMap.collection_view?.[collectionViewId])
    }
  }

  const collectionId = Object.keys(recordMap.collection ?? {})[0]
  const collectionViewId = Object.keys(recordMap.collection_view ?? {})[0]
  if (!collectionId || !collectionViewId) return undefined

  return {
    collectionId,
    collectionViewId,
    collectionView: unwrapNotionValue(recordMap.collection_view?.[collectionViewId])
  }
}

function getCollectionResultBlockIds(result: CollectionQueryResult | undefined): string[] {
  const directBlockIds = result?.blockIds ?? result?.block_ids
  if (directBlockIds?.length) return directBlockIds

  const reducerResults = result?.reducerResults ?? result?.reducer_results
  if (!reducerResults) return []

  const defaultReducerBlockIds =
    reducerResults.collection_group_results?.blockIds ?? reducerResults.collection_group_results?.block_ids
  if (defaultReducerBlockIds?.length) return defaultReducerBlockIds

  const blockIds: string[] = []
  const seen = new Set<string>()
  for (const reducer of Object.values(reducerResults)) {
    for (const blockId of reducer.blockIds ?? reducer.block_ids ?? []) {
      if (seen.has(blockId)) continue
      seen.add(blockId)
      blockIds.push(blockId)
    }
  }
  return blockIds
}

function mapPageToItem(page: NotionBlock, collection: NotionCollection | undefined): ThiingsItemDraft | undefined {
  if (!page.id || !isPublished(page, collection)) return undefined

  const name = getPropertyText(page, collection, FIELD_NAMES.name)
  const description = getPropertyText(page, collection, FIELD_NAMES.description)
  const image = getPropertyUrl(page, collection, FIELD_NAMES.image)

  if (!name || !description || !image) return undefined

  return {
    id: page.id.replaceAll('-', ''),
    notionPageId: page.id,
    image,
    name,
    description,
    tags: getTags(page, collection),
    model: getPropertyUrl(page, collection, FIELD_NAMES.model),
    modelPoster: getPropertyUrl(page, collection, FIELD_NAMES.modelPoster)
  }
}

async function signNotionResources(items: ThiingsItemDraft[]): Promise<ThiingsItem[]> {
  const resourceFields: ResourceField[] = ['image', 'model', 'modelPoster']
  const signingRequests = items.flatMap((item) =>
    resourceFields.flatMap((field) => {
      const url = item[field]
      if (!url || !shouldSignResource(url)) return []
      return {
        itemId: item.id,
        field,
        request: {
          permissionRecord: {
            table: 'block',
            id: item.notionPageId
          },
          url
        }
      }
    })
  )

  if (!signingRequests.length) {
    return items.map(({ notionPageId, ...item }) => item)
  }

  try {
    const { signedUrls } = await notion.getSignedFileUrls(signingRequests.map(({ request }) => request))
    const signedUrlByField = new Map<string, string>()

    signingRequests.forEach(({ itemId, field }, index) => {
      const signedUrl = signedUrls[index]
      if (signedUrl) signedUrlByField.set(`${itemId}:${field}`, signedUrl)
    })

    return items.map(({ notionPageId, ...item }) => ({
      ...item,
      image: signedUrlByField.get(`${item.id}:image`) ?? item.image,
      model: signedUrlByField.get(`${item.id}:model`) ?? item.model,
      modelPoster: signedUrlByField.get(`${item.id}:modelPoster`) ?? item.modelPoster
    }))
  } catch {
    return items.map(({ notionPageId, ...item }) => item)
  }
}

async function fetchThiingsItems(): Promise<ThiingsItem[]> {
  const pageId = process.env.NOTION_PAGE_ID
  if (!pageId) return []

  const pageRecordMap = (await notion.getPage(pageId, {
    fetchCollections: true,
    signFileUrls: true
  })) as NotionRecordMap
  const collectionInfo = getCollectionInfo(pageRecordMap)
  if (!collectionInfo) return []

  const collectionData = (await notion.getCollectionData(
    collectionInfo.collectionId,
    collectionInfo.collectionViewId,
    collectionInfo.collectionView
  )) as { recordMap?: NotionRecordMap; result?: CollectionQueryResult }

  const recordMap = collectionData.recordMap ?? pageRecordMap
  const collection = unwrapNotionValue<NotionCollection>(recordMap.collection?.[collectionInfo.collectionId])
  const blockIds = getCollectionResultBlockIds(collectionData.result)

  const items = blockIds
    .map((blockId, index) => {
      const page = unwrapNotionValue<NotionBlock>(recordMap.block?.[blockId])
      if (!page) return undefined
      const item = mapPageToItem(page, collection)
      if (!item) return undefined
      return {
        item,
        order: getOrder(page, collection),
        index
      }
    })
    .filter((entry): entry is { item: ThiingsItemDraft; order: number; index: number } => Boolean(entry))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ item }) => item)

  return signNotionResources(items)
}

const getCachedThiingsItems = unstable_cache(fetchThiingsItems, ['thiings-notion-items'], {
  revalidate: THIINGS_REVALIDATE_SECONDS
})

export async function getThiingsItems(): Promise<ThiingsItem[]> {
  return getCachedThiingsItems()
}

export async function getThiingsItem(id: string): Promise<ThiingsItem | undefined> {
  const normalizedId = id.replaceAll('-', '')
  const items = await getThiingsItems()
  return items.find((item) => item.id === normalizedId)
}
