/**
 * Integration Tests: /api/observatory/health
 *
 * Tests health check endpoint against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/observatory/health/route')
  return module.GET
}

describe('GET /api/observatory/health', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping health tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns overall health status', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    expect(response.status).toBe(200)
    const data = await response.json()

    // Verify response structure (no success wrapper - direct health response)
    expect(data.status).toBeDefined()
    expect(data.timestamp).toBeDefined()
    expect(typeof data.timestamp).toBe('number')
  })

  it.skipIf(skipWithoutConvex)('returns network health for solana and base', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    expect(response.status).toBe(200)
    const data = await response.json()

    // Should have networks object
    expect(data.networks).toBeDefined()
    expect(data.networks.solana).toBeDefined()
    expect(data.networks.base).toBeDefined()

    // Each network should have status and metrics
    expect(data.networks.solana.status).toBeDefined()
    expect(data.networks.base.status).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('returns convex health status', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    expect(response.status).toBe(200)
    const data = await response.json()

    // Should have convex status
    expect(data.convex).toBeDefined()
    expect(data.convex.status).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('returns facilitator health status', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    expect(response.status).toBe(200)
    const data = await response.json()

    // Should have facilitators object
    expect(data.facilitators).toBeDefined()
    expect(typeof data.facilitators).toBe('object')

    // If facilitators exist, they should have status and uptime
    const facilitatorKeys = Object.keys(data.facilitators)
    if (facilitatorKeys.length > 0) {
      const firstFacilitator = data.facilitators[facilitatorKeys[0]]
      expect(firstFacilitator.status).toBeDefined()
      expect(typeof firstFacilitator.uptime).toBe('number')
    }
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    expect(response.status).toBe(200)

    // Health endpoint should have short cache time
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toContain('s-maxage')
  })

  it.skipIf(skipWithoutConvex)('returns valid status values', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    const data = await response.json()

    // Status should be one of expected values
    const validStatuses = ['healthy', 'degraded', 'unhealthy', 'operational', 'online', 'offline']
    expect(validStatuses).toContain(data.status)
  })

  it.skipIf(skipWithoutConvex)('network metrics are reasonable', async () => {
    const GET = await getRouteHandler()
    const response = await GET()

    const data = await response.json()

    // Solana metrics should be reasonable
    if (data.networks?.solana?.tps) {
      expect(data.networks.solana.tps).toBeGreaterThanOrEqual(0)
    }
    if (data.networks?.solana?.uptime) {
      expect(data.networks.solana.uptime).toBeGreaterThanOrEqual(0)
      expect(data.networks.solana.uptime).toBeLessThanOrEqual(100)
    }

    // Base metrics should be reasonable
    if (data.networks?.base?.tps) {
      expect(data.networks.base.tps).toBeGreaterThanOrEqual(0)
    }
  })
})
