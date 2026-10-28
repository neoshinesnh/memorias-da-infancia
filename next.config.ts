import type { NextConfig } from 'next'

const PUBLIC_URL = 'PUBLIC_URL'
const LOCAL_HOST = 'localhost'
const LOOPBACK_HOST = '127.0.0.1'
const LOOPBACK_V6_HOST = '::1'

const nextConfiguration: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: readDevOrigins(process.env[PUBLIC_URL]),
}

function readDevOrigins(publicUrl: string | undefined): string[] {
  if (publicUrl === undefined) {
    return []
  }
  if (publicUrl.length === 0) {
    return []
  }
  try {
    const hostname = new URL(publicUrl).hostname
    if (isLoopbackHost(hostname)) {
      return []
    }
    return [hostname]
  } catch {
    return []
  }
}

function isLoopbackHost(hostname: string): boolean {
  if (hostname === LOCAL_HOST) {
    return true
  }
  if (hostname === LOOPBACK_HOST) {
    return true
  }
  return hostname === LOOPBACK_V6_HOST
}

export default nextConfiguration
