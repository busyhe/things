import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const isDev = process.env.NODE_ENV !== 'production'
const appDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(appDir, '../..')

const nextConfig: NextConfig = {
  transpilePackages: ['@workspace/ui'],
  turbopack: {
    root: workspaceRoot
  },
  images: isDev
    ? {
        // dev 下跳过 /_next/image 的 sharp 优化，避免首屏几十张远程图并发解码导致内存暴涨
        unoptimized: true
      }
    : {
        remotePatterns: [
          { protocol: 'https', hostname: '**.notion.so' },
          { protocol: 'https', hostname: 'img.notionusercontent.com' },
          { protocol: 'https', hostname: 'file.notion.so' },
          { protocol: 'https', hostname: '**.busyhe.com' }
        ]
      }
}

export default nextConfig
