/**
 * Rate Limiting for Seance API
 *
 * Tier-based rate limiting with in-memory store
 * Production: Use Redis or Vercel KV for distributed rate limiting
 */

import { errors } from './errors'
import { validateApiKey, type ApiKeyInfo } from './auth'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

// Rate limit tiers based on API key tier
export const rateLimits: Record<string, RateLimitConfig> = {
  // Anonymous / No API key
  anonymous: { windowMs: 60 * 60 * 1000, maxRequests: 60 }, // 60 req/hour

  // API key tiers
  free: { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100 req/hour
  basic: { windowMs: 60 * 60 * 1000, maxRequests: 500 }, // 500 req/hour
  pro: { windowMs: 60 * 60 * 1000, maxRequests: 5000 }, // 5k req/hour
  enterprise: { windowMs: 60 * 60 * 1000, maxRequests: 50000 }, // 50k req/hour
}

// In-memory store (replace with Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>()

/**
 * Check rate limit and throw if exceeded
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = rateLimits.anonymous
): Promise<RateLimitResult> {
  const now = Date.now()

  // Get or initialize counter
  let record = requestCounts.get(identifier)

  if (!record || now > record.resetAt) {
    // Reset window
    record = {
      count: 0,
      resetAt: now + config.windowMs,
    }
    requestCounts.set(identifier, record)
  }

  // Increment counter
  record.count++

  const remaining = Math.max(0, config.maxRequests - record.count)
  const result: RateLimitResult = {
    allowed: record.count <= config.maxRequests,
    remaining,
    resetAt: record.resetAt,
    limit: config.maxRequests,
  }

  // Check limit
  if (!result.allowed) {
    const resetIn = Math.ceil((record.resetAt - now) / 1000)
    throw errors.rateLimitExceeded(`Rate limit exceeded. Try again in ${resetIn} seconds.`)
  }

  return result
}

/**
 * Get rate limit config based on API key tier from database
 */
export async function getRateLimitTier(headers: Headers): Promise<RateLimitConfig> {
  const apiKey = headers.get('x-api-key')

  if (!apiKey) {
    return rateLimits.anonymous
  }

  // Validate API key and get tier from database
  const keyInfo = await validateApiKey(apiKey)

  if (!keyInfo) {
    // Invalid API key - use anonymous limits
    return rateLimits.anonymous
  }

  // Return tier-specific rate limits
  return rateLimits[keyInfo.tier] || rateLimits.free
}

/**
 * Get rate limit identifier from request
 */
export function getRateLimitIdentifier(request: Request): string {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    return `api-key:${apiKey}`
  }

  // Use IP address for anonymous requests
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  return `ip:${ip}`
}

/**
 * Full rate limit check for a request
 * Returns headers to add to response
 */
export async function rateLimitRequest(request: Request): Promise<{
  result: RateLimitResult
  headers: Record<string, string>
}> {
  const identifier = getRateLimitIdentifier(request)
  const config = await getRateLimitTier(request.headers)
  const result = await checkRateLimit(identifier, config)

  return {
    result,
    headers: {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    },
  }
}

/**
 * Get API key info with rate limit details
 */
export async function getApiKeyWithLimits(
  apiKey: string | null
): Promise<(ApiKeyInfo & { rateLimits: RateLimitConfig }) | null> {
  if (!apiKey) return null

  const keyInfo = await validateApiKey(apiKey)
  if (!keyInfo) return null

  return {
    ...keyInfo,
    rateLimits: rateLimits[keyInfo.tier] || rateLimits.free,
  }
}

// Cleanup old entries periodically (every hour)
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, record] of requestCounts.entries()) {
        if (now > record.resetAt) {
          requestCounts.delete(key)
        }
      }
    },
    60 * 60 * 1000
  )
}
