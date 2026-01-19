/**
 * Seed Facilitators
 *
 * Populates the facilitators table with verified x402 MCP servers.
 * Data sourced from:
 * - https://facilitators.x402.watch/
 * - https://www.x402.org/ecosystem
 *
 * Last verified: January 2026
 */

import { internalMutation } from './_generated/server'

/**
 * Verified x402 MCP servers/facilitators
 * All URLs have been tested and respond with 2xx/3xx/4xx (server is up)
 */
const VERIFIED_FACILITATORS = [
  // ===========================================
  // TIER 1: Major/Official Facilitators
  // ===========================================
  {
    name: 'PayAI',
    slug: 'payai',
    description: 'Solana-first x402 facilitator with gasless transactions. Supports 10+ networks including Solana, Base, Polygon, Avalanche, Sei, and IoTeX.',
    facilitatorUrl: 'https://facilitator.payai.network',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia', 'polygon', 'avalanche'] as const,
    supportedTokens: ['USDC', 'SOL'],
    features: ['gasless', 'multi-chain', 'free', 'mcp-server', 'discovery-api'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.payai.network',
    githubUrl: 'https://github.com/payai-network',
    twitterHandle: 'PayAI_Network',
  },
  {
    name: 'Coinbase CDP',
    slug: 'coinbase-cdp',
    description: 'Coinbase Developer Platform x402 facilitator. Enterprise-grade with fee-free USDC transfers on Base and Solana.',
    facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia'] as const,
    supportedTokens: ['USDC'],
    features: ['fee-free-usdc', 'enterprise', 'bazaar-discovery', 'mcp-server'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.cdp.coinbase.com/x402',
    githubUrl: 'https://github.com/coinbase/cdp-sdk',
    twitterHandle: 'CoinbaseDev',
  },
  {
    name: 'Thirdweb',
    slug: 'thirdweb',
    description: 'Full-stack web3 development platform with x402 payment integration for Base and Polygon.',
    facilitatorUrl: 'https://api.thirdweb.com/v1/payments/x402',
    networks: ['base', 'polygon'] as const,
    supportedTokens: ['USDC'],
    features: ['sdk', 'multi-chain', 'developer-tools', 'enterprise'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://portal.thirdweb.com',
    githubUrl: 'https://github.com/thirdweb-dev',
    twitterHandle: 'thirdweb',
  },
  {
    name: 'Polygon',
    slug: 'polygon',
    description: 'Official Polygon x402 facilitator for native Polygon network support.',
    facilitatorUrl: 'https://x402.polygon.technology',
    networks: ['polygon'] as const,
    supportedTokens: ['USDC', 'MATIC'],
    features: ['native-polygon', 'low-fees', 'official'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://polygon.technology/developers',
    twitterHandle: '0xPolygon',
  },

  // ===========================================
  // TIER 2: Active Community Facilitators
  // ===========================================
  {
    name: 'x402.rs',
    slug: 'x402-rs',
    description: 'Rust-native x402 facilitator supporting Base, Solana, Avalanche, Polygon, Sei, and XDC networks.',
    facilitatorUrl: 'https://facilitator.x402.rs',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia', 'polygon', 'avalanche'] as const,
    supportedTokens: ['USDC', 'SOL'],
    features: ['rust-native', 'high-performance', 'multi-chain', 'open-source'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    githubUrl: 'https://github.com/x402-rs/facilitator',
  },
  {
    name: 'Heurist',
    slug: 'heurist',
    description: 'AI-focused x402 facilitator optimized for inference workloads on Base.',
    facilitatorUrl: 'https://facilitator.heurist.xyz',
    networks: ['base'] as const,
    supportedTokens: ['USDC'],
    features: ['ai-optimized', 'inference', 'low-latency'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.heurist.ai',
  },
  {
    name: 'OpenX402',
    slug: 'openx402',
    description: 'Open-source, permissionless x402 facilitator supporting Base and Solana.',
    facilitatorUrl: 'https://open.x402.host',
    networks: ['base', 'solana'] as const,
    supportedTokens: ['USDC'],
    features: ['open-source', 'permissionless', 'community'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },
  {
    name: 'Daydreams',
    slug: 'daydreams',
    description: 'x402 facilitator for AI agent systems and autonomous workflows.',
    facilitatorUrl: 'https://facilitator.daydreams.systems',
    networks: ['base', 'solana'] as const,
    supportedTokens: ['USDC'],
    features: ['ai-agents', 'autonomous', 'workflows'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://daydreams.systems/docs',
  },
  {
    name: 'Corbits',
    slug: 'corbits',
    description: 'Multi-chain x402 facilitator supporting Solana, Base, Monad, and Polygon.',
    facilitatorUrl: 'https://facilitator.corbits.dev',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia', 'polygon'] as const,
    supportedTokens: ['USDC'],
    features: ['multi-chain', 'monad-support', 'fast'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://corbits.dev',
  },
  {
    name: 'Dexter',
    slug: 'dexter',
    description: 'DeFi-focused x402 facilitator for Solana and Base networks.',
    facilitatorUrl: 'https://facilitator.dexter.cash',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia'] as const,
    supportedTokens: ['USDC'],
    features: ['defi-integration', 'fast', 'low-latency'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://dexter.cash',
  },
  {
    name: 'Mogami',
    slug: 'mogami',
    description: 'Base-focused x402 facilitator with reliable infrastructure.',
    facilitatorUrl: 'https://facilitator.mogami.tech',
    networks: ['base', 'base-sepolia'] as const,
    supportedTokens: ['USDC'],
    features: ['base-optimized', 'reliable', 'fast'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://mogami.tech',
  },
  {
    name: 'Nevermined',
    slug: 'nevermined',
    description: 'Data and AI marketplace x402 facilitator with advanced access control.',
    facilitatorUrl: 'https://api.live.nevermined.app',
    networks: ['base', 'base-sepolia'] as const,
    supportedTokens: ['USDC'],
    features: ['data-marketplace', 'ai-marketplace', 'access-control'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://docs.nevermined.io',
    githubUrl: 'https://github.com/nevermined-io',
  },
  {
    name: 'KAMIYO',
    slug: 'kamiyo',
    description: 'Multi-chain x402 facilitator supporting Base, Polygon, and Solana.',
    facilitatorUrl: 'https://kamiyo.ai/api/v1/x402',
    networks: ['base', 'polygon', 'solana'] as const,
    supportedTokens: ['USDC'],
    features: ['ai-platform', 'multi-chain', 'api'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://kamiyo.ai',
  },
  {
    name: 'Virtuals Protocol',
    slug: 'virtuals',
    description: 'AI agent protocol x402 facilitator for autonomous agent payments.',
    facilitatorUrl: 'https://acpx.virtuals.io',
    networks: ['base'] as const,
    supportedTokens: ['USDC'],
    features: ['ai-agents', 'autonomous', 'protocol'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://virtuals.io',
    twitterHandle: 'virtikimals',
  },
  {
    name: 'Treasure',
    slug: 'treasure',
    description: 'Gaming-focused x402 facilitator from Treasure ecosystem.',
    facilitatorUrl: 'https://x402.treasure.lol',
    networks: ['base', 'base-sepolia'] as const,
    supportedTokens: ['USDC'],
    features: ['gaming', 'nft', 'entertainment'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://treasure.lol',
    twitterHandle: 'Treasure_DAO',
  },
  {
    name: 'xEcho',
    slug: 'xecho',
    description: 'AI-powered x402 facilitator on Base network.',
    facilitatorUrl: 'https://www.xechoai.xyz',
    networks: ['base'] as const,
    supportedTokens: ['USDC'],
    features: ['ai-powered', 'base-native'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },
  {
    name: 'Hydra Protocol',
    slug: 'hydra',
    description: 'High-performance x402 facilitator for Base and Solana.',
    facilitatorUrl: 'https://hydraprotocol.org',
    networks: ['base', 'solana'] as const,
    supportedTokens: ['USDC'],
    features: ['high-performance', 'multi-chain'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },
  {
    name: '402104',
    slug: '402104',
    description: 'Load-balanced x402 facilitator infrastructure on Base.',
    facilitatorUrl: 'https://x402.load.network',
    networks: ['base'] as const,
    supportedTokens: ['USDC'],
    features: ['load-balanced', 'infrastructure'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },
  {
    name: 'AutoIncentive',
    slug: 'autoincentive',
    description: 'Incentive-optimized x402 facilitator for Solana and Base.',
    facilitatorUrl: 'https://autoincentive.online',
    networks: ['solana', 'solana-devnet', 'base', 'base-sepolia'] as const,
    supportedTokens: ['USDC'],
    features: ['incentives', 'optimization', 'multi-chain'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },
  {
    name: 'Kobaru',
    slug: 'kobaru',
    description: 'Solana-focused x402 facilitator with APAC optimization.',
    facilitatorUrl: 'https://www.kobaru.io',
    networks: ['solana', 'solana-devnet'] as const,
    supportedTokens: ['USDC'],
    features: ['solana-native', 'apac-optimized'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },
  {
    name: 'CodeNut',
    slug: 'codenut',
    description: 'Developer-focused x402 facilitator for Base and Solana.',
    facilitatorUrl: 'https://facilitator.codenut.ai',
    networks: ['base', 'solana'] as const,
    supportedTokens: ['USDC'],
    features: ['developer-tools', 'ai', 'coding'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
  },

  // ===========================================
  // TIER 3: Reference/Testnet Facilitators
  // ===========================================
  {
    name: 'x402.org',
    slug: 'x402-org',
    description: 'Official x402 protocol reference implementation and Bazaar discovery service.',
    facilitatorUrl: 'https://www.x402.org',
    networks: ['base', 'base-sepolia', 'solana-devnet'] as const,
    supportedTokens: ['USDC'],
    features: ['reference-implementation', 'discovery', 'bazaar', 'documentation'],
    pricing: { model: 'free' as const },
    status: 'active' as const,
    isVerified: true,
    documentationUrl: 'https://www.x402.org/docs',
    githubUrl: 'https://github.com/coinbase/x402',
  },
]

/**
 * Seed all verified facilitators into the database
 */
export const seedAllFacilitators = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let created = 0
    let updated = 0

    for (const facilitator of VERIFIED_FACILITATORS) {
      // Check if already exists
      const existing = await ctx.db
        .query('facilitators')
        .withIndex('by_slug', (q) => q.eq('slug', facilitator.slug))
        .unique()

      if (existing) {
        // Update existing facilitator
        await ctx.db.patch('facilitators', existing._id, {
          name: facilitator.name,
          description: facilitator.description,
          facilitatorUrl: facilitator.facilitatorUrl,
          networks: facilitator.networks as any,
          supportedTokens: facilitator.supportedTokens,
          features: facilitator.features,
          pricing: facilitator.pricing,
          status: facilitator.status,
          isVerified: facilitator.isVerified,
          documentationUrl: facilitator.documentationUrl,
          githubUrl: facilitator.githubUrl,
          twitterHandle: facilitator.twitterHandle,
          updatedAt: now,
        })
        updated++
      } else {
        // Insert new facilitator
        await ctx.db.insert('facilitators', {
          name: facilitator.name,
          slug: facilitator.slug,
          description: facilitator.description,
          facilitatorUrl: facilitator.facilitatorUrl,
          networks: facilitator.networks as any,
          supportedTokens: facilitator.supportedTokens,
          features: facilitator.features,
          pricing: facilitator.pricing,
          performance: {
            uptime: 0,
            avgResponseTime: 0,
            dailyVolume: 0,
            dailyTransactions: 0,
          },
          status: facilitator.status,
          isVerified: facilitator.isVerified,
          documentationUrl: facilitator.documentationUrl,
          githubUrl: facilitator.githubUrl,
          twitterHandle: facilitator.twitterHandle,
          createdAt: now,
          updatedAt: now,
        })
        created++
      }
    }

    console.log(`Facilitator seed complete: ${created} created, ${updated} updated`)

    return { created, updated, total: VERIFIED_FACILITATORS.length }
  },
})

/**
 * Remove facilitators not in the verified list
 */
export const removeUnverifiedFacilitators = internalMutation({
  args: {},
  handler: async (ctx) => {
    const verifiedSlugs = VERIFIED_FACILITATORS.map((f) => f.slug)

    const all = await ctx.db.query('facilitators').collect()
    let removed = 0

    for (const f of all) {
      if (!verifiedSlugs.includes(f.slug)) {
        // Also delete associated health records
        const healthRecords = await ctx.db
          .query('facilitatorHealth')
          .withIndex('by_facilitator', (q) => q.eq('facilitatorId', f._id))
          .collect()

        for (const h of healthRecords) {
          await ctx.db.delete('facilitatorHealth', h._id)
        }

        await ctx.db.delete('facilitators', f._id)
        console.log(`Removed facilitator: ${f.name} (${f.slug})`)
        removed++
      }
    }

    return { removed }
  },
})

/**
 * Clear all facilitators (for testing)
 */
export const clearAllFacilitators = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('facilitators').collect()

    for (const f of all) {
      await ctx.db.delete('facilitators', f._id)
    }

    return { deleted: all.length }
  },
})
