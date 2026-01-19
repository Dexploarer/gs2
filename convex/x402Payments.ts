/**
 * x402 Payment Tracking Functions
 * For Observatory dashboard
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * Get recent x402 payments with agent info
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query('x402Payments')
      .order('desc')
      .take(args.limit ?? 50)

    // Enrich with agent data
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const agent = await ctx.db.get('agents', payment.agentId)
        return {
          ...payment,
          agent: agent
            ? {
                name: agent.name,
                address: agent.address,
                ghostScore: agent.ghostScore,
                tier: agent.tier,
              }
            : null,
        }
      })
    )

    return enrichedPayments
  },
})

/**
 * Get payments by agent
 */
export const getByAgent = query({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402Payments')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

/**
 * Get payment statistics
 */
export const getStats = query({
  args: {
    network: v.optional(v.union(v.literal('base'), v.literal('solana'))),
  },
  handler: async (ctx, args) => {
    let payments

    if (args.network) {
      const network = args.network
      payments = await ctx.db
        .query('x402Payments')
        .withIndex('by_network', (q) => q.eq('network', network))
        .collect()
    } else {
      payments = await ctx.db.query('x402Payments').collect()
    }

    const total = payments.length
    const completed = payments.filter((p) => p.status === 'completed').length
    const failed = payments.filter((p) => p.status === 'failed').length
    const pending = payments.filter((p) => p.status === 'pending').length

    const totalVolume = payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0)

    const avgResponseTime =
      payments.filter((p) => p.responseTime).reduce((sum, p) => sum + (p.responseTime || 0), 0) /
      (payments.filter((p) => p.responseTime).length || 1)

    return {
      total,
      completed,
      failed,
      pending,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      totalVolume,
      avgResponseTime,
    }
  },
})

/**
 * Record a new x402 payment
 */
export const record = mutation({
  args: {
    txSignature: v.string(),
    agentId: v.id('agents'),
    endpoint: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    facilitator: v.optional(v.string()),
    network: v.union(v.literal('base'), v.literal('solana')),
    responseTime: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert('x402Payments', {
      ...args,
      timestamp: Date.now(),
    })

    // Also record activity
    await ctx.db.insert('agentActivity', {
      agentId: args.agentId,
      activityType: 'payment',
      metadata: {
        endpoint: args.endpoint,
        amount: args.amount,
      },
      impactOnScore: args.status === 'completed' ? 1 : args.status === 'failed' ? -2 : 0,
      timestamp: Date.now(),
    })

    return paymentId
  },
})

/**
 * Get payment stats broken down by network
 */
export const getStatsByNetwork = query({
  args: {},
  handler: async (ctx) => {
    const allPayments = await ctx.db.query('x402Payments').collect()

    const solanaPayments = allPayments.filter((p) => p.network === 'solana')
    const basePayments = allPayments.filter((p) => p.network === 'base')

    const calcStats = (payments: typeof allPayments) => {
      const completed = payments.filter((p) => p.status === 'completed')
      const totalVolume = completed.reduce((sum, p) => sum + p.amount, 0)
      const avgFee = completed.length > 0
        ? completed.reduce((sum, p) => sum + (p.amount * 0.001), 0) / completed.length
        : 0

      return {
        count: payments.length,
        volume: totalVolume,
        avgFee,
      }
    }

    return {
      solana: calcStats(solanaPayments),
      base: calcStats(basePayments),
      total: allPayments.length,
    }
  },
})

/**
 * Get payment stats broken down by facilitator
 */
export const getStatsByFacilitator = query({
  args: {},
  handler: async (ctx) => {
    const allPayments = await ctx.db.query('x402Payments').collect()
    const facilitators = await ctx.db.query('facilitators').collect()

    // Group payments by facilitator
    const facilitatorStats = facilitators.map((f) => {
      const payments = allPayments.filter((p) => p.facilitator === f.slug)
      const completed = payments.filter((p) => p.status === 'completed')
      const failed = payments.filter((p) => p.status === 'failed')

      return {
        name: f.name,
        slug: f.slug,
        count: payments.length,
        successRate: payments.length > 0 ? (completed.length / payments.length) * 100 : 0,
        primaryNetwork: f.networks[0] || 'solana',
        avgFinality: f.performance?.avgResponseTime || 0,
      }
    })

    return facilitatorStats.filter((f) => f.count > 0)
  },
})

/**
 * Get payments by endpoint URL
 */
export const getByEndpoint = query({
  args: {
    endpoint: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402Payments')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .order('desc')
      .take(args.limit ?? 50)
  },
})

/**
 * Get endpoint-specific statistics
 */
export const getEndpointStats = query({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query('x402Payments')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .collect()

    const total = payments.length
    const completed = payments.filter((p) => p.status === 'completed').length
    const failed = payments.filter((p) => p.status === 'failed').length

    const avgPrice =
      total > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) / total : 0

    const maxPrice =
      total > 0 ? Math.max(...payments.map((p) => p.amount)) : 0

    const lastSuccess = payments.find((p) => p.status === 'completed')
    const lastFailure = payments.find((p) => p.status === 'failed')

    return {
      totalCalls: total,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      successCount: completed,
      failedCount: failed,
      avgPrice,
      maxPrice,
      lastSuccessAt: lastSuccess?.timestamp,
      lastFailureAt: lastFailure?.timestamp,
    }
  },
})

/**
 * Get hourly payment stats for charts
 */
export const getHourlyStats = query({
  args: {
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursBack = args.hours ?? 24
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000

    const payments = await ctx.db
      .query('x402Payments')
      .withIndex('by_timestamp')
      .filter((q) => q.gte(q.field('timestamp'), cutoff))
      .collect()

    // Group by hour
    const hourlyData: Record<number, { payments: number; volume: number }> = {}

    // Initialize all hours
    for (let i = 0; i < hoursBack; i++) {
      const hourTimestamp = Date.now() - i * 60 * 60 * 1000
      const hour = new Date(hourTimestamp).getHours()
      hourlyData[hour] = { payments: 0, volume: 0 }
    }

    // Aggregate payments
    for (const payment of payments) {
      const hour = new Date(payment.timestamp).getHours()
      if (hourlyData[hour]) {
        hourlyData[hour].payments += 1
        if (payment.status === 'completed') {
          hourlyData[hour].volume += payment.amount
        }
      }
    }

    // Convert to array sorted by hour
    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: `${hour}:00`,
        payments: data.payments,
        volume: data.volume,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
  },
})
