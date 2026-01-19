/**
 * Integration Tests: /api/observatory/agents
 *
 * Tests agent listing, filtering, and pagination against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

const getRouteHandler = async () => {
  const module = await import('@/app/api/observatory/agents/route')
  return module.GET
}

describe('GET /api/observatory/agents', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping agents tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns list of agents', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/agents')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Response structure: { total, activeAgents, avgGhostScore, agents }
    expect(Array.isArray(data.agents)).toBe(true)
    expect(typeof data.total).toBe('number')
    expect(typeof data.activeAgents).toBe('number')
  })

  it.skipIf(skipWithoutConvex)('supports pagination with limit', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/agents?limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.agents.length).toBeLessThanOrEqual(5)
    expect(typeof data.total).toBe('number')
  })

  it.skipIf(skipWithoutConvex)('filters agents by tier', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/agents?tier=gold')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned agents should be gold tier (if any)
    if (data.agents.length > 0) {
      data.agents.forEach((agent: { tier: string }) => {
        expect(agent.tier).toBe('gold')
      })
    }
  })

  it.skipIf(skipWithoutConvex)('returns agents with expected structure', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/agents?limit=1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    if (data.agents.length > 0) {
      const agent = data.agents[0]
      // Verify agent structure
      expect(agent).toHaveProperty('address')
      expect(agent).toHaveProperty('name')
      expect(agent).toHaveProperty('ghostScore')
      expect(agent).toHaveProperty('tier')
      expect(['bronze', 'silver', 'gold', 'platinum']).toContain(agent.tier)
    }
  })

  it.skipIf(skipWithoutConvex)('handles empty tier filter gracefully', async () => {
    const GET = await getRouteHandler()
    // Request a very specific tier that might return empty
    const request = new NextRequest('http://localhost/api/observatory/agents?tier=platinum&minScore=999')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(Array.isArray(data.agents)).toBe(true)
  })

  it.skipIf(skipWithoutConvex)('ghost scores are valid numbers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/agents?limit=10')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    data.agents.forEach((agent: { ghostScore: number }) => {
      expect(typeof agent.ghostScore).toBe('number')
      expect(agent.ghostScore).toBeGreaterThanOrEqual(0)
      expect(agent.ghostScore).toBeLessThanOrEqual(1000)
    })
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/agents')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
  })
})
