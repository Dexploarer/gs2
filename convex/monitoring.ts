/**
 * Facilitator Monitoring Functions (Internal)
 *
 * Cron job handlers for health checks, merchant discovery, and metrics collection
 */

import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

/**
 * Monitor all active facilitators (called by cron)
 */
export const monitorAllFacilitators = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all active facilitators
    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})

    console.log(`Monitoring ${facilitators.length} facilitators...`)

    // Monitor each facilitator
    for (const facilitator of facilitators) {
      try {
        await ctx.runAction(internal.monitoring.monitorFacilitator, {
          facilitatorId: facilitator._id,
          facilitatorSlug: facilitator.slug,
          facilitatorUrl: facilitator.facilitatorUrl,
        })
      } catch (error) {
        console.error(`Failed to monitor ${facilitator.name}:`, error)
      }
    }

    console.log('Facilitator monitoring complete')
  },
})

/**
 * Monitor a single facilitator
 */
export const monitorFacilitator = internalAction({
  args: {
    facilitatorId: v.id('facilitators'),
    facilitatorSlug: v.string(),
    facilitatorUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Import facilitator client (dynamic to avoid bundling all)
    const { createFacilitatorClient } = await import('../lib/facilitators')

    const client = createFacilitatorClient(args.facilitatorSlug, args.facilitatorUrl, {
      cdpApiKeyId: process.env.CDP_API_KEY_ID,
      cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
    })

    // Perform health check
    const healthResult = await client.healthCheck()

    // Calculate consecutive failures
    const recentHealth = await ctx.runQuery(internal.monitoring.getRecentHealth, {
      facilitatorId: args.facilitatorId,
      limit: 5,
    })

    const consecutiveFailures =
      healthResult.status === 'offline'
        ? recentHealth.filter((h: any) => h.status === 'offline').length + 1
        : 0

    // Calculate 24h uptime
    const last24hHealth = await ctx.runQuery(internal.monitoring.getLast24HoursHealth, {
      facilitatorId: args.facilitatorId,
    })

    const onlineCount = last24hHealth.filter((h: any) => h.status === 'online').length
    const uptime24h = last24hHealth.length > 0 ? (onlineCount / last24hHealth.length) * 100 : 100

    // Record health check
    await ctx.runMutation(internal.monitoring.recordHealth, {
      facilitatorId: args.facilitatorId,
      status: healthResult.status,
      responseTime: healthResult.responseTime,
      errorMessage: healthResult.error,
      uptime24h,
      consecutiveFailures,
      endpoint: args.facilitatorUrl,
      timestamp: healthResult.timestamp,
    })

    // Update facilitator performance
    if (healthResult.responseTime !== undefined) {
      await ctx.runMutation(internal.monitoring.updateFacilitatorPerformance, {
        facilitatorId: args.facilitatorId,
        avgResponseTime: healthResult.responseTime,
        uptime: uptime24h,
      })
    }

    console.log(
      `${args.facilitatorSlug}: ${healthResult.status} (${healthResult.responseTime}ms)`
    )
  },
})

/**
 * Discover merchants from all facilitators
 */
export const discoverMerchants = internalAction({
  args: {},
  handler: async (ctx) => {
    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})

    console.log(`Discovering merchants from ${facilitators.length} facilitators...`)

    let totalDiscovered = 0

    for (const facilitator of facilitators) {
      try {
        const count = await ctx.runAction(internal.monitoring.discoverMerchantsForFacilitator, {
          facilitatorId: facilitator._id,
          facilitatorSlug: facilitator.slug,
          facilitatorUrl: facilitator.facilitatorUrl,
        })

        totalDiscovered += count
      } catch (error) {
        console.error(`Failed to discover merchants for ${facilitator.name}:`, error)
      }
    }

    console.log(`Merchant discovery complete. Found ${totalDiscovered} merchants.`)
  },
})

/**
 * Discover merchants for a single facilitator
 */
export const discoverMerchantsForFacilitator = internalAction({
  args: {
    facilitatorId: v.id('facilitators'),
    facilitatorSlug: v.string(),
    facilitatorUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { createFacilitatorClient } = await import('../lib/facilitators')

    const client = createFacilitatorClient(args.facilitatorSlug, args.facilitatorUrl, {
      cdpApiKeyId: process.env.CDP_API_KEY_ID,
      cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
    })

    // Discover merchants
    const merchants = await client.discoverMerchants()

    console.log(`Found ${merchants.length} merchants for ${args.facilitatorSlug}`)

    // Record each merchant
    for (const merchant of merchants) {
      try {
        await ctx.runMutation(internal.monitoring.upsertMerchant, {
          facilitatorId: args.facilitatorId,
          merchant: {
            name: merchant.name,
            description: merchant.description,
            network: merchant.network,
            endpoints: merchant.endpoints,
            capabilities: merchant.capabilities || [],
            category: merchant.category,
            metadata: merchant.metadata,
          },
        })
      } catch (error) {
        console.error(`Failed to record merchant ${merchant.name}:`, error)
      }
    }

    return merchants.length
  },
})

/**
 * Collect metrics from facilitators
 */
export const collectMetrics = internalAction({
  args: {},
  handler: async (ctx) => {
    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})

    for (const facilitator of facilitators) {
      try {
        const { createFacilitatorClient } = await import('../lib/facilitators')

        const client = createFacilitatorClient(facilitator.slug, facilitator.facilitatorUrl)

        const stats = await client.getStats?.()

        if (stats) {
          await ctx.runMutation(internal.monitoring.updateFacilitatorStats, {
            facilitatorId: facilitator._id,
            stats,
          })
        }
      } catch (error) {
        console.error(`Failed to collect metrics for ${facilitator.name}:`, error)
      }
    }
  },
})

/**
 * Cleanup old health records (keep last 7 days)
 */
export const cleanupOldHealthRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    const oldRecords = await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_timestamp')
      .filter((q) => q.lt(q.field('timestamp'), sevenDaysAgo))
      .collect()

    for (const record of oldRecords) {
      await ctx.db.delete('facilitatorHealth', record._id)
    }

    console.log(`Cleaned up ${oldRecords.length} old health records`)
  },
})

// Internal queries and mutations

export const getActiveFacilitators = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get both active and beta facilitators for monitoring
    // Exclude only deprecated and testnet-only
    const allFacilitators = await ctx.db.query('facilitators').collect()

    return allFacilitators.filter(
      (f) => f.status === 'active' || f.status === 'beta'
    )
  },
})

export const getRecentHealth = internalQuery({
  args: {
    facilitatorId: v.id('facilitators'),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .order('desc')
      .take(args.limit)
  },
})

export const getLast24HoursHealth = internalQuery({
  args: {
    facilitatorId: v.id('facilitators'),
  },
  handler: async (ctx, args) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    return await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .filter((q) => q.gte(q.field('timestamp'), oneDayAgo))
      .collect()
  },
})

export const getLatestHealth = internalQuery({
  args: {
    facilitatorId: v.id('facilitators'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('facilitatorHealth')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .order('desc')
      .first()
  },
})

export const recordHealth = internalMutation({
  args: {
    facilitatorId: v.id('facilitators'),
    status: v.union(v.literal('online'), v.literal('offline'), v.literal('degraded')),
    responseTime: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    uptime24h: v.number(),
    consecutiveFailures: v.number(),
    endpoint: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('facilitatorHealth', {
      facilitatorId: args.facilitatorId,
      status: args.status,
      responseTime: args.responseTime,
      errorMessage: args.errorMessage,
      uptime24h: args.uptime24h,
      consecutiveFailures: args.consecutiveFailures,
      endpoint: args.endpoint,
      lastChecked: Date.now(),
      timestamp: args.timestamp,
    })
  },
})

export const updateFacilitatorPerformance = internalMutation({
  args: {
    facilitatorId: v.id('facilitators'),
    avgResponseTime: v.optional(v.number()),
    uptime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const facilitator = await ctx.db.get('facilitators', args.facilitatorId)
    if (!facilitator) return

    const updates: any = {}

    if (args.avgResponseTime !== undefined) {
      updates.avgResponseTime = args.avgResponseTime
    }

    if (args.uptime !== undefined) {
      updates.uptime = args.uptime
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch('facilitators', args.facilitatorId, {
        performance: {
          ...facilitator.performance,
          ...updates,
        },
        updatedAt: Date.now(),
      })
    }
  },
})

export const upsertMerchant = internalMutation({
  args: {
    facilitatorId: v.id('facilitators'),
    merchant: v.object({
      name: v.string(),
      description: v.string(),
      network: v.string(),
      endpoints: v.array(
        v.object({
          url: v.string(),
          method: v.string(),
          priceUSDC: v.number(),
          description: v.string(),
        })
      ),
      capabilities: v.array(v.string()),
      category: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          website: v.optional(v.string()),
          twitter: v.optional(v.string()),
          github: v.optional(v.string()),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    // Check if merchant already exists (by name + facilitator)
    const existing = await ctx.db
      .query('merchants')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .filter((q) => q.eq(q.field('name'), args.merchant.name))
      .first()

    const now = Date.now()

    if (existing) {
      // Update existing merchant
      await ctx.db.patch('merchants', existing._id, {
        description: args.merchant.description,
        network: args.merchant.network,
        endpoints: args.merchant.endpoints,
        capabilities: args.merchant.capabilities,
        category: args.merchant.category,
        lastSeen: now,
        isActive: true,
        metadata: args.merchant.metadata,
      })
    } else {
      // Insert new merchant
      await ctx.db.insert('merchants', {
        name: args.merchant.name,
        description: args.merchant.description,
        facilitatorId: args.facilitatorId,
        network: args.merchant.network,
        endpoints: args.merchant.endpoints,
        capabilities: args.merchant.capabilities,
        category: args.merchant.category,
        totalCalls: 0,
        successRate: 0,
        discoveredAt: now,
        lastSeen: now,
        isActive: true,
        metadata: args.merchant.metadata,
      })
    }
  },
})

export const updateFacilitatorStats = internalMutation({
  args: {
    facilitatorId: v.id('facilitators'),
    stats: v.any(),
  },
  handler: async (ctx, args) => {
    const facilitator = await ctx.db.get('facilitators', args.facilitatorId)
    if (!facilitator) return

    const updates: any = {}

    if (args.stats.dailyVolume !== undefined) {
      updates.dailyVolume = args.stats.dailyVolume
    }

    if (args.stats.dailyTransactions !== undefined) {
      updates.dailyTransactions = args.stats.dailyTransactions
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch('facilitators', args.facilitatorId, {
        performance: {
          ...facilitator.performance,
          ...updates,
        },
        updatedAt: Date.now(),
      })
    }
  },
})
