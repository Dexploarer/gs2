/**
 * Generic x402 Facilitator Client
 *
 * Works with any x402-compliant facilitator by:
 * - Trying multiple common endpoint patterns
 * - Flexible response parsing for various formats
 * - Inherits retry, rate limiting, and circuit breaker from base
 */

import { BaseFacilitatorClient } from '../base/client'
import type {
  FacilitatorClientConfig,
  MerchantListing,
  AgentTransaction,
  AgentActivity,
  FacilitatorStats,
  TransactionQueryOptions,
  ActivityQueryOptions,
  HealthCheckResult,
} from '../base/types'

// ========================================
// GENERIC RAW TYPES
// ========================================

interface GenericRawMerchant {
  name?: string
  title?: string
  serviceName?: string
  description?: string
  summary?: string
  network?: string
  chain?: string
  endpoints?: Array<{
    url?: string
    endpoint?: string
    method?: string
    price?: string | number
    priceUSDC?: string | number
    cost?: string | number
    description?: string
  }>
  url?: string
  endpoint?: string
  method?: string
  price?: string | number
  priceUSDC?: string | number
  cost?: string | number
  capabilities?: string[]
  tags?: string[]
  categories?: string[]
  category?: string
  type?: string
  website?: string
  homepage?: string
  twitter?: string
  github?: string
  [key: string]: unknown
}

interface GenericRawTransaction {
  txSignature?: string
  signature?: string
  txHash?: string
  tx_hash?: string
  transactionHash?: string
  hash?: string
  id?: string
  agentAddress?: string
  agent_address?: string
  agent?: string
  payer?: string
  from?: string
  sender?: string
  merchantId?: string
  type?: string
  amount?: string | number
  amountUSDC?: string | number
  value?: string | number
  status?: string
  timestamp?: string | number
  createdAt?: string | number
  time?: string | number
  network?: string
  chain?: string
  blockNumber?: number
  confirmationTime?: number
  endpointUrl?: string
  endpoint?: string
  resource?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

interface GenericRawActivity {
  agentAddress?: string
  agent_address?: string
  agent?: string
  from?: string
  merchantId?: string
  merchant_id?: string
  merchant?: string
  endpointUrl?: string
  endpoint_url?: string
  endpoint?: string
  url?: string
  responseTime?: string | number
  response_time?: string | number
  latency?: string | number
  duration?: string | number
  success?: boolean
  ok?: boolean
  status?: string
  timestamp?: string | number
  createdAt?: string | number
  time?: string | number
  errorMessage?: string
  error_message?: string
  error?: string
  requestId?: string
  request_id?: string
  id?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

// ========================================
// GENERIC CLIENT
// ========================================

export class GenericFacilitatorClient extends BaseFacilitatorClient {
  constructor(slug: string, baseUrl: string, config?: Partial<FacilitatorClientConfig>) {
    super({
      facilitatorSlug: slug,
      baseUrl,
      apiKey: config?.apiKey,
      timeout: config?.timeout ?? 15000,
      maxRetries: config?.maxRetries ?? 2,
      rateLimitPerSecond: config?.rateLimitPerSecond ?? 5,
    })
  }

  // ========================================
  // HEALTH CHECK OVERRIDE
  // ========================================

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()

    // Try multiple endpoints to determine health
    const endpoints = ['/health', '/verify', '']

    for (const endpoint of endpoints) {
      try {
        const url = endpoint ? `${this.baseUrl}${endpoint}` : this.baseUrl
        const response = await fetch(url, {
          method: endpoint === '/verify' ? 'OPTIONS' : 'GET',
          signal: AbortSignal.timeout(5000),
        })

        const responseTime = Date.now() - start

        // Any response < 500 means server is up
        if (response.status < 500) {
          return {
            status: response.ok ? 'online' : 'online', // Auth errors still mean online
            responseTime,
            timestamp: Date.now(),
            endpoint: url,
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    return {
      status: 'offline',
      responseTime: Date.now() - start,
      error: 'All endpoints failed',
      timestamp: Date.now(),
    }
  }

  // ========================================
  // MERCHANT DISCOVERY
  // ========================================

  async discoverMerchants(network?: string): Promise<MerchantListing[]> {
    try {
      const path = network ? `/list?network=${encodeURIComponent(network)}` : '/list'

      const data = await this.fetchUnprotected<
        | GenericRawMerchant[]
        | Record<string, GenericRawMerchant[] | unknown>
      >(path)

      if (!data) return []

      let merchants: GenericRawMerchant[]
      if (Array.isArray(data)) {
        merchants = data
      } else {
        const obj = data as Record<string, GenericRawMerchant[] | unknown>
        merchants = (obj.merchants ?? obj.services ?? obj.resources ?? obj.listings ?? []) as GenericRawMerchant[]
      }

      return merchants.map((m: GenericRawMerchant) => this.parseMerchant(m))
    } catch (error) {
      this.log('error', 'Merchant discovery failed', error)
      return []
    }
  }

  // ========================================
  // TRANSACTION COLLECTION
  // ========================================

  async getRecentTransactions(options?: TransactionQueryOptions): Promise<AgentTransaction[]> {
    // Try multiple common endpoint patterns
    const endpointPatterns = [
      '/transactions',
      '/payments',
      '/history',
      '/tx',
      '/api/transactions',
      '/api/v1/transactions',
    ]

    const params = new URLSearchParams()
    if (options?.since) params.append('since', options.since.toString())
    if (options?.limit) params.append('limit', (options.limit ?? 100).toString())
    if (options?.network) params.append('network', options.network)
    if (options?.agentAddress) params.append('agent', options.agentAddress)
    const queryString = params.toString()

    for (const endpoint of endpointPatterns) {
      try {
        const path = `${endpoint}${queryString ? `?${queryString}` : ''}`

        const data = await this.fetchUnprotected<
          | GenericRawTransaction[]
          | Record<string, GenericRawTransaction[] | unknown>
        >(path)

        if (!data) continue

        let transactions: GenericRawTransaction[]
        if (Array.isArray(data)) {
          transactions = data
        } else {
          const obj = data as Record<string, GenericRawTransaction[] | unknown>
          transactions = (obj.transactions ?? obj.payments ?? obj.history ?? obj.items ?? []) as GenericRawTransaction[]
        }

        if (transactions.length > 0) {
          this.log('info', `Found transactions at ${endpoint}`)
          return transactions.map((t: GenericRawTransaction) => this.parseTransaction(t))
        }
      } catch {
        // Try next endpoint
      }
    }

    return []
  }

  async getTransaction(txSignature: string): Promise<AgentTransaction | null> {
    const endpoints = [
      `/transactions/${txSignature}`,
      `/payments/${txSignature}`,
      `/tx/${txSignature}`,
      `/api/transactions/${txSignature}`,
    ]

    for (const endpoint of endpoints) {
      try {
        const data = await this.fetchUnprotected<GenericRawTransaction>(endpoint)
        if (data) {
          return this.parseTransaction(data)
        }
      } catch {
        // Try next endpoint
      }
    }

    return null
  }

  // ========================================
  // ACTIVITY TRACKING
  // ========================================

  async getAgentActivity(options?: ActivityQueryOptions): Promise<AgentActivity[]> {
    const endpointPatterns = ['/activity', '/events', '/logs', '/api/activity', '/api/v1/activity']

    const params = new URLSearchParams()
    if (options?.since) params.append('since', options.since.toString())
    if (options?.limit) params.append('limit', (options.limit ?? 100).toString())
    if (options?.agentAddress) params.append('agent', options.agentAddress)
    const queryString = params.toString()

    for (const endpoint of endpointPatterns) {
      try {
        const path = `${endpoint}${queryString ? `?${queryString}` : ''}`

        const data = await this.fetchUnprotected<
          | GenericRawActivity[]
          | Record<string, GenericRawActivity[] | unknown>
        >(path)

        if (!data) continue

        let activities: GenericRawActivity[]
        if (Array.isArray(data)) {
          activities = data
        } else {
          const obj = data as Record<string, GenericRawActivity[] | unknown>
          activities = (obj.activity ?? obj.activities ?? obj.events ?? obj.logs ?? []) as GenericRawActivity[]
        }

        if (activities.length > 0) {
          this.log('info', `Found activity at ${endpoint}`)
          return activities.map((a: GenericRawActivity) => this.parseActivity(a))
        }
      } catch {
        // Try next endpoint
      }
    }

    return []
  }

  // ========================================
  // STATISTICS
  // ========================================

  async getStats(): Promise<FacilitatorStats | null> {
    try {
      const data = await this.fetchUnprotected<Record<string, unknown>>('/stats')

      if (!data) return null

      return {
        totalPayments: (data.totalPayments ?? data.total_payments) as number | undefined,
        dailyVolume: (data.dailyVolume ?? data.daily_volume) as number | undefined,
        dailyTransactions: (data.dailyTransactions ?? data.daily_transactions) as number | undefined,
        totalVolume: (data.totalVolume ?? data.total_volume) as number | undefined,
        totalTransactions: (data.totalTransactions ?? data.total_transactions) as number | undefined,
        successRate: (data.successRate ?? data.success_rate) as number | undefined,
        availableMerchants: (data.availableMerchants ?? data.available_merchants) as number | undefined,
        activeAgents: (data.activeAgents ?? data.active_agents) as number | undefined,
        activeMerchants: (data.activeMerchants ?? data.active_merchants) as number | undefined,
        avgResponseTime: (data.avgResponseTime ?? data.avg_response_time) as number | undefined,
      }
    } catch {
      return null
    }
  }

  // ========================================
  // PRIVATE PARSERS
  // ========================================

  private parseMerchant(data: GenericRawMerchant): MerchantListing {
    const endpoints: MerchantListing['endpoints'] = []

    if (Array.isArray(data.endpoints)) {
      endpoints.push(
        ...data.endpoints.map((e) => ({
          url: e.url ?? e.endpoint ?? '',
          method: e.method ?? 'POST',
          priceUSDC: parseFloat(String(e.price ?? e.priceUSDC ?? e.cost ?? '0')),
          description: e.description ?? '',
        }))
      )
    } else if (data.url ?? data.endpoint) {
      endpoints.push({
        url: (data.url ?? data.endpoint) as string,
        method: data.method ?? 'POST',
        priceUSDC: parseFloat(String(data.price ?? data.priceUSDC ?? data.cost ?? '0')),
        description: data.description ?? '',
      })
    }

    return {
      name: data.name ?? data.title ?? data.serviceName ?? 'Unknown',
      description: data.description ?? data.summary ?? '',
      network: data.network ?? data.chain ?? 'unknown',
      endpoints,
      capabilities: data.capabilities ?? data.tags ?? data.categories ?? [],
      category: data.category ?? data.type,
      metadata: {
        website: data.website ?? data.url ?? data.homepage,
        twitter: data.twitter,
        github: data.github,
      },
    }
  }

  private parseTransaction(data: GenericRawTransaction): AgentTransaction {
    return {
      txSignature:
        data.txSignature ??
        data.signature ??
        data.txHash ??
        data.tx_hash ??
        data.transactionHash ??
        data.hash ??
        data.id ??
        '',
      agentAddress:
        data.agentAddress ??
        data.agent_address ??
        data.agent ??
        data.payer ??
        data.from ??
        data.sender ??
        '',
      merchantId: data.merchantId,
      type: this.parseTransactionType(data.type),
      amountUSDC: parseFloat(String(data.amount ?? data.amountUSDC ?? data.value ?? '0')),
      status: this.parseStatus(data.status),
      timestamp: this.parseTimestamp(data.timestamp ?? data.createdAt ?? data.time),
      network: data.network ?? data.chain ?? 'unknown',
      blockNumber: data.blockNumber,
      confirmationTime: data.confirmationTime,
      endpointUrl: data.endpointUrl ?? data.endpoint ?? data.resource,
      metadata: {
        facilitator: this.slug,
        ...data.metadata,
      },
    }
  }

  private parseActivity(data: GenericRawActivity): AgentActivity {
    return {
      agentAddress: data.agentAddress ?? data.agent_address ?? data.agent ?? data.from ?? '',
      merchantId: data.merchantId ?? data.merchant_id ?? data.merchant ?? '',
      endpointUrl: data.endpointUrl ?? data.endpoint_url ?? data.endpoint ?? data.url ?? '',
      responseTime: parseFloat(
        String(data.responseTime ?? data.response_time ?? data.latency ?? data.duration ?? '0')
      ),
      success:
        data.success === true ||
        data.ok === true ||
        data.status === 'success' ||
        data.status?.toLowerCase() === 'completed',
      timestamp: this.parseTimestamp(data.timestamp ?? data.createdAt ?? data.time),
      errorMessage: data.errorMessage ?? data.error_message ?? data.error,
      requestId: data.requestId ?? data.request_id ?? data.id,
      metadata: data.metadata,
    }
  }

  private parseTransactionType(type?: string): AgentTransaction['type'] {
    if (!type) return 'payment_sent'
    const lower = type.toLowerCase()
    if (lower.includes('receive') || lower.includes('incoming') || lower.includes('in')) {
      return 'payment_received'
    }
    if (lower.includes('refund') || lower.includes('return')) return 'refund'
    if (lower.includes('fee') || lower.includes('commission')) return 'fee'
    return 'payment_sent'
  }

  private parseStatus(status?: string): AgentTransaction['status'] {
    if (!status) return 'pending'
    const lower = status.toLowerCase()
    if (
      lower.includes('confirm') ||
      lower === 'success' ||
      lower === 'completed' ||
      lower === 'done' ||
      lower === 'settled'
    ) {
      return 'confirmed'
    }
    if (lower.includes('fail') || lower === 'error' || lower === 'rejected' || lower === 'cancelled') {
      return 'failed'
    }
    return 'pending'
  }

  private parseTimestamp(timestamp: unknown): number {
    if (!timestamp) return Date.now()
    if (typeof timestamp === 'number') {
      return timestamp < 1e12 ? timestamp * 1000 : timestamp
    }
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp).getTime()
      return isNaN(parsed) ? Date.now() : parsed
    }
    return Date.now()
  }
}

// ========================================
// FACTORY FUNCTION
// ========================================

export function createGenericClient(
  slug: string,
  baseUrl: string,
  config?: Partial<FacilitatorClientConfig>
): GenericFacilitatorClient {
  return new GenericFacilitatorClient(slug, baseUrl, config)
}
