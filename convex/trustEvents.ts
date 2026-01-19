/**
 * Trust Events Functions
 * Track agent reputation changes and milestones
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * Get recent trust events across all agents
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
    eventType: v.optional(
      v.union(
        v.literal('score_increase'),
        v.literal('score_decrease'),
        v.literal('credential_issued'),
        v.literal('credential_revoked'),
        v.literal('tier_upgrade'),
        v.literal('tier_downgrade'),
        v.literal('verification_passed'),
        v.literal('verification_failed')
      )
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    let events

    if (args.eventType) {
      const eventType = args.eventType
      events = await ctx.db
        .query('trustEvents')
        .withIndex('by_type', (q) => q.eq('eventType', eventType))
        .order('desc')
        .take(limit)
    } else {
      events = await ctx.db
        .query('trustEvents')
        .order('desc')
        .take(limit)
    }

    // Enrich with agent data
    return await Promise.all(
      events.map(async (event) => {
        const agent = await ctx.db.get('agents', event.agentId)
        return {
          ...event,
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
  },
})

/**
 * Get trust events for specific agent
 */
export const getByAgent = query({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('trustEvents')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

/**
 * Record a new trust event
 */
export const record = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('trustEvents', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

/**
 * Get trust score statistics for agent
 */
export const getAgentStats = query({
  args: {
    agentId: v.id('agents'),
    daysAgo: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.daysAgo * 24 * 60 * 60 * 1000

    const events = await ctx.db
      .query('trustEvents')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.gte(q.field('timestamp'), cutoff))
      .collect()

    const scoreIncreases = events.filter((e) => e.eventType === 'score_increase').length
    const scoreDecreases = events.filter((e) => e.eventType === 'score_decrease').length
    const credentialsIssued = events.filter((e) => e.eventType === 'credential_issued').length
    const verificationsPasssed = events.filter((e) => e.eventType === 'verification_passed').length

    // Calculate total score change
    const totalChange = events.reduce((sum, e) => {
      if (e.oldScore && e.newScore) {
        return sum + (e.newScore - e.oldScore)
      }
      return sum
    }, 0)

    return {
      scoreIncreases,
      scoreDecreases,
      credentialsIssued,
      verificationsPasssed,
      totalChange,
      totalEvents: events.length,
    }
  },
})
