/**
 * Shared API Types for Seance API
 */

// Standard API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    statusCode: number
  }
  meta?: {
    timestamp: number
    cached?: boolean
    ttl?: number
  }
}

// Agent reputation response
export interface AgentReputationResponse {
  agent: {
    address: string
    name: string
    ghostScore: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'
    isActive: boolean
    createdAt: number
  }
  profile?: {
    model?: string
    provider?: string
    avgResponseTime: number
    totalRequests: number
    successfulRequests: number
    uptime: number
    totalEarningsUSDC: number
    totalSpendingUSDC: number
    category?: string
    tags: string[]
    errorRate: number
  }
  reputation?: {
    overallScore: number
    trustScore: number
    qualityScore: number
    reliabilityScore: number
    economicScore: number
    socialScore: number
    trend: 'rising' | 'falling' | 'stable'
    rank?: number
  }
  credentials: Array<{
    credentialId: string
    type: string
    issuedBy: string
    issuedAt: number
    expiresAt?: number
    isRevoked: boolean
  }>
  capabilities: Array<{
    capability: string
    level: 'basic' | 'intermediate' | 'advanced' | 'expert'
    isVerified: boolean
    successRate: number
    usageCount: number
  }>
  stats: {
    totalTransactions: number
    totalVolume: number
    successRate: number
    avgConfirmationTime: number
  }
}

// Merchant analytics response
export interface MerchantAnalyticsResponse {
  merchant: {
    id: string
    name: string
    description: string
    facilitator: {
      name: string
      slug: string
    }
    network: string
    category?: string
    isActive: boolean
  }
  endpoints: Array<{
    url: string
    method: string
    priceUSDC: number
    description: string
  }>
  capabilities: string[]
  analytics: {
    totalCalls: number
    successRate: number
    discoveredAt: number
    lastSeen: number
  }
  reviews: {
    totalReviews: number
    avgRating: number
    ratingDistribution: Record<number, number>
  }
}

// Credential verification response
export interface CredentialVerificationResponse {
  credential: {
    credentialId: string
    type: string
    issuedBy: string
    issuedAt: number
    expiresAt?: number
    isRevoked: boolean
    isExpired: boolean
  }
  agent: {
    name: string
    address: string
    ghostScore: number
  }
  claims: {
    name: string
    capabilities: string[]
    score?: number
  }
  evidence: Array<{
    evidenceType: string
    source: string
    isVerified: boolean
    verifiedBy?: string
    verifiedAt?: number
    collectedAt: number
  }>
  verification: {
    isValid: boolean
    reason?: string
  }
}

// Capabilities search response
export interface CapabilitiesSearchResponse {
  capability: string
  totalAgents: number
  agents: Array<{
    agent: {
      name: string
      address: string
      ghostScore: number
      tier: string
    }
    capability: {
      level: 'basic' | 'intermediate' | 'advanced' | 'expert'
      confidence: number
      successRate: number
      usageCount: number
      avgResponseTime: number
      priceUSDC: number
      isVerified: boolean
    }
  }>
}

// Network statistics response
export interface NetworkStatsResponse {
  agents: {
    total: number
    active: number
    avgGhostScore: number
  }
  transactions: {
    totalVolume: number
    totalCount: number
    successRate: number
    avgConfirmationTime: number
  }
  credentials: {
    total: number
    active: number
    typeCounts: Record<string, number>
  }
  merchants: {
    total: number
    active: number
  }
  facilitators: {
    total: number
    online: number
  }
  trending: {
    topAgents: Array<{
      name: string
      address: string
      ghostScore: number
      trend: string
    }>
  }
}
