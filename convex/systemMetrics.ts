/**
 * System Metrics Functions
 * Track network health, latency, throughput
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * Get recent metrics by type
 */
export const getByType = query({
  args: {
    metricType: v.union(
      v.literal('latency'),
      v.literal('throughput'),
      v.literal('errorRate'),
      v.literal('networkFinality'),
      v.literal('facilitatorUptime')
    ),
    network: v.optional(v.union(v.literal('base'), v.literal('solana'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('systemMetrics')
      .withIndex('by_type', (q) => q.eq('metricType', args.metricType))

    if (args.network) {
      query = query.filter((q) => q.eq(q.field('network'), args.network))
    }

    return await query.order('desc').take(args.limit ?? 100)
  },
})

/**
 * Get latest metrics for all types
 */
export const getLatest = query({
  args: {
    network: v.optional(v.union(v.literal('base'), v.literal('solana'))),
  },
  handler: async (ctx, args) => {
    const metricTypes = [
      'latency',
      'throughput',
      'errorRate',
      'networkFinality',
      'facilitatorUptime',
    ] as const

    const metrics = await Promise.all(
      metricTypes.map(async (type) => {
        let query = ctx.db
          .query('systemMetrics')
          .withIndex('by_type', (q) => q.eq('metricType', type))

        if (args.network) {
          query = query.filter((q) => q.eq(q.field('network'), args.network))
        }

        const latest = await query.order('desc').first()

        return {
          type,
          value: latest?.value ?? 0,
          network: latest?.network,
          timestamp: latest?.timestamp ?? Date.now(),
        }
      })
    )

    return metrics
  },
})

/**
 * Record a new metric
 */
export const record = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('systemMetrics', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

/**
 * Get network-specific metrics (Solana/Base)
 */
export const getNetworkMetrics = query({
  args: {
    network: v.union(v.literal('solana'), v.literal('base')),
  },
  handler: async (ctx, args) => {
    const metricTypes = ['networkFinality', 'throughput', 'facilitatorUptime'] as const

    const results = await Promise.all(
      metricTypes.map(async (type) => {
        const metric = await ctx.db
          .query('systemMetrics')
          .withIndex('by_type', (q) => q.eq('metricType', type))
          .filter((q) => q.eq(q.field('network'), args.network))
          .order('desc')
          .first()

        return { type, value: metric?.value ?? 0 }
      })
    )

    const metricsMap = Object.fromEntries(results.map((r) => [r.type, r.value]))

    // Use default values if no metrics recorded yet
    return {
      network: args.network,
      finality: metricsMap.networkFinality || (args.network === 'solana' ? 400 : 2000),
      tps: metricsMap.throughput || (args.network === 'solana' ? 65000 : 1000),
      uptime: metricsMap.facilitatorUptime || 99.9,
    }
  },
})

/**
 * Get average metric value over time period
 */
export const getAverage = query({
  args: {
    metricType: v.union(
      v.literal('latency'),
      v.literal('throughput'),
      v.literal('errorRate'),
      v.literal('networkFinality'),
      v.literal('facilitatorUptime')
    ),
    network: v.optional(v.union(v.literal('base'), v.literal('solana'))),
    hoursAgo: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.hoursAgo * 60 * 60 * 1000

    let query = ctx.db
      .query('systemMetrics')
      .withIndex('by_type', (q) => q.eq('metricType', args.metricType))
      .filter((q) => q.gte(q.field('timestamp'), cutoff))

    if (args.network) {
      query = query.filter((q) => q.eq(q.field('network'), args.network))
    }

    const metrics = await query.collect()

    if (metrics.length === 0) return 0

    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  },
})

/**
 * Get latency history for charts
 */
export const getLatencyHistory = query({
  args: {
    minutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const minutesBack = args.minutes ?? 60
    const cutoff = Date.now() - minutesBack * 60 * 1000

    const metrics = await ctx.db
      .query('systemMetrics')
      .withIndex('by_type', (q) => q.eq('metricType', 'latency'))
      .filter((q) => q.gte(q.field('timestamp'), cutoff))
      .order('asc')
      .collect()

    // If no real data, return simulated data for demo
    if (metrics.length === 0) {
      return Array.from({ length: minutesBack }, (_, i) => ({
        time: i,
        latency: 30 + Math.sin(i / 5) * 20 + (i % 7) * 2,
      }))
    }

    return metrics.map((m, i) => ({
      time: i,
      latency: m.value,
    }))
  },
})

/**
 * Get system health overview
 */
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    // Get latest metrics of each type
    const metricTypes = ['latency', 'throughput', 'errorRate'] as const

    const latestMetrics = await Promise.all(
      metricTypes.map(async (type) => {
        const metric = await ctx.db
          .query('systemMetrics')
          .withIndex('by_type', (q) => q.eq('metricType', type))
          .order('desc')
          .first()

        return { type, value: metric?.value ?? 0, timestamp: metric?.timestamp }
      })
    )

    const metricsMap = Object.fromEntries(latestMetrics.map((m) => [m.type, m]))

    // Calculate overall status
    const errorRate = metricsMap.errorRate?.value ?? 0
    const latency = metricsMap.latency?.value ?? 0

    let status: 'operational' | 'degraded' | 'offline' = 'operational'
    if (errorRate > 5 || latency > 500) {
      status = 'degraded'
    }
    if (errorRate > 20 || latency > 2000) {
      status = 'offline'
    }

    // Get error count from last hour
    const hourAgo = Date.now() - 60 * 60 * 1000
    const recentErrors = await ctx.db
      .query('systemMetrics')
      .withIndex('by_type', (q) => q.eq('metricType', 'errorRate'))
      .filter((q) => q.gte(q.field('timestamp'), hourAgo))
      .filter((q) => q.gt(q.field('value'), 0))
      .collect()

    return {
      status,
      avgLatency: Math.round(latency),
      errorRate,
      activeAlerts: recentErrors.length,
      lastUpdated: Date.now(),
    }
  },
})
