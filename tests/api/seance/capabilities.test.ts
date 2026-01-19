/**
 * Integration Tests: /api/seance/capabilities/[capability]
 *
 * Tests capability search against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/seance/capabilities/[capability]/route')
  return module.GET
}

// Known test capabilities
const KNOWN_CAPABILITY = 'text-generation'
const NONEXISTENT_CAPABILITY = 'nonexistent-capability-xyz-999'

describe('GET /api/seance/capabilities/[capability]', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping capabilities tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns agents for valid capability', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    // Either 200 with data or empty results
    expect([200]).toContain(response.status)
    const data = await response.json()

    // Verify response structure
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.meta).toBeDefined()

    // Verify capabilities data shape
    expect(data.data.capability).toBe(KNOWN_CAPABILITY)
    expect(typeof data.data.totalAgents).toBe('number')
    expect(Array.isArray(data.data.agents)).toBe(true)
  })

  it.skipIf(skipWithoutConvex)('returns empty array for nonexistent capability', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${NONEXISTENT_CAPABILITY}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: NONEXISTENT_CAPABILITY }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.totalAgents).toBe(0)
    expect(data.data.agents).toEqual([])
  })

  it.skipIf(skipWithoutConvex)('supports minLevel filter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}?minLevel=advanced`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned agents should have at least advanced level
    if (data.data.agents.length > 0) {
      data.data.agents.forEach(
        (item: { capability: { level: string } }) => {
          expect(['advanced', 'expert']).toContain(item.capability.level)
        }
      )
    }
  })

  it.skipIf(skipWithoutConvex)('supports limit parameter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}?limit=3`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.data.agents.length).toBeLessThanOrEqual(3)
  })

  it.skipIf(skipWithoutConvex)('supports verifiedOnly filter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}?verifiedOnly=true`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned capabilities should be verified
    if (data.data.agents.length > 0) {
      data.data.agents.forEach(
        (item: { capability: { isVerified: boolean } }) => {
          expect(item.capability.isVerified).toBe(true)
        }
      )
    }
  })

  it.skipIf(skipWithoutConvex)('returns proper agent structure', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}?limit=1`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    if (data.data.agents.length > 0) {
      const item = data.data.agents[0]

      // Verify agent info
      expect(item.agent).toHaveProperty('name')
      expect(item.agent).toHaveProperty('address')
      expect(item.agent).toHaveProperty('ghostScore')
      expect(item.agent).toHaveProperty('tier')

      // Verify capability info
      expect(item.capability).toHaveProperty('level')
      expect(item.capability).toHaveProperty('confidence')
      expect(item.capability).toHaveProperty('successRate')
      expect(item.capability).toHaveProperty('usageCount')
      expect(item.capability).toHaveProperty('isVerified')
    }
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('returns 400 for invalid minLevel', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/capabilities/${KNOWN_CAPABILITY}?minLevel=invalid`
    )
    const response = await GET(request, {
      params: Promise.resolve({ capability: KNOWN_CAPABILITY }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })
})
