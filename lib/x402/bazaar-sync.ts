/**
 * x402 Bazaar Sync Client
 *
 * Syncs endpoints from the CDP Bazaar Discovery Extension and PayAI.
 * Supports fetching, parsing, and normalizing endpoint data from multiple sources.
 */

import { FACILITATORS, X402_NETWORKS } from './config'

/**
 * CDP Bazaar endpoint format
 */
export interface BazaarEndpoint {
  id: string
  url: string
  name: string
  description?: string
  protocol: 'x402' | 'http' | 'https'
  network: string
  price: {
    amount: string
    asset: string
    assetAddress: string
  }
  provider?: {
    name: string
    address: string
    website?: string
  }
  category?: string
  capabilities?: string[]
  metadata?: Record<string, unknown>
  // Discovery Extension specific
  discoverable?: boolean
  verified?: boolean
  lastTested?: string
}

/**
 * PayAI merchant/endpoint format
 */
export interface PayAIMerchant {
  address: string
  name: string
  description?: string
  endpoints: Array<{
    path: string
    price: string
    description?: string
  }>
  network: 'solana' | 'solana-devnet'
  totalVolume?: string
  transactionCount?: number
}

/**
 * Normalized endpoint format for GhostSpeak
 */
export interface NormalizedEndpoint {
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
  source: 'bazaar' | 'payai' | 'manual' | 'crawl'
  discoverable: boolean
  verified: boolean
  lastSynced: number
}

/**
 * CDP Bazaar API client
 */
export class BazaarClient {
  private baseUrl: string
  private apiKey?: string

  constructor(options?: { apiKey?: string }) {
    this.baseUrl = FACILITATORS.COINBASE_CDP.url
    this.apiKey = options?.apiKey
  }

  /**
   * Fetch all endpoints from CDP Bazaar
   */
  async listEndpoints(): Promise<BazaarEndpoint[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(`${this.baseUrl}/list`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`Bazaar API error: ${response.status}`)
      }

      const data = await response.json()
      return data.endpoints || data || []
    } catch (error) {
      console.error('Failed to fetch Bazaar endpoints:', error)
      return []
    }
  }

  /**
   * Fetch endpoints using Discovery Extension protocol
   */
  async discoverResources(): Promise<BazaarEndpoint[]> {
    try {
      const response = await fetch(`${this.baseUrl}/discovery/resources`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`Discovery API error: ${response.status}`)
      }

      const data = await response.json()
      return data.resources || data || []
    } catch (error) {
      console.error('Failed to discover resources:', error)
      return []
    }
  }

  /**
   * Get endpoint details by ID
   */
  async getEndpoint(id: string): Promise<BazaarEndpoint | null> {
    try {
      const response = await fetch(`${this.baseUrl}/endpoints/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get endpoint:', error)
      return null
    }
  }
}

/**
 * PayAI merchant discovery client
 */
export class PayAIDiscoveryClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = FACILITATORS.PAYAI.url
  }

  /**
   * Discover active merchants on PayAI
   */
  async discoverMerchants(
    network: 'solana' | 'solana-devnet' = 'solana'
  ): Promise<PayAIMerchant[]> {
    try {
      const response = await fetch(`${this.baseUrl}/merchants`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Network': network,
        },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`PayAI API error: ${response.status}`)
      }

      const data = await response.json()
      return data.merchants || data || []
    } catch (error) {
      console.error('Failed to discover PayAI merchants:', error)
      return []
    }
  }

  /**
   * Get recent transactions for analytics
   */
  async getRecentTransactions(limit = 100): Promise<unknown[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/transactions/recent?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        }
      )

      if (!response.ok) {
        throw new Error(`PayAI API error: ${response.status}`)
      }

      const data = await response.json()
      return data.transactions || data || []
    } catch (error) {
      console.error('Failed to get PayAI transactions:', error)
      return []
    }
  }
}

/**
 * Normalize a Bazaar endpoint to GhostSpeak format
 */
export function normalizeBazaarEndpoint(
  endpoint: BazaarEndpoint
): NormalizedEndpoint {
  // Parse price to USDC (handle both string amounts and micro-units)
  let priceUSDC = 0
  if (endpoint.price?.amount) {
    const amount = parseFloat(endpoint.price.amount)
    // If amount is > 1000, assume it's in micro-units (6 decimals for USDC)
    priceUSDC = amount > 1000 ? amount / 1_000_000 : amount
  }

  return {
    id: endpoint.id || generateEndpointId(endpoint.url),
    url: endpoint.url,
    name: endpoint.name || extractNameFromUrl(endpoint.url),
    description: endpoint.description || '',
    protocol: endpoint.protocol || 'x402',
    network: endpoint.network || X402_NETWORKS.BASE_MAINNET,
    priceUSDC,
    provider: {
      name: endpoint.provider?.name || 'Unknown',
      address: endpoint.provider?.address || '',
      website: endpoint.provider?.website,
    },
    category: endpoint.category || categorizeEndpoint(endpoint.url, endpoint.name),
    capabilities: endpoint.capabilities || [],
    source: 'bazaar',
    discoverable: endpoint.discoverable ?? true,
    verified: endpoint.verified ?? false,
    lastSynced: Date.now(),
  }
}

/**
 * Normalize a PayAI merchant to GhostSpeak endpoints
 */
export function normalizePayAIMerchant(
  merchant: PayAIMerchant
): NormalizedEndpoint[] {
  return merchant.endpoints.map((ep, index) => ({
    id: `payai-${merchant.address}-${index}`,
    url: ep.path.startsWith('http')
      ? ep.path
      : `https://${merchant.address}${ep.path}`,
    name: merchant.name || extractNameFromUrl(ep.path),
    description: ep.description || merchant.description || '',
    protocol: 'x402' as const,
    network:
      merchant.network === 'solana'
        ? X402_NETWORKS.SOLANA_MAINNET
        : X402_NETWORKS.SOLANA_DEVNET,
    priceUSDC: parseFloat(ep.price) || 0,
    provider: {
      name: merchant.name,
      address: merchant.address,
    },
    category: categorizeEndpoint(ep.path, merchant.name),
    capabilities: [],
    source: 'payai' as const,
    discoverable: true,
    verified: false,
    lastSynced: Date.now(),
  }))
}

/**
 * Generate a deterministic ID for an endpoint URL
 */
function generateEndpointId(url: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(url)
  // Simple hash for deterministic ID
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i]
    hash |= 0
  }
  return `ep-${Math.abs(hash).toString(36)}`
}

/**
 * Extract a readable name from URL
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const host = urlObj.hostname.replace('www.', '')
    const path = urlObj.pathname.replace(/^\/|\/$/g, '')
    return path ? `${host}/${path}` : host
  } catch {
    return url.slice(0, 50)
  }
}

/**
 * Categorize endpoint based on URL and name patterns
 */
function categorizeEndpoint(url: string, name?: string): string {
  const text = `${url} ${name || ''}`.toLowerCase()

  // AI/ML
  if (
    text.includes('llm') ||
    text.includes('gpt') ||
    text.includes('claude') ||
    text.includes('inference') ||
    text.includes('ai') ||
    text.includes('chat') ||
    text.includes('completion')
  ) {
    return 'ai-inference'
  }

  // DeFi
  if (
    text.includes('price') ||
    text.includes('swap') ||
    text.includes('defi') ||
    text.includes('portfolio') ||
    text.includes('token')
  ) {
    return 'defi-data'
  }

  // Blockchain
  if (
    text.includes('block') ||
    text.includes('transaction') ||
    text.includes('wallet') ||
    text.includes('nft') ||
    text.includes('solana') ||
    text.includes('ethereum')
  ) {
    return 'blockchain-data'
  }

  // Content
  if (
    text.includes('news') ||
    text.includes('content') ||
    text.includes('scrape') ||
    text.includes('article')
  ) {
    return 'content'
  }

  // Social
  if (
    text.includes('social') ||
    text.includes('farcaster') ||
    text.includes('twitter') ||
    text.includes('x.com')
  ) {
    return 'social'
  }

  // Security
  if (
    text.includes('security') ||
    text.includes('threat') ||
    text.includes('audit') ||
    text.includes('vulnerability')
  ) {
    return 'security'
  }

  return 'other'
}

/**
 * Endpoint categories for filtering
 */
export const ENDPOINT_CATEGORIES = [
  { value: 'ai-inference', label: 'AI Inference' },
  { value: 'defi-data', label: 'DeFi Data' },
  { value: 'blockchain-data', label: 'Blockchain Data' },
  { value: 'content', label: 'Content' },
  { value: 'social', label: 'Social' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
] as const

export type EndpointCategory = (typeof ENDPOINT_CATEGORIES)[number]['value']

/**
 * Full sync of all endpoints from all sources
 */
export async function syncAllEndpoints(): Promise<NormalizedEndpoint[]> {
  const endpoints: NormalizedEndpoint[] = []

  // Sync from CDP Bazaar
  const bazaarClient = new BazaarClient()
  const [bazaarEndpoints, discoveredResources] = await Promise.all([
    bazaarClient.listEndpoints(),
    bazaarClient.discoverResources(),
  ])

  // Normalize Bazaar endpoints
  for (const ep of bazaarEndpoints) {
    endpoints.push(normalizeBazaarEndpoint(ep))
  }

  // Normalize discovered resources (dedupe by URL)
  const existingUrls = new Set(endpoints.map((e) => e.url))
  for (const ep of discoveredResources) {
    if (!existingUrls.has(ep.url)) {
      endpoints.push(normalizeBazaarEndpoint(ep))
      existingUrls.add(ep.url)
    }
  }

  // Sync from PayAI
  const payaiClient = new PayAIDiscoveryClient()
  const [mainnetMerchants, devnetMerchants] = await Promise.all([
    payaiClient.discoverMerchants('solana'),
    payaiClient.discoverMerchants('solana-devnet'),
  ])

  // Normalize PayAI merchants
  for (const merchant of [...mainnetMerchants, ...devnetMerchants]) {
    const normalized = normalizePayAIMerchant(merchant)
    for (const ep of normalized) {
      if (!existingUrls.has(ep.url)) {
        endpoints.push(ep)
        existingUrls.add(ep.url)
      }
    }
  }

  return endpoints
}
