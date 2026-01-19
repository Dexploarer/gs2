/**
 * Agent Profiles Functions
 *
 * Deep agent profiles beyond basic registry - behavioral metrics, economic data, quality metrics
 */

import { query, mutation, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Get agent profile by agent ID (internal - for reputation calculations)
 */
export const getInternal = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('agentProfiles')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    return profile
  },
})

/**
 * Get agent profile by agent ID (public - for dashboard)
 */
export const get = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('agentProfiles')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    return profile
  },
})

/**
 * Get agent profile statistics (public - for observatory)
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allProfiles = await ctx.db.query('agentProfiles').collect()

    const totalAgents = allProfiles.length
    const activeAgents = allProfiles.filter(
      (p) => p.lastActiveAt > Date.now() - 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
    ).length

    const avgUptime =
      allProfiles.reduce((sum, p) => sum + p.uptime, 0) / (allProfiles.length || 1)

    const totalEarnings = allProfiles.reduce((sum, p) => sum + p.totalEarningsUSDC, 0)
    const totalSpending = allProfiles.reduce((sum, p) => sum + p.totalSpendingUSDC, 0)

    return {
      totalAgents,
      activeAgents,
      avgUptime: Math.round(avgUptime),
      totalEarningsUSDC: totalEarnings,
      totalSpendingUSDC: totalSpending,
      totalTransactionVolumeUSDC: totalEarnings + totalSpending,
    }
  },
})

/**
 * Update agent metrics (called after transactions)
 * Calculates real metrics from transaction history
 */
export const updateMetrics = internalMutation({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Get all transactions for this agent
    const allTransactions = await ctx.db
      .query('agentTransactions')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .collect()

    // Calculate metrics from transactions
    const totalRequests = allTransactions.length
    const confirmedTxs = allTransactions.filter((t) => t.status === 'confirmed')
    const failedTxs = allTransactions.filter((t) => t.status === 'failed')
    const successfulRequests = confirmedTxs.length
    const failedRequests = failedTxs.length
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0

    // Calculate earnings (payment_received) and spending (payment_sent)
    const earnings = allTransactions
      .filter((t) => t.type === 'payment_received' && t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    const spending = allTransactions
      .filter((t) => t.type === 'payment_sent' && t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    // Calculate average price per request
    const avgPricePerRequest = successfulRequests > 0 ? (earnings + spending) / successfulRequests : 0

    // Calculate latency metrics from confirmationTime
    const latencies = allTransactions
      .filter((t) => t.confirmationTime && t.confirmationTime > 0)
      .map((t) => t.confirmationTime as number)
      .sort((a, b) => a - b)

    const avgLatency = latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0
    const p95Latency = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1] : 0
    const p99Latency = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] || latencies[latencies.length - 1] : 0

    // Calculate uptime based on recent transaction success rate (last 24h)
    const last24h = now - 24 * 60 * 60 * 1000
    const recentTxs = allTransactions.filter((t) => t.timestamp > last24h)
    const recentSuccess = recentTxs.filter((t) => t.status === 'confirmed').length
    const uptime = recentTxs.length > 0 ? (recentSuccess / recentTxs.length) * 100 : 100

    // Get first transaction timestamp for firstSeenAt
    const firstTx = allTransactions.length > 0
      ? allTransactions.reduce((oldest, t) => (t.timestamp < oldest.timestamp ? t : oldest))
      : null

    // Get existing profile
    const existingProfile = await ctx.db
      .query('agentProfiles')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    const profileData = {
      agentId: args.agentId,
      avgResponseTime: avgLatency,
      totalRequests,
      successfulRequests,
      failedRequests,
      uptime: Math.round(uptime * 100) / 100,
      totalEarningsUSDC: Math.round(earnings * 100) / 100,
      totalSpendingUSDC: Math.round(spending * 100) / 100,
      avgPricePerRequest: Math.round(avgPricePerRequest * 10000) / 10000,
      errorRate: Math.round(errorRate * 100) / 100,
      avgLatency: Math.round(avgLatency),
      p95Latency: Math.round(p95Latency),
      p99Latency: Math.round(p99Latency),
      lastActiveAt: now,
      profileUpdatedAt: now,
    }

    if (!existingProfile) {
      // Create new profile
      await ctx.db.insert('agentProfiles', {
        ...profileData,
        tags: [],
        endorsements: 0,
        attestations: 0,
        firstSeenAt: firstTx?.timestamp || now,
      })
    } else {
      // Update existing profile with calculated metrics
      await ctx.db.patch('agentProfiles', existingProfile._id, profileData)
    }

    return { success: true, metrics: profileData }
  },
})
