/**
 * Agent Capabilities Functions
 *
 * Track and verify agent capabilities
 */

import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Get capabilities for an agent
export const getByAgent = query({
  args: {
    agentId: v.id('agents'),
    verifiedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('agentCapabilities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))

    let capabilities = await query.collect()

    // Filter by verified status if requested
    if (args.verifiedOnly) {
      capabilities = capabilities.filter((c) => c.isVerified)
    }

    // Sort by usage count descending
    return capabilities.sort((a, b) => b.usageCount - a.usageCount)
  },
})

// Get capabilities by name
export const getByCapability = query({
  args: {
    capability: v.string(),
    minLevel: v.optional(
      v.union(
        v.literal('basic'),
        v.literal('intermediate'),
        v.literal('advanced'),
        v.literal('expert')
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const capabilities = await ctx.db
      .query('agentCapabilities')
      .withIndex('by_capability', (q) => q.eq('capability', args.capability))
      .collect()

    // Filter by minimum level if specified
    let filtered = capabilities
    if (args.minLevel) {
      const levelOrder = ['basic', 'intermediate', 'advanced', 'expert']
      const minLevelIndex = levelOrder.indexOf(args.minLevel)
      filtered = capabilities.filter((c) => levelOrder.indexOf(c.level) >= minLevelIndex)
    }

    // Sort by success rate descending
    const sorted = filtered.sort((a, b) => b.successRate - a.successRate)

    // Limit results
    const limited = sorted.slice(0, args.limit ?? 50)

    // Enrich with agent data
    return await Promise.all(
      limited.map(async (cap) => {
        const agent = await ctx.db.get('agents', cap.agentId)
        return {
          ...cap,
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

// Record capability usage
export const recordUsage = internalMutation({
  args: {
    agentId: v.id('agents'),
    capability: v.string(),
    responseTime: v.number(),
    success: v.boolean(),
    priceUSDC: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('agentCapabilities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.eq(q.field('capability'), args.capability))
      .first()

    const now = Date.now()

    if (existing) {
      // Update existing capability
      const newUsageCount = existing.usageCount + 1
      const successCount = existing.successRate * existing.usageCount / 100
      const newSuccessCount = args.success ? successCount + 1 : successCount
      const newSuccessRate = (newSuccessCount / newUsageCount) * 100

      // Update running average response time
      const newAvgResponseTime =
        (existing.avgResponseTime * existing.usageCount + args.responseTime) / newUsageCount

      // Calculate confidence based on usage count and success rate
      const newConfidence = Math.min(
        100,
        (newUsageCount / 100) * 50 + newSuccessRate * 0.5
      )

      await ctx.db.patch('agentCapabilities', existing._id, {
        usageCount: newUsageCount,
        successRate: newSuccessRate,
        avgResponseTime: newAvgResponseTime,
        confidence: newConfidence,
        lastUsedAt: now,
        priceUSDC: args.priceUSDC ?? existing.priceUSDC,
      })

      return existing._id
    } else {
      // Create new capability
      const successRate = args.success ? 100 : 0
      const confidence = 50 // Starting confidence

      return await ctx.db.insert('agentCapabilities', {
        agentId: args.agentId,
        capability: args.capability,
        level: 'basic', // Default level, can be upgraded
        confidence,
        usageCount: 1,
        successRate,
        avgResponseTime: args.responseTime,
        priceUSDC: args.priceUSDC ?? 0.01, // Default price
        demonstratedAt: now,
        lastUsedAt: now,
        isVerified: false,
        verifiedBy: undefined,
        verifiedAt: undefined,
        examples: undefined,
        limitations: undefined,
      })
    }
  },
})

// Verify a capability
export const verify = mutation({
  args: {
    agentId: v.id('agents'),
    capability: v.string(),
    verifiedBy: v.string(),
    level: v.optional(
      v.union(
        v.literal('basic'),
        v.literal('intermediate'),
        v.literal('advanced'),
        v.literal('expert')
      )
    ),
  },
  handler: async (ctx, args) => {
    const capabilityRecord = await ctx.db
      .query('agentCapabilities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.eq(q.field('capability'), args.capability))
      .first()

    if (!capabilityRecord) {
      throw new Error('Capability not found')
    }

    await ctx.db.patch('agentCapabilities', capabilityRecord._id, {
      isVerified: true,
      verifiedBy: args.verifiedBy,
      verifiedAt: Date.now(),
      level: args.level ?? capabilityRecord.level,
    })

    return capabilityRecord._id
  },
})

// Get capability statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allCapabilities = await ctx.db.query('agentCapabilities').collect()

    // Count unique capabilities
    const uniqueCapabilities = new Set(allCapabilities.map((c) => c.capability))

    // Count verified capabilities
    const verifiedCount = allCapabilities.filter((c) => c.isVerified).length

    // Calculate average success rate
    const avgSuccessRate =
      allCapabilities.reduce((sum, c) => sum + c.successRate, 0) /
      (allCapabilities.length || 1)

    // Count by level
    const levelCounts = allCapabilities.reduce(
      (acc, c) => {
        acc[c.level] = (acc[c.level] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Most popular capabilities
    const capabilityCounts = allCapabilities.reduce(
      (acc, c) => {
        acc[c.capability] = (acc[c.capability] || 0) + c.usageCount
        return acc
      },
      {} as Record<string, number>
    )

    const topCapabilities = Object.entries(capabilityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([capability, count]) => ({ capability, usageCount: count }))

    return {
      totalCapabilityRecords: allCapabilities.length,
      uniqueCapabilities: uniqueCapabilities.size,
      verifiedCount,
      avgSuccessRate: Math.round(avgSuccessRate),
      levelCounts,
      topCapabilities,
    }
  },
})

// Get verified capabilities for an agent (for W3C credentials)
export const getVerifiedForAgent = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const capabilities = await ctx.db
      .query('agentCapabilities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.eq(q.field('isVerified'), true))
      .collect()

    return capabilities.map((c) => ({
      capability: c.capability,
      level: c.level,
      confidence: c.confidence,
      successRate: c.successRate,
      usageCount: c.usageCount,
      verifiedBy: c.verifiedBy,
      verifiedAt: c.verifiedAt,
    }))
  },
})

// Update capability level based on performance
export const updateLevel = internalMutation({
  args: {
    agentId: v.id('agents'),
    capability: v.string(),
  },
  handler: async (ctx, args) => {
    const capabilityRecord = await ctx.db
      .query('agentCapabilities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.eq(q.field('capability'), args.capability))
      .first()

    if (!capabilityRecord) return

    // Auto-upgrade level based on performance
    let newLevel = capabilityRecord.level

    if (
      capabilityRecord.usageCount >= 1000 &&
      capabilityRecord.successRate >= 95 &&
      capabilityRecord.confidence >= 90
    ) {
      newLevel = 'expert'
    } else if (
      capabilityRecord.usageCount >= 500 &&
      capabilityRecord.successRate >= 90 &&
      capabilityRecord.confidence >= 80
    ) {
      newLevel = 'advanced'
    } else if (
      capabilityRecord.usageCount >= 100 &&
      capabilityRecord.successRate >= 85 &&
      capabilityRecord.confidence >= 70
    ) {
      newLevel = 'intermediate'
    }

    if (newLevel !== capabilityRecord.level) {
      await ctx.db.patch('agentCapabilities', capabilityRecord._id, {
        level: newLevel,
      })
    }
  },
})
