/**
 * Abstract Base Facilitator Client
 *
 * Provides common functionality for all facilitator client implementations:
 * - Health checking with retry and circuit breaker
 * - Rate limiting
 * - Error handling
 * - Request logging
 */

import {
  type FacilitatorClient,
  type FacilitatorClientConfig,
  type HealthCheckResult,
  type MerchantListing,
  type FacilitatorStats,
  type AgentTransaction,
  type AgentActivity,
  type TransactionQueryOptions,
  type ActivityQueryOptions,
} from './types'
import { retryFetch, CircuitBreaker, RateLimiter, type RetryOptions } from './retry'

// ========================================
// ABSTRACT BASE CLASS
// ========================================

export abstract class BaseFacilitatorClient implements FacilitatorClient {
  readonly slug: string
  readonly baseUrl: string

  protected readonly apiKey?: string
  protected readonly timeout: number
  protected readonly circuitBreaker: CircuitBreaker
  protected readonly rateLimiter: RateLimiter
  protected readonly retryOptions: RetryOptions

  constructor(config: FacilitatorClientConfig) {
    this.slug = config.facilitatorSlug
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
    this.timeout = config.timeout ?? 30000

    // Circuit breaker: open after 5 failures, reset after 60s
    this.circuitBreaker = new CircuitBreaker(5, 60000)

    // Rate limiter: 10 requests per second by default
    this.rateLimiter = new RateLimiter(
      config.rateLimitPerSecond ?? 10,
      config.rateLimitPerSecond ?? 10
    )

    this.retryOptions = {
      maxRetries: config.maxRetries ?? 3,
      timeout: this.timeout,
    }
  }

  // ========================================
  // COMMON METHODS (implemented)
  // ========================================

  /**
   * Health check with retry and circuit breaker protection
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    const endpoint = this.getHealthEndpoint()

    try {
      const result = await this.circuitBreaker.execute(async () => {
        await this.rateLimiter.acquire()

        const fetchResult = await retryFetch(
          endpoint,
          {
            method: 'GET',
            headers: this.getDefaultHeaders(),
          },
          { ...this.retryOptions, maxRetries: 1 } // Only 1 retry for health checks
        )

        if (!fetchResult.success || !fetchResult.data) {
          throw fetchResult.error || new Error('Health check failed')
        }

        return fetchResult.data
      })

      const responseTime = Date.now() - start
      const isHealthy = result.ok || result.status < 500

      return {
        status: isHealthy ? 'online' : 'degraded',
        responseTime,
        timestamp: Date.now(),
        endpoint,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Circuit breaker state captured in error message

      return {
        status: 'offline',
        responseTime: Date.now() - start,
        error: errorMessage,
        timestamp: Date.now(),
        endpoint,
      }
    }
  }

  // ========================================
  // ABSTRACT METHODS (must implement)
  // ========================================

  /**
   * Discover merchants from this facilitator
   */
  abstract discoverMerchants(network?: string): Promise<MerchantListing[]>

  // ========================================
  // OPTIONAL METHODS (override if supported)
  // ========================================

  /**
   * Get facilitator statistics
   */
  async getStats(): Promise<FacilitatorStats | null> {
    return null
  }

  /**
   * Get recent transactions from this facilitator
   */
  async getRecentTransactions(_options?: TransactionQueryOptions): Promise<AgentTransaction[]> {
    return []
  }

  /**
   * Get agent activity from this facilitator
   */
  async getAgentActivity(_options?: ActivityQueryOptions): Promise<AgentActivity[]> {
    return []
  }

  /**
   * Get a specific transaction by signature
   */
  async getTransaction(_txSignature: string): Promise<AgentTransaction | null> {
    return null
  }

  // ========================================
  // PROTECTED HELPERS
  // ========================================

  /**
   * Get the health check endpoint URL
   * Override if facilitator uses different endpoint
   */
  protected getHealthEndpoint(): string {
    return `${this.baseUrl}/health`
  }

  /**
   * Get default headers for requests
   * Override to add facilitator-specific headers
   */
  protected getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GhostSpeak-Observatory/2.0',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    return headers
  }

  /**
   * Make a protected fetch request with retry, rate limiting, and circuit breaker
   */
  protected async fetchProtected<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`

    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.acquire()

      const result = await retryFetch(
        url,
        {
          ...options,
          headers: {
            ...this.getDefaultHeaders(),
            ...(options?.headers as Record<string, string>),
          },
        },
        this.retryOptions
      )

      if (!result.success || !result.data) {
        throw result.error || new Error(`Request to ${url} failed`)
      }

      if (!result.data.ok) {
        throw new Error(`HTTP ${result.data.status}: ${result.data.statusText}`)
      }

      return result.data.json() as Promise<T>
    })
  }

  /**
   * Make a fetch request without circuit breaker protection
   * Use for non-critical requests that shouldn't affect circuit state
   */
  protected async fetchUnprotected<T>(
    path: string,
    options?: RequestInit
  ): Promise<T | null> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`

    try {
      await this.rateLimiter.acquire()

      const result = await retryFetch(
        url,
        {
          ...options,
          headers: {
            ...this.getDefaultHeaders(),
            ...(options?.headers as Record<string, string>),
          },
        },
        this.retryOptions
      )

      if (!result.success || !result.data || !result.data.ok) {
        return null
      }

      return result.data.json() as Promise<T>
    } catch {
      return null
    }
  }

  /**
   * Log operation with facilitator context
   * Note: ESLint only allows warn/error, so info maps to warn
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${this.slug}]`
    const logFn = level === 'error' ? console.error : console.warn

    if (data) {
      logFn(prefix, message, data)
    } else {
      logFn(prefix, message)
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  /**
   * Reset circuit breaker (use with caution)
   */
  resetCircuit(): void {
    this.circuitBreaker.reset()
  }
}

// ========================================
// EXPORTS
// ========================================

export type { FacilitatorClientConfig }
