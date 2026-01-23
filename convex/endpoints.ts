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
 * List endpoints by category
 */
export const listByCategory = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100
    let endpoints

    if (args.category) {
      endpoints = await ctx.db
        .query('endpoints')
        .withIndex('by_category', (q) => q.eq('category', args.category))
        .take(limit)
    } else {
      endpoints = await ctx.db.query('endpoints').take(limit)
    }

    // Enrich with agent data
    return Promise.all(
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
  },
})

/**
 * Get endpoint statistics for dashboard
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const endpoints = await ctx.db.query('endpoints').collect()

    // Calculate totals
    const totalEndpoints = endpoints.length
    const verifiedEndpoints = endpoints.filter((e) => e.isVerified).length
    const x402Endpoints = endpoints.filter((e) => e.protocol === 'x402').length
    const totalCalls = endpoints.reduce((sum, e) => sum + e.totalCalls, 0)
    const avgSuccessRate =
      endpoints.length > 0
        ? endpoints.reduce((sum, e) => sum + e.successRate, 0) / endpoints.length
        : 0

    // Group by category
    const categoryStats: Record<string, { count: number; calls: number }> = {}
    endpoints.forEach((e) => {
      const cat = e.category || 'other'
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, calls: 0 }
      }
      categoryStats[cat].count++
      categoryStats[cat].calls += e.totalCalls
    })

    // Group by network
    const networkStats: Record<string, { count: number; calls: number }> = {}
    endpoints.forEach((e) => {
      const net = e.network || 'unknown'
      if (!networkStats[net]) {
        networkStats[net] = { count: 0, calls: 0 }
      }
      networkStats[net].count++
      networkStats[net].calls += e.totalCalls
    })

    // Price distribution
    const priceRanges = {
      free: endpoints.filter((e) => e.priceUSDC === 0).length,
      micro: endpoints.filter((e) => e.priceUSDC > 0 && e.priceUSDC <= 0.001).length,
      low: endpoints.filter((e) => e.priceUSDC > 0.001 && e.priceUSDC <= 0.01).length,
      medium: endpoints.filter((e) => e.priceUSDC > 0.01 && e.priceUSDC <= 0.1).length,
      high: endpoints.filter((e) => e.priceUSDC > 0.1).length,
    }

    return {
      totalEndpoints,
      verifiedEndpoints,
      x402Endpoints,
      totalCalls,
      avgSuccessRate,
      categoryStats,
      networkStats,
      priceRanges,
    }
  },
})

/**
 * Get top providers (agents) by endpoint count and calls
 */
export const getTopProviders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const endpoints = await ctx.db.query('endpoints').collect()

    // Group by agent
    const providerStats: Record<
      string,
      { agentId: string; endpointCount: number; totalCalls: number; avgSuccessRate: number }
    > = {}

    endpoints.forEach((e) => {
      if (!e.agentId) return
      const id = e.agentId
      if (!providerStats[id]) {
        providerStats[id] = {
          agentId: id,
          endpointCount: 0,
          totalCalls: 0,
          avgSuccessRate: 0,
        }
      }
      providerStats[id].endpointCount++
      providerStats[id].totalCalls += e.totalCalls
      providerStats[id].avgSuccessRate += e.successRate
    })

    // Calculate average success rate and sort
    const providers = Object.values(providerStats)
      .map((p) => ({
        ...p,
        avgSuccessRate: p.endpointCount > 0 ? p.avgSuccessRate / p.endpointCount : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, args.limit ?? 20)

    // Enrich with agent data
    return Promise.all(
      providers.map(async (p) => {
        const agent = await ctx.db.get('agents', p.agentId as any)
        return {
          ...p,
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
 * Search endpoints by text
 */
export const search = query({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
    network: v.optional(v.string()),
    minTrustScore: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    const searchLower = args.query.toLowerCase()

    let endpoints = await ctx.db.query('endpoints').collect()

    // Filter by search term
    if (args.query) {
      endpoints = endpoints.filter(
        (e) =>
          e.name.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower) ||
          e.url.toLowerCase().includes(searchLower) ||
          e.capabilities.some((c) => c.toLowerCase().includes(searchLower))
      )
    }

    // Filter by category
    if (args.category) {
      endpoints = endpoints.filter((e) => e.category === args.category)
    }

    // Filter by network
    if (args.network) {
      endpoints = endpoints.filter((e) => e.network === args.network)
    }

    // Filter by trust score
    if (args.minTrustScore !== undefined) {
      endpoints = endpoints.filter((e) => (e.trustScore || 0) >= args.minTrustScore!)
    }

    // Sort by trust score then success rate
    endpoints.sort((a, b) => {
      const aScore = (a.trustScore || 0) + a.successRate
      const bScore = (b.trustScore || 0) + b.successRate
      return bScore - aScore
    })

    // Limit results
    endpoints = endpoints.slice(0, limit)

    // Enrich with agent data
    return Promise.all(
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
  },
})

/**
 * Test an endpoint and record results
 */
export const testEndpoint = mutation({
  args: {
    endpointId: v.id('endpoints'),
  },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get('endpoints', args.endpointId)
    if (!endpoint) throw new Error('Endpoint not found')

    // Mark as being tested
    await ctx.db.patch(args.endpointId, {
      lastTested: Date.now(),
      updatedAt: Date.now(),
    })

    return { url: endpoint.url, protocol: endpoint.protocol }
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
