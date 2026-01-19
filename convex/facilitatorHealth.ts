/**
 * Facilitator Health Functions
 *
 * Query facilitator health monitoring data
 */

import { query } from './_generated/server'
import { v } from 'convex/values'

// Get latest health for all facilitators
export const getLatestForAll = query({
  args: {},
  handler: async (ctx) => {
    const facilitators = await ctx.db.query('facilitators').collect()

    return await Promise.all(
      facilitators.map(async (facilitator) => {
        const latestHealth = await ctx.db
          .query('facilitatorHealth')
          .withIndex('by_facilitator', (q) => q.eq('facilitatorId', facilitator._id))
          .order('desc')
          .first()

        return {
          facilitatorId: facilitator._id,
          facilitatorName: facilitator.name,
          facilitatorSlug: facilitator.slug,
          health: latestHealth || null,
        }
      })
    )
  },
})

// Get health history for a facilitator
export const getHistory = query({
  args: {
    facilitatorId: v.id('facilitators'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

// Get facilitators with issues (offline or degraded)
export const getIssues = query({
  args: {},
  handler: async (ctx) => {
    const offlineRecords = await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_status', (q) => q.eq('status', 'offline'))
      .collect()

    const degradedRecords = await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_status', (q) => q.eq('status', 'degraded'))
      .collect()

    // Get latest record for each facilitator
    const latestByFacilitator = new Map()

    for (const record of [...offlineRecords, ...degradedRecords]) {
      const existing = latestByFacilitator.get(record.facilitatorId)
      if (!existing || record.timestamp > existing.timestamp) {
        latestByFacilitator.set(record.facilitatorId, record)
      }
    }

    // Enrich with facilitator data
    const issues = await Promise.all(
      Array.from(latestByFacilitator.values()).map(async (health) => {
        const facilitator = await ctx.db.get('facilitators', health.facilitatorId)

        return {
          ...health,
          facilitator: facilitator
            ? {
                name: facilitator.name,
                slug: facilitator.slug,
              }
            : null,
        }
      })
    )

    return issues.sort((a, b) => b.timestamp - a.timestamp)
  },
})

// Get uptime statistics
export const getUptimeStats = query({
  args: {
    facilitatorId: v.id('facilitators'),
    hours: v.optional(v.number()), // Default: 24 hours
  },
  handler: async (ctx, args) => {
    const hours = args.hours ?? 24
    const timeAgo = Date.now() - hours * 60 * 60 * 1000

    const healthRecords = await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .filter((q) => q.gte(q.field('timestamp'), timeAgo))
      .collect()

    if (healthRecords.length === 0) {
      return {
        uptime: 100,
        totalChecks: 0,
        onlineChecks: 0,
        offlineChecks: 0,
        degradedChecks: 0,
        avgResponseTime: 0,
      }
    }

    const onlineChecks = healthRecords.filter((h) => h.status === 'online').length
    const offlineChecks = healthRecords.filter((h) => h.status === 'offline').length
    const degradedChecks = healthRecords.filter((h) => h.status === 'degraded').length

    const responseTimes = healthRecords
      .filter((h) => h.responseTime !== undefined)
      .map((h) => h.responseTime!)

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
        : 0

    return {
      uptime: (onlineChecks / healthRecords.length) * 100,
      totalChecks: healthRecords.length,
      onlineChecks,
      offlineChecks,
      degradedChecks,
      avgResponseTime: Math.round(avgResponseTime),
    }
  },
})
