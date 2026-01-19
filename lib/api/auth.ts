/**
 * API Key Authentication
 *
 * Validate API keys for protected Seance endpoints
 * Uses Convex database for API key storage and validation
 */

import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { errors } from './errors'

/**
 * API Key info returned from validation
 */
export interface ApiKeyInfo {
  userId: string
  permissions: string[]
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
}

/**
 * Validate API key against database
 *
 * @param apiKey - The API key to validate
 * @returns ApiKeyInfo if valid, null otherwise
 */
export async function validateApiKey(apiKey: string | null): Promise<ApiKeyInfo | null> {
  if (!apiKey) {
    return null
  }

  try {
    // Query database to check if API key exists and is active
    const apiKeyRecord = await fetchQuery(api.apiKeys.validateKey, { key: apiKey })

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return null
    }

    // Check if key is expired
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < Date.now()) {
      return null
    }

    // Update last used timestamp (fire and forget)
    fetchMutation(api.apiKeys.recordUsage, { key: apiKey }).catch(() => {
      // Ignore errors from usage tracking
    })

    return {
      userId: apiKeyRecord.userId,
      permissions: apiKeyRecord.permissions,
      tier: apiKeyRecord.tier || 'free',
    }
  } catch (error) {
    console.error('Error validating API key:', error)
    // Fall back to development key for local testing
    if (process.env.NODE_ENV === 'development' && apiKey === 'dev_test_key_1') {
      return {
        userId: 'dev_user',
        permissions: ['read', 'write'],
        tier: 'pro',
      }
    }
    return null
  }
}

/**
 * Require valid API key - throws if invalid
 */
export async function requireApiKey(request: Request): Promise<ApiKeyInfo> {
  const apiKey = request.headers.get('x-api-key')

  const keyInfo = await validateApiKey(apiKey)

  if (!keyInfo) {
    throw errors.unauthorized('Invalid or missing API key')
  }

  return keyInfo
}

/**
 * Get API key from request headers
 */
export function getApiKey(request: Request): string | null {
  return request.headers.get('x-api-key')
}

/**
 * Check if endpoint requires authentication
 */
export function isProtectedEndpoint(pathname: string): boolean {
  const protectedPaths = [
    '/api/seance/webhook/subscribe',
    '/api/seance/agents/register',
    '/api/seance/credentials/issue',
    '/api/seance/votes/cast',
  ]

  return protectedPaths.some((path) => pathname.startsWith(path))
}

/**
 * Check if user has required permission
 */
export function hasPermission(keyInfo: ApiKeyInfo, permission: string): boolean {
  return keyInfo.permissions.includes(permission) || keyInfo.permissions.includes('*')
}

/**
 * Require specific permission - throws if missing
 */
export async function requirePermission(request: Request, permission: string): Promise<ApiKeyInfo> {
  const keyInfo = await requireApiKey(request)

  if (!hasPermission(keyInfo, permission)) {
    throw errors.forbidden(`Missing required permission: ${permission}`)
  }

  return keyInfo
}
