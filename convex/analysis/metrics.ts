/**
 * Metrics Aggregation & Analysis
 *
 * Calculates and aggregates performance metrics for agents, merchants, and the network.
 * Supports trending analysis, rankings, and performance reports.
 */

import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'

// ========================================
// AGENT METRICS
// ========================================

/**
 * Update performance metrics for all active agents
 * Called by cron every 15 minutes
 */
export const updateAgentMetrics = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    console.log('[Metrics] Updating agent performance metrics...')

    const agents = await ctx.runQuery(internal.analysis.metrics.getActiveAgents, {})
    let updated = 0

    for (const agent of agents) {
      try {
        await ctx.runMutation(internal.analysis.metrics.calculateAgentMetrics, {
          agentId: agent._id,
        })
        updated++
      } catch (error) {
        console.error(`[Metrics] Failed to update metrics for agent ${agent._id}:`, error)
      }
    }

    console.log(`[Metrics] Updated metrics for ${updated} agents`)
    return { updated }
  },
})

/**
 * Calculate metrics for a single agent
 */
export const calculateAgentMetrics = internalMutation({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

    // Get recent transactions
    const recentTxs = await ctx.db
      .query('agentTransactions')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.gte(q.field('timestamp'), oneDayAgo))
      .collect()

    const weekTxs = await ctx.db
      .query('agentTransactions')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.gte(q.field('timestamp'), oneWeekAgo))
      .collect()

    // Calculate metrics
    const totalRequests = recentTxs.length
    const successfulRequests = recentTxs.filter((t) => t.status === 'confirmed').length
    const failedRequests = recentTxs.filter((t) => t.status === 'failed').length
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0

    // Calculate earnings and spending
    const totalEarningsUSDC = recentTxs
      .filter((t) => t.type === 'payment_received')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    const totalSpendingUSDC = recentTxs
      .filter((t) => t.type === 'payment_sent')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    // Calculate response time metrics (from confirmation time)
    const confirmedTxs = recentTxs.filter((t) => t.confirmationTime && t.confirmationTime > 0)
    const responseTimes = confirmedTxs.map((t) => t.confirmationTime ?? 0).sort((a, b) => a - b)

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0

    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)
    const p95Latency = responseTimes[p95Index] ?? 0
    const p99Latency = responseTimes[p99Index] ?? 0

    // Get or create profile
    let profile = await ctx.db
      .query('agentProfiles')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    if (!profile) {
      // Create profile
      await ctx.db.insert('agentProfiles', {
        agentId: args.agentId,
        avgResponseTime,
        totalRequests,
        successfulRequests,
        failedRequests,
        uptime: successRate,
        lastActiveAt: now,
        totalEarningsUSDC,
        totalSpendingUSDC,
        avgPricePerRequest: totalRequests > 0 ? totalEarningsUSDC / totalRequests : 0,
        tags: [],
        errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
        avgLatency: avgResponseTime,
        p95Latency,
        p99Latency,
        endorsements: 0,
        attestations: 0,
        firstSeenAt: now,
        profileUpdatedAt: now,
      })
    } else {
      // Update existing profile
      await ctx.db.patch(profile._id, {
        avgResponseTime,
        totalRequests: profile.totalRequests + totalRequests,
        successfulRequests: profile.successfulRequests + successfulRequests,
        failedRequests: profile.failedRequests + failedRequests,
        uptime: successRate,
        lastActiveAt: now,
        totalEarningsUSDC: profile.totalEarningsUSDC + totalEarningsUSDC,
        totalSpendingUSDC: profile.totalSpendingUSDC + totalSpendingUSDC,
        errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : profile.errorRate,
        avgLatency: avgResponseTime,
        p95Latency,
        p99Latency,
        profileUpdatedAt: now,
      })
    }

    return {
      agentId: args.agentId,
      totalRequests,
      successRate,
      totalEarningsUSDC,
    }
  },
})

/**
 * Get all active agents
 */
export const getActiveAgents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('agents')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()
  },
})

// ========================================
// TRENDING AGENTS
// ========================================

/**
 * Calculate trending agents based on recent activity
 * Called by cron every hour
 */
export const calculateTrending = internalAction({
  args: {},
  handler: async (ctx): Promise<{ trending: number }> => {
    console.log('[Metrics] Calculating trending agents...')

    const trending = await ctx.runMutation(internal.analysis.metrics.computeTrendingAgents, {})

    console.log(`[Metrics] Found ${trending.length} trending agents`)
    return { trending: trending.length }
  },
})

/**
 * Compute trending agents
 */
export const computeTrendingAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    // Get all agents with recent activity
    const agents = await ctx.db
      .query('agents')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    const trending: Array<{
      agentId: string
      score: number
      recentTxCount: number
      volumeGrowth: number
    }> = []

    for (const agent of agents) {
      // Get recent transactions
      const recentTxs = await ctx.db
        .query('agentTransactions')
        .withIndex('by_agent', (q) => q.eq('agentId', agent._id))
        .filter((q) => q.gte(q.field('timestamp'), oneHourAgo))
        .collect()

      const dayTxs = await ctx.db
        .query('agentTransactions')
        .withIndex('by_agent', (q) => q.eq('agentId', agent._id))
        .filter((q) =>
          q.and(
            q.gte(q.field('timestamp'), oneDayAgo),
            q.lt(q.field('timestamp'), oneHourAgo)
          )
        )
        .collect()

      // Calculate trending score
      const recentCount = recentTxs.length
      const hourlyAverage = dayTxs.length / 23 // 23 hours (excluding recent hour)

      // Volume growth: how much higher is recent activity compared to average
      const volumeGrowth = hourlyAverage > 0 ? (recentCount - hourlyAverage) / hourlyAverage : 0

      // Trending score = activity * growth * ghost score weight
      const trendingScore =
        recentCount * (1 + volumeGrowth) * (agent.ghostScore / 1000)

      if (trendingScore > 1) {
        trending.push({
          agentId: agent._id,
          score: Math.round(trendingScore * 100),
          recentTxCount: recentCount,
          volumeGrowth: Math.round(volumeGrowth * 100),
        })
      }
    }

    // Sort by trending score
    trending.sort((a, b) => b.score - a.score)

    return trending.slice(0, 50) // Top 50 trending
  },
})

// ========================================
// NETWORK METRICS
// ========================================

/**
 * Update network-wide statistics
 * Called by cron every 30 minutes
 */
export const updateNetworkStats = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    totalAgents: number
    activeAgents: number
    dailyVolumeUSDC: number
    dailyTxCount: number
    avgTxSize: number
    successRate: number
    totalFacilitators: number
    activeFacilitators: number
    timestamp: number
  }> => {
    console.log('[Metrics] Updating network statistics...')

    const stats = await ctx.runMutation(internal.analysis.metrics.computeNetworkStats, {})

    console.log(`[Metrics] Network stats:`)
    console.log(`  - Agents: ${stats.totalAgents}`)
    console.log(`  - Active: ${stats.activeAgents}`)
    console.log(`  - 24h Volume: $${stats.dailyVolumeUSDC.toFixed(2)}`)

    return stats
  },
})

/**
 * Compute network-wide statistics
 */
export const computeNetworkStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    // Agent counts
    const allAgents = await ctx.db.query('agents').collect()
    const activeAgents = allAgents.filter((a) => a.isActive).length

    // Transaction volume
    const recentTxs = await ctx.db
      .query('agentTransactions')
      .filter((q) => q.gte(q.field('timestamp'), oneDayAgo))
      .collect()

    const dailyVolumeUSDC = recentTxs.reduce((sum, t) => sum + t.amountUSDC, 0)
    const dailyTxCount = recentTxs.length
    const avgTxSize = dailyTxCount > 0 ? dailyVolumeUSDC / dailyTxCount : 0

    // Success rate
    const confirmedTxs = recentTxs.filter((t) => t.status === 'confirmed').length
    const successRate = dailyTxCount > 0 ? (confirmedTxs / dailyTxCount) * 100 : 0

    // Facilitator counts (all facilitators are considered active if they exist)
    const facilitators = await ctx.db.query('facilitators').collect()

    return {
      totalAgents: allAgents.length,
      activeAgents,
      dailyVolumeUSDC,
      dailyTxCount,
      avgTxSize,
      successRate,
      totalFacilitators: facilitators.length,
      activeFacilitators: facilitators.length, // All registered facilitators are active
      timestamp: now,
    }
  },
})

// ========================================
// FACILITATOR RANKINGS
// ========================================

/**
 * Update facilitator rankings based on performance
 * Called by cron every hour
 */
export const updateFacilitatorRankings = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    console.log('[Metrics] Updating facilitator rankings...')

    const rankings = await ctx.runMutation(internal.analysis.metrics.computeFacilitatorRankings, {})

    console.log(`[Metrics] Ranked ${rankings.length} facilitators`)
    return { updated: rankings.length }
  },
})

/**
 * Compute facilitator rankings
 */
export const computeFacilitatorRankings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const facilitators = await ctx.db.query('facilitators').collect()
    const now = Date.now()
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

    const rankings: Array<{
      facilitatorId: string
      rank: number
      score: number
      uptime: number
      avgLatency: number
      txCount: number
    }> = []

    for (const facilitator of facilitators) {
      // Get health records
      const healthRecords = await ctx.db
        .query('facilitatorHealth')
        .withIndex('by_facilitator', (q) => q.eq('facilitatorId', facilitator._id))
        .filter((q) => q.gte(q.field('timestamp'), oneWeekAgo))
        .collect()

      const onlineCount = healthRecords.filter((h) => h.status === 'online').length
      const uptime = healthRecords.length > 0 ? (onlineCount / healthRecords.length) * 100 : 0
      const avgLatency = healthRecords.length > 0
        ? healthRecords.reduce((sum, h) => sum + (h.responseTime ?? 0), 0) / healthRecords.length
        : 0

      // Get transaction count for this facilitator (filter by facilitatorId)
      const txs = await ctx.db
        .query('agentTransactions')
        .filter((q) =>
          q.and(
            q.eq(q.field('facilitatorId'), facilitator._id),
            q.gte(q.field('timestamp'), oneWeekAgo)
          )
        )
        .collect()

      // Calculate ranking score
      // Higher uptime, lower latency, more transactions = better
      const uptimeScore = uptime
      const latencyScore = avgLatency > 0 ? Math.max(0, 100 - avgLatency / 10) : 50
      const volumeScore = Math.min(100, txs.length / 10)

      const totalScore = uptimeScore * 0.4 + latencyScore * 0.3 + volumeScore * 0.3

      rankings.push({
        facilitatorId: facilitator._id,
        rank: 0, // Will be set after sorting
        score: Math.round(totalScore),
        uptime: Math.round(uptime),
        avgLatency: Math.round(avgLatency),
        txCount: txs.length,
      })
    }

    // Sort by score and assign ranks
    rankings.sort((a, b) => b.score - a.score)
    rankings.forEach((r, i) => {
      r.rank = i + 1
    })

    return rankings
  },
})

// ========================================
// MERCHANT ANALYTICS
// ========================================

/**
 * Snapshot merchant analytics
 * Called by cron hourly and daily
 */
export const snapshotMerchantAnalytics = internalAction({
  args: {},
  handler: async (ctx): Promise<{ merchantCount: number; timestamp: number }> => {
    console.log('[Metrics] Creating merchant analytics snapshot...')

    const snapshot = await ctx.runMutation(internal.analysis.metrics.createMerchantSnapshot, {})

    console.log(`[Metrics] Created snapshot for ${snapshot.merchantCount} merchants`)
    return snapshot
  },
})

/**
 * Create merchant analytics snapshot
 */
export const createMerchantSnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    const merchants = await ctx.db.query('merchants').collect()

    for (const merchant of merchants) {
      // Get transactions for this merchant (filter by facilitatorId since no index)
      const txs = await ctx.db
        .query('agentTransactions')
        .filter((q) =>
          q.and(
            q.eq(q.field('facilitatorId'), merchant.facilitatorId),
            q.gte(q.field('timestamp'), oneDayAgo)
          )
        )
        .collect()

      // Calculate metrics
      const totalRequests = txs.length
      const totalRevenueUSDC = txs.reduce((sum, t) => sum + t.amountUSDC, 0)
      const successfulRequests = txs.filter((t) => t.status === 'confirmed').length
      const failedRequests = txs.filter((t) => t.status === 'failed').length
      const avgResponseTime = txs.length > 0
        ? txs.reduce((sum, t) => sum + (t.confirmationTime ?? 0), 0) / txs.length
        : 0

      // Calculate percentile response times
      const responseTimes = txs.map((t) => t.confirmationTime ?? 0).sort((a, b) => a - b)
      const p95Index = Math.floor(responseTimes.length * 0.95)
      const p99Index = Math.floor(responseTimes.length * 0.99)
      const p95ResponseTime = responseTimes[p95Index] ?? 0
      const p99ResponseTime = responseTimes[p99Index] ?? 0

      // Get unique agents
      const uniqueAgentIds = new Set(txs.map((t) => t.agentId))
      const uniqueAgents = uniqueAgentIds.size

      // Create or update analytics record
      const existing = await ctx.db
        .query('merchantAnalytics')
        .withIndex('by_merchant', (q) => q.eq('merchantId', merchant._id))
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, {
          totalRequests: existing.totalRequests + totalRequests,
          successfulRequests: existing.successfulRequests + successfulRequests,
          failedRequests: existing.failedRequests + failedRequests,
          totalRevenueUSDC: existing.totalRevenueUSDC + totalRevenueUSDC,
          avgResponseTime,
          p95ResponseTime,
          p99ResponseTime,
          errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : existing.errorRate,
          uniqueAgents,
          timestamp: now,
        })
      } else {
        await ctx.db.insert('merchantAnalytics', {
          merchantId: merchant._id,
          periodStart: oneDayAgo,
          periodEnd: now,
          periodType: 'daily',
          totalRequests,
          successfulRequests,
          failedRequests,
          totalRevenueUSDC,
          avgResponseTime,
          p95ResponseTime,
          p99ResponseTime,
          errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
          uniqueAgents,
          newAgents: uniqueAgents, // All agents are new for first snapshot
          returningAgents: 0,
          totalReviews: 0,
          uptime: 100, // Assume 100% uptime initially
          timestamp: now,
        })
      }
    }

    return { merchantCount: merchants.length, timestamp: now }
  },
})

// ========================================
// PERFORMANCE REPORTS
// ========================================

/**
 * Generate performance reports
 * Called by cron every hour
 */
export const generatePerformanceReports = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    topAgents: Array<{ agentId: unknown; uptime: number; totalRequests: number; earnings: number; score: number }>
    networkStats: Record<string, unknown>
    generatedAt: number
  }> => {
    console.log('[Metrics] Generating performance reports...')

    // Get top performing agents
    const topAgents = await ctx.runQuery(internal.analysis.metrics.getTopPerformingAgents, {
      limit: 10,
    })

    // Get network health summary
    const networkStats = await ctx.runMutation(internal.analysis.metrics.computeNetworkStats, {})

    console.log(`[Metrics] Report generated:`)
    console.log(`  - Top agents: ${topAgents.length}`)
    console.log(`  - Network health: ${networkStats.successRate.toFixed(1)}% success rate`)

    return {
      topAgents,
      networkStats,
      generatedAt: Date.now(),
    }
  },
})

/**
 * Get top performing agents
 */
export const getTopPerformingAgents = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profiles = await ctx.db.query('agentProfiles').collect()

    // Sort by a composite score
    const scored = profiles.map((p) => ({
      agentId: p.agentId,
      uptime: p.uptime ?? 0,
      totalRequests: p.totalRequests ?? 0,
      earnings: p.totalEarningsUSDC ?? 0,
      score: (p.uptime ?? 0) * 0.4 + Math.min(100, (p.totalRequests ?? 0) / 10) * 0.3 + Math.min(100, (p.totalEarningsUSDC ?? 0) / 100) * 0.3,
    }))

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, args.limit ?? 10)
  },
})
