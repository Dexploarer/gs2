/**
 * Facilitator Client Factory
 *
 * Creates appropriate client based on facilitator slug.
 * Consolidated entry point for all facilitator-related exports.
 */

// ========================================
// BASE EXPORTS
// ========================================

export { BaseFacilitatorClient } from './base/client'
export type { FacilitatorClientConfig } from './base/client'

export {
  retryFetch,
  CircuitBreaker,
  RateLimiter,
  BatchProcessor,
  type RetryOptions,
  type RetryResult,
} from './base/retry'

export type {
  FacilitatorClient,
  HealthCheckResult,
  MerchantListing,
  MerchantEndpoint,
  AgentTransaction,
  AgentActivity,
  FacilitatorStats,
  TransactionType,
  TransactionStatus,
  TransactionQueryOptions,
  ActivityQueryOptions,
} from './base/types'

// ========================================
// CLIENT IMPORTS (for internal use)
// ========================================

import { PayAIClient, createPayAIClient } from './clients/payai'
import { CoinbaseCDPClient, createCoinbaseCDPClient } from './clients/coinbase-cdp'
import { GenericFacilitatorClient, createGenericClient } from './clients/generic'

// ========================================
// CLIENT RE-EXPORTS
// ========================================

export { PayAIClient, createPayAIClient }
export { CoinbaseCDPClient, createCoinbaseCDPClient }
export { GenericFacilitatorClient, createGenericClient }

// ========================================
// CLIENT CONFIG TYPE
// ========================================

export interface CreateClientOptions {
  apiKey?: string
  timeout?: number
  maxRetries?: number
  rateLimitPerSecond?: number
  // CDP-specific
  cdpApiKeyId?: string
  cdpApiKeySecret?: string
}

// ========================================
// FACTORY FUNCTION
// ========================================

/**
 * Create a facilitator client based on slug
 *
 * @param facilitatorSlug - Identifier for the facilitator (e.g., 'payai', 'coinbase-cdp')
 * @param facilitatorUrl - Base URL for the facilitator API
 * @param options - Optional configuration
 * @returns Appropriate FacilitatorClient implementation
 */
export function createFacilitatorClient(
  facilitatorSlug: string,
  facilitatorUrl: string,
  options?: CreateClientOptions
): import('./base/types').FacilitatorClient {
  const baseConfig = {
    apiKey: options?.apiKey,
    timeout: options?.timeout,
    maxRetries: options?.maxRetries,
    rateLimitPerSecond: options?.rateLimitPerSecond,
  }

  switch (facilitatorSlug) {
    case 'payai':
      return new PayAIClient({ baseUrl: facilitatorUrl, ...baseConfig })

    case 'coinbase-cdp':
      return new CoinbaseCDPClient({
        baseUrl: facilitatorUrl,
        apiKeyId: options?.cdpApiKeyId,
        apiKeySecret: options?.cdpApiKeySecret,
        ...baseConfig,
      })

    // All other x402 facilitators use the generic client
    // which will attempt to discover transaction/activity endpoints
    case 'thirdweb':
    case 'polygon':
    case 'heurist':
    case 'openx402':
    case 'daydreams':
    case 'corbits':
    case 'dexter':
    case 'mogami':
    case 'nevermined':
    case 'kamiyo':
    case 'virtuals':
    case 'treasure':
    case 'xecho':
    case 'hydra':
    case '402104':
    case 'autoincentive':
    case 'kobaru':
    case 'codenut':
    case 'x402-rs':
    case 'x402-org':
    case 'x402-devnet':
    default:
      // Use generic client for all others
      // Generic client will try common transaction/activity endpoints
      return new GenericFacilitatorClient(facilitatorSlug, facilitatorUrl, baseConfig)
  }
}

// ========================================
// CONVENIENCE FACTORY FUNCTIONS
// ========================================

/**
 * Create a PayAI client directly
 */
export function createPayAI(baseUrl: string, options?: CreateClientOptions) {
  return new PayAIClient({ baseUrl, ...options })
}

/**
 * Create a Coinbase CDP client directly
 */
export function createCDP(
  baseUrl: string,
  apiKeyId?: string,
  apiKeySecret?: string,
  options?: CreateClientOptions
) {
  return new CoinbaseCDPClient({ baseUrl, apiKeyId, apiKeySecret, ...options })
}

/**
 * Create a generic client for any x402 facilitator
 */
export function createGeneric(slug: string, baseUrl: string, options?: CreateClientOptions) {
  return new GenericFacilitatorClient(slug, baseUrl, options)
}
