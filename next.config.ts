import type { NextConfig } from 'next'

const nextConfiguration: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfiguration
