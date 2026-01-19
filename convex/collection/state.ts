/**
 * Collection State Management
 *
 * Track data collection progress, prevent duplicate collection runs,
 * and provide state for incremental syncs.
 */

import { internalQuery, internalMutation } from '../_generated/server'
import { v } from 'convex/values'

// ========================================
// TYPES (defined inline to avoid recursive type issues)
// ========================================

// Valid collector names
type CollectorNameType = 'facilitators' | 'blockchain' | 'transactions' | 'merchants' | 'health'

// Valid collection statuses
type CollectionStatusType = 'idle' | 'running' | 'completed' | 'failed'

// ========================================
// QUERIES
// ========================================

/**
 * Get collection state for a specific collector
 */
export const getState = internalQuery({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
    network: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    _id: unknown
    collectorName: string
    status: string
    lastRunAt?: number
    lastSuccessAt?: number
    facilitatorSlug?: string
    network?: string
  } | null> => {
    // Try to find exact match first
    const collectorName = args.collectorName as CollectorNameType
    let state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        let expr = q.eq(q.field('collectorName'), args.collectorName)
        if (args.facilitatorSlug) {
          expr = q.and(expr, q.eq(q.field('facilitatorSlug'), args.facilitatorSlug))
        }
        if (args.network) {
          expr = q.and(expr, q.eq(q.field('network'), args.network))
        }
        return expr
      })
      .first()

    return state
  },
})

/**
 * Get last successful collection time
 */
export const getLastCollectionTime = internalQuery({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<number | null> => {
    const collectorName = args.collectorName as CollectorNameType
    const state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        if (args.facilitatorSlug) {
          return q.eq(q.field('facilitatorSlug'), args.facilitatorSlug)
        }
        return true
      })
      .first()

    return state?.lastSuccessAt ?? null
  },
})

/**
 * Check if a collection is currently running
 */
export const isRunning = internalQuery({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const collectorName = args.collectorName as CollectorNameType
    const state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        if (args.facilitatorSlug) {
          return q.eq(q.field('facilitatorSlug'), args.facilitatorSlug)
        }
        return true
      })
      .first()

    if (!state) return false

    // Consider running if status is 'running' and started less than 10 minutes ago
    const isStale = state.lastRunAt < Date.now() - 10 * 60 * 1000
    return state.status === 'running' && !isStale
  },
})

/**
 * Get all collection states (for monitoring dashboard)
 */
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query('collectionState').order('desc').take(100)
  },
})

// ========================================
// MUTATIONS
// ========================================

/**
 * Start a collection run - marks state as running
 */
export const startCollection = internalMutation({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
    network: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; reason?: string; stateId: unknown; resumed?: boolean }> => {
    const now = Date.now()
    const collectorName = args.collectorName as CollectorNameType

    // Find existing state
    const existing = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        let expr = q.eq(q.field('collectorName'), args.collectorName)
        if (args.facilitatorSlug) {
          expr = q.and(expr, q.eq(q.field('facilitatorSlug'), args.facilitatorSlug))
        }
        if (args.network) {
          expr = q.and(expr, q.eq(q.field('network'), args.network))
        }
        return expr
      })
      .first()

    if (existing) {
      // Check if already running (and not stale)
      const isStale = existing.lastRunAt < now - 10 * 60 * 1000
      if (existing.status === 'running' && !isStale) {
        return { success: false, reason: 'already_running', stateId: existing._id }
      }

      // Update existing state
      await ctx.db.patch(existing._id, {
        status: 'running',
        lastRunAt: now,
        errorMessage: undefined,
      })

      return { success: true, stateId: existing._id, resumed: true }
    }

    // Create new state
    const stateId = await ctx.db.insert('collectionState', {
      collectorName,
      facilitatorSlug: args.facilitatorSlug,
      network: args.network,
      lastRunAt: now,
      lastSuccessAt: undefined,
      lastCursor: undefined,
      lastProcessedId: undefined,
      itemsCollected: 0,
      itemsSkipped: 0,
      errorsCount: 0,
      status: 'running',
      errorMessage: undefined,
      durationMs: undefined,
      avgItemTimeMs: undefined,
    })

    return { success: true, stateId, resumed: false }
  },
})

/**
 * Complete a collection run successfully
 */
export const completeCollection = internalMutation({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
    network: v.optional(v.string()),
    itemsCollected: v.number(),
    itemsSkipped: v.optional(v.number()),
    lastCursor: v.optional(v.string()),
    lastProcessedId: v.optional(v.string()),
    durationMs: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now()
    const collectorName = args.collectorName as CollectorNameType

    const state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        let expr = q.eq(q.field('collectorName'), collectorName)
        if (args.facilitatorSlug) {
          expr = q.and(expr, q.eq(q.field('facilitatorSlug'), args.facilitatorSlug))
        }
        if (args.network) {
          expr = q.and(expr, q.eq(q.field('network'), args.network))
        }
        return expr
      })
      .first()

    if (!state) {
      console.warn(`[Collection State] No state found for ${collectorName}`)
      return
    }

    const avgItemTimeMs =
      args.itemsCollected > 0 ? Math.round(args.durationMs / args.itemsCollected) : undefined

    await ctx.db.patch(state._id, {
      status: 'completed',
      lastSuccessAt: now,
      itemsCollected: state.itemsCollected + args.itemsCollected,
      itemsSkipped: state.itemsSkipped + (args.itemsSkipped ?? 0),
      lastCursor: args.lastCursor ?? state.lastCursor,
      lastProcessedId: args.lastProcessedId ?? state.lastProcessedId,
      durationMs: args.durationMs,
      avgItemTimeMs,
      errorMessage: undefined,
    })
  },
})

/**
 * Mark a collection run as failed
 */
export const failCollection = internalMutation({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
    network: v.optional(v.string()),
    errorMessage: v.string(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const collectorName = args.collectorName as CollectorNameType
    const state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        let expr = q.eq(q.field('collectorName'), args.collectorName)
        if (args.facilitatorSlug) {
          expr = q.and(expr, q.eq(q.field('facilitatorSlug'), args.facilitatorSlug))
        }
        if (args.network) {
          expr = q.and(expr, q.eq(q.field('network'), args.network))
        }
        return expr
      })
      .first()

    if (!state) {
      console.warn(`[Collection State] No state found for ${args.collectorName}`)
      return
    }

    await ctx.db.patch(state._id, {
      status: 'failed',
      errorsCount: state.errorsCount + 1,
      errorMessage: args.errorMessage,
      durationMs: args.durationMs,
    })
  },
})

/**
 * Update cursor/progress during collection
 */
export const updateProgress = internalMutation({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
    network: v.optional(v.string()),
    lastCursor: v.optional(v.string()),
    lastProcessedId: v.optional(v.string()),
    itemsCollected: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const collectorName = args.collectorName as CollectorNameType
    const state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        let expr = q.eq(q.field('collectorName'), collectorName)
        if (args.facilitatorSlug) {
          expr = q.and(expr, q.eq(q.field('facilitatorSlug'), args.facilitatorSlug))
        }
        if (args.network) {
          expr = q.and(expr, q.eq(q.field('network'), args.network))
        }
        return expr
      })
      .first()

    if (!state) return

    const updates: Record<string, unknown> = {}
    if (args.lastCursor !== undefined) updates.lastCursor = args.lastCursor
    if (args.lastProcessedId !== undefined) updates.lastProcessedId = args.lastProcessedId
    if (args.itemsCollected !== undefined) {
      updates.itemsCollected = state.itemsCollected + args.itemsCollected
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(state._id, updates)
    }
  },
})

/**
 * Reset collection state (for debugging/recovery)
 */
export const resetState = internalMutation({
  args: {
    collectorName: v.string(),
    facilitatorSlug: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const collectorName = args.collectorName as CollectorNameType
    const state = await ctx.db
      .query('collectionState')
      .withIndex('by_collector', (q) => q.eq('collectorName', collectorName))
      .filter((q) => {
        if (args.facilitatorSlug) {
          return q.eq(q.field('facilitatorSlug'), args.facilitatorSlug)
        }
        return true
      })
      .first()

    if (state) {
      await ctx.db.patch(state._id, {
        status: 'idle',
        itemsCollected: 0,
        itemsSkipped: 0,
        errorsCount: 0,
        lastCursor: undefined,
        lastProcessedId: undefined,
        errorMessage: undefined,
      })
    }
  },
})
