/**
 * Integration Tests: /api/observatory/endpoints
 *
 * Tests endpoint listing against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/observatory/endpoints/route')
  return module.GET
}

describe('GET /api/observatory/endpoints', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping endpoints tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns list of endpoints', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Response structure: { total, endpoints }
    expect(typeof data.total).toBe('number')
    expect(Array.isArray(data.endpoints)).toBe(true)
  })

  it.skipIf(skipWithoutConvex)('supports limit parameter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.endpoints.length).toBeLessThanOrEqual(5)
  })

  it.skipIf(skipWithoutConvex)('supports protocol filter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?protocol=x402')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned endpoints should have x402 protocol
    if (data.endpoints.length > 0) {
      data.endpoints.forEach((endpoint: { protocol: string }) => {
        expect(endpoint.protocol).toBe('x402')
      })
    }
  })

  it.skipIf(skipWithoutConvex)('supports minSuccessRate filter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?minSuccessRate=90')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned endpoints should have >= 90% success rate
    if (data.endpoints.length > 0) {
      data.endpoints.forEach((endpoint: { successRate: number }) => {
        expect(endpoint.successRate).toBeGreaterThanOrEqual(90)
      })
    }
  })

  it.skipIf(skipWithoutConvex)('supports minGhostScore filter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?minGhostScore=500')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Filtering by ghost score should work
    expect(Array.isArray(data.endpoints)).toBe(true)
  })

  it.skipIf(skipWithoutConvex)('returns endpoints with expected structure', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?limit=1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    if (data.endpoints.length > 0) {
      const endpoint = data.endpoints[0]

      // Verify endpoint structure
      expect(endpoint).toHaveProperty('id')
      expect(endpoint).toHaveProperty('url')
      expect(endpoint).toHaveProperty('protocol')
      expect(endpoint).toHaveProperty('successRate')
      expect(endpoint).toHaveProperty('totalCalls')
      expect(endpoint).toHaveProperty('verified')
    }
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toContain('s-maxage')
  })

  it.skipIf(skipWithoutConvex)('returns 400 for invalid limit', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?limit=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('handles large limit parameter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/endpoints?limit=500')
    const response = await GET(request)

    // API may clamp to max or return validation error
    expect([200, 400]).toContain(response.status)
  })
})
