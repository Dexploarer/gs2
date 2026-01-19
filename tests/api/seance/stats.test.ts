/**
 * Integration Tests: /api/seance/stats
 *
 * Tests network statistics endpoint against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/seance/stats/route')
  return module.GET
}

describe('GET /api/seance/stats', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping stats tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns network statistics from real data', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/stats')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Verify response structure
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.meta).toBeDefined()
    expect(data.meta.timestamp).toBeDefined()

    // Verify data shape matches NetworkStatsResponse
    expect(data.data.agents).toBeDefined()
    expect(typeof data.data.agents.total).toBe('number')
    expect(typeof data.data.agents.active).toBe('number')
    expect(typeof data.data.agents.avgGhostScore).toBe('number')

    expect(data.data.transactions).toBeDefined()
    expect(typeof data.data.transactions.totalVolume).toBe('number')
    expect(typeof data.data.transactions.totalCount).toBe('number')

    expect(data.data.credentials).toBeDefined()
    expect(data.data.merchants).toBeDefined()
    expect(data.data.facilitators).toBeDefined()
    expect(data.data.trending).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('returns proper facilitator counts', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/stats')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Facilitators should have total and online counts
    expect(typeof data.data.facilitators.total).toBe('number')
    expect(typeof data.data.facilitators.online).toBe('number')
    expect(data.data.facilitators.online).toBeLessThanOrEqual(data.data.facilitators.total)
  })

  it.skipIf(skipWithoutConvex)('includes trending agents data', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/stats')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.data.trending).toBeDefined()
    expect(Array.isArray(data.data.trending.topAgents)).toBe(true)

    // If there are trending agents, verify their structure
    if (data.data.trending.topAgents.length > 0) {
      const agent = data.data.trending.topAgents[0]
      expect(agent.name).toBeDefined()
      expect(agent.address).toBeDefined()
      expect(typeof agent.ghostScore).toBe('number')
    }
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/stats')
    const response = await GET(request)

    expect(response.status).toBe(200)

    // Check for cache control headers
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toContain('s-maxage')
  })

  it.skipIf(skipWithoutConvex)('returns consistent data types', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/stats')
    const response = await GET(request)

    const data = await response.json()

    // All numeric fields should be numbers (not strings)
    expect(typeof data.data.agents.total).toBe('number')
    expect(typeof data.data.agents.active).toBe('number')
    expect(typeof data.data.transactions.totalVolume).toBe('number')
    expect(typeof data.data.transactions.successRate).toBe('number')
    expect(typeof data.data.credentials.total).toBe('number')
    expect(typeof data.data.merchants.total).toBe('number')
  })
})
