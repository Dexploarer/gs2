/**
 * GhostSpeak v2 Convex Schema (2026)
 *
 * Following Convex 1.31+ best practices:
 * - Explicit table names for security
 * - Validators for type safety
 * - Modular schema organization
 */

import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // User accounts (linked to Solana wallets)
  users: defineTable({
    walletAddress: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id('_storage')), // Convex file storage
    createdAt: v.number(),
    lastLoginAt: v.number(),
  })
    .index('by_wallet', ['walletAddress'])
    .index('by_email', ['email']),

  // AI Agent registry
  agents: defineTable({
    address: v.string(), // Solana address
    ownerId: v.optional(v.id('users')), // Optional for auto-discovered agents
    name: v.string(),
    description: v.string(),
    descriptionEmbedding: v.optional(v.array(v.float64())), // Vector for similarity search
    avatarStorageId: v.optional(v.id('_storage')), // Convex file storage for avatar
    model: v.optional(v.string()),
    capabilities: v.array(v.string()),
    endpoints: v.optional(
      v.array(
        v.object({
          type: v.string(),
          url: v.string(),
        })
      )
    ),
    ghostScore: v.number(),
    tier: v.union(
      v.literal('bronze'),
      v.literal('silver'),
      v.literal('gold'),
      v.literal('platinum')
    ),
    isActive: v.boolean(),
    isVerified: v.optional(v.boolean()), // Verified by GhostSpeak
    category: v.optional(v.string()), // x402-agent, ai, data, etc.
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_address', ['address'])
    .index('by_owner', ['ownerId'])
    .index('by_score', ['ghostScore'])
    .index('by_tier', ['tier'])
    .vectorIndex('by_description_embedding', {
      vectorField: 'descriptionEmbedding',
      dimensions: 1536, // OpenAI text-embedding-3-small
      filterFields: ['isActive', 'tier'],
    }),

  // W3C Verifiable Credentials
  credentials: defineTable({
    credentialId: v.string(),
    agentId: v.id('agents'),
    type: v.string(),
    typeEmbedding: v.optional(v.array(v.float64())), // Vector for semantic credential search
    issuedBy: v.string(),
    issuedAt: v.number(),
    expiresAt: v.optional(v.number()),
    isRevoked: v.boolean(),
    claims: v.object({
      name: v.string(),
      capabilities: v.array(v.string()),
      score: v.optional(v.number()),
    }),
    evidenceDocumentStorageId: v.optional(v.id('_storage')), // Evidence documents (PDFs, images)
  })
    .index('by_credential_id', ['credentialId'])
    .index('by_agent', ['agentId'])
    .index('by_type', ['type'])
    .vectorIndex('by_type_embedding', {
      vectorField: 'typeEmbedding',
      dimensions: 1536,
      filterFields: ['isRevoked'],
    }),

  // Ghost Score history (for charts)
  scoreHistory: defineTable({
    agentId: v.id('agents'),
    score: v.number(),
    tier: v.string(),
    reason: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_timestamp', ['timestamp']),

  // x402 payment transactions
  transactions: defineTable({
    signature: v.string(),
    agentId: v.id('agents'),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('failed')
    ),
    timestamp: v.number(),
  })
    .index('by_signature', ['signature'])
    .index('by_agent', ['agentId'])
    .index('by_status', ['status']),

  // API keys for developers
  apiKeys: defineTable({
    key: v.string(),
    userId: v.id('users'),
    name: v.string(),
    permissions: v.array(v.string()),
    usageCount: v.number(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index('by_key', ['key'])
    .index('by_user', ['userId']),

  // x402 Payment Tracking (Observatory)
  x402Payments: defineTable({
    txSignature: v.string(),
    agentId: v.id('agents'),
    endpoint: v.string(),
    amount: v.number(),
    currency: v.string(), // USDC
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('failed')
    ),
    facilitator: v.optional(v.string()), // PayAI, Coinbase, etc.
    network: v.union(v.literal('base'), v.literal('solana')),
    responseTime: v.optional(v.number()), // milliseconds
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_signature', ['txSignature'])
    .index('by_agent', ['agentId'])
    .index('by_endpoint', ['endpoint'])
    .index('by_status', ['status'])
    .index('by_network', ['network'])
    .index('by_timestamp', ['timestamp']),

  // x402 Subscriptions (recurring payments)
  x402Subscriptions: defineTable({
    subscriptionId: v.string(),
    subscriberId: v.id('agents'),
    recipientId: v.id('agents'),
    recipientAddress: v.string(),
    amount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    period: v.union(
      v.literal('hourly'),
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('monthly'),
      v.literal('yearly')
    ),
    periodSeconds: v.optional(v.number()),
    status: v.union(
      v.literal('active'),
      v.literal('paused'),
      v.literal('cancelled'),
      v.literal('expired'),
      v.literal('trial')
    ),
    autoRenew: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    maxRenewals: v.optional(v.number()),
    renewalCount: v.number(),
    gracePeriodSeconds: v.optional(v.number()),
    features: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
  })
    .index('by_subscription', ['subscriptionId'])
    .index('by_subscriber', ['subscriberId'])
    .index('by_recipient', ['recipientId'])
    .index('by_status', ['status'])
    .index('by_period_end', ['currentPeriodEnd']),

  // x402 Subscription Payments
  x402SubscriptionPayments: defineTable({
    subscriptionId: v.string(),
    txSignature: v.string(),
    amount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    periodStart: v.number(),
    periodEnd: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('refunded')
    ),
    failureReason: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index('by_subscription', ['subscriptionId'])
    .index('by_signature', ['txSignature'])
    .index('by_status', ['status'])
    .index('by_timestamp', ['timestamp']),

  // x402 Upto Authorizations (variable pricing)
  x402UptoAuthorizations: defineTable({
    authorizationId: v.string(),
    payerId: v.id('agents'),
    recipientId: v.id('agents'),
    recipientAddress: v.string(),
    maxAmount: v.number(),
    usedAmount: v.number(),
    remainingAmount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    baseCost: v.number(),
    unitCost: v.number(),
    unitType: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('exhausted'),
      v.literal('expired'),
      v.literal('revoked')
    ),
    expiresAt: v.optional(v.number()),
    totalUnitsUsed: v.number(),
    chargeCount: v.number(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_authorization', ['authorizationId'])
    .index('by_payer', ['payerId'])
    .index('by_recipient', ['recipientId'])
    .index('by_status', ['status'])
    .index('by_expires', ['expiresAt']),

  // x402 Upto Charges (charges against authorizations)
  x402UptoCharges: defineTable({
    authorizationId: v.string(),
    txSignature: v.optional(v.string()),
    amount: v.number(),
    unitsUsed: v.number(),
    unitType: v.string(),
    breakdown: v.object({
      base: v.number(),
      variable: v.number(),
    }),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('failed')
    ),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_authorization', ['authorizationId'])
    .index('by_signature', ['txSignature'])
    .index('by_timestamp', ['timestamp']),

  // x402 Batch Payments
  x402BatchPayments: defineTable({
    batchId: v.string(),
    initiatorId: v.id('agents'),
    totalAmount: v.number(),
    successAmount: v.number(),
    failedAmount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    executionMode: v.union(v.literal('atomic'), v.literal('best-effort')),
    paymentCount: v.number(),
    successCount: v.number(),
    failedCount: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('partial'),
      v.literal('failed')
    ),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_batch', ['batchId'])
    .index('by_initiator', ['initiatorId'])
    .index('by_status', ['status'])
    .index('by_created', ['createdAt']),

  // x402 Batch Payment Items
  x402BatchPaymentItems: defineTable({
    batchId: v.string(),
    recipientId: v.optional(v.id('agents')),
    recipientAddress: v.string(),
    amount: v.number(),
    reference: v.optional(v.string()),
    txSignature: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('failed')
    ),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    processedAt: v.optional(v.number()),
  })
    .index('by_batch', ['batchId'])
    .index('by_recipient', ['recipientAddress'])
    .index('by_signature', ['txSignature'])
    .index('by_status', ['status']),

  // Endpoint Registry (Observatory)
  endpoints: defineTable({
    url: v.string(),
    protocol: v.union(v.literal('x402'), v.literal('http'), v.literal('https')),
    network: v.optional(v.union(v.literal('base'), v.literal('solana'))), // Blockchain network
    agentId: v.optional(v.id('agents')), // Provider agent
    name: v.string(),
    description: v.string(),
    capabilities: v.array(v.string()),
    priceUSDC: v.number(),
    successRate: v.number(), // 0-100
    avgResponseTime: v.number(), // milliseconds
    ghostScore: v.optional(v.number()), // Provider's ghost score
    totalCalls: v.number(),
    successfulCalls: v.number(),
    failedCalls: v.number(),
    lastTested: v.optional(v.number()),
    isVerified: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // New fields for sync and trust scoring
    source: v.optional(
      v.union(
        v.literal('bazaar'),
        v.literal('payai'),
        v.literal('manual'),
        v.literal('crawl')
      )
    ),
    category: v.optional(v.string()), // ai-inference, defi-data, etc.
    consistencyScore: v.optional(v.number()), // 0-100, response quality variance
    trustScore: v.optional(v.number()), // 0-1000 composite trust score
    verificationTier: v.optional(v.string()), // UNVERIFIED, TESTED, VERIFIED, TRUSTED, CERTIFIED
    discoverable: v.optional(v.boolean()), // Discoverable via Bazaar
    isStale: v.optional(v.boolean()), // Marked for cleanup
    lastSynced: v.optional(v.number()), // Last sync from external source
  })
    .index('by_url', ['url'])
    .index('by_agent', ['agentId'])
    .index('by_protocol', ['protocol'])
    .index('by_network', ['network'])
    .index('by_success_rate', ['successRate'])
    .index('by_ghost_score', ['ghostScore'])
    .index('by_source', ['source'])
    .index('by_category', ['category'])
    .index('by_trust_score', ['trustScore']),

  // Trust Score History (for tracking changes and alerts)
  trustScoreHistory: defineTable({
    endpointId: v.id('endpoints'),
    trustScore: v.number(),
    successRate: v.number(),
    avgResponseTime: v.number(),
    verificationTier: v.string(),
    timestamp: v.number(),
  })
    .index('by_endpoint', ['endpointId'])
    .index('by_timestamp', ['timestamp']),

  // Agent Activity Stream (Observatory)
  agentActivity: defineTable({
    agentId: v.id('agents'),
    activityType: v.union(
      v.literal('payment'),
      v.literal('endpoint_call'),
      v.literal('credential_issued'),
      v.literal('score_change'),
      v.literal('tier_change')
    ),
    metadata: v.object({
      endpoint: v.optional(v.string()),
      amount: v.optional(v.number()),
      oldScore: v.optional(v.number()),
      newScore: v.optional(v.number()),
      description: v.optional(v.string()),
      credentialType: v.optional(v.string()), // For credential_issued activity
      newTier: v.optional(v.string()), // For tier_change activity
      scoreImpact: v.optional(v.number()), // Score change amount
    }),
    impactOnScore: v.optional(v.number()), // +/- change
    timestamp: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_type', ['activityType'])
    .index('by_timestamp', ['timestamp']),

  // System Metrics (Observatory)
  systemMetrics: defineTable({
    metricType: v.union(
      v.literal('latency'),
      v.literal('throughput'),
      v.literal('errorRate'),
      v.literal('networkFinality'),
      v.literal('facilitatorUptime')
    ),
    value: v.number(),
    network: v.optional(v.union(v.literal('base'), v.literal('solana'))),
    facilitator: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_type', ['metricType'])
    .index('by_network', ['network'])
    .index('by_timestamp', ['timestamp']),

  // Trust Events (Observatory)
  trustEvents: defineTable({
    agentId: v.id('agents'),
    eventType: v.union(
      v.literal('score_increase'),
      v.literal('score_decrease'),
      v.literal('credential_issued'),
      v.literal('credential_revoked'),
      v.literal('tier_upgrade'),
      v.literal('tier_downgrade'),
      v.literal('verification_passed'),
      v.literal('verification_failed')
    ),
    oldScore: v.optional(v.number()),
    newScore: v.optional(v.number()),
    reason: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_type', ['eventType'])
    .index('by_timestamp', ['timestamp']),

  // x402 Facilitator Registry (Observatory)
  facilitators: defineTable({
    name: v.string(),
    slug: v.string(), // payai, coinbase-cdp, rapid402, etc.
    description: v.string(),
    facilitatorUrl: v.string(),
    networks: v.array(
      v.union(
        v.literal('solana'),
        v.literal('solana-devnet'),
        v.literal('base'),
        v.literal('base-sepolia'),
        v.literal('avalanche'),
        v.literal('polygon'),
        v.literal('sei'),
        v.literal('iotex'),
        v.literal('peaq'),
        v.literal('xlayer'),
        v.literal('skale'),
        v.literal('bnb'),
        v.literal('bitcoin')
      )
    ),
    supportedTokens: v.array(v.string()), // ['USDC', 'SOL', 'ETH']
    features: v.array(v.string()), // ['gasless', 'permissionless', 'multi-chain']
    pricing: v.object({
      model: v.union(
        v.literal('free'),
        v.literal('fee-per-transaction'),
        v.literal('percentage')
      ),
      feePercentage: v.optional(v.number()), // 0.5% = 0.005
      flatFee: v.optional(v.number()),
    }),
    performance: v.object({
      uptime: v.number(), // 99.9
      avgResponseTime: v.number(), // milliseconds
      dailyVolume: v.number(), // USD
      dailyTransactions: v.number(),
    }),
    status: v.union(
      v.literal('active'),
      v.literal('beta'),
      v.literal('testnet-only'),
      v.literal('deprecated')
    ),
    isVerified: v.boolean(),
    documentationUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_verified', ['isVerified']),

  // Facilitator Health Monitoring (Real-time)
  facilitatorHealth: defineTable({
    facilitatorId: v.id('facilitators'),
    status: v.union(
      v.literal('online'),
      v.literal('offline'),
      v.literal('degraded')
    ),
    responseTime: v.optional(v.number()), // milliseconds
    lastChecked: v.number(),
    errorMessage: v.optional(v.string()),
    uptime24h: v.number(), // percentage
    consecutiveFailures: v.number(), // 0 = healthy, 3+ = alert
    endpoint: v.string(), // which endpoint was checked
    timestamp: v.number(),
  })
    .index('by_facilitator', ['facilitatorId'])
    .index('by_status', ['status'])
    .index('by_timestamp', ['timestamp']),

  // Merchants/Sellers discovered via Bazaar
  merchants: defineTable({
    name: v.string(),
    description: v.string(),
    descriptionEmbedding: v.optional(v.array(v.float64())), // Vector for merchant similarity search
    logoStorageId: v.optional(v.id('_storage')), // Convex file storage for merchant logo
    facilitatorId: v.id('facilitators'),
    network: v.string(), // CAIP-2 network identifier
    endpoints: v.array(
      v.object({
        url: v.string(),
        method: v.string(), // GET, POST, etc.
        priceUSDC: v.number(),
        description: v.string(),
      })
    ),
    capabilities: v.array(v.string()), // What services they offer
    category: v.optional(v.string()), // AI, data, compute, etc.
    totalCalls: v.number(),
    successRate: v.number(), // 0-100
    discoveredAt: v.number(),
    lastSeen: v.number(),
    isActive: v.boolean(),
    metadata: v.optional(
      v.object({
        website: v.optional(v.string()),
        twitter: v.optional(v.string()),
        github: v.optional(v.string()),
      })
    ),
  })
    .index('by_facilitator', ['facilitatorId'])
    .index('by_network', ['network'])
    .index('by_active', ['isActive'])
    .index('by_discovered', ['discoveredAt'])
    .vectorIndex('by_description_embedding', {
      vectorField: 'descriptionEmbedding',
      dimensions: 1536,
      filterFields: ['isActive', 'category'],
    }),

  // ========================================
  // DEEP DATA COLLECTION TABLES (Phase 1)
  // ========================================

  // Agent Profiles - Deep agent profiles beyond basic registry
  agentProfiles: defineTable({
    agentId: v.id('agents'),
    // Extended metadata
    model: v.optional(v.string()), // GPT-4, Claude, Llama, etc.
    modelVersion: v.optional(v.string()),
    provider: v.optional(v.string()), // OpenAI, Anthropic, local, etc.
    // Behavioral metrics
    avgResponseTime: v.number(), // milliseconds
    totalRequests: v.number(),
    successfulRequests: v.number(),
    failedRequests: v.number(),
    uptime: v.number(), // percentage
    // Economic metrics
    totalEarningsUSDC: v.number(),
    totalSpendingUSDC: v.number(),
    avgPricePerRequest: v.number(),
    // Specialization
    primaryCategory: v.optional(
      v.union(
        v.literal('data'),
        v.literal('ai'),
        v.literal('compute'),
        v.literal('storage'),
        v.literal('seance'),
        v.literal('tool'),
        v.literal('other')
      )
    ),
    tags: v.array(v.string()),
    // Quality metrics
    errorRate: v.number(), // percentage
    avgLatency: v.number(), // milliseconds
    p95Latency: v.number(), // milliseconds
    p99Latency: v.number(), // milliseconds
    // Social proof
    endorsements: v.number(), // Count of other agents endorsing this one
    attestations: v.number(), // Count of W3C attestations received
    // Timestamps
    firstSeenAt: v.number(),
    lastActiveAt: v.number(),
    profileUpdatedAt: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_category', ['primaryCategory'])
    .index('by_uptime', ['uptime'])
    .index('by_earnings', ['totalEarningsUSDC'])
    .index('by_last_active', ['lastActiveAt']),

  // Agent Transactions - Every x402 payment tracked from agent perspective
  agentTransactions: defineTable({
    agentId: v.id('agents'),
    txSignature: v.string(),
    // Transaction details
    type: v.union(
      v.literal('payment_sent'), // Agent paid for a service
      v.literal('payment_received'), // Agent received payment
      v.literal('refund'),
      v.literal('fee')
    ),
    counterpartyAgentId: v.optional(v.id('agents')), // Other agent involved
    merchantId: v.optional(v.id('merchants')), // Or merchant
    // Financial details
    amountUSDC: v.number(),
    feeUSDC: v.number(),
    facilitatorId: v.id('facilitators'),
    network: v.string(), // CAIP-2
    // Performance
    confirmationTime: v.number(), // milliseconds
    blockNumber: v.optional(v.number()),
    // Metadata
    endpointUrl: v.optional(v.string()),
    serviceName: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('failed'),
      v.literal('refunded')
    ),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_signature', ['txSignature'])
    .index('by_type', ['type'])
    .index('by_status', ['status'])
    .index('by_timestamp', ['timestamp'])
    .index('by_counterparty', ['counterpartyAgentId'])
    .index('by_merchant', ['merchantId', 'timestamp']),

  // Agent Capabilities - Structured capability tracking
  agentCapabilities: defineTable({
    agentId: v.id('agents'),
    capability: v.string(), // e.g., "image-generation", "text-analysis", "data-fetch"
    // Proficiency metrics
    level: v.union(
      v.literal('basic'),
      v.literal('intermediate'),
      v.literal('advanced'),
      v.literal('expert')
    ),
    confidence: v.number(), // 0-100, based on success rate
    usageCount: v.number(), // How many times used
    successRate: v.number(), // 0-100
    avgResponseTime: v.number(), // milliseconds
    // Pricing
    priceUSDC: v.number(), // Price to use this capability
    // Evidence
    demonstratedAt: v.number(), // When first demonstrated
    lastUsedAt: v.number(),
    // Verification
    isVerified: v.boolean(), // Has been verified by community or testing
    verifiedBy: v.optional(v.string()), // Who verified it
    verifiedAt: v.optional(v.number()),
    // Metadata
    examples: v.optional(v.array(v.string())), // Example use cases
    limitations: v.optional(v.array(v.string())),
  })
    .index('by_agent', ['agentId'])
    .index('by_capability', ['capability'])
    .index('by_level', ['level'])
    .index('by_verified', ['isVerified'])
    .index('by_last_used', ['lastUsedAt']),

  // Merchant Analytics - Deep merchant metrics
  merchantAnalytics: defineTable({
    merchantId: v.id('merchants'),
    // Time-series metrics (hourly or daily snapshots)
    periodStart: v.number(), // Timestamp for start of period
    periodEnd: v.number(),
    periodType: v.union(v.literal('hourly'), v.literal('daily'), v.literal('weekly')),
    // Volume metrics
    totalRequests: v.number(),
    successfulRequests: v.number(),
    failedRequests: v.number(),
    totalRevenueUSDC: v.number(),
    // Performance metrics
    avgResponseTime: v.number(), // milliseconds
    p95ResponseTime: v.number(),
    p99ResponseTime: v.number(),
    errorRate: v.number(), // percentage
    // Customer metrics
    uniqueAgents: v.number(), // Distinct agents that used this merchant
    newAgents: v.number(), // First-time users this period
    returningAgents: v.number(), // Repeat users
    // Top endpoints
    topEndpoint: v.optional(v.string()),
    topEndpointCalls: v.optional(v.number()),
    // Quality
    avgRating: v.optional(v.number()), // 0-5 from reviews
    totalReviews: v.number(),
    // Computed metrics
    uptime: v.number(), // percentage
    timestamp: v.number(), // When snapshot was taken
  })
    .index('by_merchant', ['merchantId'])
    .index('by_period', ['periodStart', 'periodEnd'])
    .index('by_timestamp', ['timestamp']),

  // Facilitator Incidents - Track downtime, errors, issues
  facilitatorIncidents: defineTable({
    facilitatorId: v.id('facilitators'),
    // Incident details
    severity: v.union(
      v.literal('critical'), // Complete outage
      v.literal('high'), // Major degradation
      v.literal('medium'), // Partial issues
      v.literal('low') // Minor issues
    ),
    status: v.union(
      v.literal('investigating'),
      v.literal('identified'),
      v.literal('monitoring'),
      v.literal('resolved')
    ),
    // Description
    title: v.string(),
    description: v.string(),
    affectedNetworks: v.array(v.string()), // Which networks were affected
    affectedServices: v.array(v.string()), // verify, settle, list, etc.
    // Timeline
    startedAt: v.number(),
    identifiedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    duration: v.optional(v.number()), // milliseconds
    // Impact
    affectedTransactions: v.number(),
    estimatedLossUSDC: v.optional(v.number()),
    // Root cause
    rootCause: v.optional(v.string()),
    resolution: v.optional(v.string()),
    // Metadata
    reportedBy: v.optional(v.string()), // auto-monitor or user report
    updates: v.optional(
      v.array(
        v.object({
          timestamp: v.number(),
          status: v.string(),
          message: v.string(),
        })
      )
    ),
  })
    .index('by_facilitator', ['facilitatorId'])
    .index('by_severity', ['severity'])
    .index('by_status', ['status'])
    .index('by_started', ['startedAt']),

  // Network Metrics - Chain-level performance tracking
  networkMetrics: defineTable({
    network: v.string(), // CAIP-2 identifier
    metricType: v.union(
      v.literal('finality'),
      v.literal('tps'),
      v.literal('gas_price'),
      v.literal('block_time'),
      v.literal('uptime')
    ),
    value: v.number(),
    unit: v.string(), // ms, transactions/sec, lamports, etc.
    // Time-series
    periodStart: v.number(),
    periodEnd: v.number(),
    periodType: v.union(v.literal('5min'), v.literal('hourly'), v.literal('daily')),
    // Aggregations
    min: v.optional(v.number()),
    max: v.optional(v.number()),
    avg: v.number(),
    p50: v.optional(v.number()),
    p95: v.optional(v.number()),
    p99: v.optional(v.number()),
    // Source
    source: v.string(), // Where we got this data
    timestamp: v.number(),
  })
    .index('by_network', ['network'])
    .index('by_metric_type', ['metricType'])
    .index('by_timestamp', ['timestamp']),

  // W3C Credential Evidence - Proof backing credentials
  credentialEvidence: defineTable({
    credentialId: v.id('credentials'),
    agentId: v.id('agents'),
    // Evidence type
    evidenceType: v.union(
      v.literal('transaction_history'), // Proof of payments
      v.literal('performance_metrics'), // Uptime, response time
      v.literal('capability_demo'), // Demonstrated capability
      v.literal('community_attestation'), // Others vouch for agent
      v.literal('third_party_verification') // External verification
    ),
    // Evidence data
    source: v.string(), // Where evidence came from
    data: v.any(), // Flexible JSON structure for evidence
    // Verification
    isVerified: v.boolean(),
    verifiedBy: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    // Timestamps
    collectedAt: v.number(),
    expiresAt: v.optional(v.number()), // Some evidence may expire
  })
    .index('by_credential', ['credentialId'])
    .index('by_agent', ['agentId'])
    .index('by_type', ['evidenceType'])
    .index('by_verified', ['isVerified']),

  // Credential Revocations - Track revoked credentials
  credentialRevocations: defineTable({
    credentialId: v.id('credentials'),
    agentId: v.id('agents'),
    // Revocation details
    reason: v.string(),
    reasonCode: v.union(
      v.literal('performance_decline'),
      v.literal('fraudulent_activity'),
      v.literal('security_breach'),
      v.literal('expired'),
      v.literal('voluntary'), // Agent requested revocation
      v.literal('other')
    ),
    // Authority
    revokedBy: v.string(), // Who revoked it
    revokedAt: v.number(),
    // Impact
    affectedClaims: v.array(v.string()),
    // Metadata
    metadata: v.optional(v.any()),
  })
    .index('by_credential', ['credentialId'])
    .index('by_agent', ['agentId'])
    .index('by_reason_code', ['reasonCode'])
    .index('by_revoked_at', ['revokedAt']),

  // Agent Attestations - Agent-to-agent endorsements
  agentAttestations: defineTable({
    // Who is attesting
    attestorAgentId: v.id('agents'),
    // Who is being attested to
    subjectAgentId: v.id('agents'),
    // Attestation details
    attestationType: v.union(
      v.literal('endorsement'), // General endorsement
      v.literal('capability_verification'), // Verified specific capability
      v.literal('reliability'), // Vouches for reliability
      v.literal('security'), // Vouches for security practices
      v.literal('quality') // Vouches for quality of work
    ),
    // Claim
    claim: v.string(), // What is being attested
    confidence: v.number(), // 0-100, how confident is attestor
    // Evidence
    basedOn: v.optional(v.string()), // What is this based on?
    evidence: v.optional(v.any()), // Supporting evidence
    // Context
    relatedTransactionId: v.optional(v.id('agentTransactions')), // If based on a transaction
    relatedCapability: v.optional(v.string()), // If about a specific capability
    // Validity
    isActive: v.boolean(),
    revokedAt: v.optional(v.number()),
    revocationReason: v.optional(v.string()),
    // Timestamps
    attestedAt: v.number(),
    expiresAt: v.optional(v.number()), // Some attestations may expire
  })
    .index('by_attestor', ['attestorAgentId'])
    .index('by_subject', ['subjectAgentId'])
    .index('by_type', ['attestationType'])
    .index('by_active', ['isActive'])
    .index('by_attested_at', ['attestedAt']),

  // Merchant Reviews - Payment-proof required reviews
  merchantReviews: defineTable({
    merchantId: v.id('merchants'),
    reviewerAgentId: v.id('agents'),
    // Proof of purchase required
    transactionId: v.id('agentTransactions'), // Must have paid to review
    // Review content
    rating: v.number(), // 1-5 stars
    title: v.optional(v.string()),
    content: v.string(),
    // Specific ratings
    ratings: v.object({
      performance: v.number(), // 1-5
      reliability: v.number(), // 1-5
      value: v.number(), // 1-5, price vs quality
      support: v.optional(v.number()), // 1-5
    }),
    // Helpfulness
    helpfulVotes: v.number(),
    notHelpfulVotes: v.number(),
    // Verification
    isVerified: v.boolean(), // Transaction verified
    isPurchaseVerified: v.boolean(), // Payment confirmed
    // Moderation
    isFlagged: v.boolean(),
    flagReason: v.optional(v.string()),
    // Response from merchant
    merchantResponse: v.optional(
      v.object({
        content: v.string(),
        respondedAt: v.number(),
      })
    ),
    // Timestamps
    reviewedAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index('by_merchant', ['merchantId'])
    .index('by_reviewer', ['reviewerAgentId'])
    .index('by_transaction', ['transactionId'])
    .index('by_rating', ['rating'])
    .index('by_verified', ['isVerified'])
    .index('by_reviewed_at', ['reviewedAt']),

  // Reputation Votes - Community voting on agents/merchants
  reputationVotes: defineTable({
    // Voter
    voterAgentId: v.id('agents'),
    voterGhostScore: v.number(), // Snapshot of voter's score at time of vote
    // Subject
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
    // Vote
    voteType: v.union(
      v.literal('trustworthy'),
      v.literal('untrustworthy'),
      v.literal('high_quality'),
      v.literal('low_quality'),
      v.literal('reliable'),
      v.literal('unreliable')
    ),
    weight: v.number(), // Vote weight based on voter's Ghost Score
    // Context
    reason: v.optional(v.string()),
    basedOnTransactionId: v.optional(v.id('agentTransactions')), // If based on experience
    // Metadata
    isActive: v.boolean(),
    timestamp: v.number(),
  })
    .index('by_voter', ['voterAgentId'])
    .index('by_subject_agent', ['subjectAgentId'])
    .index('by_subject_merchant', ['subjectMerchantId'])
    .index('by_vote_type', ['voteType'])
    .index('by_timestamp', ['timestamp']),

  // Reputation Scores - Computed reputation scores
  reputationScores: defineTable({
    // Subject
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
    // Overall score
    overallScore: v.number(), // 0-1000 composite score
    // Component scores
    trustScore: v.number(), // 0-100, based on votes and attestations
    qualityScore: v.number(), // 0-100, based on performance
    reliabilityScore: v.number(), // 0-100, based on uptime/success rate
    economicScore: v.number(), // 0-100, based on transaction volume/value
    socialScore: v.number(), // 0-100, based on community engagement
    stakingScore: v.optional(v.number()), // 0-100, based on BYOT staking (optional for backwards compat)
    // Supporting data
    totalVotes: v.number(),
    positiveVotes: v.number(),
    negativeVotes: v.number(),
    totalAttestations: v.number(),
    totalReviews: v.number(),
    avgReviewRating: v.optional(v.number()), // 1-5
    // On-chain sync (ERC-8004 Reputation Registry)
    onChain: v.optional(
      v.object({
        reputationPDA: v.string(), // Program Derived Address
        paymentProofsMerkleRoot: v.string(), // Hex string of Merkle root
        lastSyncTx: v.string(), // Last sync transaction signature
        lastSyncedAt: v.number(),
      })
    ),
    // Trends
    scoreChange7d: v.number(), // Change over last 7 days
    scoreChange30d: v.number(), // Change over last 30 days
    trend: v.union(v.literal('rising'), v.literal('falling'), v.literal('stable')),
    // Ranking
    rank: v.optional(v.number()), // Overall rank in ecosystem
    categoryRank: v.optional(v.number()), // Rank in category
    // Timestamps
    lastCalculatedAt: v.number(),
    nextCalculationAt: v.number(), // When to recalculate
  })
    .index('by_subject_agent', ['subjectAgentId'])
    .index('by_subject_merchant', ['subjectMerchantId'])
    .index('by_overall_score', ['overallScore'])
    .index('by_rank', ['rank'])
    .index('by_last_calculated', ['lastCalculatedAt']),

  // ========================================
  // WEB-OF-TRUST / REPUTATION GRAPH TABLES
  // ========================================

  // Trust Relationships - Graph edges for web-of-trust
  // Stores direct endorsements and computed transitive trust
  trustRelationships: defineTable({
    // Source and target agents
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    // Relationship type
    relationshipType: v.union(
      v.literal('endorsement'), // Direct endorsement
      v.literal('attestation'), // Based on attestation
      v.literal('transaction'), // Based on transaction history
      v.literal('computed'), // Computed from graph traversal
      v.literal('vote') // Based on payment-backed vote
    ),
    // Trust weights
    directWeight: v.number(), // 0-100, weight of direct relationship
    transitiveWeight: v.optional(v.number()), // 0-100, computed from graph
    // Trust categories (can endorse for specific domains)
    categories: v.array(
      v.union(
        v.literal('technical'),
        v.literal('reliability'),
        v.literal('quality'),
        v.literal('trustworthiness'),
        v.literal('collaboration'),
        v.literal('general')
      )
    ),
    // Graph metadata
    pathDistance: v.optional(v.number()), // Hops from original endorser (1 = direct)
    confidence: v.number(), // 0-100, confidence in this relationship
    // Source evidence
    sourceEndorsementId: v.optional(v.string()), // On-chain endorsement reference
    sourceAttestationId: v.optional(v.id('agentAttestations')),
    sourceVoteId: v.optional(v.id('reputationVotes')),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()), // Trust can expire
    isActive: v.boolean(),
  })
    .index('by_from', ['fromAgentId'])
    .index('by_to', ['toAgentId'])
    .index('by_from_to', ['fromAgentId', 'toAgentId'])
    .index('by_type', ['relationshipType'])
    .index('by_confidence', ['confidence'])
    .index('by_active', ['isActive']),

  // Trust Graph Metrics - PageRank and centrality scores
  trustGraphMetrics: defineTable({
    agentId: v.id('agents'),
    // PageRank scores
    pageRank: v.number(), // 0-1, PageRank authority score
    pageRankNormalized: v.number(), // 0-100, normalized for display
    // Centrality measures
    inDegree: v.number(), // Number of incoming endorsements
    outDegree: v.number(), // Number of outgoing endorsements
    betweennessCentrality: v.optional(v.number()), // Bridge importance
    eigenCentrality: v.optional(v.number()), // Influence in network
    // Trust network position
    clusterCoefficient: v.optional(v.number()), // Local clustering
    trustReach: v.number(), // Number of agents reachable via trust paths
    avgTrustDistance: v.optional(v.number()), // Average path length to trusted agents
    // Sybil resistance indicators
    endorserDiversity: v.number(), // 0-100, variety of endorsers
    circularEndorsements: v.number(), // Count of circular patterns detected
    sybilRiskScore: v.number(), // 0-100, higher = more suspicious
    // Timestamps
    calculatedAt: v.number(),
    graphVersion: v.number(), // Increments when graph changes
  })
    .index('by_agent', ['agentId'])
    .index('by_pagerank', ['pageRank'])
    .index('by_sybil_risk', ['sybilRiskScore'])
    .index('by_calculated', ['calculatedAt']),

  // Trust Paths - Cached paths between agents for efficient queries
  trustPaths: defineTable({
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    // Path information
    pathLength: v.number(), // Number of hops
    aggregateConfidence: v.number(), // 0-100, multiplied confidence along path
    pathNodes: v.array(v.id('agents')), // Ordered list of agents in path
    pathWeights: v.array(v.number()), // Weight at each hop
    // Computation metadata
    calculatedAt: v.number(),
    expiresAt: v.number(), // Paths need recalculation
    isValid: v.boolean(),
  })
    .index('by_from', ['fromAgentId'])
    .index('by_to', ['toAgentId'])
    .index('by_from_to', ['fromAgentId', 'toAgentId'])
    .index('by_expires', ['expiresAt']),

  // ========================================
  // PROGRAM GOVERNANCE TABLES
  // ========================================

  // Program Upgrade Authority Tracking
  programAuthorities: defineTable({
    programId: v.string(), // Solana program address
    programName: v.string(), // Human readable name
    programDataAddress: v.string(), // BPF loader program data account
    upgradeAuthority: v.optional(v.string()), // Current authority (null = immutable)
    isImmutable: v.boolean(),
    isMultisig: v.boolean(), // Whether authority is a multi-sig
    multisigThreshold: v.optional(v.number()),
    multisigSigners: v.optional(v.array(v.string())),
    lastDeployedSlot: v.number(),
    lastCheckedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_program', ['programId'])
    .index('by_authority', ['upgradeAuthority'])
    .index('by_immutable', ['isImmutable']),

  // Program Authority Change Events (Audit Log)
  authorityChangeEvents: defineTable({
    programId: v.string(),
    programName: v.string(),
    eventType: v.union(
      v.literal('authority_transferred'),
      v.literal('made_immutable'),
      v.literal('multisig_updated'),
      v.literal('initial_discovery')
    ),
    previousAuthority: v.optional(v.string()),
    newAuthority: v.optional(v.string()),
    transactionSignature: v.optional(v.string()),
    slot: v.number(),
    timestamp: v.number(),
    // Alert status
    isAlerted: v.boolean(),
    alertedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.id('users')),
    acknowledgedAt: v.optional(v.number()),
  })
    .index('by_program', ['programId'])
    .index('by_timestamp', ['timestamp'])
    .index('by_unalerted', ['isAlerted']),

  // Multi-sig Proposals (Mirror of on-chain state)
  multisigProposals: defineTable({
    programId: v.string(),
    proposalId: v.number(),
    proposalType: v.string(),
    proposer: v.string(),
    data: v.optional(v.string()), // Base64 encoded
    approvalCount: v.number(),
    threshold: v.number(),
    approvers: v.array(v.string()),
    isExecuted: v.boolean(),
    createdAt: v.number(),
    expiresAt: v.number(),
    executedAt: v.optional(v.number()),
    // Sync metadata
    lastSyncedAt: v.number(),
  })
    .index('by_program', ['programId'])
    .index('by_proposal', ['programId', 'proposalId'])
    .index('by_pending', ['isExecuted', 'expiresAt']),

  // ========================================
  // ERC-8004 ALIGNMENT TABLES
  // ========================================

  // Agent Identities - ERC-8004 Identity Registry
  agentIdentities: defineTable({
    agentId: v.id('agents'),
    // Primary identifier
    walletAddress: v.string(), // Solana address
    // On-chain references (ERC-8004 compliant - Metaplex Core 2026)
    onChain: v.optional(
      v.object({
        assetAddress: v.string(), // Metaplex Core asset address (single account)
        identityPDA: v.string(), // Program Derived Address for identity
        metadataUri: v.string(), // IPFS/Arweave URI
        registrationTx: v.string(), // Transaction signature
        lastSyncedAt: v.number(),
        // Plugin tracking (Metaplex Core feature)
        plugins: v.optional(
          v.array(
            v.object({
              type: v.string(), // 'royalties', 'attributes', 'freeze', etc.
              data: v.optional(v.any()), // Plugin-specific data
              addedAt: v.number(),
            })
          )
        ),
      })
    ),
    // Alternative identifiers
    did: v.optional(v.string()), // Decentralized Identifier (did:web, did:key, etc.)
    ensName: v.optional(v.string()),
    // Linked accounts
    linkedAccounts: v.optional(
      v.array(
        v.object({
          platform: v.string(), // twitter, github, discord, etc.
          identifier: v.string(),
          verifiedAt: v.optional(v.number()),
        })
      )
    ),
    // Biometrics / Uniqueness proofs
    publicKey: v.string(),
    // Metadata
    createdAt: v.number(),
    lastVerifiedAt: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_wallet', ['walletAddress'])
    .index('by_did', ['did'])
    .index('by_asset_address', ['onChain.assetAddress']),

  // Agent Validations - ERC-8004 Validation Registry
  agentValidations: defineTable({
    agentId: v.id('agents'),
    // Validation type
    validationType: v.union(
      v.literal('identity'), // Wallet ownership verified
      v.literal('capability'), // Capability tested and verified
      v.literal('performance'), // Performance benchmarked
      v.literal('security'), // Security audit passed
      v.literal('compliance') // Regulatory compliance
    ),
    // Status
    status: v.union(
      v.literal('pending'),
      v.literal('passed'),
      v.literal('failed'),
      v.literal('expired')
    ),
    // Validator
    validatorId: v.optional(v.string()), // Who/what performed validation
    validatorType: v.union(
      v.literal('automated'), // Our system
      v.literal('community'), // Community vote
      v.literal('expert'), // Expert review
      v.literal('third_party') // External service
    ),
    // Results
    score: v.optional(v.number()), // 0-100 validation score
    details: v.optional(v.any()), // Validation details
    // Validity period
    validatedAt: v.number(),
    expiresAt: v.optional(v.number()),
    // Metadata
    metadata: v.optional(v.any()),
  })
    .index('by_agent', ['agentId'])
    .index('by_type', ['validationType'])
    .index('by_status', ['status'])
    .index('by_validated_at', ['validatedAt']),

  // ========================================
  // SEANCE (DATA SERVICE) & WEBHOOK INFRASTRUCTURE
  // ========================================

  // Webhook Subscriptions - For seance consumers
  webhookSubscriptions: defineTable({
    subscriberId: v.string(), // API key or agent ID
    // What they want to be notified about
    eventType: v.union(
      v.literal('agent_score_change'),
      v.literal('merchant_review_added'),
      v.literal('facilitator_incident'),
      v.literal('credential_issued'),
      v.literal('credential_revoked'),
      v.literal('reputation_score_updated'),
      v.literal('new_attestation')
    ),
    // Filters
    filters: v.optional(
      v.object({
        agentId: v.optional(v.id('agents')),
        merchantId: v.optional(v.id('merchants')),
        facilitatorId: v.optional(v.id('facilitators')),
        minScoreChange: v.optional(v.number()),
      })
    ),
    // Delivery
    webhookUrl: v.string(),
    secret: v.string(), // For signing payloads
    // Status
    isActive: v.boolean(),
    lastDeliveryAt: v.optional(v.number()),
    failureCount: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_subscriber', ['subscriberId'])
    .index('by_event_type', ['eventType'])
    .index('by_active', ['isActive']),

  // ========================================
  // COLLECTION STATE TRACKING
  // ========================================

  // Collection State - Track data collection progress and prevent duplicates
  collectionState: defineTable({
    // Collector identification
    collectorName: v.union(
      v.literal('facilitators'),
      v.literal('blockchain'),
      v.literal('transactions'),
      v.literal('merchants'),
      v.literal('health')
    ),
    facilitatorSlug: v.optional(v.string()), // For facilitator-specific state
    network: v.optional(v.string()), // For network-specific state
    // Progress tracking
    lastRunAt: v.number(),
    lastSuccessAt: v.optional(v.number()),
    lastCursor: v.optional(v.string()), // Pagination cursor or block number
    lastProcessedId: v.optional(v.string()), // Last processed item ID
    // Metrics
    itemsCollected: v.number(),
    itemsSkipped: v.number(),
    errorsCount: v.number(),
    // Status
    status: v.union(
      v.literal('idle'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    errorMessage: v.optional(v.string()),
    // Performance
    durationMs: v.optional(v.number()),
    avgItemTimeMs: v.optional(v.number()),
  })
    .index('by_collector', ['collectorName'])
    .index('by_facilitator', ['facilitatorSlug'])
    .index('by_status', ['status'])
    .index('by_last_run', ['lastRunAt']),

  // ========================================
  // ARCHIVAL & AGGREGATION TABLES
  // ========================================

  // Transaction Aggregates - Archived summary data from old transactions
  transactionAggregates: defineTable({
    agentId: v.id('agents'),
    period: v.union(
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('monthly')
    ),
    periodStart: v.number(), // Unix timestamp of period start
    periodEnd: v.number(), // Unix timestamp of period end
    // Volume metrics
    totalTransactions: v.number(),
    successfulTransactions: v.number(),
    failedTransactions: v.number(),
    // Financial metrics
    totalAmountUSDC: v.number(),
    totalFeesUSDC: v.number(),
    avgTransactionUSDC: v.number(),
    // Performance metrics
    avgResponseTimeMs: v.optional(v.number()),
    medianResponseTimeMs: v.optional(v.number()),
    // Breakdown by type
    breakdownByType: v.optional(
      v.object({
        payments: v.optional(v.number()),
        earnings: v.optional(v.number()),
        refunds: v.optional(v.number()),
      })
    ),
    // Timestamp
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_period', ['period', 'periodStart'])
    .index('by_agent_period', ['agentId', 'period', 'periodStart']),

  // Webhook Deliveries - Track webhook notifications to external systems
  webhookDeliveries: defineTable({
    // Webhook target
    webhookId: v.optional(v.string()), // External webhook subscription ID
    targetUrl: v.string(),
    // Event info
    eventType: v.union(
      v.literal('agent.registered'),
      v.literal('agent.updated'),
      v.literal('score.changed'),
      v.literal('credential.issued'),
      v.literal('credential.revoked'),
      v.literal('payment.completed'),
      v.literal('payment.failed'),
      v.literal('tier.changed'),
      v.literal('alert.triggered')
    ),
    eventData: v.any(), // Event payload
    // Delivery status
    status: v.union(
      v.literal('pending'),
      v.literal('delivered'),
      v.literal('failed'),
      v.literal('retrying')
    ),
    attempts: v.number(),
    maxAttempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    // Response tracking
    lastResponseCode: v.optional(v.number()),
    lastResponseBody: v.optional(v.string()),
    lastErrorMessage: v.optional(v.string()),
    // Timing
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
    expiresAt: v.number(), // When to give up and archive
  })
    .index('by_status', ['status'])
    .index('by_next_attempt', ['nextAttemptAt'])
    .index('by_webhook', ['webhookId'])
    .index('by_event_type', ['eventType'])
    .index('by_created', ['createdAt']),

  // ==========================================
  // TOKEN STAKING (BYOT - Bring Your Own Token)
  // ==========================================

  // Registered staking tokens per agent/merchant
  // Agents can register their own SPL token for staking-based attestations
  stakingTokens: defineTable({
    // Owner of this token registration
    agentId: v.optional(v.id('agents')),
    merchantId: v.optional(v.id('merchants')),

    // Token info (SPL Token)
    tokenMint: v.string(), // Solana mint address
    tokenSymbol: v.string(), // e.g., "MYTOKEN"
    tokenName: v.string(), // e.g., "My Agent Token"
    tokenDecimals: v.number(), // Usually 6 or 9

    // Staking configuration
    minStakeAmount: v.number(), // Minimum to count as attestation
    lockPeriodSeconds: v.number(), // How long stakes must be locked
    weightMultiplier: v.number(), // How much weight per token (default 1)

    // Vault info (where stakes go)
    vaultAddress: v.optional(v.string()), // PDA or token account for receiving stakes
    vaultType: v.union(
      v.literal('pda'), // Program-controlled vault
      v.literal('token_account'), // Simple token account
      v.literal('external') // External staking program
    ),

    // Status
    isActive: v.boolean(),
    isVerified: v.boolean(), // Verified by GhostSpeak team

    // Metadata
    totalStaked: v.number(), // Running total of all stakes
    stakerCount: v.number(), // Number of unique stakers
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_merchant', ['merchantId'])
    .index('by_token_mint', ['tokenMint'])
    .index('by_active', ['isActive']),

  // Individual stake positions
  // Tracks who has staked what token on which agent
  tokenStakes: defineTable({
    // Staker info
    stakerAddress: v.string(), // Solana wallet that staked
    stakerAgentId: v.optional(v.id('agents')), // If staker is a registered agent

    // Target being endorsed
    targetAgentId: v.optional(v.id('agents')),
    targetMerchantId: v.optional(v.id('merchants')),

    // Token info
    stakingTokenId: v.id('stakingTokens'), // Reference to registered token
    tokenMint: v.string(), // Denormalized for queries

    // Stake details
    amount: v.number(), // Amount staked (in token units)
    amountRaw: v.string(), // Raw amount (for precision)

    // Attestation type (what this stake represents)
    attestationType: v.union(
      v.literal('endorsement'),
      v.literal('quality'),
      v.literal('reliability'),
      v.literal('capability'),
      v.literal('security'),
      v.literal('general')
    ),

    // Lock period
    stakedAt: v.number(),
    lockedUntil: v.number(), // When stake can be withdrawn
    unstakedAt: v.optional(v.number()), // When withdrawn (null if still staked)

    // On-chain reference
    stakeAccountAddress: v.optional(v.string()), // If using PDA stake accounts
    txSignature: v.string(), // Stake transaction signature

    // Trust graph weight (calculated)
    trustWeight: v.number(), // Computed weight for trust graph

    // Status
    status: v.union(
      v.literal('active'), // Currently staked
      v.literal('unlocking'), // Lock period ended, can withdraw
      v.literal('unstaked'), // Withdrawn
      v.literal('slashed') // Penalized (if we implement slashing)
    ),
  })
    .index('by_staker', ['stakerAddress'])
    .index('by_staker_agent', ['stakerAgentId'])
    .index('by_target_agent', ['targetAgentId'])
    .index('by_target_merchant', ['targetMerchantId'])
    .index('by_token', ['stakingTokenId'])
    .index('by_token_mint', ['tokenMint'])
    .index('by_status', ['status'])
    .index('by_staked_at', ['stakedAt']),

  // Staking events (for history/audit)
  stakingEvents: defineTable({
    stakeId: v.id('tokenStakes'),
    eventType: v.union(
      v.literal('staked'),
      v.literal('unstaked'),
      v.literal('slashed'),
      v.literal('lock_extended'),
      v.literal('weight_updated')
    ),
    amount: v.optional(v.number()),
    txSignature: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index('by_stake', ['stakeId'])
    .index('by_type', ['eventType'])
    .index('by_timestamp', ['timestamp']),
})
