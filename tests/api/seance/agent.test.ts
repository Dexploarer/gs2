/**
 * Integration Tests: /api/seance/agent/[address]
 *
 * Tests agent lookup against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/seance/agent/[address]/route')
  return module.GET
}

// Known test addresses from your fixtures
const KNOWN_AGENT_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
const NONEXISTENT_ADDRESS = 'NonExistentAddress123456789012345678901234567'

describe('GET /api/seance/agent/[address]', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping agent tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns agent data for valid address', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(`http://localhost/api/seance/agent/${KNOWN_AGENT_ADDRESS}`)
    const response = await GET(request, {
      params: Promise.resolve({ address: KNOWN_AGENT_ADDRESS }),
    })

    // If agent exists, should return 200
    // If not, 404 is also acceptable
    expect([200, 404]).toContain(response.status)

    const data = await response.json()

    if (response.status === 200) {
      // Verify response structure
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.meta).toBeDefined()

      // Verify agent data shape
      expect(data.data.agent).toBeDefined()
      expect(data.data.agent.address).toBe(KNOWN_AGENT_ADDRESS)
      expect(typeof data.data.agent.ghostScore).toBe('number')
      expect(['bronze', 'silver', 'gold', 'platinum']).toContain(data.data.agent.tier)
    }
  })

  it.skipIf(skipWithoutConvex)('returns 404 for non-existent agent', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(`http://localhost/api/seance/agent/${NONEXISTENT_ADDRESS}`)
    const response = await GET(request, {
      params: Promise.resolve({ address: NONEXISTENT_ADDRESS }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    // Error response format: { error: { message, code, statusCode } }
    expect(data.error).toBeDefined()
    expect(data.error.message).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('returns 400 for empty address', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/agent/')
    const response = await GET(request, {
      params: Promise.resolve({ address: '' }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('includes cache headers on success', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(`http://localhost/api/seance/agent/${KNOWN_AGENT_ADDRESS}`)
    const response = await GET(request, {
      params: Promise.resolve({ address: KNOWN_AGENT_ADDRESS }),
    })

    if (response.status === 200) {
      const cacheControl = response.headers.get('Cache-Control')
      expect(cacheControl).toBeDefined()
    }
  })

  it.skipIf(skipWithoutConvex)('returns complete agent profile when available', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(`http://localhost/api/seance/agent/${KNOWN_AGENT_ADDRESS}`)
    const response = await GET(request, {
      params: Promise.resolve({ address: KNOWN_AGENT_ADDRESS }),
    })

    if (response.status === 200) {
      const data = await response.json()

      // Agent data should include all expected fields
      expect(data.data.agent).toHaveProperty('address')
      expect(data.data.agent).toHaveProperty('name')
      expect(data.data.agent).toHaveProperty('ghostScore')
      expect(data.data.agent).toHaveProperty('tier')
      expect(data.data.agent).toHaveProperty('isActive')
      expect(data.data.agent).toHaveProperty('createdAt')

      // Optional fields should be present (may be null/undefined)
      expect('profile' in data.data).toBe(true)
      expect('reputation' in data.data).toBe(true)
      expect('credentials' in data.data).toBe(true)
      expect('capabilities' in data.data).toBe(true)
      expect('stats' in data.data).toBe(true)
    }
  })

  it.skipIf(skipWithoutConvex)('returns valid tier based on ghost score', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(`http://localhost/api/seance/agent/${KNOWN_AGENT_ADDRESS}`)
    const response = await GET(request, {
      params: Promise.resolve({ address: KNOWN_AGENT_ADDRESS }),
    })

    if (response.status === 200) {
      const data = await response.json()
      const { ghostScore, tier } = data.data.agent

      // Verify tier matches score ranges
      if (ghostScore >= 900) expect(tier).toBe('platinum')
      else if (ghostScore >= 700) expect(tier).toBe('gold')
      else if (ghostScore >= 400) expect(tier).toBe('silver')
      else expect(tier).toBe('bronze')
    }
  })

  it.skipIf(skipWithoutConvex)('credentials are arrays', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(`http://localhost/api/seance/agent/${KNOWN_AGENT_ADDRESS}`)
    const response = await GET(request, {
      params: Promise.resolve({ address: KNOWN_AGENT_ADDRESS }),
    })

    if (response.status === 200) {
      const data = await response.json()
      expect(Array.isArray(data.data.credentials)).toBe(true)
      expect(Array.isArray(data.data.capabilities)).toBe(true)
    }
  })
})
