/**
 * Agent Activity Stream Functions
 * Real-time activity feed for Observatory
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * Get recent activity across all agents
 */
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
    activityType: v.optional(
      v.union(
        v.literal('payment'),
        v.literal('endpoint_call'),
        v.literal('credential_issued'),
        v.literal('score_change'),
        v.literal('tier_change')
      )
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    let activities

    if (args.activityType) {
      // Use index when filtering by type
      const activityType = args.activityType
      activities = await ctx.db
        .query('agentActivity')
        .withIndex('by_type', (q) => q.eq('activityType', activityType))
        .order('desc')
        .take(limit)
    } else {
      // Use timestamp index for all activities
      activities = await ctx.db
        .query('agentActivity')
        .withIndex('by_timestamp')
        .order('desc')
        .take(limit)
    }

    // Enrich with agent data
    return await Promise.all(
      activities.map(async (activity) => {
        const agent = await ctx.db.get('agents', activity.agentId)
        return {
          ...activity,
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
 * Get activity for specific agent
 */
export const getByAgent = query({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentActivity')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

/**
 * Record new activity
 */
export const record = mutation({
  args: {
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
    }),
    impactOnScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('agentActivity', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
