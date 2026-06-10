import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

const nextConfig: NextConfig = {
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
