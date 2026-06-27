import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // fallback untuk package yang pakai Node.js native modules
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty.ts' },
      path: { browser: './empty.ts' },
      os: { browser: './empty.ts' },
    },
  },
}

export default nextConfig
