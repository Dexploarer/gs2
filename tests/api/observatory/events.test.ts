/**
 * Integration Tests: /api/observatory/events
 *
 * Tests trust events against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/observatory/events/route')
  return module.GET
}

describe('GET /api/observatory/events', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping events tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns list of events', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Response structure: { total, events }
    expect(typeof data.total).toBe('number')
    expect(Array.isArray(data.events)).toBe(true)
  })

  it.skipIf(skipWithoutConvex)('supports limit parameter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events?limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.events.length).toBeLessThanOrEqual(5)
  })

  it.skipIf(skipWithoutConvex)('supports eventType filter', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events?eventType=score_increase')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // All returned events should have score_increase type
    if (data.events.length > 0) {
      data.events.forEach((event: { eventType: string }) => {
        expect(event.eventType).toBe('score_increase')
      })
    }
  })

  it.skipIf(skipWithoutConvex)('returns events with expected structure', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events?limit=1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    if (data.events.length > 0) {
      const event = data.events[0]

      // Verify event structure
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('agentId')
      expect(event).toHaveProperty('eventType')
      expect(event).toHaveProperty('timestamp')
    }
  })

  it.skipIf(skipWithoutConvex)('includes cache headers', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toContain('s-maxage')
  })

  it.skipIf(skipWithoutConvex)('events are sorted by timestamp (most recent first)', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events?limit=10')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    if (data.events.length > 1) {
      // Verify events are sorted by timestamp descending
      for (let i = 0; i < data.events.length - 1; i++) {
        expect(data.events[i].timestamp).toBeGreaterThanOrEqual(data.events[i + 1].timestamp)
      }
    }
  })

  it.skipIf(skipWithoutConvex)('returns 400 for invalid eventType', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/observatory/events?eventType=invalid_type')
    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })
})
