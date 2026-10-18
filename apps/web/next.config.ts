import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

// The monorepo keeps one .env at the root; Next only looks in the app folder.
loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true })
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true, quiet: true })

const apiUrl = process.env.API_URL ?? 'http://localhost:4000'

// Loading the root .env above is what makes NEXT_PUBLIC_* available for inlining;
// this only fills the gap if the var is missing entirely.
process.env.NEXT_PUBLIC_API_URL ??= `${apiUrl}/api/v1`

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than compiled output.
  transpilePackages: ['@ais/shared'],
  async rewrites() {
    // Same-origin path for the browser, so cookies/CORS stay simple in production.
    return [{ source: '/api/proxy/:path*', destination: `${apiUrl}/api/v1/:path*` }]
  },
}

export default nextConfig
