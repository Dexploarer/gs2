/**
 * Vector Search Functions
 *
 * Implements semantic search and similarity matching using Convex vector indexes:
 * - Agent similarity search (find similar agents)
 * - Credential semantic search
 * - Merchant recommendations based on agent history
 * - Embedding generation via Vercel AI SDK
 */

import { action, internalAction, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { embed, createGateway } from 'ai'
import type { Id } from './_generated/dataModel'

// Type for agent data returned from internal query
interface AgentData {
  _id: Id<'agents'>
  name: string
  description: string
  descriptionEmbedding?: number[]
  capabilities: string[]
  tier: string
}

// Type for merchant data
interface MerchantData {
  _id: Id<'merchants'>
  name: string
  description: string
  descriptionEmbedding?: number[]
  capabilities: string[]
  category?: string
}

// Type for credential data
interface CredentialData {
  _id: Id<'credentials'>
  type: string
  claims: {
    name?: string
    capabilities?: string[]
  }
}

// Type for vector search result
interface VectorSearchResult {
  _id: Id<'agents'> | Id<'merchants'> | Id<'credentials'>
  _score: number
}

// ==========================================
// VECTOR SEARCH QUERIES
// ==========================================

/**
 * Find similar agents by description
 */
export const findSimilarAgents = action({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
    filterByTier: v.optional(
      v.union(v.literal('bronze'), v.literal('silver'), v.literal('gold'), v.literal('platinum'))
    ),
  },
  returns: v.array(
    v.object({
      agent: v.any(), // Full agent object from database
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate and clamp limit to Convex's 1-256 range
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 256)
    const minScore = args.minScore ?? 0.7

    // Get source agent
    const agentResult = await ctx.runQuery(internal.agents.getInternal, { agentId: args.agentId })
    const agent = agentResult as AgentData | null

    if (!agent || !agent.descriptionEmbedding) {
      throw new Error('Agent not found or missing embedding')
    }

    // Perform vector search (filters don't support complex boolean logic)
    const results = (await ctx.vectorSearch('agents', 'by_description_embedding', {
      vector: agent.descriptionEmbedding,
      limit: limit + 20, // Get extra to account for filtering
      filter: (q) => q.eq('isActive', true),
    })) as VectorSearchResult[]

    // Filter out the source agent and apply score threshold
    // Note: Vector search only returns _id and _score, not full document fields
    // Tier filtering would need to fetch full documents
    const similarAgents = results
      .filter((result: VectorSearchResult) => {
        if (result._id === args.agentId) return false
        if (result._score < minScore) return false
        return true
      })
      .slice(0, limit)
      .map((result: VectorSearchResult) => ({
        agent: result,
        score: result._score,
      }))

    return similarAgents
  },
})

/**
 * Search agents by text query (semantic search)
 */
export const searchAgentsByText = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
    filterByTier: v.optional(
      v.union(v.literal('bronze'), v.literal('silver'), v.literal('gold'), v.literal('platinum'))
    ),
  },
  returns: v.array(
    v.object({
      agent: v.any(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate and clamp limit to Convex's 1-256 range
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 256)
    const minScore = args.minScore ?? 0.5 // Lower default for text search (more permissive)

    // Generate embedding for query
    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, {
      text: args.query,
    })) as number[]

    // Perform vector search
    const results = (await ctx.vectorSearch('agents', 'by_description_embedding', {
      vector: embedding,
      limit: limit + 20, // Get extra to account for score filtering
      filter: (q) => q.eq('isActive', true),
    })) as VectorSearchResult[]

    // Apply score threshold and limit
    // Note: Tier filtering removed - vector search doesn't return full document fields
    return results
      .filter((result: VectorSearchResult) => {
        if (result._score < minScore) return false
        return true
      })
      .slice(0, limit)
      .map((result: VectorSearchResult) => ({
        agent: result,
        score: result._score,
      }))
  },
})

/**
 * Find similar merchants
 */
export const findSimilarMerchants = action({
  args: {
    merchantId: v.id('merchants'),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      merchant: v.any(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate and clamp limit to Convex's 1-256 range
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 256)
    const minScore = args.minScore ?? 0.7

    // Get source merchant
    const merchantResult = await ctx.runQuery(internal.merchants.getInternal, { merchantId: args.merchantId })
    const merchant = merchantResult as MerchantData | null

    if (!merchant || !merchant.descriptionEmbedding) {
      throw new Error('Merchant not found or missing embedding')
    }

    // Perform vector search
    const results = (await ctx.vectorSearch('merchants', 'by_description_embedding', {
      vector: merchant.descriptionEmbedding,
      limit: limit + 10, // Get extra to account for filtering
      filter: (q) => q.eq('isActive', true),
    })) as VectorSearchResult[]

    // Filter out source merchant and apply score threshold
    const similarMerchants = results
      .filter((result: VectorSearchResult) => result._id !== args.merchantId && result._score >= minScore)
      .slice(0, limit)
      .map((result: VectorSearchResult) => ({
        merchant: result,
        score: result._score,
      }))

    return similarMerchants
  },
})

/**
 * Search merchants by text query
 */
export const searchMerchantsByText = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      merchant: v.any(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate and clamp limit to Convex's 1-256 range
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 256)
    const minScore = args.minScore ?? 0.5 // Lower default for text search

    // Generate embedding for query
    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, {
      text: args.query,
    })) as number[]

    // Perform vector search
    const results = (await ctx.vectorSearch('merchants', 'by_description_embedding', {
      vector: embedding,
      limit: limit + 20, // Get extra to account for score filtering
      filter: (q) => q.eq('isActive', true),
    })) as VectorSearchResult[]

    // Apply score threshold and limit
    // Note: Category filtering removed - vector search only returns _id and _score
    return results
      .filter((result: VectorSearchResult) => result._score >= minScore)
      .slice(0, limit)
      .map((result: VectorSearchResult) => ({
        merchant: result,
        score: result._score,
      }))
  },
})

/**
 * Semantic credential search
 */
export const searchCredentialsByType = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      credential: v.any(),
      score: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate and clamp limit to Convex's 1-256 range
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 256)
    const minScore = args.minScore ?? 0.5 // Lower default for text search

    // Generate embedding for query
    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, {
      text: args.query,
    })) as number[]

    // Perform vector search
    const results = (await ctx.vectorSearch('credentials', 'by_type_embedding', {
      vector: embedding,
      limit: limit + 10, // Get extra to account for score filtering
      filter: (q) => q.eq('isRevoked', false),
    })) as VectorSearchResult[]

    // Apply score threshold and limit
    return results
      .filter((result: VectorSearchResult) => result._score >= minScore)
      .slice(0, limit)
      .map((result: VectorSearchResult) => ({
        credential: result,
        score: result._score,
      }))
  },
})

/**
 * Recommend merchants for agent based on transaction history and capabilities
 */
export const recommendMerchantsForAgent = action({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      merchant: v.any(),
      score: v.number(),
      matchReason: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate and clamp limit to Convex's 1-256 range
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 256)
    const minScore = args.minScore ?? 0.6 // Medium threshold for recommendations

    // Get agent details
    const agentResult = await ctx.runQuery(internal.agents.getInternal, { agentId: args.agentId })
    const agent = agentResult as AgentData | null

    if (!agent) {
      throw new Error('Agent not found')
    }

    // Build search query from agent capabilities
    const capabilitiesText = agent.capabilities.join(' ')
    const searchQuery = `${agent.description} ${capabilitiesText}`.trim()

    if (!searchQuery) {
      return []
    }

    // Generate embedding
    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, {
      text: searchQuery,
    })) as number[]

    // Vector search for matching merchants
    const results = (await ctx.vectorSearch('merchants', 'by_description_embedding', {
      vector: embedding,
      limit: limit + 10, // Get extra to account for score filtering
      filter: (q) => q.eq('isActive', true),
    })) as VectorSearchResult[]

    // Apply score threshold and limit
    return results
      .filter((result: VectorSearchResult) => result._score >= minScore)
      .slice(0, limit)
      .map((result: VectorSearchResult) => ({
        merchant: result,
        score: result._score,
        matchReason: 'Based on your capabilities and description',
      }))
  },
})

// ==========================================
// EMBEDDING GENERATION
// ==========================================

/**
 * Generate embedding for text via Vercel AI Gateway
 */
export const generateEmbedding = internalAction({
  args: {
    text: v.string(),
  },
  returns: v.array(v.float64()),
  handler: async (ctx, args) => {
    const apiKey = process.env.AI_GATEWAY_API_KEY

    if (!apiKey) {
      throw new Error('AI_GATEWAY_API_KEY not configured in Convex environment')
    }

    try {
      // Create AI Gateway with custom API key
      const gateway = createGateway({
        apiKey,
      })

      // Use Vercel AI Gateway for embeddings
      const { embedding } = await embed({
        model: gateway.embeddingModel('openai/text-embedding-3-small'),
        value: args.text.slice(0, 8000), // Limit to 8k chars
      })

      return embedding
    } catch (error) {
      console.error('[Vector Search] Failed to generate embedding:', error)
      throw error
    }
  },
})

/**
 * Generate and save embedding for agent
 */
export const generateAgentEmbedding = internalAction({
  args: {
    agentId: v.id('agents'),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const agentResult = await ctx.runQuery(internal.agents.getInternal, { agentId: args.agentId })
    const agent = agentResult as AgentData | null

    if (!agent) {
      throw new Error('Agent not found')
    }

    // Build text for embedding from agent data
    const text = `${agent.name}. ${agent.description}. Capabilities: ${agent.capabilities.join(', ')}`

    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, { text })) as number[]

    // Save embedding to agent
    await ctx.runMutation(internal.vectorSearch.saveAgentEmbedding, {
      agentId: args.agentId,
      embedding,
    })

    return { success: true }
  },
})

/**
 * Generate and save embedding for merchant
 */
export const generateMerchantEmbedding = internalAction({
  args: {
    merchantId: v.id('merchants'),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const merchantResult = await ctx.runQuery(internal.merchants.getInternal, { merchantId: args.merchantId })
    const merchant = merchantResult as MerchantData | null

    if (!merchant) {
      throw new Error('Merchant not found')
    }

    // Build text for embedding
    const text = `${merchant.name}. ${merchant.description}. Category: ${merchant.category || 'general'}. Capabilities: ${merchant.capabilities.join(', ')}`

    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, { text })) as number[]

    // Save embedding
    await ctx.runMutation(internal.vectorSearch.saveMerchantEmbedding, {
      merchantId: args.merchantId,
      embedding,
    })

    return { success: true }
  },
})

/**
 * Generate and save embedding for credential type
 */
export const generateCredentialEmbedding = internalAction({
  args: {
    credentialId: v.id('credentials'),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // Get credential directly from database
    const credentialResult = await ctx.runQuery(internal.vectorSearch.getCredentialById, {
      credentialId: args.credentialId,
    })
    const credential = credentialResult as CredentialData | null

    if (!credential) {
      throw new Error('Credential not found')
    }

    // Build text for embedding (handle optional fields)
    const claimsName = credential.claims?.name || ''
    const claimsCapabilities = credential.claims?.capabilities?.join(', ') || ''
    const text = `${credential.type}. ${claimsName}. Capabilities: ${claimsCapabilities}`.trim()

    const embedding = (await ctx.runAction(internal.vectorSearch.generateEmbedding, { text })) as number[]

    // Save embedding
    await ctx.runMutation(internal.vectorSearch.saveCredentialEmbedding, {
      credentialId: args.credentialId,
      embedding,
    })

    return { success: true }
  },
})

// Helper query to get credential by ID
export const getCredentialById = internalQuery({
  args: { credentialId: v.id('credentials') },
  handler: async (ctx, args) => {
    return await ctx.db.get('credentials', args.credentialId)
  },
})

// ==========================================
// EMBEDDING STORAGE MUTATIONS
// ==========================================

export const saveAgentEmbedding = internalMutation({
  args: {
    agentId: v.id('agents'),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    // Validate embedding dimensions (OpenAI text-embedding-3-small = 1536)
    if (args.embedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension: expected 1536, got ${args.embedding.length}`
      )
    }

    await ctx.db.patch('agents', args.agentId, {
      descriptionEmbedding: args.embedding,
      updatedAt: Date.now(),
    })
  },
})

export const saveMerchantEmbedding = internalMutation({
  args: {
    merchantId: v.id('merchants'),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    // Validate embedding dimensions (OpenAI text-embedding-3-small = 1536)
    if (args.embedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension: expected 1536, got ${args.embedding.length}`
      )
    }

    await ctx.db.patch('merchants', args.merchantId, {
      descriptionEmbedding: args.embedding,
      lastSeen: Date.now(),
    })
  },
})

export const saveCredentialEmbedding = internalMutation({
  args: {
    credentialId: v.id('credentials'),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    // Validate embedding dimensions (OpenAI text-embedding-3-small = 1536)
    if (args.embedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimension: expected 1536, got ${args.embedding.length}`
      )
    }

    await ctx.db.patch('credentials', args.credentialId, {
      typeEmbedding: args.embedding,
    })
  },
})

// ==========================================
// BATCH EMBEDDING GENERATION
// ==========================================

/**
 * Generate embeddings for all agents missing them
 */
export const generateMissingAgentEmbeddings = internalAction({
  args: {},
  returns: v.object({ generated: v.number() }),
  handler: async (ctx) => {
    const agents = await ctx.runQuery(internal.agents.listInternal, { limit: 1000 })

    const agentsNeedingEmbeddings = agents.filter((agent: any) => !agent.descriptionEmbedding)

    console.log(`[Vector Search] Generating embeddings for ${agentsNeedingEmbeddings.length} agents`)

    let generated = 0

    for (const agent of agentsNeedingEmbeddings) {
      try {
        await ctx.runAction(internal.vectorSearch.generateAgentEmbedding, {
          agentId: agent._id,
        })
        generated++
      } catch (error) {
        console.error(`Failed to generate embedding for agent ${agent._id}:`, error)
      }

      // Rate limit: 1 request per 100ms (10 req/sec to stay under OpenAI limits)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return { generated }
  },
})

/**
 * Generate embeddings for all merchants missing them
 */
export const generateMissingMerchantEmbeddings = internalAction({
  args: {},
  returns: v.object({ generated: v.number() }),
  handler: async (ctx) => {
    const merchants = await ctx.runQuery(internal.merchants.listInternal, { limit: 1000 })

    const merchantsNeedingEmbeddings = merchants.filter((merchant: any) => !merchant.descriptionEmbedding)

    console.log(
      `[Vector Search] Generating embeddings for ${merchantsNeedingEmbeddings.length} merchants`
    )

    let generated = 0

    for (const merchant of merchantsNeedingEmbeddings) {
      try {
        await ctx.runAction(internal.vectorSearch.generateMerchantEmbedding, {
          merchantId: merchant._id,
        })
        generated++
      } catch (error) {
        console.error(`Failed to generate embedding for merchant ${merchant._id}:`, error)
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return { generated }
  },
})
