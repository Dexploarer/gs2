/**
 * Retry Handler with Exponential Backoff
 *
 * Handles API call retries, rate limiting, and error recovery for facilitator clients
 */

// ========================================
// TYPES
// ========================================

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableStatuses?: number[]
  timeout?: number
}

export interface RetryResult<T> {
  data?: T
  error?: Error
  attempts: number
  totalTime: number
  success: boolean
}

// ========================================
// CONSTANTS
// ========================================

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  timeout: 30000,
}

// ========================================
// HELPERS
// ========================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  // Timeout errors
  if (
    error.name === 'AbortError' ||
    error.message.includes('timeout') ||
    error.message.includes('ETIMEDOUT')
  ) {
    return true
  }

  // Network errors
  if (
    error.message.includes('ECONNRESET') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('network')
  ) {
    return true
  }

  // HTTP status errors
  const statusMatch = error.message.match(/HTTP (\d+)/)
  if (statusMatch) {
    const status = parseInt(statusMatch[1])
    return retryableStatuses.includes(status)
  }

  return false
}

// ========================================
// RETRY FUNCTIONS
// ========================================

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const startTime = Date.now()

  let lastError: Error | undefined
  let attempt = 0

  while (attempt <= opts.maxRetries) {
    try {
      const data = await fn()

      return {
        data,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
        success: true,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      attempt++

      // Don't retry if we've exceeded max retries
      if (attempt > opts.maxRetries) {
        break
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(error, opts.retryableStatuses)) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      )

      console.warn(
        `[Retry] Attempt ${attempt}/${opts.maxRetries} failed. Retrying in ${delay}ms...`,
        lastError.message
      )

      // Wait before retry
      await sleep(delay)
    }
  }

  return {
    error: lastError,
    attempts: attempt,
    totalTime: Date.now() - startTime,
    success: false,
  }
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<RetryResult<Response>> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return retryWithBackoff(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })

      // Check if response is retryable
      if (!response.ok && opts.retryableStatuses.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }, options)
}

// ========================================
// RATE LIMITER
// ========================================

/**
 * Rate limiter with token bucket algorithm
 */
export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens
    this.refillRate = refillRate
    this.tokens = maxTokens
    this.lastRefill = Date.now()
  }

  /**
   * Wait until a token is available, then consume it
   */
  async acquire(): Promise<void> {
    while (true) {
      this.refill()

      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }

      // Calculate how long to wait for next token
      const tokensNeeded = 1 - this.tokens
      const waitTime = (tokensNeeded / this.refillRate) * 1000

      await sleep(Math.min(waitTime, 1000)) // Wait max 1 second at a time
    }
  }

  /**
   * Try to acquire a token without waiting
   */
  tryAcquire(): boolean {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }

    return false
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000 // seconds
    const newTokens = elapsed * this.refillRate

    this.tokens = Math.min(this.tokens + newTokens, this.maxTokens)
    this.lastRefill = now
  }
}

// ========================================
// CIRCUIT BREAKER
// ========================================

export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker pattern for failing services
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private state: CircuitState = 'closed'

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 60000 // 1 minute
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (this.state === 'open' && Date.now() - this.lastFailure > this.resetTimeoutMs) {
      this.state = 'half-open'
      this.failures = 0
    }

    // Reject if circuit is open
    if (this.state === 'open') {
      throw new Error(
        `Circuit breaker is OPEN. Service has failed ${this.failures} times. Try again in ${Math.ceil((this.resetTimeoutMs - (Date.now() - this.lastFailure)) / 1000)}s`
      )
    }

    try {
      const result = await fn()

      // Success - close circuit if it was half-open
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failures = 0
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failures++
    this.lastFailure = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
      console.error(
        `[Circuit Breaker] OPEN after ${this.failures} failures. Cooling down for ${this.resetTimeoutMs / 1000}s`
      )
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failures
  }

  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.lastFailure = 0
  }
}

// ========================================
// BATCH PROCESSOR
// ========================================

/**
 * Batch processor with automatic flushing
 */
export class BatchProcessor<T> {
  private batch: T[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly processFn: (items: T[]) => Promise<void>,
    private readonly maxBatchSize = 100,
    private readonly maxWaitMs = 5000
  ) {}

  /**
   * Add item to batch
   */
  add(item: T): void {
    this.batch.push(item)

    // Flush if batch is full
    if (this.batch.length >= this.maxBatchSize) {
      this.flush()
      return
    }

    // Start timer if this is first item
    if (this.batch.length === 1) {
      this.startTimer()
    }
  }

  /**
   * Flush current batch
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.batch.length === 0) {
      return
    }

    const items = this.batch
    this.batch = []

    try {
      await this.processFn(items)
    } catch (error) {
      console.error('[Batch Processor] Failed to process batch:', error)
    }
  }

  /**
   * Get current batch size
   */
  size(): number {
    return this.batch.length
  }

  private startTimer(): void {
    this.timer = setTimeout(() => {
      this.flush()
    }, this.maxWaitMs)
  }
}
