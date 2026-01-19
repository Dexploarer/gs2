/**
 * Agent management functions (Convex 1.31+ with validators)
 */

import { v } from 'convex/values'
import { query, mutation, internalQuery, action } from './_generated/server'
import { internal } from './_generated/api'

/**
 * Get agent by ID (internal - for other Convex functions)
 */
export const getInternal = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db.get('agents', args.agentId)
  },
})

/**
 * List all agents (internal - for other Convex functions)
 */
export const listInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .order('desc')
      .take(args.limit ?? 50)
  },
})

/**
 * List all agents (with pagination)
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .order('desc')
      .take(args.limit ?? 50)
  },
})

/**
 * Get agent by Solana address
 */
export const getByAddress = query({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.address))
      .unique()
  },
})

/**
 * Get agent by ID (explicit table name for security)
 */
export const get = query({
  args: { id: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db.get('agents', args.id)
  },
})

/**
 * Register new agent
 */
export const register = mutation({
  args: {
    address: v.string(),
    ownerId: v.id('users'),
    name: v.string(),
    description: v.string(),
    capabilities: v.array(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    return await ctx.db.insert('agents', {
      address: args.address,
      ownerId: args.ownerId,
      name: args.name,
      description: args.description,
      capabilities: args.capabilities,
      model: args.model,
      ghostScore: 250, // Starting score
      tier: 'bronze',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Get reputation votes for an agent
 */
export const getAgentVotes = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('reputationVotes')
      .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.agentId))
      .collect()
  },
})

/**
 * Create agent (for auto-discovery from webhooks)
 */
export const create = mutation({
  args: {
    address: v.string(),
    name: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    tier: v.optional(
      v.union(v.literal('bronze'), v.literal('silver'), v.literal('gold'), v.literal('platinum'))
    ),
    ghostScore: v.optional(v.number()),
    capabilities: v.optional(v.array(v.string())),
    verified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Check if agent already exists
    const existing = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.address))
      .unique()

    if (existing) {
      return existing._id
    }

    return await ctx.db.insert('agents', {
      address: args.address,
      name: args.name,
      description: args.description,
      category: args.category || 'other',
      capabilities: args.capabilities || [],
      ghostScore: args.ghostScore || 100,
      tier: args.tier || 'bronze',
      isActive: true,
      isVerified: args.verified || false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Get voter agent details (address) for votes
 */
export const getVoterDetails = query({
  args: { voterAgentId: v.id('agents') },
  handler: async (ctx, args) => {
    const voter = await ctx.db.get('agents', args.voterAgentId)
    return voter ? { address: voter.address, name: voter.name } : null
  },
})

/**
 * Get vote by ID
 */
export const getVoteById = query({
  args: { voteId: v.id('reputationVotes') },
  handler: async (ctx, args) => {
    return await ctx.db.get('reputationVotes', args.voteId)
  },
})

/**
 * Get transaction details for a vote
 */
export const getVoteTransaction = query({
  args: { transactionId: v.id('agentTransactions') },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get('agentTransactions', args.transactionId)
    return tx
      ? {
          signature: tx.txSignature,
          amount: tx.amountUSDC,
          timestamp: tx.timestamp,
        }
      : null
  },
})

/**
 * Get agents by category
 */
export const getByCategory = query({
  args: { category: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .filter((q) => q.eq(q.field('category'), args.category))
      .take(args.limit ?? 50)
  },
})

/**
 * Get category statistics
 */
export const getCategoryStats = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query('agents').collect()

    // Group by category
    const categoryMap = new Map<
      string,
      { count: number; totalScore: number; activeCount: number }
    >()

    for (const agent of agents) {
      const category = agent.category || 'uncategorized'
      const existing = categoryMap.get(category) || {
        count: 0,
        totalScore: 0,
        activeCount: 0,
      }
      categoryMap.set(category, {
        count: existing.count + 1,
        totalScore: existing.totalScore + agent.ghostScore,
        activeCount: existing.activeCount + (agent.isActive ? 1 : 0),
      })
    }

    // Convert to array
    return Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      agentCount: stats.count,
      averageScore: Math.round(stats.totalScore / stats.count),
      activeAgentCount: stats.activeCount,
    }))
  },
})

/**
 * Search agents by text (name/description)
 */
export const searchAgents = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query('agents').collect()
    const term = args.searchTerm.toLowerCase()

    // Simple text search (for production, use vector search)
    const matches = agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term) ||
        agent.capabilities.some((c) => c.toLowerCase().includes(term))
    )

    return matches.slice(0, args.limit ?? 20)
  },
})

/**
 * Search agents by address (prefix match)
 */
export const searchByAddress = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query('agents').collect()
    const queryLower = args.query.toLowerCase()

    // Filter agents by address prefix
    const matches = agents.filter(
      (agent) =>
        agent.address.toLowerCase().includes(queryLower) ||
        agent.name.toLowerCase().includes(queryLower)
    )

    // Sort by ghost score descending
    matches.sort((a, b) => b.ghostScore - a.ghostScore)

    return matches.slice(0, args.limit ?? 10)
  },
})

/**
 * Get file storage URL for avatar
 */
export const getAvatarUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Get agent metadata for GraphQL resolver
 */
export const getAgentMetadata = query({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.address))
      .unique()

    if (!agent) {
      return null
    }

    // Find website and twitter from endpoints
    const websiteEndpoint = agent.endpoints?.find((e) => e.type === 'website')
    const twitterEndpoint = agent.endpoints?.find((e) => e.type === 'twitter')

    return {
      description: agent.description,
      website: websiteEndpoint?.url ?? null,
      twitter: twitterEndpoint?.url ?? null,
      tags: agent.capabilities,
      nftAddress: null, // Would come from identity registry
      category: agent.category,
      name: agent.name,
      isVerified: agent.isVerified ?? false,
      tier: agent.tier,
      ghostScore: agent.ghostScore,
    }
  },
})

/**
 * Vector search for agents by semantic similarity
 * Uses OpenAI text-embedding-3-small (1536 dimensions)
 * Note: Vector search requires an action, not a query
 */
export const vectorSearchAgents = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
    filterActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: string
    address: string
    name: string
    description: string
    category?: string
    capabilities: string[]
    ghostScore: number
    tier: string
    isActive: boolean
    _score: number
  }>> => {
    // Vector search returns array of { _id, _score }
    const searchResults = await ctx.vectorSearch('agents', 'by_description_embedding', {
      vector: args.embedding,
      limit: args.limit ?? 10,
      filter: args.filterActive !== undefined
        ? (q) => q.eq('isActive', args.filterActive!)
        : undefined,
    })

    // Fetch full agent documents for each result
    const agentPromises = searchResults.map(async (result): Promise<{
      _id: string
      address: string
      name: string
      description: string
      category?: string
      capabilities: string[]
      ghostScore: number
      tier: string
      isActive: boolean
      _score: number
    } | null> => {
      const agent = await ctx.runQuery(internal.agents.getInternal, {
        agentId: result._id,
      })
      if (!agent) return null
      return {
        _id: agent._id,
        address: agent.address,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        capabilities: agent.capabilities,
        ghostScore: agent.ghostScore,
        tier: agent.tier,
        isActive: agent.isActive,
        _score: result._score,
      }
    })

    const agents = await Promise.all(agentPromises)
    return agents.filter((a): a is NonNullable<typeof a> => a !== null)
  },
})

/**
 * Update agent Ghost Score (explicit table name)
 */
export const updateScore = mutation({
  args: {
    id: v.id('agents'),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get('agents', args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }

    // Determine tier based on score
    let tier: 'bronze' | 'silver' | 'gold' | 'platinum'
    if (args.score >= 900) tier = 'platinum'
    else if (args.score >= 750) tier = 'gold'
    else if (args.score >= 500) tier = 'silver'
    else tier = 'bronze'

    // Update agent
    await ctx.db.patch('agents', args.id, {
      ghostScore: args.score,
      tier,
      updatedAt: Date.now(),
    })

    // Record history
    await ctx.db.insert('scoreHistory', {
      agentId: args.id,
      score: args.score,
      tier,
      timestamp: Date.now(),
    })

    return { score: args.score, tier }
  },
})
