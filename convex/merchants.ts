/**
 * Merchant Registry Functions
 *
 * Query discovered merchants from x402 facilitators
 */

import { query, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// Get merchant by ID (internal - for other Convex functions)
export const getInternal = internalQuery({
  args: { merchantId: v.id('merchants') },
  handler: async (ctx, args) => {
    return await ctx.db.get('merchants', args.merchantId)
  },
})

// List all merchants (internal - for other Convex functions)
export const listInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('merchants')
      .take(args.limit ?? 100)
  },
})

// List all merchants
export const list = query({
  args: {
    limit: v.optional(v.number()),
    facilitatorId: v.optional(v.id('facilitators')),
    network: v.optional(v.string()),
    category: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100
    let merchants

    // Filter by facilitator
    if (args.facilitatorId) {
      const facilitatorId = args.facilitatorId
      merchants = await ctx.db
        .query('merchants')
        .withIndex('by_facilitator', (q) => q.eq('facilitatorId', facilitatorId))
        .take(limit)
    } else if (args.activeOnly) {
      // Filter by active status
      merchants = await ctx.db
        .query('merchants')
        .withIndex('by_active', (q) => q.eq('isActive', true))
        .take(limit)
    } else {
      merchants = await ctx.db
        .query('merchants')
        .take(limit)
    }

    // Filter by network
    if (args.network) {
      const network = args.network
      merchants = merchants.filter((m) => m.network === network)
    }

    // Filter by category
    if (args.category) {
      const category = args.category
      merchants = merchants.filter((m) => m.category === category)
    }

    // Enrich with facilitator data
    return await Promise.all(
      merchants.map(async (merchant) => {
        const facilitator = await ctx.db.get('facilitators', merchant.facilitatorId)

        return {
          ...merchant,
          facilitator: facilitator
            ? {
                name: facilitator.name,
                slug: facilitator.slug,
              }
            : null,
        }
      })
    )
  },
})

// Get merchant by ID
export const get = query({
  args: { merchantId: v.id('merchants') },
  handler: async (ctx, args) => {
    const merchant = await ctx.db.get('merchants', args.merchantId)
    if (!merchant) return null

    const facilitator = await ctx.db.get('facilitators', merchant.facilitatorId)

    return {
      ...merchant,
      facilitator: facilitator
        ? {
            name: facilitator.name,
            slug: facilitator.slug,
            url: facilitator.facilitatorUrl,
          }
        : null,
    }
  },
})

// Get merchants stats
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allMerchants = await ctx.db.query('merchants').collect()
    const activeMerchants = allMerchants.filter((m) => m.isActive)

    const networks = new Set(allMerchants.map((m) => m.network))
    const categories = new Set(
      allMerchants.map((m) => m.category).filter((c): c is string => c !== undefined)
    )

    const totalEndpoints = allMerchants.reduce((sum, m) => sum + m.endpoints.length, 0)

    return {
      total: allMerchants.length,
      active: activeMerchants.length,
      networks: networks.size,
      categories: categories.size,
      totalEndpoints,
      recentlyDiscovered: allMerchants.filter(
        (m) => Date.now() - m.discoveredAt < 24 * 60 * 60 * 1000
      ).length,
    }
  },
})

// Get recently discovered merchants
export const getRecentlyDiscovered = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const merchants = await ctx.db
      .query('merchants')
      .withIndex('by_discovered')
      .order('desc')
      .take(args.limit ?? 20)

    return await Promise.all(
      merchants.map(async (merchant) => {
        const facilitator = await ctx.db.get('facilitators', merchant.facilitatorId)

        return {
          ...merchant,
          facilitator: facilitator
            ? {
                name: facilitator.name,
                slug: facilitator.slug,
              }
            : null,
        }
      })
    )
  },
})
