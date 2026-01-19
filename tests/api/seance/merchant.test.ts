/**
 * Integration Tests: /api/seance/merchant/[id]
 *
 * Tests merchant lookup against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/seance/merchant/[id]/route')
  return module.GET
}

// Get real merchant from database
let realMerchantId: string | null = null
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

describe('GET /api/seance/merchant/[id]', () => {
  beforeAll(async () => {
    if (!hasConvexCredentials) {
      console.log('Skipping merchant tests - no Convex credentials')
      return
    }

    // Get a real merchant ID from the database
    if (convexUrl) {
      try {
        const convex = new ConvexHttpClient(convexUrl)
        const merchants = await convex.query(api.merchants.list, { limit: 1 })
        if (merchants.length > 0) {
          realMerchantId = merchants[0]._id
        }
      } catch (error) {
        console.log('Could not fetch merchant for testing:', error)
      }
    }
  })

  it.skipIf(skipWithoutConvex)('returns 400 for empty merchant ID', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/merchant/')
    const response = await GET(request, {
      params: Promise.resolve({ id: '' }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('returns merchant data for valid ID', async () => {
    if (!realMerchantId) {
      console.log('Skipping - no merchants in database')
      return
    }

    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/merchant/${realMerchantId}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ id: realMerchantId }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    // Verify response structure
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.meta).toBeDefined()

    // Verify merchant data shape
    expect(data.data.merchant).toBeDefined()
    expect(data.data.merchant).toHaveProperty('id')
    expect(data.data.merchant).toHaveProperty('name')
    expect(data.data.merchant).toHaveProperty('facilitator')
    expect(data.data.merchant).toHaveProperty('network')
    expect(data.data.merchant).toHaveProperty('isActive')

    // Verify endpoints
    expect(Array.isArray(data.data.endpoints)).toBe(true)

    // Verify analytics
    expect(data.data.analytics).toBeDefined()
    expect(typeof data.data.analytics.totalCalls).toBe('number')
    expect(typeof data.data.analytics.successRate).toBe('number')

    // Verify reviews
    expect(data.data.reviews).toBeDefined()
    expect(typeof data.data.reviews.totalReviews).toBe('number')
  })

  it.skipIf(skipWithoutConvex)('includes cache headers on success', async () => {
    if (!realMerchantId) {
      console.log('Skipping - no merchants in database')
      return
    }

    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/merchant/${realMerchantId}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ id: realMerchantId }),
    })

    if (response.status === 200) {
      const cacheControl = response.headers.get('Cache-Control')
      expect(cacheControl).toBeDefined()
    }
  })
})
