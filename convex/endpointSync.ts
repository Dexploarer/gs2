/**
 * Endpoint Sync Functions
 *
 * Syncs endpoints from external sources (CDP Bazaar, PayAI)
 * and maintains the endpoint registry for the Observatory.
 */

import { v } from 'convex/values'
import { mutation, query, action } from './_generated/server'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Normalized endpoint format from sync sources
 */
const normalizedEndpointValidator = v.object({
  id: v.string(),
  url: v.string(),
  name: v.string(),
  description: v.string(),
  protocol: v.union(v.literal('x402'), v.literal('http'), v.literal('https')),
  network: v.string(),
  priceUSDC: v.number(),
  provider: v.object({
    name: v.string(),
    address: v.string(),
    website: v.optional(v.string()),
  }),
  category: v.string(),
  capabilities: v.array(v.string()),
  source: v.union(
    v.literal('bazaar'),
    v.literal('payai'),
    v.literal('manual'),
    v.literal('crawl')
  ),
  discoverable: v.boolean(),
  verified: v.boolean(),
  lastSynced: v.number(),
})

/**
 * Upsert a single endpoint from sync
 */
export const upsertFromSync = mutation({
  args: {
    endpoint: normalizedEndpointValidator,
  },
  handler: async (ctx, args) => {
    const { endpoint } = args
    const now = Date.now()

    // Check if endpoint exists by URL
    const existing = await ctx.db
      .query('endpoints')
      .withIndex('by_url', (q) => q.eq('url', endpoint.url))
      .unique()

    if (existing) {
      // Update existing endpoint (preserve stats)
      await ctx.db.patch('endpoints', existing._id, {
        name: endpoint.name,
        description: endpoint.description,
        protocol: endpoint.protocol,
        priceUSDC: endpoint.priceUSDC,
        capabilities: endpoint.capabilities,
        category: endpoint.category,
        source: endpoint.source,
        discoverable: endpoint.discoverable,
        lastSynced: now,
        updatedAt: now,
      })
      return { id: existing._id, action: 'updated' }
    }

    // Find or create agent for this provider
    let agentId: Id<'agents'> | undefined = undefined
    if (endpoint.provider.address) {
      const agent = await ctx.db
        .query('agents')
        .withIndex('by_address', (q) => q.eq('address', endpoint.provider.address))
        .unique()

      if (agent) {
        agentId = agent._id
      }
    }

    // Create new endpoint
    const newId = await ctx.db.insert('endpoints', {
      url: endpoint.url,
      name: endpoint.name,
      description: endpoint.description,
      protocol: endpoint.protocol,
      priceUSDC: endpoint.priceUSDC,
      capabilities: endpoint.capabilities,
      category: endpoint.category,
      source: endpoint.source,
      discoverable: endpoint.discoverable,
      agentId,
      // Initialize stats
      successRate: 0,
      avgResponseTime: 0,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      isVerified: endpoint.verified,
      trustScore: 0,
      lastSynced: now,
      lastTested: undefined,
      createdAt: now,
      updatedAt: now,
    })

    return { id: newId, action: 'created' }
  },
})

/**
 * Batch upsert endpoints from sync
 */
export const batchUpsertFromSync = mutation({
  args: {
    endpoints: v.array(normalizedEndpointValidator),
  },
  handler: async (ctx, args) => {
    const results = {
      created: 0,
      updated: 0,
      errors: 0,
    }

    for (const endpoint of args.endpoints) {
      try {
        const existing = await ctx.db
          .query('endpoints')
          .withIndex('by_url', (q) => q.eq('url', endpoint.url))
          .unique()

        const now = Date.now()

        if (existing) {
          await ctx.db.patch('endpoints', existing._id, {
            name: endpoint.name,
            description: endpoint.description,
            protocol: endpoint.protocol,
            priceUSDC: endpoint.priceUSDC,
            capabilities: endpoint.capabilities,
            category: endpoint.category,
            source: endpoint.source,
            discoverable: endpoint.discoverable,
            lastSynced: now,
            updatedAt: now,
          })
          results.updated++
        } else {
          await ctx.db.insert('endpoints', {
            url: endpoint.url,
            name: endpoint.name,
            description: endpoint.description,
            protocol: endpoint.protocol,
            priceUSDC: endpoint.priceUSDC,
            capabilities: endpoint.capabilities,
            category: endpoint.category,
            source: endpoint.source,
            discoverable: endpoint.discoverable,
            agentId: undefined,
            successRate: 0,
            avgResponseTime: 0,
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            isVerified: endpoint.verified,
            trustScore: 0,
            lastSynced: now,
            lastTested: undefined,
            createdAt: now,
            updatedAt: now,
          })
          results.created++
        }
      } catch {
        results.errors++
      }
    }

    return results
  },
})

/**
 * Get sync status and statistics
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const allEndpoints = await ctx.db.query('endpoints').collect()

    const bySource = {
      bazaar: allEndpoints.filter((e) => e.source === 'bazaar').length,
      payai: allEndpoints.filter((e) => e.source === 'payai').length,
      manual: allEndpoints.filter((e) => e.source === 'manual').length,
      crawl: allEndpoints.filter((e) => e.source === 'crawl').length,
    }

    const byCategory: Record<string, number> = {}
    for (const ep of allEndpoints) {
      const cat = ep.category || 'other'
      byCategory[cat] = (byCategory[cat] || 0) + 1
    }

    const recentlyUpdated = allEndpoints.filter(
      (e) => e.lastSynced && e.lastSynced > Date.now() - 24 * 60 * 60 * 1000
    ).length

    return {
      total: allEndpoints.length,
      bySource,
      byCategory,
      recentlyUpdated,
      verified: allEndpoints.filter((e) => e.isVerified).length,
      discoverable: allEndpoints.filter((e) => e.discoverable).length,
    }
  },
})

/**
 * Get endpoints by source
 */
export const getBySource = query({
  args: {
    source: v.union(
      v.literal('bazaar'),
      v.literal('payai'),
      v.literal('manual'),
      v.literal('crawl')
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const source = args.source
    return await ctx.db
      .query('endpoints')
      .withIndex('by_source', (q) => q.eq('source', source))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

/**
 * Get endpoints by category
 */
export const getByCategory = query({
  args: {
    category: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const category = args.category
    return await ctx.db
      .query('endpoints')
      .withIndex('by_category', (q) => q.eq('category', category))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

/**
 * Mark endpoint as stale (for cleanup)
 */
export const markStale = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db
      .query('endpoints')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .unique()

    if (endpoint) {
      await ctx.db.patch('endpoints', endpoint._id, {
        isStale: true,
        updatedAt: Date.now(),
      })
    }
  },
})

/**
 * Delete stale endpoints (older than threshold)
 */
export const deleteStaleEndpoints = mutation({
  args: {
    maxAge: v.number(), // milliseconds
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.maxAge

    const staleEndpoints = await ctx.db
      .query('endpoints')
      .filter((q) =>
        q.and(
          q.eq(q.field('isStale'), true),
          q.lt(q.field('lastSynced'), cutoff)
        )
      )
      .collect()

    let deleted = 0
    for (const ep of staleEndpoints) {
      await ctx.db.delete('endpoints', ep._id)
      deleted++
    }

    return { deleted }
  },
})

/**
 * Search endpoints by query
 */
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase()
    const limit = args.limit ?? 50

    // Simple text search (for more advanced search, use vector embeddings)
    const allEndpoints = await ctx.db.query('endpoints').take(500)

    const matches = allEndpoints.filter((ep) => {
      const searchFields = [
        ep.name,
        ep.description,
        ep.url,
        ep.category,
        ...(ep.capabilities || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchFields.includes(searchTerm)
    })

    return matches.slice(0, limit)
  },
})
