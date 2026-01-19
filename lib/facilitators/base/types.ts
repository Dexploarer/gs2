/**
 * Shared types for facilitator clients
 *
 * Consolidated type definitions used across all facilitator client implementations
 */

// ========================================
// HEALTH & STATUS
// ========================================

export interface HealthCheckResult {
  status: 'online' | 'offline' | 'degraded'
  responseTime?: number
  error?: string
  timestamp: number
  endpoint?: string
}

// ========================================
// MERCHANTS & ENDPOINTS
// ========================================

export interface MerchantEndpoint {
  url: string
  method: string
  priceUSDC: number
  description: string
}

export interface MerchantListing {
  name: string
  description: string
  network: string
  endpoints: MerchantEndpoint[]
  capabilities?: string[]
  category?: string
  metadata?: {
    website?: string
    twitter?: string
    github?: string
  }
}

// ========================================
// TRANSACTIONS & ACTIVITY
// ========================================

export type TransactionType = 'payment_sent' | 'payment_received' | 'refund' | 'fee'
export type TransactionStatus = 'confirmed' | 'pending' | 'failed'

export interface AgentTransaction {
  txSignature: string
  agentAddress: string
  merchantId?: string
  type: TransactionType
  amountUSDC: number
  feeUSDC?: number
  status: TransactionStatus
  timestamp: number
  network: string
  blockNumber?: number
  confirmationTime?: number
  endpointUrl?: string
  serviceName?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
}

export interface AgentActivity {
  agentAddress: string
  merchantId: string
  endpointUrl: string
  responseTime: number
  success: boolean
  timestamp: number
  errorMessage?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

// ========================================
// STATISTICS
// ========================================

export interface FacilitatorStats {
  totalPayments?: number
  dailyVolume?: number
  dailyTransactions?: number
  totalVolume?: number
  totalTransactions?: number
  successRate?: number
  availableMerchants?: number
  activeAgents?: number
  activeMerchants?: number
  avgResponseTime?: number
}

// ========================================
// QUERY OPTIONS
// ========================================

export interface TransactionQueryOptions {
  since?: number
  limit?: number
  network?: string
  agentAddress?: string
}

export interface ActivityQueryOptions {
  since?: number
  limit?: number
  agentAddress?: string
}

// ========================================
// CLIENT CONFIG
// ========================================

export interface FacilitatorClientConfig {
  facilitatorSlug: string
  baseUrl: string
  apiKey?: string
  timeout?: number
  maxRetries?: number
  rateLimitPerSecond?: number
}

// ========================================
// CLIENT INTERFACE
// ========================================

export interface FacilitatorClient {
  readonly slug: string
  readonly baseUrl: string

  // Required methods
  healthCheck(): Promise<HealthCheckResult>
  discoverMerchants(network?: string): Promise<MerchantListing[]>

  // Optional methods
  getStats?(): Promise<FacilitatorStats | null>
  getRecentTransactions?(options?: TransactionQueryOptions): Promise<AgentTransaction[]>
  getAgentActivity?(options?: ActivityQueryOptions): Promise<AgentActivity[]>
  getTransaction?(txSignature: string): Promise<AgentTransaction | null>
}
