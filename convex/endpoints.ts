/**
 * Endpoint Registry Functions
 * For Observatory dashboard
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * List all endpoints with filters
 */
export const list = query({
  args: {
    protocol: v.optional(v.union(v.literal('x402'), v.literal('http'), v.literal('https'))),
    minSuccessRate: v.optional(v.number()),
    minGhostScore: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100
    let endpoints

    if (args.protocol) {
      // Use protocol index when filtering
      const protocol = args.protocol
      endpoints = await ctx.db
        .query('endpoints')
        .withIndex('by_protocol', (q) => q.eq('protocol', protocol))
        .order('desc')
        .take(limit)
    } else {
      // Get all endpoints
      endpoints = await ctx.db
        .query('endpoints')
        .order('desc')
        .take(limit)
    }

    // Apply filters
    if (args.minSuccessRate !== undefined) {
      endpoints = endpoints.filter((e) => e.successRate >= args.minSuccessRate!)
    }

    if (args.minGhostScore !== undefined) {
      endpoints = endpoints.filter((e) => (e.ghostScore || 0) >= args.minGhostScore!)
    }

    // Enrich with agent data
    const enriched = await Promise.all(
      endpoints.map(async (endpoint) => {
        if (!endpoint.agentId) return { ...endpoint, agent: null }

        const agent = await ctx.db.get('agents', endpoint.agentId)
        return {
          ...endpoint,
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

    return enriched
  },
})

/**
 * Get endpoint by URL
 */
export const getByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('endpoints')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique()
  },
})

/**
 * Get endpoints by agent (provider)
 */
export const getByAgent = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('endpoints')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .collect()
  },
})

/**
 * Register new endpoint
 */
export const register = mutation({
  args: {
    url: v.string(),
    protocol: v.union(v.literal('x402'), v.literal('http'), v.literal('https')),
    agentId: v.optional(v.id('agents')),
    name: v.string(),
    description: v.string(),
    capabilities: v.array(v.string()),
    priceUSDC: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Get agent's ghost score if available
    let ghostScore = undefined
    if (args.agentId) {
      const agent = await ctx.db.get('agents', args.agentId)
      ghostScore = agent?.ghostScore
    }

    return await ctx.db.insert('endpoints', {
      ...args,
      successRate: 0,
      avgResponseTime: 0,
      ghostScore,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastTested: now,
      isVerified: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update endpoint stats after a call
 */
export const updateStats = mutation({
  args: {
    url: v.string(),
    success: v.boolean(),
    responseTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db
      .query('endpoints')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique()

    if (!endpoint) {
      throw new Error('Endpoint not found')
    }

    const newTotalCalls = endpoint.totalCalls + 1
    const newSuccessfulCalls = endpoint.successfulCalls + (args.success ? 1 : 0)
    const newFailedCalls = endpoint.failedCalls + (args.success ? 0 : 1)
    const newSuccessRate = (newSuccessfulCalls / newTotalCalls) * 100

    // Calculate new average response time (only if provided)
    let newAvgResponseTime = endpoint.avgResponseTime
    if (args.responseTime !== undefined) {
      const totalResponseTime = endpoint.avgResponseTime * endpoint.totalCalls
      newAvgResponseTime = (totalResponseTime + args.responseTime) / newTotalCalls
    }

    await ctx.db.patch('endpoints', endpoint._id, {
      totalCalls: newTotalCalls,
      successfulCalls: newSuccessfulCalls,
      failedCalls: newFailedCalls,
      successRate: newSuccessRate,
      avgResponseTime: newAvgResponseTime,
      lastTested: Date.now(),
      updatedAt: Date.now(),
    })

    return { successRate: newSuccessRate }
  },
})
