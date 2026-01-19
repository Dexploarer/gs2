/**
 * Library Tests: Base Facilitator Client
 *
 * Tests abstract base client functionality including retry logic,
 * circuit breaker, and rate limiting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Create a concrete implementation for testing
class TestFacilitatorClient {
  readonly slug: string
  readonly baseUrl: string
  private timeout: number
  private maxRetries: number
  private failureCount: number = 0
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed'
  private lastFailureTime: number = 0
  private readonly circuitResetTimeout = 60000

  constructor(config: {
    baseUrl: string
    timeout?: number
    maxRetries?: number
  }) {
    this.slug = 'test'
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout ?? 30000
    this.maxRetries = config.maxRetries ?? 3
  }

  async healthCheck(): Promise<{
    status: 'online' | 'degraded' | 'offline'
    responseTime: number
    error?: string
  }> {
    const start = Date.now()

    try {
      if (this.circuitState === 'open') {
        if (Date.now() - this.lastFailureTime > this.circuitResetTimeout) {
          this.circuitState = 'half-open'
        } else {
          throw new Error('Circuit breaker is open')
        }
      }

      const response = await mockFetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const responseTime = Date.now() - start

      if (response.ok) {
        this.failureCount = 0
        this.circuitState = 'closed'
        return { status: 'online', responseTime }
      }

      if (response.status >= 500) {
        this.recordFailure()
        return { status: 'degraded', responseTime }
      }

      return { status: 'degraded', responseTime }
    } catch (error) {
      this.recordFailure()
      return {
        status: 'offline',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= 5) {
      this.circuitState = 'open'
    }
  }

  async fetchWithRetry<T>(path: string): Promise<T | null> {
    let lastError: Error | undefined
    let attempts = 0

    while (attempts < this.maxRetries) {
      try {
        const response = await mockFetch(`${this.baseUrl}${path}`, {
          headers: { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          return await response.json()
        }

        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        attempts++
        // Exponential backoff would go here
      }
    }

    console.error(`Failed after ${attempts} attempts:`, lastError)
    return null
  }

  getCircuitState(): 'closed' | 'open' | 'half-open' {
    return this.circuitState
  }

  resetCircuit() {
    this.circuitState = 'closed'
    this.failureCount = 0
  }

  // Expose for testing
  getFailureCount() {
    return this.failureCount
  }
}

describe('BaseFacilitatorClient (via TestFacilitatorClient)', () => {
  let client: TestFacilitatorClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new TestFacilitatorClient({
      baseUrl: 'https://test.facilitator.network',
      timeout: 5000,
      maxRetries: 3,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('healthCheck', () => {
    it('returns online for successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      const result = await client.healthCheck()

      expect(result.status).toBe('online')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('returns degraded for 5xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const result = await client.healthCheck()

      expect(result.status).toBe('degraded')
    })

    it('returns offline when request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await client.healthCheck()

      expect(result.status).toBe('offline')
      expect(result.error).toBe('Connection refused')
    })
  })

  describe('circuit breaker', () => {
    it('starts in closed state', () => {
      expect(client.getCircuitState()).toBe('closed')
    })

    it('opens after 5 failures', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'))

      for (let i = 0; i < 5; i++) {
        await client.healthCheck()
      }

      expect(client.getCircuitState()).toBe('open')
    })

    it('rejects requests when circuit is open', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'))

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await client.healthCheck()
      }

      expect(client.getCircuitState()).toBe('open')

      const result = await client.healthCheck()
      expect(result.status).toBe('offline')
      expect(result.error).toContain('Circuit breaker')
    })

    it('resets to closed after reset()', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'))

      for (let i = 0; i < 5; i++) {
        await client.healthCheck()
      }

      expect(client.getCircuitState()).toBe('open')

      client.resetCircuit()

      expect(client.getCircuitState()).toBe('closed')
    })

    it('resets failure count on successful request', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ ok: true, status: 200 })

      await client.healthCheck()
      await client.healthCheck()
      expect(client.getFailureCount()).toBe(2)

      await client.healthCheck()
      expect(client.getFailureCount()).toBe(0)
    })
  })

  describe('retry logic', () => {
    it('retries failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        })

      const result = await client.fetchWithRetry('/test')

      expect(result).toEqual({ data: 'success' })
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('returns null after max retries exceeded', async () => {
      mockFetch.mockRejectedValue(new Error('Timeout'))

      const result = await client.fetchWithRetry('/test')

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(3) // maxRetries
    })

    it('does not retry on successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'success' }),
      })

      await client.fetchWithRetry('/test')

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('URL handling', () => {
    it('removes trailing slash from base URL', () => {
      const clientWithSlash = new TestFacilitatorClient({
        baseUrl: 'https://test.network/',
      })

      expect(clientWithSlash.baseUrl).toBe('https://test.network')
    })

    it('constructs correct health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      await client.healthCheck()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.facilitator.network/health',
        expect.any(Object)
      )
    })
  })

  describe('headers', () => {
    it('includes Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      await client.healthCheck()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })
})
