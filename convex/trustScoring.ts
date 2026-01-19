/**
 * Trust Scoring Convex Functions
 *
 * Manages trust scores for x402 endpoints based on the scoring algorithm.
 * Stores and updates endpoint metrics, calculates scores, and tracks verification tiers.
 */

import { v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * Verification tier constants (mirroring lib/trust/scoring.ts)
 */
const VERIFICATION_TIERS = {
  UNVERIFIED: { level: 0, badge: null, label: 'Unverified' },
  TESTED: { level: 1, badge: 'bronze', label: 'Tested' },
  VERIFIED: { level: 2, badge: 'silver', label: 'Verified' },
  TRUSTED: { level: 3, badge: 'gold', label: 'Trusted' },
  CERTIFIED: { level: 4, badge: 'platinum', label: 'Certified' },
}

const TIER_REQUIREMENTS = {
  UNVERIFIED: { minCalls: 0 },
  TESTED: { minCalls: 100, minSuccessRate: 80 },
  VERIFIED: { minCalls: 1000, minSuccessRate: 90 },
  TRUSTED: { minCalls: 10000, minSuccessRate: 95 },
  CERTIFIED: { minCalls: 50000, minSuccessRate: 98 },
}

/**
 * Calculate trust score from metrics (simplified version for Convex)
 */
function calculateTrustScoreInternal(metrics: {
  successRate: number
  avgLatency: number
  uptime: number
  consistencyScore: number
  priceUSDC: number
  marketAveragePrice: number
  agentGhostScore: number
  verificationLevel: number
}): number {
  // Performance (40%)
  const successRateScore = (metrics.successRate / 100) * 200
  const latencyScore = Math.max(0, 100 - metrics.avgLatency / 50)
  const uptimeScore = (metrics.uptime / 100) * 100
  const performance = successRateScore + latencyScore + uptimeScore

  // Reliability (30%)
  const reliability = (metrics.consistencyScore / 100) * 300

  // Economic (20%)
  let priceFairness = 100
  if (metrics.marketAveragePrice > 0 && metrics.priceUSDC > 0) {
    const priceRatio = metrics.priceUSDC / metrics.marketAveragePrice
    priceFairness = Math.max(0, Math.min(200, 200 - priceRatio * 100))
  }

  // Reputation (10%)
  const ghostScoreComponent = (metrics.agentGhostScore / 1000) * 50
  const verificationComponent = (metrics.verificationLevel / 4) * 50
  const reputation = ghostScoreComponent + verificationComponent

  return Math.round(performance + reliability + priceFairness + reputation)
}

/**
 * Determine verification tier from metrics
 */
function determineTier(totalCalls: number, successRate: number, agentGhostScore: number): string {
  if (
    totalCalls >= TIER_REQUIREMENTS.CERTIFIED.minCalls &&
    successRate >= TIER_REQUIREMENTS.CERTIFIED.minSuccessRate &&
    agentGhostScore >= 900
  ) {
    return 'CERTIFIED'
  }
  if (
    totalCalls >= TIER_REQUIREMENTS.TRUSTED.minCalls &&
    successRate >= TIER_REQUIREMENTS.TRUSTED.minSuccessRate &&
    agentGhostScore >= 750
  ) {
    return 'TRUSTED'
  }
  if (
    totalCalls >= TIER_REQUIREMENTS.VERIFIED.minCalls &&
    successRate >= TIER_REQUIREMENTS.VERIFIED.minSuccessRate
  ) {
    return 'VERIFIED'
  }
  if (
    totalCalls >= TIER_REQUIREMENTS.TESTED.minCalls &&
    successRate >= TIER_REQUIREMENTS.TESTED.minSuccessRate
  ) {
    return 'TESTED'
  }
  return 'UNVERIFIED'
}

/**
 * Update endpoint trust score after a transaction
 */
export const updateAfterTransaction = mutation({
  args: {
    endpointId: v.id('endpoints'),
    success: v.boolean(),
    responseTime: v.number(),
  },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get('endpoints', args.endpointId)
    if (!endpoint) {
      throw new Error('Endpoint not found')
    }

    // Update basic stats
    const newTotalCalls = (endpoint.totalCalls || 0) + 1
    const newSuccessfulCalls = (endpoint.successfulCalls || 0) + (args.success ? 1 : 0)
    const newFailedCalls = (endpoint.failedCalls || 0) + (args.success ? 0 : 1)
    const newSuccessRate = (newSuccessfulCalls / newTotalCalls) * 100

    // Update average response time
    const oldTotal = (endpoint.avgResponseTime || 0) * (endpoint.totalCalls || 0)
    const newAvgResponseTime = (oldTotal + args.responseTime) / newTotalCalls

    // Calculate consistency score (lower variance = higher consistency)
    const currentAvg = endpoint.avgResponseTime || args.responseTime
    const variance = Math.abs(args.responseTime - currentAvg)
    const normalizedVariance = Math.min(100, variance / 10)
    const consistencyScore =
      ((endpoint.consistencyScore || 50) * 0.95) + ((100 - normalizedVariance) * 0.05)

    // Get agent ghost score if available
    let agentGhostScore = 100
    if (endpoint.agentId) {
      const agent = await ctx.db.get('agents', endpoint.agentId)
      if (agent) {
        agentGhostScore = agent.ghostScore || 100
      }
    }

    // Calculate new trust score
    const trustScore = calculateTrustScoreInternal({
      successRate: newSuccessRate,
      avgLatency: newAvgResponseTime,
      uptime: 99, // Assume 99% uptime for now
      consistencyScore,
      priceUSDC: endpoint.priceUSDC || 0,
      marketAveragePrice: 0.01, // Will be calculated separately
      agentGhostScore,
      verificationLevel: VERIFICATION_TIERS[endpoint.verificationTier as keyof typeof VERIFICATION_TIERS]?.level || 0,
    })

    // Determine new tier
    const verificationTier = determineTier(newTotalCalls, newSuccessRate, agentGhostScore)

    // Update endpoint
    await ctx.db.patch('endpoints', args.endpointId, {
      totalCalls: newTotalCalls,
      successfulCalls: newSuccessfulCalls,
      failedCalls: newFailedCalls,
      successRate: Math.round(newSuccessRate * 100) / 100,
      avgResponseTime: Math.round(newAvgResponseTime),
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      trustScore,
      verificationTier,
      lastTested: Date.now(),
      updatedAt: Date.now(),
    })

    // Record trust score history
    await ctx.db.insert('trustScoreHistory', {
      endpointId: args.endpointId,
      trustScore,
      successRate: newSuccessRate,
      avgResponseTime: newAvgResponseTime,
      verificationTier,
      timestamp: Date.now(),
    })

    return {
      trustScore,
      verificationTier,
      badge: VERIFICATION_TIERS[verificationTier as keyof typeof VERIFICATION_TIERS]?.badge,
    }
  },
})

/**
 * Get trust score for an endpoint
 */
export const getEndpointTrustScore = query({
  args: {
    endpointId: v.id('endpoints'),
  },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get('endpoints', args.endpointId)
    if (!endpoint) {
      return null
    }

    const tier = endpoint.verificationTier || 'UNVERIFIED'
    const tierInfo = VERIFICATION_TIERS[tier as keyof typeof VERIFICATION_TIERS] || VERIFICATION_TIERS.UNVERIFIED

    return {
      trustScore: endpoint.trustScore || 0,
      verificationTier: tier,
      badge: tierInfo.badge,
      label: tierInfo.label,
      level: tierInfo.level,
      metrics: {
        successRate: endpoint.successRate || 0,
        avgResponseTime: endpoint.avgResponseTime || 0,
        totalCalls: endpoint.totalCalls || 0,
        consistencyScore: endpoint.consistencyScore || 50,
      },
    }
  },
})

/**
 * Get trust score leaderboard
 */
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
    minCalls: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    const minCalls = args.minCalls ?? 10

    // Get all endpoints with enough calls
    const endpoints = await ctx.db
      .query('endpoints')
      .filter((q) => q.gte(q.field('totalCalls'), minCalls))
      .collect()

    // Sort by trust score
    const sorted = endpoints
      .filter((e) => e.trustScore !== undefined)
      .sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0))
      .slice(0, limit)

    // Enrich with agent data
    return await Promise.all(
      sorted.map(async (endpoint) => {
        let agent = null
        if (endpoint.agentId) {
          const agentDoc = await ctx.db.get('agents', endpoint.agentId)
          if (agentDoc) {
            agent = {
              name: agentDoc.name,
              address: agentDoc.address,
              ghostScore: agentDoc.ghostScore,
              tier: agentDoc.tier,
            }
          }
        }

        const tier = endpoint.verificationTier || 'UNVERIFIED'
        const tierInfo = VERIFICATION_TIERS[tier as keyof typeof VERIFICATION_TIERS] || VERIFICATION_TIERS.UNVERIFIED

        return {
          id: endpoint._id,
          url: endpoint.url,
          name: endpoint.name,
          trustScore: endpoint.trustScore || 0,
          verificationTier: tier,
          badge: tierInfo.badge,
          successRate: endpoint.successRate || 0,
          totalCalls: endpoint.totalCalls || 0,
          priceUSDC: endpoint.priceUSDC || 0,
          agent,
        }
      })
    )
  },
})

/**
 * Get trust score history for an endpoint
 */
export const getScoreHistory = query({
  args: {
    endpointId: v.id('endpoints'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('trustScoreHistory')
      .withIndex('by_endpoint', (q) => q.eq('endpointId', args.endpointId))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

/**
 * Batch recalculate trust scores for all endpoints
 */
export const recalculateAllScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const endpoints = await ctx.db.query('endpoints').collect()
    let updated = 0

    for (const endpoint of endpoints) {
      if (endpoint.totalCalls === 0) continue

      // Get agent ghost score
      let agentGhostScore = 100
      if (endpoint.agentId) {
        const agent = await ctx.db.get('agents', endpoint.agentId)
        if (agent) {
          agentGhostScore = agent.ghostScore || 100
        }
      }

      const trustScore = calculateTrustScoreInternal({
        successRate: endpoint.successRate || 0,
        avgLatency: endpoint.avgResponseTime || 0,
        uptime: 99,
        consistencyScore: endpoint.consistencyScore || 50,
        priceUSDC: endpoint.priceUSDC || 0,
        marketAveragePrice: 0.01,
        agentGhostScore,
        verificationLevel: VERIFICATION_TIERS[endpoint.verificationTier as keyof typeof VERIFICATION_TIERS]?.level || 0,
      })

      const verificationTier = determineTier(
        endpoint.totalCalls || 0,
        endpoint.successRate || 0,
        agentGhostScore
      )

      await ctx.db.patch('endpoints', endpoint._id, {
        trustScore,
        verificationTier,
        updatedAt: Date.now(),
      })

      updated++
    }

    return { updated }
  },
})

/**
 * Get endpoints with score changes (for alerts)
 */
export const getScoreChanges = query({
  args: {
    hoursBack: v.optional(v.number()),
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursBack = args.hoursBack ?? 24
    const threshold = args.threshold ?? 50
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000

    const recentHistory = await ctx.db
      .query('trustScoreHistory')
      .filter((q) => q.gte(q.field('timestamp'), cutoff))
      .collect()

    // Group by endpoint
    const byEndpoint: Record<string, Array<{ trustScore: number; timestamp: number }>> = {}
    for (const entry of recentHistory) {
      const key = entry.endpointId
      if (!byEndpoint[key]) {
        byEndpoint[key] = []
      }
      byEndpoint[key].push({ trustScore: entry.trustScore, timestamp: entry.timestamp })
    }

    // Find significant changes
    const changes = []
    for (const [endpointId, history] of Object.entries(byEndpoint)) {
      if (history.length < 2) continue

      const sorted = history.sort((a, b) => a.timestamp - b.timestamp)
      const oldest = sorted[0].trustScore
      const newest = sorted[sorted.length - 1].trustScore
      const change = newest - oldest

      if (Math.abs(change) >= threshold) {
        const endpoint = await ctx.db.get('endpoints', endpointId as Id<'endpoints'>)
        if (endpoint) {
          changes.push({
            endpoint: {
              id: endpoint._id,
              url: endpoint.url,
              name: endpoint.name,
            },
            oldScore: oldest,
            newScore: newest,
            change,
            direction: change > 0 ? 'up' : 'down',
          })
        }
      }
    }

    return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  },
})
