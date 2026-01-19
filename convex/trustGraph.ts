/**
 * Trust Graph - Web of Trust Implementation
 *
 * Implements PageRank-style authority scoring, trust path finding,
 * and transitive trust computation for the GhostSpeak reputation system.
 *
 * Key features:
 * - PageRank calculation for agent authority
 * - BFS-based trust path discovery
 * - Confidence decay over graph distance
 * - Sybil resistance indicators
 * - Integration with existing reputation scoring
 */

import { v } from 'convex/values'
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  internalAction,
} from './_generated/server'
import { internal, api } from './_generated/api'
import type { Id, Doc } from './_generated/dataModel'

// ========================================
// CONSTANTS
// ========================================

// PageRank parameters
const PAGERANK_DAMPING = 0.85 // Standard damping factor
const PAGERANK_ITERATIONS = 20 // Convergence iterations
const PAGERANK_CONVERGENCE = 0.0001 // Stop when change < this

// Trust decay parameters
const TRUST_DECAY_PER_HOP = 0.7 // Multiply confidence by this per hop
const MAX_TRUST_HOPS = 4 // Don't traverse beyond this
const TRUST_PATH_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

// Sybil detection thresholds
const CIRCULAR_ENDORSEMENT_PENALTY = 0.5 // Penalty per circular pattern
const MIN_ENDORSER_DIVERSITY = 3 // Need at least this many unique endorsers

// ========================================
// RELATIONSHIP MANAGEMENT
// ========================================

/**
 * Create or update a trust relationship
 */
export const upsertRelationship = mutation({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    relationshipType: v.union(
      v.literal('endorsement'),
      v.literal('attestation'),
      v.literal('transaction'),
      v.literal('computed'),
      v.literal('vote')
    ),
    directWeight: v.number(),
    categories: v.array(v.string()),
    sourceEndorsementId: v.optional(v.string()),
    sourceAttestationId: v.optional(v.id('agentAttestations')),
    sourceVoteId: v.optional(v.id('reputationVotes')),
  },
  handler: async (ctx, args) => {
    // Prevent self-endorsement
    if (args.fromAgentId === args.toAgentId) {
      throw new Error('Cannot create self-relationship')
    }

    // Validate weight
    if (args.directWeight < 0 || args.directWeight > 100) {
      throw new Error('Direct weight must be between 0 and 100')
    }

    const now = Date.now()

    // Check for existing relationship
    const existing = await ctx.db
      .query('trustRelationships')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) => q.eq(q.field('relationshipType'), args.relationshipType))
      .first()

    // Validate categories
    const validCategories = args.categories.filter((c) =>
      ['technical', 'reliability', 'quality', 'trustworthiness', 'collaboration', 'general'].includes(c)
    ) as Array<'technical' | 'reliability' | 'quality' | 'trustworthiness' | 'collaboration' | 'general'>

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        directWeight: args.directWeight,
        categories: validCategories,
        confidence: args.directWeight, // Direct relationships have confidence = weight
        updatedAt: now,
        isActive: true,
      })
      return existing._id
    }

    // Create new relationship
    return await ctx.db.insert('trustRelationships', {
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      relationshipType: args.relationshipType,
      directWeight: args.directWeight,
      categories: validCategories,
      pathDistance: 1, // Direct relationship
      confidence: args.directWeight,
      sourceEndorsementId: args.sourceEndorsementId,
      sourceAttestationId: args.sourceAttestationId,
      sourceVoteId: args.sourceVoteId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    })
  },
})

/**
 * Create or update a trust relationship (internal - for other Convex functions)
 */
export const upsertRelationshipInternal = internalMutation({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    relationshipType: v.union(
      v.literal('endorsement'),
      v.literal('attestation'),
      v.literal('transaction'),
      v.literal('computed'),
      v.literal('vote')
    ),
    directWeight: v.number(),
    categories: v.array(v.string()),
    sourceEndorsementId: v.optional(v.string()),
    sourceAttestationId: v.optional(v.id('agentAttestations')),
    sourceVoteId: v.optional(v.id('reputationVotes')),
  },
  handler: async (ctx, args) => {
    // Prevent self-endorsement
    if (args.fromAgentId === args.toAgentId) {
      return null // Silently ignore self-votes
    }

    // Validate weight
    const weight = Math.max(0, Math.min(100, args.directWeight))

    const now = Date.now()

    // Check for existing relationship
    const existing = await ctx.db
      .query('trustRelationships')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) => q.eq(q.field('relationshipType'), args.relationshipType))
      .first()

    // Validate categories
    const validCategories = args.categories.filter((c) =>
      ['technical', 'reliability', 'quality', 'trustworthiness', 'collaboration', 'general'].includes(c)
    ) as Array<'technical' | 'reliability' | 'quality' | 'trustworthiness' | 'collaboration' | 'general'>

    if (existing) {
      // Update existing - average the weights for repeated votes
      const newWeight = (existing.directWeight + weight) / 2
      await ctx.db.patch(existing._id, {
        directWeight: newWeight,
        categories: validCategories,
        confidence: newWeight,
        updatedAt: now,
        isActive: true,
      })
      return existing._id
    }

    // Create new relationship
    return await ctx.db.insert('trustRelationships', {
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      relationshipType: args.relationshipType,
      directWeight: weight,
      categories: validCategories,
      pathDistance: 1,
      confidence: weight,
      sourceEndorsementId: args.sourceEndorsementId,
      sourceAttestationId: args.sourceAttestationId,
      sourceVoteId: args.sourceVoteId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    })
  },
})

/**
 * Deactivate a trust relationship
 */
export const deactivateRelationship = mutation({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    relationshipType: v.string(),
  },
  handler: async (ctx, args) => {
    const relationship = await ctx.db
      .query('trustRelationships')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) => q.eq(q.field('relationshipType'), args.relationshipType))
      .first()

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        isActive: false,
        updatedAt: Date.now(),
      })
    }
  },
})

/**
 * Deactivate a trust relationship (internal - for other Convex functions)
 */
export const deactivateRelationshipInternal = internalMutation({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    relationshipType: v.string(),
  },
  handler: async (ctx, args) => {
    const relationship = await ctx.db
      .query('trustRelationships')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) => q.eq(q.field('relationshipType'), args.relationshipType))
      .first()

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        isActive: false,
        updatedAt: Date.now(),
      })
    }
  },
})

// ========================================
// PAGERANK CALCULATION
// ========================================

/**
 * Calculate PageRank for all agents in the trust graph
 * Called by cron job periodically
 */
export const calculatePageRank = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number; iterations: number }> => {
    console.log('[TrustGraph] Starting PageRank calculation...')

    // Get all active agents
    const agents = await ctx.runQuery(internal.trustGraph.getActiveAgents, {})
    const agentIds = agents.map((a) => a._id)

    if (agentIds.length === 0) {
      console.log('[TrustGraph] No agents to calculate PageRank for')
      return { updated: 0, iterations: 0 }
    }

    // Get all active relationships
    const relationships = await ctx.runQuery(internal.trustGraph.getActiveRelationships, {})

    // Build adjacency list (who endorses whom)
    const incomingEdges = new Map<string, Array<{ from: string; weight: number }>>()
    const outgoingCount = new Map<string, number>()

    for (const agentId of agentIds) {
      incomingEdges.set(agentId, [])
      outgoingCount.set(agentId, 0)
    }

    for (const rel of relationships) {
      const from = rel.fromAgentId
      const to = rel.toAgentId

      // Add incoming edge
      const incoming = incomingEdges.get(to) || []
      incoming.push({ from, weight: rel.directWeight / 100 })
      incomingEdges.set(to, incoming)

      // Count outgoing
      outgoingCount.set(from, (outgoingCount.get(from) || 0) + 1)
    }

    // Initialize PageRank scores
    const n = agentIds.length
    const initialScore = 1 / n
    let pageRank = new Map<string, number>()
    let newPageRank = new Map<string, number>()

    for (const agentId of agentIds) {
      pageRank.set(agentId, initialScore)
    }

    // Iterate until convergence
    let iteration = 0
    let maxChange = 1

    while (iteration < PAGERANK_ITERATIONS && maxChange > PAGERANK_CONVERGENCE) {
      maxChange = 0

      for (const agentId of agentIds) {
        // Sum of weighted incoming PageRank
        let sum = 0
        const incoming = incomingEdges.get(agentId) || []

        for (const edge of incoming) {
          const fromRank = pageRank.get(edge.from) || 0
          const fromOutCount = outgoingCount.get(edge.from) || 1
          // Weighted PageRank contribution
          sum += (fromRank * edge.weight) / fromOutCount
        }

        // PageRank formula with damping
        const newScore = (1 - PAGERANK_DAMPING) / n + PAGERANK_DAMPING * sum
        newPageRank.set(agentId, newScore)

        // Track max change
        const change = Math.abs(newScore - (pageRank.get(agentId) || 0))
        if (change > maxChange) maxChange = change
      }

      // Swap maps
      const temp = pageRank
      pageRank = newPageRank
      newPageRank = temp

      iteration++
    }

    console.log(`[TrustGraph] PageRank converged after ${iteration} iterations`)

    // Update metrics in database
    let updated = 0
    for (const agentId of agentIds) {
      const score = pageRank.get(agentId) || 0
      const incoming = incomingEdges.get(agentId) || []
      const outCount = outgoingCount.get(agentId) || 0

      await ctx.runMutation(internal.trustGraph.updateAgentMetrics, {
        agentId: agentId as Id<'agents'>,
        pageRank: score,
        pageRankNormalized: Math.round(score * n * 100), // Normalize to 0-100 scale
        inDegree: incoming.length,
        outDegree: outCount,
      })
      updated++
    }

    console.log(`[TrustGraph] Updated PageRank for ${updated} agents`)
    return { updated, iterations: iteration }
  },
})

/**
 * Get all active agents for PageRank
 */
export const getActiveAgents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('agents')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()
  },
})

/**
 * Get all active trust relationships
 */
export const getActiveRelationships = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('trustRelationships')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect()
  },
})

/**
 * Update agent's graph metrics
 */
export const updateAgentMetrics = internalMutation({
  args: {
    agentId: v.id('agents'),
    pageRank: v.number(),
    pageRankNormalized: v.number(),
    inDegree: v.number(),
    outDegree: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Get existing metrics
    const existing = await ctx.db
      .query('trustGraphMetrics')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    // Calculate sybil indicators
    const sybilIndicators = await calculateSybilIndicators(ctx, args.agentId)

    if (existing) {
      await ctx.db.patch(existing._id, {
        pageRank: args.pageRank,
        pageRankNormalized: args.pageRankNormalized,
        inDegree: args.inDegree,
        outDegree: args.outDegree,
        endorserDiversity: sybilIndicators.diversity,
        circularEndorsements: sybilIndicators.circular,
        sybilRiskScore: sybilIndicators.riskScore,
        calculatedAt: now,
        graphVersion: (existing.graphVersion || 0) + 1,
      })
    } else {
      await ctx.db.insert('trustGraphMetrics', {
        agentId: args.agentId,
        pageRank: args.pageRank,
        pageRankNormalized: args.pageRankNormalized,
        inDegree: args.inDegree,
        outDegree: args.outDegree,
        trustReach: 0, // Will be calculated separately
        endorserDiversity: sybilIndicators.diversity,
        circularEndorsements: sybilIndicators.circular,
        sybilRiskScore: sybilIndicators.riskScore,
        calculatedAt: now,
        graphVersion: 1,
      })
    }
  },
})

/**
 * Calculate Sybil resistance indicators for an agent
 */
async function calculateSybilIndicators(
  ctx: { db: any },
  agentId: Id<'agents'>
): Promise<{ diversity: number; circular: number; riskScore: number }> {
  // Get incoming endorsements
  const incoming = await ctx.db
    .query('trustRelationships')
    .withIndex('by_to', (q: any) => q.eq('toAgentId', agentId))
    .filter((q: any) => q.eq(q.field('isActive'), true))
    .collect()

  // Get outgoing endorsements
  const outgoing = await ctx.db
    .query('trustRelationships')
    .withIndex('by_from', (q: any) => q.eq('fromAgentId', agentId))
    .filter((q: any) => q.eq(q.field('isActive'), true))
    .collect()

  // Calculate diversity (unique endorsers)
  const uniqueEndorsers = new Set(incoming.map((r: any) => r.fromAgentId))
  const diversity = Math.min(100, (uniqueEndorsers.size / MIN_ENDORSER_DIVERSITY) * 100)

  // Detect circular endorsements (A endorses B, B endorses A)
  const outgoingSet = new Set(outgoing.map((r: any) => r.toAgentId))
  let circular = 0
  for (const rel of incoming) {
    if (outgoingSet.has(rel.fromAgentId)) {
      circular++
    }
  }

  // Calculate risk score
  let riskScore = 0

  // Low diversity = higher risk
  if (uniqueEndorsers.size < MIN_ENDORSER_DIVERSITY) {
    riskScore += 30
  }

  // Many circular endorsements = higher risk
  riskScore += Math.min(50, circular * 10)

  // Very high incoming with low outgoing = potential Sybil target
  if (incoming.length > 10 && outgoing.length < 2) {
    riskScore += 20
  }

  return {
    diversity: Math.round(diversity),
    circular,
    riskScore: Math.min(100, riskScore),
  }
}

// ========================================
// TRUST PATH FINDING
// ========================================

/**
 * Find trust path between two agents using BFS
 */
export const findTrustPath = query({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    maxHops: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    found: boolean
    path: string[]
    confidence: number
    distance: number
  } | null> => {
    const maxHops = args.maxHops ?? MAX_TRUST_HOPS

    if (args.fromAgentId === args.toAgentId) {
      return { found: true, path: [args.fromAgentId], confidence: 100, distance: 0 }
    }

    // Check cache first
    const cached = await ctx.db
      .query('trustPaths')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) =>
        q.and(q.eq(q.field('isValid'), true), q.gt(q.field('expiresAt'), Date.now()))
      )
      .first()

    if (cached) {
      return {
        found: true,
        path: cached.pathNodes,
        confidence: cached.aggregateConfidence,
        distance: cached.pathLength,
      }
    }

    // BFS to find shortest path
    const visited = new Set<string>()
    const queue: Array<{
      agentId: string
      path: string[]
      confidence: number
    }> = [{ agentId: args.fromAgentId, path: [args.fromAgentId], confidence: 100 }]

    visited.add(args.fromAgentId)

    while (queue.length > 0) {
      const current = queue.shift()!

      if (current.path.length > maxHops + 1) continue

      // Get outgoing relationships
      const relationships = await ctx.db
        .query('trustRelationships')
        .withIndex('by_from', (q) => q.eq('fromAgentId', current.agentId as Id<'agents'>))
        .filter((q) => q.eq(q.field('isActive'), true))
        .collect()

      for (const rel of relationships) {
        const nextAgent = rel.toAgentId

        if (visited.has(nextAgent)) continue

        const newConfidence = current.confidence * TRUST_DECAY_PER_HOP * (rel.directWeight / 100)
        const newPath = [...current.path, nextAgent]

        if (nextAgent === args.toAgentId) {
          // Found the target
          return {
            found: true,
            path: newPath,
            confidence: Math.round(newConfidence),
            distance: newPath.length - 1,
          }
        }

        visited.add(nextAgent)
        queue.push({
          agentId: nextAgent,
          path: newPath,
          confidence: newConfidence,
        })
      }
    }

    return { found: false, path: [], confidence: 0, distance: -1 }
  },
})

/**
 * Calculate transitive trust from one agent to another
 */
export const calculateTransitiveTrust = query({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
  },
  handler: async (ctx, args): Promise<{
    directTrust: number
    transitiveTrust: number
    combinedTrust: number
    pathInfo: { found: boolean; distance: number } | null
  }> => {
    // Check for direct relationship
    const direct = await ctx.db
      .query('trustRelationships')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) => q.eq(q.field('isActive'), true))
      .first()

    const directTrust = direct?.directWeight ?? 0

    // Find transitive path
    const path = await ctx.db
      .query('trustPaths')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .filter((q) => q.eq(q.field('isValid'), true))
      .first()

    const transitiveTrust = path?.aggregateConfidence ?? 0

    // Combine: direct trust is weighted more heavily
    const combinedTrust = Math.min(100, directTrust * 0.7 + transitiveTrust * 0.3)

    return {
      directTrust,
      transitiveTrust,
      combinedTrust: Math.round(combinedTrust),
      pathInfo: path ? { found: true, distance: path.pathLength } : null,
    }
  },
})

/**
 * Cache a trust path for faster future lookups
 */
export const cacheTrustPath = internalMutation({
  args: {
    fromAgentId: v.id('agents'),
    toAgentId: v.id('agents'),
    pathNodes: v.array(v.id('agents')),
    pathWeights: v.array(v.number()),
    aggregateConfidence: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Remove existing path
    const existing = await ctx.db
      .query('trustPaths')
      .withIndex('by_from_to', (q) =>
        q.eq('fromAgentId', args.fromAgentId).eq('toAgentId', args.toAgentId)
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }

    // Insert new path
    await ctx.db.insert('trustPaths', {
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      pathLength: args.pathNodes.length - 1,
      aggregateConfidence: args.aggregateConfidence,
      pathNodes: args.pathNodes,
      pathWeights: args.pathWeights,
      calculatedAt: now,
      expiresAt: now + TRUST_PATH_EXPIRY_MS,
      isValid: true,
    })
  },
})

// ========================================
// QUERIES
// ========================================

/**
 * Get trust graph metrics for an agent
 */
export const getMetrics = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('trustGraphMetrics')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()
  },
})

/**
 * Get top agents by PageRank
 */
export const getTopByPageRank = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query('trustGraphMetrics')
      .withIndex('by_pagerank')
      .order('desc')
      .take(args.limit ?? 50)

    // Enrich with agent data
    return Promise.all(
      metrics.map(async (m) => {
        const agent = await ctx.db.get('agents', m.agentId)
        return {
          ...m,
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
 * Get endorsers for an agent
 */
export const getEndorsers = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const relationships = await ctx.db
      .query('trustRelationships')
      .withIndex('by_to', (q) => q.eq('toAgentId', args.agentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    return Promise.all(
      relationships.map(async (rel) => {
        const endorser = await ctx.db.get('agents', rel.fromAgentId)
        return {
          ...rel,
          endorser: endorser
            ? {
                name: endorser.name,
                address: endorser.address,
                ghostScore: endorser.ghostScore,
              }
            : null,
        }
      })
    )
  },
})

/**
 * Get endorsements made by an agent
 */
export const getEndorsements = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const relationships = await ctx.db
      .query('trustRelationships')
      .withIndex('by_from', (q) => q.eq('fromAgentId', args.agentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    return Promise.all(
      relationships.map(async (rel) => {
        const endorsed = await ctx.db.get('agents', rel.toAgentId)
        return {
          ...rel,
          endorsed: endorsed
            ? {
                name: endorsed.name,
                address: endorsed.address,
                ghostScore: endorsed.ghostScore,
              }
            : null,
        }
      })
    )
  },
})

/**
 * Get agents with high Sybil risk
 */
export const getSybilRiskAgents = query({
  args: { minRisk: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const minRisk = args.minRisk ?? 50

    const metrics = await ctx.db
      .query('trustGraphMetrics')
      .withIndex('by_sybil_risk')
      .order('desc')
      .take(args.limit ?? 100)

    const filtered = metrics.filter((m) => m.sybilRiskScore >= minRisk)

    return Promise.all(
      filtered.map(async (m) => {
        const agent = await ctx.db.get('agents', m.agentId)
        return {
          ...m,
          agent: agent
            ? {
                name: agent.name,
                address: agent.address,
                ghostScore: agent.ghostScore,
              }
            : null,
        }
      })
    )
  },
})

// ========================================
// INTEGRATION WITH REPUTATION SCORING
// ========================================

/**
 * Get combined trust score (graph + traditional metrics)
 */
export const getCombinedTrustScore = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    // Get graph metrics
    const graphMetrics = await ctx.db
      .query('trustGraphMetrics')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()

    // Get traditional reputation score
    const reputation = await ctx.db
      .query('reputationScores')
      .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.agentId))
      .first()

    // Get agent
    const agent = await ctx.db.get('agents', args.agentId)

    if (!agent) return null

    // Combine scores
    const pageRankScore = graphMetrics?.pageRankNormalized ?? 0
    const traditionalScore = reputation?.overallScore ?? agent.ghostScore
    const sybilPenalty = graphMetrics ? (graphMetrics.sybilRiskScore / 100) * 0.2 : 0

    // Weighted combination: 30% PageRank, 70% traditional, minus Sybil penalty
    const combinedScore = Math.round(
      (pageRankScore * 0.3 + (traditionalScore / 10) * 0.7) * (1 - sybilPenalty)
    )

    return {
      agentId: args.agentId,
      pageRankScore,
      traditionalScore,
      sybilRiskScore: graphMetrics?.sybilRiskScore ?? 0,
      combinedScore: Math.max(0, Math.min(100, combinedScore)),
      graphMetrics,
      reputation,
    }
  },
})

// ========================================
// BATCH OPERATIONS
// ========================================

/**
 * Recalculate all trust paths (expensive, run daily)
 */
export const recalculateAllPaths = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[TrustGraph] Recalculating all trust paths...')

    // Invalidate all existing paths
    await ctx.runMutation(internal.trustGraph.invalidateAllPaths, {})

    // Get all agents
    const agents = await ctx.runQuery(internal.trustGraph.getActiveAgents, {})

    let pathsCreated = 0

    // For each pair of agents, calculate trust path if they're connected
    for (const from of agents) {
      const relationships = await ctx.runQuery(internal.trustGraph.getOutgoingRelationships, {
        agentId: from._id,
      })

      // BFS from this agent to find reachable agents
      const visited = new Set<string>()
      const queue: Array<{
        agentId: Id<'agents'>
        path: Id<'agents'>[]
        weights: number[]
        confidence: number
      }> = []

      visited.add(from._id)

      for (const rel of relationships) {
        queue.push({
          agentId: rel.toAgentId,
          path: [from._id, rel.toAgentId],
          weights: [rel.directWeight],
          confidence: rel.directWeight,
        })
        visited.add(rel.toAgentId)
      }

      while (queue.length > 0) {
        const current = queue.shift()!

        if (current.path.length > MAX_TRUST_HOPS + 1) continue

        // Cache this path
        await ctx.runMutation(internal.trustGraph.cacheTrustPath, {
          fromAgentId: from._id,
          toAgentId: current.agentId,
          pathNodes: current.path,
          pathWeights: current.weights,
          aggregateConfidence: Math.round(current.confidence),
        })
        pathsCreated++

        // Continue BFS
        const nextRelationships = await ctx.runQuery(
          internal.trustGraph.getOutgoingRelationships,
          { agentId: current.agentId }
        )

        for (const rel of nextRelationships) {
          if (visited.has(rel.toAgentId)) continue

          const newConfidence = current.confidence * TRUST_DECAY_PER_HOP * (rel.directWeight / 100)
          const newPath = [...current.path, rel.toAgentId]
          const newWeights = [...current.weights, rel.directWeight]

          visited.add(rel.toAgentId)
          queue.push({
            agentId: rel.toAgentId,
            path: newPath,
            weights: newWeights,
            confidence: newConfidence,
          })
        }
      }
    }

    console.log(`[TrustGraph] Created ${pathsCreated} trust paths`)
    return { pathsCreated }
  },
})

/**
 * Get outgoing relationships for an agent
 */
export const getOutgoingRelationships = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('trustRelationships')
      .withIndex('by_from', (q) => q.eq('fromAgentId', args.agentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()
  },
})

/**
 * Invalidate all cached trust paths
 */
export const invalidateAllPaths = internalMutation({
  args: {},
  handler: async (ctx) => {
    const paths = await ctx.db.query('trustPaths').collect()

    for (const path of paths) {
      await ctx.db.patch(path._id, { isValid: false })
    }

    return { invalidated: paths.length }
  },
})

/**
 * Clean up expired trust paths
 */
export const cleanupExpiredPaths = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    const expired = await ctx.db
      .query('trustPaths')
      .withIndex('by_expires')
      .filter((q) => q.lt(q.field('expiresAt'), now))
      .take(1000)

    for (const path of expired) {
      await ctx.db.delete(path._id)
    }

    return { deleted: expired.length }
  },
})
