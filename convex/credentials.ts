/**
 * W3C Verifiable Credentials Functions
 *
 * Issue, verify, and manage W3C Verifiable Credentials for agents
 */

import { query, mutation, internalMutation, internalAction, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal, api } from './_generated/api'
import type { Id } from './_generated/dataModel'

// Type for agent profile
interface AgentProfile {
  uptime: number
  errorRate: number
  avgResponseTime: number
  p95Latency: number
  p99Latency: number
  firstSeenAt: number
  totalRequests: number
}

// Type for transaction stats
interface TransactionStats {
  totalTransactions: number
  successRate: number
  totalVolume: number
}

// Type for capability
interface Capability {
  capability: string
  level: string
  successRate: number
  usageCount: number
  confidence: number
}

// Type for reputation
interface Reputation {
  overallScore: number
  trustScore: number
  totalVotes: number
  totalAttestations: number
}

// Credential type definitions matching the plan
export type CredentialType =
  // Performance Credentials
  | 'HighVolumeAgent' // 10K+ transactions
  | 'ReliableService' // 99%+ success rate
  | 'FastResponse' // <500ms avg response time
  | 'Established' // 90+ days active
  // Certification Credentials
  | 'ISO42001Certified' // AI safety standard
  | 'SOC2Compliant' // Security compliance
  | 'AuditedByGhostSpeak' // Our verification
  | 'CommunityTrusted' // High reputation score (800+)
  // Capability Credentials
  | 'WeatherDataProvider'
  | 'CodeReviewExpert'
  | 'CryptoPriceOracle'
  | 'AIImageGenerator'
  | 'DataAnalysisExpert'
  | 'ComputeProvider'

// Get all credentials for an agent
export const getForAgent = query({
  args: {
    agentId: v.id('agents'),
    includeRevoked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('credentials').withIndex('by_agent', (q) => q.eq('agentId', args.agentId))

    let credentials = await query.collect()

    // Filter out revoked if not requested
    if (!args.includeRevoked) {
      credentials = credentials.filter((c) => !c.isRevoked)
    }

    // Check expiration
    const now = Date.now()
    credentials = credentials.map((c) => ({
      ...c,
      isExpired: c.expiresAt ? c.expiresAt < now : false,
    }))

    return credentials
  },
})

// Internal query to get credential by ID (for use by other Convex functions)
export const getCredentialById = internalQuery({
  args: { credentialId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('credentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', args.credentialId))
      .first()
  },
})

// Get credential by ID
export const get = query({
  args: { credentialId: v.string() },
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('credentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', args.credentialId))
      .first()

    if (!credential) return null

    // Get agent data
    const agent = await ctx.db.get('agents', credential.agentId)

    // Get evidence
    const evidence = await ctx.db
      .query('credentialEvidence')
      .withIndex('by_credential', (q) => q.eq('credentialId', credential._id))
      .collect()

    // Get revocation data if revoked
    let revokedAt: number | undefined
    let revocationReason: string | undefined
    if (credential.isRevoked) {
      const revocation = await ctx.db
        .query('credentialRevocations')
        .withIndex('by_credential', (q) => q.eq('credentialId', credential._id))
        .first()
      if (revocation) {
        revokedAt = revocation.revokedAt
        revocationReason = revocation.reason
      }
    }

    const now = Date.now()

    return {
      ...credential,
      // Alias type as credentialType for frontend compatibility
      credentialType: credential.type,
      revokedAt,
      revocationReason,
      agent: agent
        ? {
            name: agent.name,
            address: agent.address,
            ghostScore: agent.ghostScore,
          }
        : null,
      evidence,
      isExpired: credential.expiresAt ? credential.expiresAt < now : false,
    }
  },
})

// Issue a credential (automatic based on criteria)
export const issue = internalAction({
  args: {
    agentId: v.id('agents'),
    credentialType: v.string(),
  },
  returns: v.object({
    credentialId: v.string(),
    credId: v.id('credentials'),
  }),
  handler: async (ctx, args) => {
    // Check if agent qualifies for this credential
    const qualifies = await checkQualification(ctx, args.agentId, args.credentialType)

    if (!qualifies.qualified) {
      throw new Error(`Agent does not qualify: ${qualifies.reason}`)
    }

    // Get agent data
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId })
    if (!agent) {
      throw new Error('Agent not found')
    }

    // Generate credential ID (W3C format)
    const credentialId = `urn:ghostspeak:credential:${args.agentId}:${args.credentialType}:${Date.now()}`

    // Determine expiration (most credentials expire in 1 year)
    const now = Date.now()
    const oneYear = 365 * 24 * 60 * 60 * 1000
    const expiresAt = args.credentialType.includes('Certified') ? now + oneYear : undefined

    // Create credential
    const credId = (await ctx.runMutation(internal.credentials.create, {
      credentialId,
      agentId: args.agentId,
      type: args.credentialType,
      issuedBy: 'GhostSpeak',
      issuedAt: now,
      expiresAt,
      claims: {
        name: agent.name,
        capabilities: qualifies.capabilities || [],
        score: qualifies.score,
      },
    })) as Id<'credentials'>

    // Collect and store evidence
    type EvidenceType = 'transaction_history' | 'performance_metrics' | 'capability_demo' | 'community_attestation' | 'third_party_verification'
    for (const evidence of qualifies.evidence || []) {
      await ctx.runMutation(internal.credentials.addEvidence, {
        credentialId: credId,
        agentId: args.agentId,
        evidenceType: evidence.type as EvidenceType,
        source: evidence.source,
        data: evidence.data,
        isVerified: true,
        verifiedBy: 'GhostSpeak',
        verifiedAt: now,
        collectedAt: now,
        expiresAt: evidence.expiresAt,
      })
    }

    return { credentialId, credId }
  },
})

// Helper function to check qualification
async function checkQualification(
  ctx: {
    runQuery: <T>(fn: any, args: any) => Promise<T>
  },
  agentId: Id<'agents'>,
  credentialType: string
): Promise<{
  qualified: boolean
  reason?: string
  capabilities?: string[]
  score?: number
  evidence?: Array<{ type: string; source: string; data: any; expiresAt?: number }>
}> {
  // Get agent profile data (use api for public queries)
  const profile = (await ctx.runQuery(api.agentProfiles.get, { agentId })) as AgentProfile | null
  const transactions = (await ctx.runQuery(api.agentTransactions.getStats, {
    agentId,
    timeRangeHours: 24 * 365, // All time
  })) as TransactionStats
  const capabilities = (await ctx.runQuery(api.agentCapabilities.getByAgent, {
    agentId,
    verifiedOnly: true,
  })) as Capability[]
  const reputation = (await ctx.runQuery(api.reputationScores.getForAgent, { agentId })) as Reputation | null

  const evidence = []

  switch (credentialType) {
    case 'HighVolumeAgent':
      if (transactions.totalTransactions >= 10000) {
        evidence.push({
          type: 'transaction_history',
          source: 'GhostSpeak Seance',
          data: {
            totalTransactions: transactions.totalTransactions,
            totalVolume: transactions.totalVolume,
          },
        })
        return { qualified: true, evidence }
      }
      return {
        qualified: false,
        reason: `Only ${transactions.totalTransactions} transactions (need 10,000+)`,
      }

    case 'ReliableService':
      if (profile && profile.uptime >= 99 && transactions.successRate >= 99) {
        evidence.push({
          type: 'performance_metrics',
          source: 'GhostSpeak Seance',
          data: {
            uptime: profile.uptime,
            successRate: transactions.successRate,
            errorRate: profile.errorRate,
          },
        })
        return { qualified: true, evidence }
      }
      return {
        qualified: false,
        reason: `Uptime ${profile?.uptime || 0}% or success rate ${transactions.successRate}% too low (need 99%+)`,
      }

    case 'FastResponse':
      if (profile && profile.avgResponseTime < 500) {
        evidence.push({
          type: 'performance_metrics',
          source: 'GhostSpeak Seance',
          data: {
            avgResponseTime: profile.avgResponseTime,
            p95Latency: profile.p95Latency,
            p99Latency: profile.p99Latency,
          },
        })
        return { qualified: true, evidence }
      }
      return {
        qualified: false,
        reason: `Average response time ${profile?.avgResponseTime || 0}ms (need <500ms)`,
      }

    case 'Established':
      if (profile) {
        const ageMs = Date.now() - profile.firstSeenAt
        const ageDays = ageMs / (24 * 60 * 60 * 1000)
        if (ageDays >= 90) {
          evidence.push({
            type: 'transaction_history',
            source: 'GhostSpeak Seance',
            data: {
              firstSeenAt: profile.firstSeenAt,
              ageDays: Math.floor(ageDays),
              totalRequests: profile.totalRequests,
            },
          })
          return { qualified: true, evidence }
        }
        return { qualified: false, reason: `Only ${Math.floor(ageDays)} days active (need 90+)` }
      }
      return { qualified: false, reason: 'No profile found' }

    case 'CommunityTrusted':
      if (reputation && reputation.overallScore >= 800) {
        evidence.push({
          type: 'community_attestation',
          source: 'GhostSpeak Seance',
          data: {
            overallScore: reputation.overallScore,
            trustScore: reputation.trustScore,
            totalVotes: reputation.totalVotes,
            totalAttestations: reputation.totalAttestations,
          },
        })
        return { qualified: true, score: reputation.overallScore, evidence }
      }
      return {
        qualified: false,
        reason: `Reputation score ${reputation?.overallScore || 0} (need 800+)`,
      }

    // Capability-based credentials
    case 'WeatherDataProvider':
    case 'CodeReviewExpert':
    case 'CryptoPriceOracle':
    case 'AIImageGenerator':
    case 'DataAnalysisExpert':
    case 'ComputeProvider':
      const requiredCapability = credentialType.replace(/Expert|Provider|Oracle|Generator/g, '')
      const hasCapability = capabilities.find(
        (c) =>
          c.capability.toLowerCase().includes(requiredCapability.toLowerCase()) &&
          (c.level === 'advanced' || c.level === 'expert')
      )

      if (hasCapability) {
        evidence.push({
          type: 'capability_demo',
          source: 'GhostSpeak Seance',
          data: {
            capability: hasCapability.capability,
            level: hasCapability.level,
            successRate: hasCapability.successRate,
            usageCount: hasCapability.usageCount,
            confidence: hasCapability.confidence,
          },
        })
        return {
          qualified: true,
          capabilities: [hasCapability.capability],
          evidence,
        }
      }
      return {
        qualified: false,
        reason: `No verified ${requiredCapability} capability at advanced/expert level`,
      }

    default:
      return { qualified: false, reason: 'Unknown credential type' }
  }
}

// Create credential (internal)
export const create = internalMutation({
  args: {
    credentialId: v.string(),
    agentId: v.id('agents'),
    type: v.string(),
    issuedBy: v.string(),
    issuedAt: v.number(),
    expiresAt: v.optional(v.number()),
    claims: v.object({
      name: v.string(),
      capabilities: v.array(v.string()),
      score: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('credentials', {
      credentialId: args.credentialId,
      agentId: args.agentId,
      type: args.type,
      issuedBy: args.issuedBy,
      issuedAt: args.issuedAt,
      expiresAt: args.expiresAt,
      isRevoked: false,
      claims: args.claims,
    })
  },
})

// Add evidence for a credential
export const addEvidence = internalMutation({
  args: {
    credentialId: v.id('credentials'),
    agentId: v.id('agents'),
    evidenceType: v.union(
      v.literal('transaction_history'),
      v.literal('performance_metrics'),
      v.literal('capability_demo'),
      v.literal('community_attestation'),
      v.literal('third_party_verification')
    ),
    source: v.string(),
    data: v.any(),
    isVerified: v.boolean(),
    verifiedBy: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    collectedAt: v.number(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('credentialEvidence', args)
  },
})

// Revoke a credential
export const revoke = mutation({
  args: {
    credentialId: v.string(),
    reason: v.string(),
    reasonCode: v.union(
      v.literal('performance_decline'),
      v.literal('fraudulent_activity'),
      v.literal('security_breach'),
      v.literal('expired'),
      v.literal('voluntary'),
      v.literal('other')
    ),
    revokedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Find credential
    const credential = await ctx.db
      .query('credentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', args.credentialId))
      .first()

    if (!credential) {
      throw new Error('Credential not found')
    }

    // Mark as revoked
    await ctx.db.patch('credentials', credential._id, {
      isRevoked: true,
    })

    // Record revocation
    await ctx.db.insert('credentialRevocations', {
      credentialId: credential._id,
      agentId: credential.agentId,
      reason: args.reason,
      reasonCode: args.reasonCode,
      revokedBy: args.revokedBy,
      revokedAt: Date.now(),
      affectedClaims: Object.keys(credential.claims),
      metadata: undefined,
    })

    return credential._id
  },
})

// Type for agent list result
interface AgentListItem {
  _id: Id<'agents'>
  name: string
  address: string
  ghostScore: number
  tier: string
}

// Type for credential list item
interface CredentialListItem {
  _id: Id<'credentials'>
  type: string
  isRevoked: boolean
  isExpired?: boolean
}

// Auto-issue credentials for qualifying agents (cron job)
export const autoIssue = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    issued: v.number(),
    details: v.array(
      v.object({
        agentId: v.id('agents'),
        credentialType: v.string(),
        credentialId: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // Get all agents
    const agents = (await ctx.runQuery(api.agents.list, { limit: args.limit ?? 100 })) as AgentListItem[]

    const credentialTypes: CredentialType[] = [
      'HighVolumeAgent',
      'ReliableService',
      'FastResponse',
      'Established',
      'CommunityTrusted',
      'WeatherDataProvider',
      'CodeReviewExpert',
      'CryptoPriceOracle',
      'AIImageGenerator',
      'DataAnalysisExpert',
      'ComputeProvider',
    ]

    const issued: Array<{ agentId: Id<'agents'>; credentialType: string; credentialId: string }> = []

    for (const agent of agents) {
      // Get existing credentials
      const existing = (await ctx.runQuery(api.credentials.getForAgent, {
        agentId: agent._id,
        includeRevoked: false,
      })) as CredentialListItem[]

      const existingTypes = new Set(existing.map((c: CredentialListItem) => c.type))

      // Check each credential type
      for (const credentialType of credentialTypes) {
        // Skip if already has this credential
        if (existingTypes.has(credentialType)) continue

        try {
          const result = (await ctx.runAction(internal.credentials.issue, {
            agentId: agent._id,
            credentialType,
          })) as { credentialId: string; credId: Id<'credentials'> }
          issued.push({ agentId: agent._id, credentialType, credentialId: result.credentialId })
        } catch (_error) {
          // Agent doesn't qualify, continue
        }
      }
    }

    return { issued: issued.length, details: issued }
  },
})

// Get credential statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allCredentials = await ctx.db.query('credentials').collect()

    const active = allCredentials.filter((c) => !c.isRevoked)
    const revoked = allCredentials.filter((c) => c.isRevoked)

    const now = Date.now()
    const expired = active.filter((c) => c.expiresAt && c.expiresAt < now)

    const typeCounts = active.reduce(
      (acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total: allCredentials.length,
      active: active.length,
      revoked: revoked.length,
      expired: expired.length,
      typeCounts,
    }
  },
})
