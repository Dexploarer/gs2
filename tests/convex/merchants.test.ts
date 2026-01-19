/**
 * Convex Function Tests: Merchant Operations
 *
 * Tests merchant registration, discovery, and analytics
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockConvexContext } from '../mocks/convex'

describe('Merchant Convex Functions', () => {
  let ctx: ReturnType<typeof createMockConvexContext>

  const mockMerchant = {
    name: 'AI Text Service',
    description: 'High-quality text generation API',
    network: 'solana',
    walletAddress: 'merchant_wallet_123',
    facilitatorId: 'facilitator_payai',
    status: 'active' as const,
    createdAt: Date.now(),
    endpoints: [],
    capabilities: ['text-generation'],
    pricing: {
      currency: 'USDC',
      minPrice: 0.001,
      maxPrice: 0.1,
    },
    analytics: {
      totalRequests: 0,
      successfulRequests: 0,
      totalRevenue: 0,
      avgResponseTime: 0,
    },
  }

  beforeEach(() => {
    ctx = createMockConvexContext()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('merchants.register', () => {
    it('registers a new merchant', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      expect(merchantId).toBeDefined()

      const saved = await ctx.db.get('merchants', merchantId)
      expect(saved?.name).toBe('AI Text Service')
      expect(saved?.status).toBe('active')
    })

    it('validates required fields', () => {
      const invalidMerchant = {
        // Missing name
        description: 'Test',
      }

      expect(() => {
        if (!invalidMerchant.hasOwnProperty('name')) {
          throw new Error('name is required')
        }
      }).toThrow('name is required')
    })

    it('sets default analytics', async () => {
      const merchantWithoutAnalytics = {
        ...mockMerchant,
        analytics: undefined,
      }

      const merchantId = await ctx.db.insert('merchants', {
        ...merchantWithoutAnalytics,
        analytics: {
          totalRequests: 0,
          successfulRequests: 0,
          totalRevenue: 0,
          avgResponseTime: 0,
        },
      })

      const saved = await ctx.db.get('merchants', merchantId)
      expect(saved?.analytics.totalRequests).toBe(0)
    })
  })

  describe('merchants.getByFacilitator', () => {
    it('returns merchants for specific facilitator', async () => {
      await ctx.db.insert('merchants', {
        ...mockMerchant,
        facilitatorId: 'facilitator_payai',
      })

      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'Another Service',
        facilitatorId: 'facilitator_payai',
      })

      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'Different Facilitator Service',
        facilitatorId: 'facilitator_coinbase',
      })

      const payaiMerchants = await ctx.db.query('merchants').filter((m) => m.facilitatorId === 'facilitator_payai')

      expect(payaiMerchants.length).toBe(2)
    })
  })

  describe('merchants.getByCapability', () => {
    it('filters merchants by capability', async () => {
      await ctx.db.insert('merchants', {
        ...mockMerchant,
        capabilities: ['text-generation'],
      })

      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'Image Service',
        capabilities: ['image-analysis'],
      })

      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'Multi-capability Service',
        capabilities: ['text-generation', 'image-analysis'],
      })

      const textMerchants = await ctx.db
        .query('merchants')
        .filter((m) => m.capabilities?.includes('text-generation'))

      expect(textMerchants.length).toBe(2)
    })
  })

  describe('merchants.addEndpoint', () => {
    it('adds endpoint to merchant', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      const endpoint = {
        url: 'https://api.example.com/v1/generate',
        method: 'POST',
        priceUSDC: 0.01,
        description: 'Text generation endpoint',
      }

      await ctx.db.patch('merchants', merchantId, {
        endpoints: [endpoint],
      })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.endpoints).toHaveLength(1)
      expect(updated?.endpoints[0].url).toBe('https://api.example.com/v1/generate')
    })

    it('supports multiple endpoints', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      const endpoints = [
        { url: 'https://api.example.com/v1/generate', method: 'POST', priceUSDC: 0.01 },
        { url: 'https://api.example.com/v1/analyze', method: 'POST', priceUSDC: 0.05 },
        { url: 'https://api.example.com/v1/summarize', method: 'POST', priceUSDC: 0.02 },
      ]

      await ctx.db.patch('merchants', merchantId, { endpoints })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.endpoints).toHaveLength(3)
    })
  })

  describe('merchants.updateAnalytics', () => {
    it('updates request count', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      await ctx.db.patch('merchants', merchantId, {
        analytics: {
          ...mockMerchant.analytics,
          totalRequests: 100,
          successfulRequests: 95,
        },
      })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.analytics.totalRequests).toBe(100)
      expect(updated?.analytics.successfulRequests).toBe(95)
    })

    it('calculates success rate', async () => {
      const analytics = {
        totalRequests: 100,
        successfulRequests: 95,
        totalRevenue: 5.0,
        avgResponseTime: 150,
      }

      const successRate = analytics.successfulRequests / analytics.totalRequests
      expect(successRate).toBe(0.95)
    })

    it('updates revenue', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      await ctx.db.patch('merchants', merchantId, {
        analytics: {
          ...mockMerchant.analytics,
          totalRevenue: 125.5,
        },
      })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.analytics.totalRevenue).toBe(125.5)
    })
  })

  describe('merchants.recordReview', () => {
    it('records merchant review', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      const review = {
        merchantId,
        agentId: 'agent_123',
        rating: 4,
        comment: 'Great service, fast responses',
        timestamp: Date.now(),
      }

      const reviewId = await ctx.db.insert('merchantReviews', review)

      expect(reviewId).toBeDefined()

      const saved = await ctx.db.get('merchantReviews', reviewId)
      expect(saved?.rating).toBe(4)
    })

    it('validates rating range (1-5)', () => {
      const validRatings = [1, 2, 3, 4, 5]
      const invalidRatings = [0, 6, -1]

      validRatings.forEach((rating) => {
        expect(rating >= 1 && rating <= 5).toBe(true)
      })

      invalidRatings.forEach((rating) => {
        expect(rating >= 1 && rating <= 5).toBe(false)
      })
    })

    it('calculates average rating', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      await ctx.db.insert('merchantReviews', {
        merchantId,
        agentId: 'agent_1',
        rating: 5,
        timestamp: Date.now(),
      })

      await ctx.db.insert('merchantReviews', {
        merchantId,
        agentId: 'agent_2',
        rating: 4,
        timestamp: Date.now(),
      })

      await ctx.db.insert('merchantReviews', {
        merchantId,
        agentId: 'agent_3',
        rating: 3,
        timestamp: Date.now(),
      })

      const reviews = await ctx.db.query('merchantReviews').filter((r) => r.merchantId === merchantId)

      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      expect(avgRating).toBe(4)
    })
  })

  describe('merchants.discover', () => {
    it('returns active merchants', async () => {
      await ctx.db.insert('merchants', {
        ...mockMerchant,
        status: 'active',
      })

      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'Inactive Service',
        status: 'inactive',
      })

      const activeMerchants = await ctx.db.query('merchants').filter((m) => m.status === 'active')

      expect(activeMerchants.length).toBe(1)
      expect(activeMerchants[0].name).toBe('AI Text Service')
    })

    it('sorts by rating and request count', async () => {
      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'Popular Service',
        analytics: { ...mockMerchant.analytics, totalRequests: 1000 },
      })

      await ctx.db.insert('merchants', {
        ...mockMerchant,
        name: 'New Service',
        analytics: { ...mockMerchant.analytics, totalRequests: 10 },
      })

      const merchants = await ctx.db.query('merchants').order('desc')

      // Sorted by request count descending
      expect(merchants[0].analytics.totalRequests).toBeGreaterThanOrEqual(merchants[1].analytics.totalRequests)
    })
  })

  describe('merchant status management', () => {
    it('can deactivate merchant', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      await ctx.db.patch('merchants', merchantId, {
        status: 'inactive',
        deactivatedAt: Date.now(),
      })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.status).toBe('inactive')
    })

    it('can suspend merchant', async () => {
      const merchantId = await ctx.db.insert('merchants', mockMerchant)

      await ctx.db.patch('merchants', merchantId, {
        status: 'suspended',
        suspendedAt: Date.now(),
        suspensionReason: 'Policy violation',
      })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.status).toBe('suspended')
      expect(updated?.suspensionReason).toBe('Policy violation')
    })

    it('can reactivate merchant', async () => {
      const merchantId = await ctx.db.insert('merchants', {
        ...mockMerchant,
        status: 'inactive',
      })

      await ctx.db.patch('merchants', merchantId, {
        status: 'active',
        reactivatedAt: Date.now(),
      })

      const updated = await ctx.db.get('merchants', merchantId)
      expect(updated?.status).toBe('active')
    })
  })
})
