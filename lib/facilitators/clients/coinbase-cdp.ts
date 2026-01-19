/**
 * Coinbase CDP Facilitator Client
 *
 * Full-featured client for CDP facilitator with:
 * - Health checking with retry and circuit breaker
 * - Bazaar discovery
 * - Transaction collection
 * - Activity tracking
 * - Supports Base (eip155:8453) and Base Sepolia (eip155:84532)
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
// CDP-SPECIFIC TYPES
// ========================================

interface CDPRawResource {
  name?: string
  title?: string
  description?: string
  network?: string
  endpoints?: Array<{
    url?: string
    endpoint?: string
    method?: string
    price?: string | number
    cost?: string | number
    description?: string
  }>
  url?: string
  method?: string
  price?: string | number
  cost?: string | number
  capabilities?: string[]
  tags?: string[]
  category?: string
  type?: string
  website?: string
  homepage?: string
  twitter?: string
  github?: string
  [key: string]: unknown
}

interface CDPRawTransaction {
  txHash?: string
  tx_hash?: string
  transactionHash?: string
  transaction_hash?: string
  signature?: string
  agentAddress?: string
  agent_address?: string
  payer?: string
  from?: string
  merchantId?: string
  type?: string
  amount?: string | number
  amountUSDC?: string | number
  amount_usdc?: string | number
  status?: string
  timestamp?: string | number
  createdAt?: string | number
  created_at?: string | number
  network?: string
  chain?: string
  blockNumber?: number
  confirmationTime?: number
  endpointUrl?: string
  endpoint_url?: string
  resourceUrl?: string
  resource_url?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

interface CDPRawActivity {
  agentAddress?: string
  agent_address?: string
  agent?: string
  merchantId?: string
  merchant_id?: string
  endpointUrl?: string
  endpoint_url?: string
  endpoint?: string
  responseTime?: string | number
  response_time?: string | number
  latency?: string | number
  success?: boolean
  status?: string
  timestamp?: string | number
  createdAt?: string | number
  errorMessage?: string
  error_message?: string
  error?: string
  requestId?: string
  request_id?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

// ========================================
// CDP CLIENT
// ========================================

export class CoinbaseCDPClient extends BaseFacilitatorClient {
  private apiKeyId?: string
  private apiKeySecret?: string

  constructor(config?: Partial<FacilitatorClientConfig> & { apiKeyId?: string; apiKeySecret?: string }) {
    super({
      facilitatorSlug: 'coinbase-cdp',
      baseUrl: config?.baseUrl ?? 'https://api.cdp.coinbase.com/platform/v2/x402',
      apiKey: config?.apiKey,
      timeout: config?.timeout ?? 15000,
      maxRetries: config?.maxRetries ?? 3,
      rateLimitPerSecond: config?.rateLimitPerSecond ?? 10,
    })

    this.apiKeyId = config?.apiKeyId
    this.apiKeySecret = config?.apiKeySecret
  }

  // ========================================
  // OVERRIDES
  // ========================================

  protected override getHealthEndpoint(): string {
    // CDP doesn't have a /health endpoint, check base URL
    return this.baseUrl
  }

  protected override getDefaultHeaders(): Record<string, string> {
    const headers = super.getDefaultHeaders()

    // Add Basic auth if credentials provided
    if (this.apiKeyId && this.apiKeySecret) {
      const auth = Buffer.from(`${this.apiKeyId}:${this.apiKeySecret}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    return headers
  }

  // ========================================
  // MERCHANT DISCOVERY
  // ========================================

  async discoverMerchants(network?: string): Promise<MerchantListing[]> {
    try {
      const path = network
        ? `/discovery/resources?network=${encodeURIComponent(network)}`
        : '/discovery/resources'

      const data = await this.fetchProtected<
        CDPRawResource[] | { resources: CDPRawResource[] } | { services: CDPRawResource[] }
      >(path)

      let resources: CDPRawResource[]
      if (Array.isArray(data)) {
        resources = data
      } else {
        const obj = data as Record<string, CDPRawResource[] | unknown>
        resources = (obj.resources ?? obj.services ?? []) as CDPRawResource[]
      }

      return resources.map((r: CDPRawResource) => this.parseResource(r))
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

      const queryString = params.toString()
      const path = `/payments${queryString ? `?${queryString}` : ''}`

      const data = await this.fetchProtected<
        CDPRawTransaction[] | { payments: CDPRawTransaction[] } | { transactions: CDPRawTransaction[] }
      >(path)

      let payments: CDPRawTransaction[]
      if (Array.isArray(data)) {
        payments = data
      } else {
        const obj = data as Record<string, CDPRawTransaction[] | unknown>
        payments = (obj.payments ?? obj.transactions ?? []) as CDPRawTransaction[]
      }

      return payments.map((p: CDPRawTransaction) => this.parseTransaction(p))
    } catch (error) {
      this.log('error', 'Transaction collection failed', error)
      return []
    }
  }

  async getTransaction(txSignature: string): Promise<AgentTransaction | null> {
    try {
      const data = await this.fetchUnprotected<CDPRawTransaction>(`/payments/${txSignature}`)

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

      const queryString = params.toString()
      const path = `/activity${queryString ? `?${queryString}` : ''}`

      const data = await this.fetchUnprotected<
        CDPRawActivity[] | { activity: CDPRawActivity[] } | { activities: CDPRawActivity[] }
      >(path)

      if (!data) return []

      let activities: CDPRawActivity[]
      if (Array.isArray(data)) {
        activities = data
      } else {
        const obj = data as Record<string, CDPRawActivity[] | unknown>
        activities = (obj.activity ?? obj.activities ?? []) as CDPRawActivity[]
      }

      return activities.map((a: CDPRawActivity) => this.parseActivity(a))
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

  private parseResource(data: CDPRawResource): MerchantListing {
    const endpoints: MerchantListing['endpoints'] = []

    if (Array.isArray(data.endpoints)) {
      endpoints.push(
        ...data.endpoints.map((e) => ({
          url: e.url ?? e.endpoint ?? '',
          method: e.method ?? 'POST',
          priceUSDC: parseFloat(String(e.price ?? e.cost ?? '0')),
          description: e.description ?? '',
        }))
      )
    } else if (data.url) {
      endpoints.push({
        url: data.url,
        method: data.method ?? 'POST',
        priceUSDC: parseFloat(String(data.price ?? data.cost ?? '0')),
        description: data.description ?? '',
      })
    }

    return {
      name: data.name ?? data.title ?? 'Unknown Service',
      description: data.description ?? '',
      network: data.network ?? 'eip155:8453', // Default to Base mainnet
      endpoints,
      capabilities: data.capabilities ?? data.tags ?? [],
      category: data.category ?? data.type,
      metadata: {
        website: data.website ?? data.homepage,
        twitter: data.twitter,
        github: data.github,
      },
    }
  }

  private parseTransaction(data: CDPRawTransaction): AgentTransaction {
    return {
      txSignature:
        data.txHash ??
        data.tx_hash ??
        data.transactionHash ??
        data.transaction_hash ??
        data.signature ??
        '',
      agentAddress: data.agentAddress ?? data.agent_address ?? data.payer ?? data.from ?? '',
      merchantId: data.merchantId,
      type: this.parseTransactionType(data.type),
      amountUSDC: parseFloat(String(data.amount ?? data.amountUSDC ?? data.amount_usdc ?? '0')),
      status: this.parseStatus(data.status),
      timestamp: this.parseTimestamp(data.timestamp ?? data.createdAt ?? data.created_at),
      network: this.parseNetwork(data.network ?? data.chain),
      blockNumber: data.blockNumber,
      confirmationTime: data.confirmationTime,
      endpointUrl: data.endpointUrl ?? data.endpoint_url ?? data.resourceUrl ?? data.resource_url,
      metadata: {
        facilitator: 'coinbase-cdp',
        ...data.metadata,
      },
    }
  }

  private parseActivity(data: CDPRawActivity): AgentActivity {
    return {
      agentAddress: data.agentAddress ?? data.agent_address ?? data.agent ?? '',
      merchantId: data.merchantId ?? data.merchant_id ?? '',
      endpointUrl: data.endpointUrl ?? data.endpoint_url ?? data.endpoint ?? '',
      responseTime: parseFloat(String(data.responseTime ?? data.response_time ?? data.latency ?? '0')),
      success:
        data.success === true ||
        data.status === 'success' ||
        data.status?.toLowerCase() === 'completed',
      timestamp: this.parseTimestamp(data.timestamp ?? data.createdAt),
      errorMessage: data.errorMessage ?? data.error_message ?? data.error,
      requestId: data.requestId ?? data.request_id,
      metadata: data.metadata,
    }
  }

  private parseTransactionType(type?: string): AgentTransaction['type'] {
    if (!type) return 'payment_sent'
    const lower = type.toLowerCase()
    if (lower.includes('receive') || lower.includes('incoming')) return 'payment_received'
    if (lower.includes('refund')) return 'refund'
    if (lower.includes('fee')) return 'fee'
    return 'payment_sent'
  }

  private parseStatus(status?: string): AgentTransaction['status'] {
    if (!status) return 'pending'
    const lower = status.toLowerCase()
    if (lower.includes('confirm') || lower === 'success' || lower === 'completed') return 'confirmed'
    if (lower.includes('fail') || lower === 'error' || lower === 'rejected') return 'failed'
    return 'pending'
  }

  private parseTimestamp(timestamp: unknown): number {
    if (!timestamp) return Date.now()
    if (typeof timestamp === 'number') {
      return timestamp < 1e12 ? timestamp * 1000 : timestamp
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime()
    }
    return Date.now()
  }

  private parseNetwork(network: unknown): string {
    if (!network) return 'base'
    const str = String(network).toLowerCase()
    if (str.includes('8453') || str === 'base' || str === 'base-mainnet') return 'base'
    if (str.includes('84532') || str === 'base-sepolia') return 'base-sepolia'
    if (str.includes('solana') || str.includes('sol')) return 'solana'
    if (str.includes('polygon') || str.includes('137')) return 'polygon'
    if (str.includes('ethereum') || str.includes('eth') || str.includes('1')) return 'ethereum'
    return str
  }
}

// ========================================
// FACTORY FUNCTION
// ========================================

export function createCoinbaseCDPClient(
  config?: Partial<FacilitatorClientConfig> & { apiKeyId?: string; apiKeySecret?: string }
): CoinbaseCDPClient {
  return new CoinbaseCDPClient(config)
}
