/**
 * PayAI Facilitator Client
 *
 * Full-featured client for PayAI facilitator with:
 * - Health checking with retry and circuit breaker
 * - Merchant discovery
 * - Transaction collection
 * - Activity tracking
 * - Stats retrieval
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
} from '../base/types'

// ========================================
// PAYAI-SPECIFIC TYPES
// ========================================

interface PayAIRawTransaction {
  signature?: string
  txSignature?: string
  hash?: string
  agent?: string
  from?: string
  to?: string
  amount?: number
  value?: number
  timestamp?: number
  status?: string
  direction?: string
  type?: string
  merchant?: string
  merchantId?: string
  network?: string
  blockNumber?: number
  block?: number
  confirmationTime?: number
  confirmTime?: number
  endpoint?: string
  url?: string
  [key: string]: unknown
}

interface PayAIRawActivity {
  agent?: string
  agentAddress?: string
  merchant?: string
  merchantId?: string
  endpoint?: string
  url?: string
  responseTime?: number
  latency?: number
  success?: boolean
  error?: string
  errorMessage?: string
  timestamp?: number
  requestId?: string
  id?: string
  method?: string
  statusCode?: number
  [key: string]: unknown
}

interface PayAIRawMerchant {
  name?: string
  description?: string
  network?: string
  endpoints?: Array<{
    url?: string
    endpoint?: string
    method?: string
    price?: number
    priceUSDC?: number
    description?: string
  }>
  capabilities?: string[]
  category?: string
  website?: string
  url?: string
  twitter?: string
  github?: string
  [key: string]: unknown
}

// ========================================
// PAYAI CLIENT
// ========================================

export class PayAIClient extends BaseFacilitatorClient {
  constructor(config?: Partial<FacilitatorClientConfig>) {
    super({
      facilitatorSlug: 'payai',
      baseUrl: config?.baseUrl ?? 'https://facilitator.payai.network',
      apiKey: config?.apiKey,
      timeout: config?.timeout ?? 15000,
      maxRetries: config?.maxRetries ?? 3,
      rateLimitPerSecond: config?.rateLimitPerSecond ?? 10,
    })
  }

  // ========================================
  // MERCHANT DISCOVERY
  // ========================================

  async discoverMerchants(network?: string): Promise<MerchantListing[]> {
    try {
      const path = network ? `/list?network=${encodeURIComponent(network)}` : '/list'

      const data = await this.fetchProtected<PayAIRawMerchant[] | { merchants: PayAIRawMerchant[] }>(
        path
      )

      const merchants = Array.isArray(data) ? data : data.merchants ?? []

      return merchants.map((m) => this.parseMerchant(m))
    } catch (error) {
      this.log('error', 'Merchant discovery failed', error)
      return []
    }
  }

  // ========================================
  // TRANSACTION COLLECTION
  // ========================================

  async getRecentTransactions(options?: TransactionQueryOptions): Promise<AgentTransaction[]> {
    try {
      const params = new URLSearchParams()

      if (options?.since) params.append('since', options.since.toString())
      if (options?.limit) params.append('limit', (options.limit ?? 100).toString())
      if (options?.network) params.append('network', options.network)
      if (options?.agentAddress) params.append('agent', options.agentAddress)

      const path = `/transactions?${params.toString()}`

      const data = await this.fetchProtected<
        PayAIRawTransaction[] | { transactions: PayAIRawTransaction[] }
      >(path)

      const transactions = Array.isArray(data) ? data : data.transactions ?? []

      return transactions.map((tx) => this.parseTransaction(tx))
    } catch (error) {
      this.log('error', 'Transaction collection failed', error)
      return []
    }
  }

  /**
   * Get a specific transaction by signature
   */
  async getTransaction(txSignature: string): Promise<AgentTransaction | null> {
    try {
      const data = await this.fetchUnprotected<PayAIRawTransaction>(
        `/transaction/${txSignature}`
      )

      if (!data) return null

      return this.parseTransaction(data)
    } catch {
      return null
    }
  }

  // ========================================
  // ACTIVITY TRACKING
  // ========================================

  async getAgentActivity(options?: ActivityQueryOptions): Promise<AgentActivity[]> {
    try {
      const params = new URLSearchParams()

      if (options?.since) params.append('since', options.since.toString())
      if (options?.limit) params.append('limit', (options.limit ?? 100).toString())
      if (options?.agentAddress) params.append('agent', options.agentAddress)

      const path = `/activity?${params.toString()}`

      const data = await this.fetchProtected<
        PayAIRawActivity[] | { activities: PayAIRawActivity[] }
      >(path)

      const activities = Array.isArray(data) ? data : data.activities ?? []

      return activities.map((a) => this.parseActivity(a))
    } catch (error) {
      this.log('error', 'Activity collection failed', error)
      return []
    }
  }

  // ========================================
  // STATISTICS
  // ========================================

  async getStats(): Promise<FacilitatorStats | null> {
    try {
      const data = await this.fetchUnprotected<Record<string, unknown>>('/stats')

      if (!data) return null

      return {
        dailyVolume: (data.dailyVolume ?? data.volume24h ?? 0) as number,
        dailyTransactions: (data.dailyTransactions ?? data.transactions24h ?? 0) as number,
        totalVolume: (data.totalVolume ?? 0) as number,
        totalTransactions: (data.totalTransactions ?? 0) as number,
        activeAgents: (data.activeAgents ?? 0) as number,
        activeMerchants: (data.activeMerchants ?? 0) as number,
        avgResponseTime: (data.avgResponseTime ?? 0) as number,
        successRate: (data.successRate ?? 0) as number,
      }
    } catch {
      return null
    }
  }

  // ========================================
  // STREAMING (for continuous collection)
  // ========================================

  /**
   * Stream real-time transactions via polling
   * Yields batches of new transactions since last check
   */
  async *streamTransactions(
    pollIntervalMs = 5000
  ): AsyncGenerator<AgentTransaction[], void, unknown> {
    let lastCheck = Date.now() - 60 * 1000 // Start from 1 minute ago

    while (true) {
      try {
        const transactions = await this.getRecentTransactions({
          since: lastCheck,
          limit: 1000,
        })

        if (transactions.length > 0) {
          yield transactions
          // Update lastCheck to the most recent transaction timestamp
          const latestTimestamp = Math.max(...transactions.map((tx) => tx.timestamp))
          lastCheck = latestTimestamp
        }

        // Wait before next poll
        await this.sleep(pollIntervalMs)
      } catch (error) {
        this.log('error', 'Transaction stream error', error)
        // Wait longer on error
        await this.sleep(pollIntervalMs * 2)
      }
    }
  }

  // ========================================
  // PRIVATE PARSERS
  // ========================================

  private parseMerchant(data: PayAIRawMerchant): MerchantListing {
    return {
      name: data.name ?? 'Unknown Merchant',
      description: data.description ?? '',
      network: data.network ?? 'solana',
      endpoints: Array.isArray(data.endpoints)
        ? data.endpoints.map((e) => ({
            url: e.url ?? e.endpoint ?? '',
            method: e.method ?? 'POST',
            priceUSDC: e.price ?? e.priceUSDC ?? 0,
            description: e.description ?? '',
          }))
        : [],
      capabilities: data.capabilities ?? [],
      category: data.category,
      metadata: {
        website: data.website ?? data.url,
        twitter: data.twitter,
        github: data.github,
      },
    }
  }

  private parseTransaction(data: PayAIRawTransaction): AgentTransaction {
    // Determine transaction type
    let type: AgentTransaction['type'] = 'payment_received'

    if (data.type === 'refund') {
      type = 'refund'
    } else if (data.type === 'fee') {
      type = 'fee'
    } else if (data.direction === 'outbound') {
      type = 'payment_sent'
    }

    return {
      txSignature: data.signature ?? data.txSignature ?? data.hash ?? '',
      agentAddress: data.agent ?? data.from ?? data.to ?? '',
      merchantId: data.merchant ?? data.merchantId,
      type,
      amountUSDC: data.amount ?? data.value ?? 0,
      status: (data.status ?? 'confirmed') as AgentTransaction['status'],
      timestamp: data.timestamp ?? Date.now(),
      network: data.network ?? 'solana',
      blockNumber: data.blockNumber ?? data.block,
      confirmationTime: data.confirmationTime ?? data.confirmTime,
      endpointUrl: data.endpoint ?? data.url,
      metadata: {
        facilitator: 'payai',
      },
    }
  }

  private parseActivity(data: PayAIRawActivity): AgentActivity {
    return {
      agentAddress: data.agent ?? data.agentAddress ?? '',
      merchantId: data.merchant ?? data.merchantId ?? '',
      endpointUrl: data.endpoint ?? data.url ?? '',
      responseTime: data.responseTime ?? data.latency ?? 0,
      success: data.success !== false && data.error === undefined,
      timestamp: data.timestamp ?? Date.now(),
      errorMessage: data.error ?? data.errorMessage,
      requestId: data.requestId ?? data.id,
      metadata: {
        method: data.method,
        statusCode: data.statusCode,
      },
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ========================================
// FACTORY FUNCTION
// ========================================

export function createPayAIClient(config?: Partial<FacilitatorClientConfig>): PayAIClient {
  return new PayAIClient(config)
}
