/**
 * Library Tests: PayAI Facilitator Client
 *
 * Tests PayAI client functionality including health checks, merchant discovery,
 * transaction collection, and activity tracking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PayAIClient, createPayAIClient } from '@/lib/facilitators/clients/payai'
import { mockAgentTransaction, mockX402Payment, mockTransactionList } from '../../fixtures/transactions'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PayAIClient', () => {
  let client: PayAIClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new PayAIClient({
      baseUrl: 'https://facilitator.payai.network',
      timeout: 5000,
      maxRetries: 2,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('constructor', () => {
    it('creates client with default config', () => {
      const defaultClient = new PayAIClient()
      expect(defaultClient.slug).toBe('payai')
      expect(defaultClient.baseUrl).toBe('https://facilitator.payai.network')
    })

    it('creates client with custom config', () => {
      const customClient = new PayAIClient({
        baseUrl: 'https://custom.payai.network',
        apiKey: 'test-api-key',
        timeout: 10000,
      })
      expect(customClient.baseUrl).toBe('https://custom.payai.network')
    })

    it('removes trailing slash from base URL', () => {
      const clientWithSlash = new PayAIClient({
        baseUrl: 'https://facilitator.payai.network/',
      })
      expect(clientWithSlash.baseUrl).toBe('https://facilitator.payai.network')
    })
  })

  describe('healthCheck', () => {
    it('returns healthy status when service is online', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      })

      const result = await client.healthCheck()

      expect(result.status).toBe('online')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
      expect(result.endpoint).toContain('/health')
    })

    it('returns degraded status for slow responses', async () => {
      // Simulate slow response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ status: 'ok' }),
                }),
              100
            )
          )
      )

      const result = await client.healthCheck()

      expect(result.status).toBe('online')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('returns offline status when service is down', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await client.healthCheck()

      expect(result.status).toBe('offline')
      expect(result.error).toBeDefined()
    })

    it('returns offline status for 5xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })

      const result = await client.healthCheck()

      // 5xx errors should result in offline status
      expect(['offline', 'degraded']).toContain(result.status)
    })
  })

  describe('discoverMerchants', () => {
    it('returns list of merchants', async () => {
      const mockMerchants = [
        {
          name: 'AI Text Service',
          description: 'Text generation API',
          network: 'solana',
          endpoints: [
            { url: 'https://api.example.com/generate', method: 'POST', price: 0.01 },
          ],
          capabilities: ['text-generation'],
        },
        {
          name: 'Image Analysis',
          description: 'Image analysis API',
          network: 'solana',
          endpoints: [
            { url: 'https://api.example.com/analyze', method: 'POST', price: 0.05 },
          ],
          capabilities: ['image-analysis'],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMerchants,
      })

      const merchants = await client.discoverMerchants()

      expect(merchants).toHaveLength(2)
      expect(merchants[0].name).toBe('AI Text Service')
      expect(merchants[0].endpoints).toHaveLength(1)
    })

    it('handles wrapped response with merchants array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          merchants: [{ name: 'Test Merchant', network: 'solana', endpoints: [] }],
        }),
      })

      const merchants = await client.discoverMerchants()

      expect(merchants).toHaveLength(1)
      expect(merchants[0].name).toBe('Test Merchant')
    })

    it('filters merchants by network', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { name: 'Solana Merchant', network: 'solana', endpoints: [] },
        ],
      })

      const merchants = await client.discoverMerchants('solana')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('network=solana'),
        expect.any(Object)
      )
    })

    it('returns empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const merchants = await client.discoverMerchants()

      expect(merchants).toEqual([])
    })
  })

  describe('getRecentTransactions', () => {
    it('returns list of transactions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            signature: 'txsig123',
            agent: 'agent123',
            amount: 0.05,
            timestamp: Date.now(),
            status: 'confirmed',
          },
        ],
      })

      const transactions = await client.getRecentTransactions()

      expect(transactions).toHaveLength(1)
      expect(transactions[0].txSignature).toBe('txsig123')
    })

    it('handles query options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })

      await client.getRecentTransactions({
        since: Date.now() - 3600000,
        limit: 50,
        network: 'solana',
        agentAddress: 'agent123',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/since=.*&limit=50&network=solana&agent=agent123/),
        expect.any(Object)
      )
    })

    it('parses transaction types correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { signature: 'tx1', type: 'refund', direction: 'inbound' },
          { signature: 'tx2', type: 'fee' },
          { signature: 'tx3', direction: 'outbound' },
          { signature: 'tx4' }, // Default to payment_received
        ],
      })

      const transactions = await client.getRecentTransactions()

      expect(transactions[0].type).toBe('refund')
      expect(transactions[1].type).toBe('fee')
      expect(transactions[2].type).toBe('payment_sent')
      expect(transactions[3].type).toBe('payment_received')
    })

    it('returns empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const transactions = await client.getRecentTransactions()

      expect(transactions).toEqual([])
    })
  })

  describe('getTransaction', () => {
    it('returns single transaction by signature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          signature: 'txsig123',
          agent: 'agent123',
          amount: 0.05,
          timestamp: Date.now(),
          status: 'confirmed',
        }),
      })

      const transaction = await client.getTransaction('txsig123')

      expect(transaction).not.toBeNull()
      expect(transaction?.txSignature).toBe('txsig123')
    })

    it('returns null for non-existent transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const transaction = await client.getTransaction('nonexistent')

      expect(transaction).toBeNull()
    })
  })

  describe('getAgentActivity', () => {
    it('returns agent activity records', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            agent: 'agent123',
            merchant: 'merchant456',
            endpoint: 'https://api.example.com/generate',
            responseTime: 150,
            success: true,
            timestamp: Date.now(),
          },
        ],
      })

      const activity = await client.getAgentActivity()

      expect(activity).toHaveLength(1)
      expect(activity[0].agentAddress).toBe('agent123')
      expect(activity[0].success).toBe(true)
    })

    it('marks failed activities correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            agent: 'agent123',
            success: false,
            error: 'Timeout exceeded',
            timestamp: Date.now(),
          },
        ],
      })

      const activity = await client.getAgentActivity()

      expect(activity[0].success).toBe(false)
      expect(activity[0].errorMessage).toBe('Timeout exceeded')
    })
  })

  describe('getStats', () => {
    it('returns facilitator statistics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dailyVolume: 1500.5,
          dailyTransactions: 250,
          totalVolume: 50000,
          totalTransactions: 10000,
          activeAgents: 150,
          activeMerchants: 25,
          avgResponseTime: 120,
          successRate: 0.98,
        }),
      })

      const stats = await client.getStats()

      expect(stats).not.toBeNull()
      expect(stats?.dailyVolume).toBe(1500.5)
      expect(stats?.activeAgents).toBe(150)
      expect(stats?.successRate).toBe(0.98)
    })

    it('handles alternative field names', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          volume24h: 1500,
          transactions24h: 250,
        }),
      })

      const stats = await client.getStats()

      expect(stats?.dailyVolume).toBe(1500)
      expect(stats?.dailyTransactions).toBe(250)
    })

    it('returns null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const stats = await client.getStats()

      expect(stats).toBeNull()
    })
  })

  describe('circuit breaker', () => {
    it('returns circuit state', () => {
      const state = client.getCircuitState()
      expect(['closed', 'open', 'half-open']).toContain(state)
    })

    it('resets circuit breaker', () => {
      client.resetCircuit()
      expect(client.getCircuitState()).toBe('closed')
    })
  })

  describe('factory function', () => {
    it('creates PayAI client with createPayAIClient', () => {
      const factoryClient = createPayAIClient({
        baseUrl: 'https://custom.payai.network',
      })

      expect(factoryClient).toBeInstanceOf(PayAIClient)
      expect(factoryClient.baseUrl).toBe('https://custom.payai.network')
    })
  })
})
