/**
 * x402 Facilitator Registry Functions
 *
 * Manages facilitator information for the Observatory
 */

import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Network type for type safety
type Network = 'solana' | 'solana-devnet' | 'base' | 'base-sepolia' | 'avalanche' | 'polygon' | 'sei' | 'iotex' | 'peaq' | 'xlayer' | 'skale' | 'bnb' | 'bitcoin'

// Known x402 facilitators (as of January 2026)
const KNOWN_FACILITATORS = [
  {
    name: 'PayAI',
    slug: 'payai',
    description: 'Primary x402 facilitator for AI agent commerce. Supports Solana and Base networks with low fees and fast settlement.',
    facilitatorUrl: 'https://payai.network',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia'] as Network[],
    supportedTokens: ['USDC', 'SOL', 'ETH'],
    features: ['gasless', 'permissionless', 'multi-chain', 'instant-settlement', 'agent-discovery'],
    pricing: {
      model: 'percentage' as const,
      feePercentage: 0.005, // 0.5%
    },
    performance: {
      uptime: 99.9,
      avgResponseTime: 120,
      dailyVolume: 500000,
      dailyTransactions: 15000,
    },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.payai.network',
    githubUrl: 'https://github.com/payai-network',
    twitterHandle: 'payai_network',
  },
  {
    name: 'Coinbase CDP',
    slug: 'coinbase-cdp',
    description: 'Enterprise-grade x402 facilitator powered by Coinbase Developer Platform. Best for high-volume applications.',
    facilitatorUrl: 'https://cdp.coinbase.com',
    networks: ['base', 'base-sepolia', 'polygon', 'avalanche'] as Network[],
    supportedTokens: ['USDC', 'ETH', 'MATIC', 'AVAX'],
    features: ['enterprise', 'compliance', 'multi-chain', 'fiat-onramp', 'custody'],
    pricing: {
      model: 'percentage' as const,
      feePercentage: 0.003, // 0.3%
    },
    performance: {
      uptime: 99.95,
      avgResponseTime: 95,
      dailyVolume: 2000000,
      dailyTransactions: 50000,
    },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.cdp.coinbase.com/x402',
    githubUrl: 'https://github.com/coinbase/cdp-sdk',
    twitterHandle: 'CoinbaseDev',
  },
  {
    name: 'Thirdweb Pay',
    slug: 'thirdweb',
    description: 'Developer-friendly x402 facilitator with extensive SDK support and multi-chain capabilities.',
    facilitatorUrl: 'https://thirdweb.com/pay',
    networks: ['base', 'polygon', 'avalanche', 'bnb'] as Network[],
    supportedTokens: ['USDC', 'ETH', 'MATIC', 'BNB'],
    features: ['sdk', 'multi-chain', 'embedded-wallet', 'gasless-relay'],
    pricing: {
      model: 'percentage' as const,
      feePercentage: 0.01, // 1%
    },
    performance: {
      uptime: 99.8,
      avgResponseTime: 150,
      dailyVolume: 300000,
      dailyTransactions: 8000,
    },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://portal.thirdweb.com/pay',
    githubUrl: 'https://github.com/thirdweb-dev',
    twitterHandle: 'thirdweb',
  },
  {
    name: 'Rapid402',
    slug: 'rapid402',
    description: 'High-speed x402 facilitator optimized for low-latency AI inference payments.',
    facilitatorUrl: 'https://rapid402.io',
    networks: ['solana', 'solana-devnet'] as Network[],
    supportedTokens: ['USDC', 'SOL'],
    features: ['low-latency', 'permissionless', 'streaming-payments'],
    pricing: {
      model: 'fee-per-transaction' as const,
      flatFee: 0.001, // $0.001 per transaction
    },
    performance: {
      uptime: 99.5,
      avgResponseTime: 80,
      dailyVolume: 100000,
      dailyTransactions: 25000,
    },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.rapid402.io',
  },
  {
    name: 'KAMIYO',
    slug: 'kamiyo',
    description: 'Escrow-based x402 facilitator with oracle-powered dispute resolution for high-value AI transactions.',
    facilitatorUrl: 'https://kamiyo.ai',
    networks: ['solana', 'base'] as Network[],
    supportedTokens: ['USDC'],
    features: ['escrow', 'dispute-resolution', 'oracle-verification', 'milestone-payments'],
    pricing: {
      model: 'percentage' as const,
      feePercentage: 0.015, // 1.5%
    },
    performance: {
      uptime: 99.7,
      avgResponseTime: 200,
      dailyVolume: 50000,
      dailyTransactions: 1000,
    },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.kamiyo.ai',
    twitterHandle: 'kamiyo_ai',
  },
  {
    name: 'SATI',
    slug: 'sati',
    description: 'Solana Agent Trust Infrastructure - ERC-8004 compatible identity and reputation layer on Solana.',
    facilitatorUrl: 'https://sati.sol',
    networks: ['solana', 'solana-devnet'] as Network[],
    supportedTokens: ['USDC', 'SOL'],
    features: ['identity-registry', 'reputation', 'token-2022', 'sas-attestations'],
    pricing: {
      model: 'free' as const,
    },
    performance: {
      uptime: 99.6,
      avgResponseTime: 100,
      dailyVolume: 0, // Infrastructure layer
      dailyTransactions: 5000,
    },
    status: 'beta' as const,
    isVerified: true,
    documentationUrl: 'https://docs.sati.sol',
    githubUrl: 'https://github.com/sati-sol',
  },
  {
    name: 'Amiko',
    slug: 'amiko',
    description: 'Payment-as-reputation facilitator using volume-weighted average (VWA) algorithm for trust scoring.',
    facilitatorUrl: 'https://amiko.network',
    networks: ['base', 'polygon'] as Network[],
    supportedTokens: ['USDC', 'ETH'],
    features: ['vwa-reputation', 'payment-tracking', 'trust-scores'],
    pricing: {
      model: 'percentage' as const,
      feePercentage: 0.008, // 0.8%
    },
    performance: {
      uptime: 99.4,
      avgResponseTime: 130,
      dailyVolume: 75000,
      dailyTransactions: 3000,
    },
    status: 'beta' as const,
    isVerified: false,
    documentationUrl: 'https://docs.amiko.network',
  },
  {
    name: 'x402 TestNet',
    slug: 'x402-testnet',
    description: 'Official x402 protocol testnet facilitator for development and testing.',
    facilitatorUrl: 'https://testnet.x402.org',
    networks: ['solana-devnet', 'base-sepolia'] as Network[],
    supportedTokens: ['USDC'],
    features: ['testnet', 'faucet', 'sandbox'],
    pricing: {
      model: 'free' as const,
    },
    performance: {
      uptime: 99.0,
      avgResponseTime: 200,
      dailyVolume: 0, // Testnet
      dailyTransactions: 10000,
    },
    status: 'testnet-only' as const,
    isVerified: true,
    documentationUrl: 'https://x402.org/testnet',
  },
]

// Seed facilitators (internal - for initialization)
export const seedFacilitators = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let created = 0
    let skipped = 0

    for (const facilitator of KNOWN_FACILITATORS) {
      // Check if already exists
      const existing = await ctx.db
        .query('facilitators')
        .withIndex('by_slug', (q) => q.eq('slug', facilitator.slug))
        .unique()

      if (existing) {
        skipped++
        continue
      }

      // Insert new facilitator
      await ctx.db.insert('facilitators', {
        ...facilitator,
        createdAt: now,
        updatedAt: now,
      })
      created++
    }

    return { created, skipped, total: KNOWN_FACILITATORS.length }
  },
})

// List all facilitators
export const list = query({
  args: {
    limit: v.optional(v.number()),
    network: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('active'),
      v.literal('beta'),
      v.literal('testnet-only'),
      v.literal('deprecated')
    )),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    let facilitators

    if (args.status) {
      const status = args.status
      facilitators = await ctx.db
        .query('facilitators')
        .withIndex('by_status', (q) => q.eq('status', status))
        .take(limit)
    } else {
      facilitators = await ctx.db
        .query('facilitators')
        .take(limit)
    }

    // Filter by network if specified
    if (args.network) {
      const network = args.network
      return facilitators.filter((f) => f.networks.includes(network as any))
    }

    return facilitators
  },
})

// Get facilitator by slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('facilitators')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

// Get verified facilitators only
export const getVerified = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('facilitators')
      .withIndex('by_verified', (q) => q.eq('isVerified', true))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .take(args.limit ?? 20)
  },
})

// Get facilitator stats
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allFacilitators = await ctx.db.query('facilitators').collect()

    const active = allFacilitators.filter((f) => f.status === 'active')
    const verified = allFacilitators.filter((f) => f.isVerified)

    const totalDailyVolume = active.reduce((sum, f) => sum + f.performance.dailyVolume, 0)
    const totalDailyTransactions = active.reduce((sum, f) => sum + f.performance.dailyTransactions, 0)
    const avgUptime = active.length > 0
      ? active.reduce((sum, f) => sum + f.performance.uptime, 0) / active.length
      : 0

    const networkCoverage = new Set(
      allFacilitators.flatMap((f) => f.networks)
    ).size

    return {
      total: allFacilitators.length,
      active: active.length,
      verified: verified.length,
      totalDailyVolume,
      totalDailyTransactions,
      avgUptime,
      networkCoverage,
    }
  },
})

// Register new facilitator
export const register = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    facilitatorUrl: v.string(),
    networks: v.array(v.string()),
    supportedTokens: v.array(v.string()),
    features: v.array(v.string()),
    pricing: v.object({
      model: v.union(
        v.literal('free'),
        v.literal('fee-per-transaction'),
        v.literal('percentage')
      ),
      feePercentage: v.optional(v.number()),
      flatFee: v.optional(v.number()),
    }),
    documentationUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const facilitatorId = await ctx.db.insert('facilitators', {
      ...args,
      networks: args.networks as any,
      performance: {
        uptime: 0,
        avgResponseTime: 0,
        dailyVolume: 0,
        dailyTransactions: 0,
      },
      status: 'beta',
      isVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return facilitatorId
  },
})

// Update facilitator performance metrics
export const updatePerformance = mutation({
  args: {
    facilitatorId: v.id('facilitators'),
    uptime: v.optional(v.number()),
    avgResponseTime: v.optional(v.number()),
    dailyVolume: v.optional(v.number()),
    dailyTransactions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { facilitatorId, ...updates } = args
    const facilitator = await ctx.db.get('facilitators', facilitatorId)

    if (!facilitator) {
      throw new Error('Facilitator not found')
    }

    await ctx.db.patch('facilitators', facilitatorId, {
      performance: {
        ...facilitator.performance,
        ...updates,
      },
      updatedAt: Date.now(),
    })
  },
})

// Update facilitator status
export const updateStatus = mutation({
  args: {
    facilitatorId: v.id('facilitators'),
    status: v.union(
      v.literal('active'),
      v.literal('beta'),
      v.literal('testnet-only'),
      v.literal('deprecated')
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('facilitators', args.facilitatorId, {
      status: args.status,
      updatedAt: Date.now(),
    })
  },
})

// Verify facilitator
export const verify = mutation({
  args: {
    facilitatorId: v.id('facilitators'),
    isVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('facilitators', args.facilitatorId, {
      isVerified: args.isVerified,
      updatedAt: Date.now(),
    })
  },
})
