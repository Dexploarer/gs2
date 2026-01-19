/**
 * Score History Functions
 *
 * Track Ghost Score changes over time for agents
 */

import { query } from './_generated/server'
import { v } from 'convex/values'

/**
 * Get score history for a specific agent
 */
export const getForAgent = query({
  args: {
    agentId: v.id('agents'),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.days ?? 30
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000

    const history = await ctx.db
      .query('scoreHistory')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.gte(q.field('timestamp'), cutoff))
      .order('asc')
      .collect()

    // If no history, return demo data
    if (history.length === 0) {
      return Array.from({ length: daysBack }, (_, i) => ({
        day: i + 1,
        score: 650 + Math.sin(i / 3) * 50 + i * 8,
        timestamp: Date.now() - (daysBack - i) * 24 * 60 * 60 * 1000,
      }))
    }

    return history.map((h, i) => ({
      day: i + 1,
      score: h.score,
      timestamp: h.timestamp,
      tier: h.tier,
    }))
  },
})

/**
 * Get aggregate score history for network
 */
export const getAggregateHistory = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.days ?? 30
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000

    const history = await ctx.db
      .query('scoreHistory')
      .withIndex('by_timestamp')
      .filter((q) => q.gte(q.field('timestamp'), cutoff))
      .collect()

    // Group by day
    const dayMap = new Map<string, number[]>()

    for (const record of history) {
      const date = new Date(record.timestamp).toISOString().split('T')[0]
      if (!dayMap.has(date)) {
        dayMap.set(date, [])
      }
      dayMap.get(date)!.push(record.score)
    }

    // Calculate averages
    const result = Array.from(dayMap.entries()).map(([date, scores]) => ({
      date,
      avgScore: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
      count: scores.length,
    }))

    return result.sort((a, b) => a.date.localeCompare(b.date))
  },
})

/**
 * Get trust events for an agent
 */
export const getTrustEvents = query({
  args: {
    agentId: v.optional(v.id('agents')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10

    // Get activities that affect score
    let activities
    const agentIdFilter = args.agentId
    if (agentIdFilter) {
      activities = await ctx.db
        .query('agentActivity')
        .withIndex('by_agent', (q) => q.eq('agentId', agentIdFilter))
        .order('desc')
        .take(limit)
    } else {
      activities = await ctx.db
        .query('agentActivity')
        .withIndex('by_timestamp')
        .order('desc')
        .take(limit)
    }

    // Enrich with agent data and format as trust events
    return await Promise.all(
      activities.map(async (activity) => {
        const agent = await ctx.db.get('agents', activity.agentId)

        return {
          id: activity._id,
          type: activity.activityType,
          title: formatActivityTitle(activity.activityType),
          description: formatActivityDescription(activity),
          impact: activity.impactOnScore || 0,
          timestamp: activity.timestamp,
          agent: agent
            ? {
                name: agent.name,
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
 * Get score statistics for an agent
 */
export const getStatsForAgent = query({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get('agents', args.agentId)
    if (!agent) return null

    // Get recent score history
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const history = await ctx.db
      .query('scoreHistory')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.gte(q.field('timestamp'), thirtyDaysAgo))
      .order('asc')
      .collect()

    const startScore = history[0]?.score ?? agent.ghostScore
    const currentScore = agent.ghostScore
    const change = currentScore - startScore

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (change > 5) trend = 'up'
    else if (change < -5) trend = 'down'

    // Calculate next tier milestone
    let nextTier = ''
    let pointsToNextTier = 0
    if (currentScore < 500) {
      nextTier = 'Silver'
      pointsToNextTier = 500 - currentScore
    } else if (currentScore < 750) {
      nextTier = 'Gold'
      pointsToNextTier = 750 - currentScore
    } else if (currentScore < 900) {
      nextTier = 'Platinum'
      pointsToNextTier = 900 - currentScore
    } else {
      nextTier = 'Max'
      pointsToNextTier = 0
    }

    return {
      currentScore,
      startScore,
      change,
      trend,
      tier: agent.tier,
      nextTier,
      pointsToNextTier,
    }
  },
})

// Helper functions
function formatActivityTitle(type: string): string {
  switch (type) {
    case 'credential_issued':
      return 'Credential Issued'
    case 'tier_change':
      return 'Tier Upgraded'
    case 'score_change':
      return 'Score Changed'
    case 'payment':
      return 'Payment Completed'
    case 'endpoint_call':
      return 'API Call Completed'
    default:
      return 'Activity Recorded'
  }
}

function formatActivityDescription(activity: any): string {
  switch (activity.activityType) {
    case 'credential_issued':
      return `Received ${activity.metadata?.credentialType || 'Verifiable Credential'}`
    case 'tier_change':
      return `Upgraded to ${activity.metadata?.newTier || 'new tier'}`
    case 'score_change':
      return `Score changed from ${activity.metadata?.oldScore || 0} to ${activity.metadata?.newScore || 0}`
    case 'payment':
      return `Completed payment of $${activity.metadata?.amount?.toFixed(2) || '0.00'}`
    case 'endpoint_call':
      return `Called ${activity.metadata?.endpoint || 'endpoint'}`
    default:
      return 'Activity recorded'
  }
}
