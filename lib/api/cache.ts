/**
 * Response Caching for Seance API
 *
 * Simple in-memory cache with TTL
 * Production: Use Redis or Vercel KV
 */

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export function getCached<T = unknown>(key: string): T | null {
  const entry = cache.get(key)

  if (!entry) return null

  // Check expiration
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  return entry.data as T
}

export function setCache(key: string, data: unknown, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key)
    }
  }
}, 5 * 60 * 1000) // Cleanup every 5 minutes

// Cache helpers for common patterns
export const cacheKeys = {
  agent: (address: string) => `agent:${address}`,
  merchant: (id: string) => `merchant:${id}`,
  credential: (id: string) => `credential:${id}`,
  capabilities: (capability: string) => `capabilities:${capability}`,
  stats: () => 'stats',
}

// Default TTLs (in seconds)
export const cacheTTL = {
  agent: 5 * 60, // 5 minutes
  merchant: 5 * 60, // 5 minutes
  credential: 0, // No caching (always fresh)
  capabilities: 10 * 60, // 10 minutes
  stats: 15 * 60, // 15 minutes
}
