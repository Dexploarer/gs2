/**
 * Merchant Analytics Functions
 *
 * Time-series analytics for merchant performance, revenue, and customer metrics
 */

import { internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Get analytics for a merchant (with time range filtering)
 */
export const getAnalytics = internalQuery({
  args: {
    merchantId: v.id('merchants'),
    periodType: v.optional(
      v.union(v.literal('hourly'), v.literal('daily'), v.literal('weekly'))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { merchantId, periodType, limit = 30 } = args

    let query = ctx.db
      .query('merchantAnalytics')
      .withIndex('by_merchant', (q) => q.eq('merchantId', merchantId))
      .order('desc')

    // Filter by period type if specified
    const analytics = await query.take(limit)

    // Filter by period type after fetching (since we can't filter in query)
    const filtered = periodType
      ? analytics.filter((a) => a.periodType === periodType)
      : analytics

    return filtered
  },
})

/**
 * Get latest analytics snapshot for a merchant
 */
export const getLatest = internalQuery({
  args: {
    merchantId: v.id('merchants'),
    periodType: v.optional(
      v.union(v.literal('hourly'), v.literal('daily'), v.literal('weekly'))
    ),
  },
  handler: async (ctx, args) => {
    const analytics = await ctx.db
      .query('merchantAnalytics')
      .withIndex('by_merchant', (q) => q.eq('merchantId', args.merchantId))
      .order('desc')
      .take(100) // Get recent ones to filter

    // Filter by period type if specified
    const filtered = args.periodType
      ? analytics.filter((a) => a.periodType === args.periodType)
      : analytics

    return filtered[0] || null
  },
})

/**
 * Get aggregated analytics summary for a merchant
 */
export const getSummary = internalQuery({
  args: {
    merchantId: v.id('merchants'),
    days: v.optional(v.number()), // Default to last 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days || 30
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

    // Get daily analytics within time range
    const analytics = await ctx.db
      .query('merchantAnalytics')
      .withIndex('by_merchant', (q) => q.eq('merchantId', args.merchantId))
      .filter((q) => q.gte(q.field('timestamp'), cutoffTime))
      .collect()

    // Filter for daily snapshots
    const dailyAnalytics = analytics.filter((a) => a.periodType === 'daily')

    if (dailyAnalytics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRevenueUSDC: 0,
        avgResponseTime: 0,
        avgErrorRate: 0,
        totalUniqueAgents: 0,
        avgUptime: 0,
        avgRating: 0,
        totalReviews: 0,
        periodDays: days,
        snapshotCount: 0,
      }
    }

    // Aggregate metrics
    const totalRequests = dailyAnalytics.reduce((sum, a) => sum + a.totalRequests, 0)
    const successfulRequests = dailyAnalytics.reduce((sum, a) => sum + a.successfulRequests, 0)
    const failedRequests = dailyAnalytics.reduce((sum, a) => sum + a.failedRequests, 0)
    const totalRevenueUSDC = dailyAnalytics.reduce((sum, a) => sum + a.totalRevenueUSDC, 0)

    // Calculate averages
    const count = dailyAnalytics.length
    const avgResponseTime =
      dailyAnalytics.reduce((sum, a) => sum + a.avgResponseTime, 0) / count
    const avgErrorRate = dailyAnalytics.reduce((sum, a) => sum + a.errorRate, 0) / count
    const avgUptime = dailyAnalytics.reduce((sum, a) => sum + a.uptime, 0) / count

    // Total unique agents (max seen in any single day as best approximation)
    const totalUniqueAgents =
      dailyAnalytics.length > 0
        ? Math.max(...dailyAnalytics.map((a) => a.uniqueAgents))
        : 0

    // Average rating
    const analyticsWithRating = dailyAnalytics.filter((a) => a.avgRating !== undefined)
    const avgRating =
      analyticsWithRating.length > 0
        ? analyticsWithRating.reduce((sum, a) => sum + (a.avgRating || 0), 0) /
          analyticsWithRating.length
        : 0

    const totalReviews = dailyAnalytics.reduce((sum, a) => sum + a.totalReviews, 0)

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      totalRevenueUSDC,
      avgResponseTime: Math.round(avgResponseTime),
      avgErrorRate: Math.round(avgErrorRate * 100) / 100,
      totalUniqueAgents,
      avgUptime: Math.round(avgUptime * 100) / 100,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews,
      periodDays: days,
      snapshotCount: dailyAnalytics.length,
    }
  },
})

/**
 * Record a new analytics snapshot
 * (Called by cron jobs or after aggregating merchant data)
 */
export const recordSnapshot = internalMutation({
  args: {
    merchantId: v.id('merchants'),
    periodStart: v.number(),
    periodEnd: v.number(),
    periodType: v.union(v.literal('hourly'), v.literal('daily'), v.literal('weekly')),
    totalRequests: v.number(),
    successfulRequests: v.number(),
    failedRequests: v.number(),
    totalRevenueUSDC: v.number(),
    avgResponseTime: v.number(),
    p95ResponseTime: v.number(),
    p99ResponseTime: v.number(),
    errorRate: v.number(),
    uniqueAgents: v.number(),
    newAgents: v.number(),
    returningAgents: v.number(),
    topEndpoint: v.optional(v.string()),
    topEndpointCalls: v.optional(v.number()),
    avgRating: v.optional(v.number()),
    totalReviews: v.number(),
    uptime: v.number(),
  },
  handler: async (ctx, args) => {
    const { merchantId, periodStart, periodEnd, periodType, ...metrics } = args

    // Check if snapshot already exists for this period
    const existing = await ctx.db
      .query('merchantAnalytics')
      .withIndex('by_merchant', (q) => q.eq('merchantId', merchantId))
      .filter((q) =>
        q.and(
          q.eq(q.field('periodStart'), periodStart),
          q.eq(q.field('periodEnd'), periodEnd),
          q.eq(q.field('periodType'), periodType)
        )
      )
      .first()

    if (existing) {
      // Update existing snapshot
      await ctx.db.patch('merchantAnalytics', existing._id, {
        ...metrics,
        timestamp: Date.now(),
      })
      return { success: true, updated: true, snapshotId: existing._id }
    } else {
      // Create new snapshot
      const snapshotId = await ctx.db.insert('merchantAnalytics', {
        merchantId,
        periodStart,
        periodEnd,
        periodType,
        ...metrics,
        timestamp: Date.now(),
      })
      return { success: true, updated: false, snapshotId }
    }
  },
})

/**
 * Get realtime analytics computed directly from transaction data
 * (Used as fallback when no snapshots exist)
 */
export const getRealtimeAnalytics = internalQuery({
  args: {
    merchantId: v.id('merchants'),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

    // Get all transactions for this merchant in the time period
    const allTransactions = await ctx.db
      .query('agentTransactions')
      .withIndex('by_merchant', (q) =>
        q.eq('merchantId', args.merchantId).gte('timestamp', cutoffTime)
      )
      .collect()

    if (allTransactions.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        totalRevenueUSDC: 0,
        avgResponseTime: 0,
        avgErrorRate: 0,
        totalUniqueAgents: 0,
        avgUptime: 100,
        avgRating: 0,
        totalReviews: 0,
        periodDays: days,
        hasData: false,
      }
    }

    // Calculate metrics
    const totalRequests = allTransactions.length
    const successfulRequests = allTransactions.filter(
      (t) => t.status === 'confirmed'
    ).length
    const failedRequests = allTransactions.filter((t) => t.status === 'failed').length

    const totalRevenueUSDC = allTransactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    // Response times (confirmation times)
    const responseTimes = allTransactions
      .filter((t) => t.confirmationTime !== undefined)
      .map((t) => t.confirmationTime)
      .sort((a, b) => a - b)

    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
        : 0

    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0

    // Unique agents
    const uniqueAgentIds = new Set(
      allTransactions.map((t) => t.agentId).filter((id) => id !== undefined)
    )
    const totalUniqueAgents = uniqueAgentIds.size

    // Uptime calculation (based on success rate)
    const avgUptime = successRate

    // Get merchant reviews for rating
    const reviews = await ctx.db
      .query('merchantReviews')
      .withIndex('by_merchant', (q) => q.eq('merchantId', args.merchantId))
      .filter((q) => q.gte(q.field('reviewedAt'), cutoffTime))
      .collect()

    const avgRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 0

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      totalRevenueUSDC: Math.round(totalRevenueUSDC * 100) / 100,
      avgResponseTime,
      avgErrorRate: Math.round(errorRate * 100) / 100,
      totalUniqueAgents,
      avgUptime: Math.round(avgUptime * 100) / 100,
      avgRating,
      totalReviews: reviews.length,
      periodDays: days,
      hasData: true,
    }
  },
})

/**
 * Calculate analytics for a merchant from transaction data
 * (Helper function to aggregate raw transaction data into analytics snapshots)
 */
export const calculateFromTransactions = internalQuery({
  args: {
    merchantId: v.id('merchants'),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all transactions for this merchant in the time period
    const allTransactions = await ctx.db
      .query('agentTransactions')
      .withIndex('by_merchant', (q) =>
        q.eq('merchantId', args.merchantId).gte('timestamp', args.periodStart)
      )
      .filter((q) => q.lte(q.field('timestamp'), args.periodEnd))
      .collect()

    if (allTransactions.length === 0) {
      // No transactions in this period
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRevenueUSDC: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        uniqueAgents: 0,
        newAgents: 0,
        returningAgents: 0,
        uptime: 100,
      }
    }

    // Calculate metrics
    const totalRequests = allTransactions.length
    const successfulRequests = allTransactions.filter(
      (t) => t.status === 'confirmed'
    ).length
    const failedRequests = allTransactions.filter((t) => t.status === 'failed').length

    const totalRevenueUSDC = allTransactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    // Response times (confirmation times)
    const responseTimes = allTransactions
      .filter((t) => t.confirmationTime !== undefined)
      .map((t) => t.confirmationTime)
      .sort((a, b) => a - b)

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0

    const p95ResponseTime =
      responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.95)]
        : 0

    const p99ResponseTime =
      responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.99)]
        : 0

    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0

    // Unique agents
    const uniqueAgentIds = new Set(
      allTransactions.map((t) => t.agentId).filter((id) => id !== undefined)
    )
    const uniqueAgents = uniqueAgentIds.size

    // For new vs returning, we'd need to query historical data
    // Simplified: assume all are returning for now
    const newAgents = 0
    const returningAgents = uniqueAgents

    // Uptime calculation (based on success rate)
    const uptime = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalRevenueUSDC,
      avgResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      uniqueAgents,
      newAgents,
      returningAgents,
      uptime: Math.round(uptime * 100) / 100,
    }
  },
})
