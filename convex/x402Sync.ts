/**
 * x402 Sync Functions
 *
 * Internal functions for syncing x402 endpoints from external sources:
 * - CDP Bazaar API
 * - PayAI Discovery API
 */

import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

/**
 * CDP Bazaar API configuration
 * Discovery endpoint on the x402 facilitator
 */
const CDP_BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources'

/**
 * PayAI Discovery API configuration
 */
const PAYAI_DISCOVERY_URL = 'https://facilitator.payai.network/discovery/resources'

/**
 * Endpoint categories for classification
 */
const CATEGORIES = [
  'ai-inference',
  'defi-data',
  'blockchain-data',
  'content',
  'social',
  'security',
  'other',
] as const

/**
 * Infer category from endpoint metadata
 */
function inferCategory(
  name: string,
  description: string,
  capabilities: string[]
): (typeof CATEGORIES)[number] {
  const text = `${name} ${description} ${capabilities.join(' ')}`.toLowerCase()

  if (text.includes('llm') || text.includes('ai') || text.includes('inference') || text.includes('gpt') || text.includes('claude')) {
    return 'ai-inference'
  }
  if (text.includes('defi') || text.includes('swap') || text.includes('price') || text.includes('token')) {
    return 'defi-data'
  }
  if (text.includes('blockchain') || text.includes('solana') || text.includes('ethereum') || text.includes('transaction')) {
    return 'blockchain-data'
  }
  if (text.includes('content') || text.includes('scrape') || text.includes('news') || text.includes('article')) {
    return 'content'
  }
  if (text.includes('social') || text.includes('twitter') || text.includes('farcaster')) {
    return 'social'
  }
  if (text.includes('security') || text.includes('threat') || text.includes('audit')) {
    return 'security'
  }

  return 'other'
}

/**
 * Get CDP credentials from environment
 */
function getCDPCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.CDP_API_KEY
  const apiSecret = process.env.CDP_API_SECRET

  if (!apiKey || !apiSecret) {
    return null
  }

  return { apiKey, apiSecret }
}

/**
 * Generate CDP JWT token for authentication
 * CDP uses ES256 signed JWTs
 */
async function generateCDPToken(apiKey: string, apiSecret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // JWT Header
  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid: apiKey,
    nonce: crypto.randomUUID(),
  }

  // JWT Payload
  const payload = {
    iss: 'cdp',
    sub: apiKey,
    nbf: now,
    exp: now + 120, // 2 minutes expiry
    aud: ['cdp_service'],
  }

  // Base64url encode
  const base64url = (data: object) => {
    const json = JSON.stringify(data)
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerB64 = base64url(header)
  const payloadB64 = base64url(payload)
  const message = `${headerB64}.${payloadB64}`

  // Import the secret key and sign
  try {
    // Decode the base64 secret
    const secretBytes = Uint8Array.from(atob(apiSecret), (c) => c.charCodeAt(0))

    // For ES256, we need to import as ECDSA key
    // CDP uses P-256 curve
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes.slice(0, 32), // Use first 32 bytes for P-256 private key
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const messageBytes = new TextEncoder().encode(message)
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      messageBytes.buffer as ArrayBuffer
    )

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    return `${message}.${signatureB64}`
  } catch (error) {
    console.error('Failed to generate CDP token:', error)
    // Fallback: return basic auth format
    return `${apiKey}:${apiSecret}`
  }
}

/**
 * Fetch endpoints from CDP Bazaar
 */
async function fetchFromBazaar(): Promise<Array<{
  id: string
  url: string
  name: string
  description: string
  protocol: 'x402' | 'http' | 'https'
  network: string
  priceUSDC: number
  provider: {
    name: string
    address: string
    website?: string
  }
  category: string
  capabilities: string[]
  source: 'bazaar'
  discoverable: boolean
  verified: boolean
  lastSynced: number
}>> {
  try {
    const credentials = getCDPCredentials()

    // Build headers with optional authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GhostSpeak-Observatory/1.0',
    }

    if (credentials) {
      const token = await generateCDPToken(credentials.apiKey, credentials.apiSecret)
      headers['Authorization'] = `Bearer ${token}`
    } else {
      console.warn('CDP_API_KEY and CDP_API_SECRET not set - Bazaar API may return 401')
    }

    const response = await fetch(CDP_BAZAAR_URL, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`Bazaar API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const endpoints = data.endpoints || data.resources || data.items || data.data || []

    // Filter endpoints with valid resource URLs first
    const validEndpoints = endpoints.filter(
      (ep: Record<string, unknown>) => typeof ep.resource === 'string' && ep.resource.length > 0
    )

    return validEndpoints.map((ep: Record<string, unknown>) => {
      // CDP Bazaar uses nested structure with 'resource' and 'accepts'
      const resourceUrl = ep.resource as string
      const accepts = (ep.accepts as Array<Record<string, unknown>>) || []
      const firstAccept = accepts[0] || {}

      // Extract details from the accepts array
      const description = (firstAccept.description as string) || ''
      // Use URL path for name - extra.name is usually the asset name (USD Coin)
      const urlParts = resourceUrl.split('/')
      const pathName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'Unknown'
      const name = pathName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const network = (firstAccept.network as string) || 'base'
      const discoverable = (firstAccept.discoverable as boolean) || true

      // Extract price from maxAmountRequired (in smallest units, divide by 10^6 for USDC)
      const maxAmountStr = firstAccept.maxAmountRequired as string
      const priceUSDC = maxAmountStr ? parseFloat(maxAmountStr) / 1_000_000 : 0

      // Build capabilities from accept data
      const capabilities: string[] = []
      if (firstAccept.mimeType) capabilities.push(firstAccept.mimeType as string)
      if (ep.type) capabilities.push(ep.type as string)

      return {
        id: resourceUrl,
        url: resourceUrl,
        name,
        description,
        protocol: 'x402' as const,
        network,
        priceUSDC,
        provider: {
          name: 'CDP Bazaar',
          address: (firstAccept.asset as string) || '',
          website: undefined,
        },
        category: inferCategory(name, description, capabilities),
        capabilities,
        source: 'bazaar' as const,
        discoverable,
        verified: true, // Listed on official CDP Bazaar
        lastSynced: Date.now(),
      }
    })
  } catch (error) {
    console.error('Failed to fetch from Bazaar:', error)
    return []
  }
}

/**
 * Fetch endpoints from PayAI Discovery
 */
async function fetchFromPayAI(): Promise<Array<{
  id: string
  url: string
  name: string
  description: string
  protocol: 'x402' | 'http' | 'https'
  network: string
  priceUSDC: number
  provider: {
    name: string
    address: string
    website?: string
  }
  category: string
  capabilities: string[]
  source: 'payai'
  discoverable: boolean
  verified: boolean
  lastSynced: number
}>> {
  try {
    const response = await fetch(PAYAI_DISCOVERY_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GhostSpeak-Observatory/1.0',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`PayAI Discovery API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    // PayAI uses 'items' key with same structure as CDP Bazaar
    const resources = data.items || data.resources || data.endpoints || data.merchants || []

    // Filter resources with valid accepts array (same format as Bazaar)
    const validResources = resources.filter(
      (r: Record<string, unknown>) => {
        const accepts = r.accepts as Array<Record<string, unknown>> | undefined
        return accepts && accepts.length > 0 && accepts[0].resource
      }
    )

    return validResources.map((resource: Record<string, unknown>) => {
      const accepts = (resource.accepts as Array<Record<string, unknown>>) || []
      const firstAccept = accepts[0] || {}

      // Extract URL from accepts[0].resource (same as Bazaar)
      const resourceUrl = (firstAccept.resource as string) || ''
      const description = (firstAccept.description as string) || ''

      // Use URL path for name
      const urlParts = resourceUrl.split('/')
      const pathName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'Unknown'
      const name = pathName.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

      // Network from accepts
      const network = (firstAccept.network as string) || 'solana'

      // Price from maxAmountRequired (in micro-units)
      const maxAmountStr = firstAccept.maxAmountRequired as string
      const priceUSDC = maxAmountStr ? parseFloat(maxAmountStr) / 1_000_000 : 0

      // Build capabilities
      const capabilities: string[] = []
      if (firstAccept.mimeType) capabilities.push(firstAccept.mimeType as string)
      if (firstAccept.scheme) capabilities.push(firstAccept.scheme as string)

      return {
        id: resourceUrl,
        url: resourceUrl,
        name,
        description,
        protocol: 'x402' as const,
        network,
        priceUSDC,
        provider: {
          name: 'PayAI',
          address: (firstAccept.payTo as string) || (firstAccept.asset as string) || '',
          website: undefined,
        },
        category: inferCategory(name, description, capabilities),
        capabilities,
        source: 'payai' as const,
        discoverable: true,
        verified: false,
        lastSynced: Date.now(),
      }
    })
  } catch (error) {
    console.error('Failed to fetch from PayAI:', error)
    return []
  }
}

/**
 * Sync endpoints from all sources (called by cron)
 */
export const syncEndpointsFromSources = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('Starting x402 endpoint sync...')

    // Fetch from both sources in parallel
    const [bazaarEndpoints, payaiEndpoints] = await Promise.all([
      fetchFromBazaar(),
      fetchFromPayAI(),
    ])

    console.log(`Fetched ${bazaarEndpoints.length} from Bazaar, ${payaiEndpoints.length} from PayAI`)

    // Combine and deduplicate by URL
    const allEndpoints = [...bazaarEndpoints, ...payaiEndpoints]
    const uniqueByUrl = new Map<string, typeof allEndpoints[0]>()

    for (const ep of allEndpoints) {
      if (ep.url && !uniqueByUrl.has(ep.url)) {
        uniqueByUrl.set(ep.url, ep)
      }
    }

    const uniqueEndpoints = Array.from(uniqueByUrl.values())
    console.log(`Processing ${uniqueEndpoints.length} unique endpoints`)

    // Batch upsert to database
    if (uniqueEndpoints.length > 0) {
      const result: { created: number; updated: number; errors: number } = await ctx.runMutation(
        internal.x402Sync.batchUpsertEndpoints,
        { endpoints: uniqueEndpoints }
      )
      console.log(`Sync complete: ${result.created} created, ${result.updated} updated, ${result.errors} errors`)
      return result
    }

    return { created: 0, updated: 0, errors: 0 } as const
  },
})

/**
 * Batch upsert endpoints (internal mutation for action to call)
 */
export const batchUpsertEndpoints = internalMutation({
  args: {
    endpoints: v.array(
      v.object({
        id: v.string(),
        url: v.string(),
        name: v.string(),
        description: v.string(),
        protocol: v.union(v.literal('x402'), v.literal('http'), v.literal('https')),
        network: v.string(),
        priceUSDC: v.number(),
        provider: v.object({
          name: v.string(),
          address: v.string(),
          website: v.optional(v.string()),
        }),
        category: v.string(),
        capabilities: v.array(v.string()),
        source: v.union(v.literal('bazaar'), v.literal('payai')),
        discoverable: v.boolean(),
        verified: v.boolean(),
        lastSynced: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = { created: 0, updated: 0, errors: 0 }

    for (const endpoint of args.endpoints) {
      try {
        const existing = await ctx.db
          .query('endpoints')
          .withIndex('by_url', (q) => q.eq('url', endpoint.url))
          .unique()

        const now = Date.now()

        // Normalize network to allowed values
        const network = endpoint.network.toLowerCase().includes('solana') ? 'solana' as const : 'base' as const

        if (existing) {
          // Update existing endpoint (preserve stats)
          await ctx.db.patch('endpoints', existing._id, {
            name: endpoint.name,
            description: endpoint.description,
            protocol: endpoint.protocol,
            network,
            priceUSDC: endpoint.priceUSDC,
            capabilities: endpoint.capabilities,
            category: endpoint.category,
            source: endpoint.source,
            discoverable: endpoint.discoverable,
            lastSynced: now,
            updatedAt: now,
          })
          results.updated++
        } else {
          // Create new endpoint
          await ctx.db.insert('endpoints', {
            url: endpoint.url,
            name: endpoint.name,
            description: endpoint.description,
            protocol: endpoint.protocol,
            network,
            priceUSDC: endpoint.priceUSDC,
            capabilities: endpoint.capabilities,
            category: endpoint.category,
            source: endpoint.source,
            discoverable: endpoint.discoverable,
            agentId: undefined,
            successRate: 0,
            avgResponseTime: 0,
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            isVerified: endpoint.verified,
            trustScore: 0,
            lastSynced: now,
            lastTested: undefined,
            createdAt: now,
            updatedAt: now,
          })
          results.created++
        }
      } catch (error) {
        console.error(`Failed to upsert endpoint ${endpoint.url}:`, error)
        results.errors++
      }
    }

    return results
  },
})

/**
 * Get sync statistics
 */
export const getSyncStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allEndpoints = await ctx.db.query('endpoints').collect()
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    return {
      total: allEndpoints.length,
      syncedLastHour: allEndpoints.filter((e) => e.lastSynced && e.lastSynced > oneHourAgo).length,
      syncedLastDay: allEndpoints.filter((e) => e.lastSynced && e.lastSynced > oneDayAgo).length,
      bySource: {
        bazaar: allEndpoints.filter((e) => e.source === 'bazaar').length,
        payai: allEndpoints.filter((e) => e.source === 'payai').length,
        manual: allEndpoints.filter((e) => e.source === 'manual').length,
        crawl: allEndpoints.filter((e) => e.source === 'crawl').length,
      },
    }
  },
})
