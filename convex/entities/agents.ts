/**
 * Agent Entity Operations
 *
 * Single source of truth for agent CRUD operations.
 * Consolidates agent creation/update logic from solanaSync and realDataCollection.
 */

import { v } from 'convex/values'
import { internalQuery, internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'

// ========================================
// TYPES
// ========================================

export const AgentSource = v.union(
  v.literal('solana'), // Discovered from Solana blockchain
  v.literal('facilitator'), // Discovered from facilitator API
  v.literal('manual'), // Manually registered
  v.literal('webhook') // Created via webhook
)

export const AgentTier = v.union(
  v.literal('bronze'),
  v.literal('silver'),
  v.literal('gold'),
  v.literal('platinum')
)

// ========================================
// INTERNAL QUERIES
// ========================================

/**
 * Get agent by address (internal)
 */
export const getByAddress = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.address))
      .first()
  },
})

/**
 * Get agent by ID (internal)
 */
export const getById = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return ctx.db.get('agents', args.agentId)
  },
})

/**
 * Get multiple agents by IDs
 */
export const getMany = internalQuery({
  args: { agentIds: v.array(v.id('agents')) },
  handler: async (ctx, args) => {
    const agents = await Promise.all(args.agentIds.map((id) => ctx.db.get('agents', id)))
    return agents.filter(Boolean)
  },
})

/**
 * List active agents
 */
export const listActive = internalQuery({
  args: {
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('agents').filter((q) => q.eq(q.field('isActive'), true))

    const agents = await query.order('desc').take(args.limit ?? 100)

    if (args.category) {
      return agents.filter((a) => a.category === args.category)
    }

    return agents
  },
})

// ========================================
// UNIFIED UPSERT (SINGLE SOURCE OF TRUTH)
// ========================================

/**
 * Upsert agent - THE single function for creating or updating agents
 *
 * Use this instead of:
 * - solanaSync.upsertAgentFromSolana
 * - realDataCollection.findOrCreateAgent
 * - agents.create
 */
export const upsert = internalMutation({
  args: {
    // Required
    address: v.string(),
    name: v.string(),

    // Optional - will use defaults if not provided
    description: v.optional(v.string()),
    source: v.optional(AgentSource),
    category: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    model: v.optional(v.string()),

    // Scoring (only used if creating new)
    ghostScore: v.optional(v.number()),
    tier: v.optional(AgentTier),

    // Flags
    isActive: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()),

    // Ownership
    ownerId: v.optional(v.id('users')),

    // Endpoints
    endpoints: v.optional(
      v.array(
        v.object({
          type: v.string(),
          url: v.string(),
        })
      )
    ),

    // Update behavior
    updateIfExists: v.optional(v.boolean()), // Default: true - update existing agent
    skipScoreUpdate: v.optional(v.boolean()), // Default: true - don't overwrite existing score
  },
  handler: async (ctx, args): Promise<{ agentId: unknown; created: boolean; updated: boolean }> => {
    const now = Date.now()
    const updateIfExists = args.updateIfExists !== false
    const skipScoreUpdate = args.skipScoreUpdate !== false

    // Check if agent already exists
    const existing = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.address))
      .first()

    if (existing) {
      if (!updateIfExists) {
        return { agentId: existing._id, created: false, updated: false }
      }

      // Build update object - only include provided fields
      const updates: Record<string, unknown> = {
        updatedAt: now,
      }

      if (args.name !== undefined) updates.name = args.name
      if (args.description !== undefined) updates.description = args.description
      if (args.category !== undefined) updates.category = args.category
      if (args.capabilities !== undefined) updates.capabilities = args.capabilities
      if (args.model !== undefined) updates.model = args.model
      if (args.isActive !== undefined) updates.isActive = args.isActive
      if (args.isVerified !== undefined) updates.isVerified = args.isVerified
      if (args.endpoints !== undefined) updates.endpoints = args.endpoints

      // Only update score if explicitly requested
      if (!skipScoreUpdate && args.ghostScore !== undefined) {
        updates.ghostScore = args.ghostScore
        updates.tier = args.tier ?? calculateTier(args.ghostScore)
      }

      await ctx.db.patch(existing._id, updates)

      return { agentId: existing._id, created: false, updated: true }
    }

    // Create new agent with defaults
    const ghostScore = args.ghostScore ?? 100
    const tier = args.tier ?? calculateTier(ghostScore)

    const agentId = await ctx.db.insert('agents', {
      address: args.address,
      name: args.name,
      description: args.description ?? `AI Agent at ${args.address.slice(0, 8)}...`,
      category: args.category ?? 'other',
      capabilities: args.capabilities ?? [],
      model: args.model,
      ghostScore,
      tier,
      isActive: args.isActive ?? true,
      isVerified: args.isVerified ?? false,
      ownerId: args.ownerId,
      endpoints: args.endpoints,
      createdAt: now,
      updatedAt: now,
    })

    // Create initial agent profile
    await ctx.scheduler.runAfter(0, internal.agentProfiles.updateMetrics, {
      agentId,
    })

    return { agentId, created: true, updated: false }
  },
})

/**
 * Update agent score and tier
 */
export const updateScore = internalMutation({
  args: {
    agentId: v.id('agents'),
    score: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get('agents', args.agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const tier = calculateTier(args.score)
    const oldScore = agent.ghostScore

    // Update agent
    await ctx.db.patch(args.agentId, {
      ghostScore: args.score,
      tier,
      updatedAt: Date.now(),
    })

    // Record history
    await ctx.db.insert('scoreHistory', {
      agentId: args.agentId,
      score: args.score,
      tier,
      reason: args.reason,
      timestamp: Date.now(),
    })

    return { oldScore, newScore: args.score, tier }
  },
})

/**
 * Batch upsert agents (for bulk imports)
 */
export const batchUpsert = internalMutation({
  args: {
    agents: v.array(
      v.object({
        address: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        source: v.optional(AgentSource),
        category: v.optional(v.string()),
        capabilities: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
    }

    for (const agentData of args.agents) {
      try {
        const existing = await ctx.db
          .query('agents')
          .withIndex('by_address', (q) => q.eq('address', agentData.address))
          .first()

        const now = Date.now()

        if (existing) {
          await ctx.db.patch(existing._id, {
            name: agentData.name,
            description: agentData.description ?? existing.description,
            category: agentData.category ?? existing.category,
            capabilities: agentData.capabilities ?? existing.capabilities,
            updatedAt: now,
          })
          results.updated++
        } else {
          await ctx.db.insert('agents', {
            address: agentData.address,
            name: agentData.name,
            description: agentData.description ?? `AI Agent at ${agentData.address.slice(0, 8)}...`,
            category: agentData.category ?? 'other',
            capabilities: agentData.capabilities ?? [],
            ghostScore: 100,
            tier: 'bronze',
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
          results.created++
        }
      } catch (error) {
        console.error(`Failed to upsert agent ${agentData.address}:`, error)
        results.failed++
      }
    }

    return results
  },
})

/**
 * Deactivate agent
 */
export const deactivate = internalMutation({
  args: {
    agentId: v.id('agents'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, {
      isActive: false,
      updatedAt: Date.now(),
    })

    // Log the deactivation
    await ctx.db.insert('trustEvents', {
      agentId: args.agentId,
      eventType: 'score_decrease',
      reason: args.reason ?? 'Agent deactivated',
      timestamp: Date.now(),
    })
  },
})

// ========================================
// HELPERS
// ========================================

/**
 * Calculate tier from ghost score
 */
function calculateTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (score >= 900) return 'platinum'
  if (score >= 750) return 'gold'
  if (score >= 500) return 'silver'
  return 'bronze'
}
