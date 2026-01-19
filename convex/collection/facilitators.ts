/**
 * Facilitator Data Collection
 *
 * Collects transactions, activity, and merchant data from facilitator APIs.
 * Uses the new collection state tracking to prevent duplicate collections
 * and maintain collection progress.
 */

import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'

// ========================================
// TRANSACTION COLLECTION
// ========================================

/**
 * Collect transactions from all active facilitators
 * Called by cron every 15 minutes (tiered schedule)
 */
export const collectAllTransactions = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: boolean; reason?: string; collected?: number; errors?: number; facilitators?: number }> => {
    const startTime = Date.now()

    // Check if collection is already running
    const isRunning = await ctx.runQuery(internal.collection.state.isRunning, {
      collectorName: 'transactions',
    })

    if (isRunning) {
      console.log('[Collection] Transaction collection already running, skipping')
      return { skipped: true, reason: 'already_running' }
    }

    // Start collection
    await ctx.runMutation(internal.collection.state.startCollection, {
      collectorName: 'transactions',
    })

    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})
    console.log(`[Collection] Collecting transactions from ${facilitators.length} facilitators`)

    let totalCollected = 0
    let totalErrors = 0

    for (const facilitator of facilitators) {
      try {
        const result = await ctx.runAction(internal.collection.facilitators.collectTransactions, {
          facilitatorId: facilitator._id,
          facilitatorSlug: facilitator.slug,
          facilitatorUrl: facilitator.facilitatorUrl,
        })

        totalCollected += result.collected
        totalErrors += result.errors
      } catch (error) {
        console.error(`[Collection] Failed to collect from ${facilitator.name}:`, error)
        totalErrors++
      }
    }

    // Complete collection
    await ctx.runMutation(internal.collection.state.completeCollection, {
      collectorName: 'transactions',
      itemsCollected: totalCollected,
      itemsSkipped: 0,
      durationMs: Date.now() - startTime,
    })

    console.log(`[Collection] Completed: ${totalCollected} transactions, ${totalErrors} errors`)

    return {
      collected: totalCollected,
      errors: totalErrors,
      facilitators: facilitators.length,
    }
  },
})

/**
 * Collect transactions from a single facilitator
 */
export const collectTransactions = internalAction({
  args: {
    facilitatorId: v.id('facilitators'),
    facilitatorSlug: v.string(),
    facilitatorUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ collected: number; errors: number }> => {
    // Get last collection time for this facilitator
    const lastRun = await ctx.runQuery(internal.collection.state.getLastCollectionTime, {
      collectorName: 'transactions',
      facilitatorSlug: args.facilitatorSlug,
    })

    const since = lastRun || Date.now() - 60 * 60 * 1000 // Last hour if no previous collection

    // Import client factory
    const { createFacilitatorClient } = await import('../../lib/facilitators')

    const client = createFacilitatorClient(args.facilitatorSlug, args.facilitatorUrl, {
      cdpApiKeyId: process.env.CDP_API_KEY,
      cdpApiKeySecret: process.env.CDP_API_SECRET,
      apiKey: process.env.PAYAI_API_KEY,
    })

    // Check if client supports transactions
    if (!client.getRecentTransactions) {
      console.log(`[Collection] ${args.facilitatorSlug} - no transaction API`)
      return { collected: 0, errors: 0 }
    }

    // Fetch transactions
    const transactions = await client.getRecentTransactions({
      since,
      limit: 500,
    })

    console.log(`[Collection] Found ${transactions.length} transactions from ${args.facilitatorSlug}`)

    let collected = 0
    let errors = 0

    for (const tx of transactions) {
      try {
        // Use unified agent upsert
        const result = await ctx.runMutation(internal.entities.agents.upsert, {
          address: tx.agentAddress,
          name: `Agent ${tx.agentAddress.slice(0, 8)}...`,
          source: 'facilitator',
        })
        const agentId = result.agentId as import('../_generated/dataModel').Id<'agents'>

        // Record transaction
        await ctx.runMutation(internal.collection.facilitators.recordTransaction, {
          agentId,
          facilitatorId: args.facilitatorId,
          txSignature: tx.txSignature,
          type: tx.type,
          amountUSDC: tx.amountUSDC,
          feeUSDC: tx.feeUSDC ?? 0,
          status: tx.status,
          network: tx.network,
          blockNumber: tx.blockNumber,
          confirmationTime: tx.confirmationTime,
          endpointUrl: tx.endpointUrl,
          timestamp: tx.timestamp,
        })

        collected++
      } catch (error) {
        console.error(`[Collection] Failed to record tx ${tx.txSignature}:`, error)
        errors++
      }
    }

    // Update facilitator-specific state
    await ctx.runMutation(internal.collection.state.updateProgress, {
      collectorName: 'transactions',
      facilitatorSlug: args.facilitatorSlug,
      itemsCollected: collected,
      lastProcessedId: transactions[transactions.length - 1]?.txSignature,
    })

    return { collected, errors }
  },
})

/**
 * Record a transaction in the database
 */
export const recordTransaction = internalMutation({
  args: {
    agentId: v.id('agents'),
    facilitatorId: v.id('facilitators'),
    txSignature: v.string(),
    type: v.union(
      v.literal('payment_sent'),
      v.literal('payment_received'),
      v.literal('refund'),
      v.literal('fee')
    ),
    amountUSDC: v.number(),
    feeUSDC: v.number(),
    status: v.union(v.literal('pending'), v.literal('confirmed'), v.literal('failed')),
    network: v.string(),
    blockNumber: v.optional(v.number()),
    confirmationTime: v.optional(v.number()),
    endpointUrl: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query('agentTransactions')
      .withIndex('by_signature', (q) => q.eq('txSignature', args.txSignature))
      .first()

    if (existing) {
      return { txId: existing._id, created: false }
    }

    const txId = await ctx.db.insert('agentTransactions', {
      agentId: args.agentId,
      facilitatorId: args.facilitatorId,
      txSignature: args.txSignature,
      type: args.type,
      amountUSDC: args.amountUSDC,
      feeUSDC: args.feeUSDC,
      status: args.status,
      network: args.network,
      blockNumber: args.blockNumber,
      confirmationTime: args.confirmationTime ?? 0,
      endpointUrl: args.endpointUrl,
      timestamp: args.timestamp ?? Date.now(),
    })

    return { txId, created: true }
  },
})

// ========================================
// ACTIVITY COLLECTION
// ========================================

/**
 * Collect activity from all active facilitators
 * Called by cron every 15 minutes (tiered schedule)
 */
export const collectAllActivity = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: boolean; reason?: string; collected?: number; errors?: number; facilitators?: number }> => {
    const startTime = Date.now()

    const isRunning = await ctx.runQuery(internal.collection.state.isRunning, {
      collectorName: 'facilitators',
    })

    if (isRunning) {
      console.log('[Collection] Activity collection already running, skipping')
      return { skipped: true, reason: 'already_running' }
    }

    await ctx.runMutation(internal.collection.state.startCollection, {
      collectorName: 'facilitators',
    })

    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})
    console.log(`[Collection] Collecting activity from ${facilitators.length} facilitators`)

    let totalCollected = 0
    let totalErrors = 0

    for (const facilitator of facilitators) {
      try {
        const result = await ctx.runAction(internal.collection.facilitators.collectActivity, {
          facilitatorId: facilitator._id,
          facilitatorSlug: facilitator.slug,
          facilitatorUrl: facilitator.facilitatorUrl,
        })

        totalCollected += result.collected
        totalErrors += result.errors
      } catch (error) {
        console.error(`[Collection] Failed activity from ${facilitator.name}:`, error)
        totalErrors++
      }
    }

    await ctx.runMutation(internal.collection.state.completeCollection, {
      collectorName: 'facilitators',
      itemsCollected: totalCollected,
      itemsSkipped: 0,
      durationMs: Date.now() - startTime,
    })

    console.log(`[Collection] Activity: ${totalCollected} records, ${totalErrors} errors`)

    return {
      collected: totalCollected,
      errors: totalErrors,
      facilitators: facilitators.length,
    }
  },
})

/**
 * Collect activity from a single facilitator
 */
export const collectActivity = internalAction({
  args: {
    facilitatorId: v.id('facilitators'),
    facilitatorSlug: v.string(),
    facilitatorUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ collected: number; errors: number }> => {
    const lastRun = await ctx.runQuery(internal.collection.state.getLastCollectionTime, {
      collectorName: 'facilitators',
      facilitatorSlug: args.facilitatorSlug,
    })

    const since = lastRun || Date.now() - 60 * 60 * 1000

    const { createFacilitatorClient } = await import('../../lib/facilitators')

    const client = createFacilitatorClient(args.facilitatorSlug, args.facilitatorUrl, {
      cdpApiKeyId: process.env.CDP_API_KEY,
      cdpApiKeySecret: process.env.CDP_API_SECRET,
      apiKey: process.env.PAYAI_API_KEY,
    })

    if (!client.getAgentActivity) {
      console.log(`[Collection] ${args.facilitatorSlug} - no activity API`)
      return { collected: 0, errors: 0 }
    }

    const activities = await client.getAgentActivity({
      since,
      limit: 500,
    })

    console.log(`[Collection] Found ${activities.length} activity records from ${args.facilitatorSlug}`)

    let collected = 0
    let errors = 0

    for (const activity of activities) {
      try {
        const result = await ctx.runMutation(internal.entities.agents.upsert, {
          address: activity.agentAddress,
          name: `Agent ${activity.agentAddress.slice(0, 8)}...`,
          source: 'facilitator',
        })
        const agentId = result.agentId as import('../_generated/dataModel').Id<'agents'>

        // Record as capability usage
        const capability = activity.endpointUrl.split('/').pop() || 'api'

        await ctx.runMutation(internal.agentCapabilities.recordUsage, {
          agentId,
          capability,
          responseTime: activity.responseTime,
          success: activity.success,
        })

        collected++
      } catch (error) {
        console.error(`[Collection] Failed activity record:`, error)
        errors++
      }
    }

    await ctx.runMutation(internal.collection.state.updateProgress, {
      collectorName: 'facilitators',
      facilitatorSlug: args.facilitatorSlug,
      itemsCollected: collected,
    })

    return { collected, errors }
  },
})

// ========================================
// MERCHANT COLLECTION
// ========================================

/**
 * Discover and update merchants from all facilitators
 * Called by cron every 30 minutes
 */
export const discoverAllMerchants = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: boolean; reason?: string; discovered: number; updated: number; facilitators: number; errors?: number }> => {
    const startTime = Date.now()

    const isRunning = await ctx.runQuery(internal.collection.state.isRunning, {
      collectorName: 'merchants',
    })

    if (isRunning) {
      console.log('[Collection] Merchant discovery already running, skipping')
      return { skipped: true, reason: 'already_running', discovered: 0, updated: 0, facilitators: 0 }
    }

    await ctx.runMutation(internal.collection.state.startCollection, {
      collectorName: 'merchants',
    })

    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})
    console.log(`[Collection] Discovering merchants from ${facilitators.length} facilitators`)

    let totalDiscovered = 0
    let totalErrors = 0

    for (const facilitator of facilitators) {
      try {
        const result = await ctx.runAction(internal.collection.facilitators.discoverMerchants, {
          facilitatorId: facilitator._id,
          facilitatorSlug: facilitator.slug,
          facilitatorUrl: facilitator.facilitatorUrl,
        })

        totalDiscovered += result.discovered
        totalErrors += result.errors ?? 0
      } catch (error) {
        console.error(`[Collection] Failed merchant discovery from ${facilitator.name}:`, error)
        totalErrors++
      }
    }

    await ctx.runMutation(internal.collection.state.completeCollection, {
      collectorName: 'merchants',
      itemsCollected: totalDiscovered,
      itemsSkipped: 0,
      durationMs: Date.now() - startTime,
    })

    console.log(`[Collection] Merchants: ${totalDiscovered} discovered, ${totalErrors} errors`)

    return {
      discovered: totalDiscovered,
      updated: 0,
      errors: totalErrors,
      facilitators: facilitators.length,
    }
  },
})

/**
 * Discover merchants from a single facilitator
 */
export const discoverMerchants = internalAction({
  args: {
    facilitatorId: v.id('facilitators'),
    facilitatorSlug: v.string(),
    facilitatorUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ discovered: number; updated: number; errors?: number }> => {
    const { createFacilitatorClient } = await import('../../lib/facilitators')

    const client = createFacilitatorClient(args.facilitatorSlug, args.facilitatorUrl, {
      apiKey: process.env.PAYAI_API_KEY,
    })

    const merchants = await client.discoverMerchants()

    console.log(`[Collection] Found ${merchants.length} merchants from ${args.facilitatorSlug}`)

    let discovered = 0
    let errors = 0

    for (const merchant of merchants) {
      try {
        await ctx.runMutation(internal.collection.facilitators.upsertMerchant, {
          facilitatorId: args.facilitatorId,
          name: merchant.name,
          description: merchant.description,
          network: merchant.network,
          endpoints: merchant.endpoints.map((e) => ({
            url: e.url,
            method: e.method,
            priceUSDC: e.priceUSDC,
            description: e.description,
          })),
          capabilities: merchant.capabilities ?? [],
          category: merchant.category,
        })

        discovered++
      } catch (error) {
        console.error(`[Collection] Failed to upsert merchant ${merchant.name}:`, error)
        errors++
      }
    }

    return { discovered, updated: 0, errors }
  },
})

/**
 * Upsert a merchant into the database
 */
export const upsertMerchant = internalMutation({
  args: {
    facilitatorId: v.id('facilitators'),
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
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Find existing merchant by name and facilitator
    const existing = await ctx.db
      .query('merchants')
      .withIndex('by_facilitator', (q) => q.eq('facilitatorId', args.facilitatorId))
      .filter((q) => q.eq(q.field('name'), args.name))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        endpoints: args.endpoints,
        capabilities: args.capabilities,
        category: args.category,
        lastSeen: now,
      })

      return { merchantId: existing._id, created: false }
    }

    const merchantId = await ctx.db.insert('merchants', {
      facilitatorId: args.facilitatorId,
      name: args.name,
      description: args.description,
      network: args.network,
      endpoints: args.endpoints,
      capabilities: args.capabilities,
      category: args.category,
      isActive: true,
      totalCalls: 0,
      successRate: 100, // Start at 100%
      discoveredAt: now,
      lastSeen: now,
    })

    return { merchantId, created: true }
  },
})

// ========================================
// STATS COLLECTION
// ========================================

/**
 * Collect stats from all facilitators
 */
export const collectAllStats = internalAction({
  args: {},
  handler: async (ctx): Promise<Array<{ slug: string; stats: Record<string, unknown> | null }>> => {
    const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})

    const results: Array<{
      slug: string
      stats: Record<string, unknown> | null
    }> = []

    for (const facilitator of facilitators) {
      try {
        const { createFacilitatorClient } = await import('../../lib/facilitators')

        const client = createFacilitatorClient(facilitator.slug, facilitator.facilitatorUrl, {
          apiKey: process.env.PAYAI_API_KEY,
        })

        if (client.getStats) {
          const stats = await client.getStats()
          results.push({ slug: facilitator.slug, stats: stats as Record<string, unknown> | null })
        }
      } catch (error) {
        console.error(`[Collection] Failed stats from ${facilitator.name}:`, error)
        results.push({ slug: facilitator.slug, stats: null })
      }
    }

    return results
  },
})
