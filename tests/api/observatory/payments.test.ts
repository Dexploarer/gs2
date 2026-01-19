/**
 * Integration Tests: /api/observatory/payments
 *
 * Tests payment listing, filtering, and statistics against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

const getRouteHandler = async () => {
  const module = await import('@/app/api/observatory/payments/route')
  return module.GET
}

describe('GET /api/observatory/payments', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping payments tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns list of payments', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Response structure: { total, volume, successRate, payments }
    expect(data.payments).toBeDefined()
    expect(Array.isArray(data.payments)).toBe(true)
    expect(typeof data.total).toBe('number')
  })

  it.skipIf(skipWithoutConvex)('supports pagination with limit', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments?limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.payments.length).toBeLessThanOrEqual(5)
  })

  it.skipIf(skipWithoutConvex)('filters payments by status', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments?status=completed')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned payments should be completed (if any)
    data.payments.forEach((payment: { status: string }) => {
      expect(payment.status).toBe('completed')
    })
  })

  it.skipIf(skipWithoutConvex)('returns payments with expected structure', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments?limit=1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    if (data.payments.length > 0) {
      const payment = data.payments[0]
      // Verify payment has key fields
      expect(payment).toHaveProperty('id')
      expect(payment).toHaveProperty('status')
      expect(['pending', 'completed', 'failed', 'processing']).toContain(payment.status)
    }
  })

  it.skipIf(skipWithoutConvex)('filters payments by network', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments?network=solana')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned payments should be on solana (if any)
    data.payments.forEach((payment: { network: string }) => {
      expect(payment.network).toBe('solana')
    })
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('includes volume and stats', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(typeof data.volume).toBe('number')
    expect(typeof data.successRate).toBe('number')
    expect(data.successRate).toBeGreaterThanOrEqual(0)
    expect(data.successRate).toBeLessThanOrEqual(100)
  })

  it.skipIf(skipWithoutConvex)('payment amounts are valid', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/payments?limit=10')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    data.payments.forEach((payment: { amount?: number }) => {
      if (payment.amount !== undefined) {
        expect(typeof payment.amount).toBe('number')
        expect(payment.amount).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
