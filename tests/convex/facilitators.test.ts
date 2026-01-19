/**
 * Integration Tests: Convex Facilitators
 *
 * Tests facilitator functions against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { hasConvexCredentials, skipWithoutConvex } from '../setup'

// Get real Convex URL
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Real Convex client
let convex: ConvexHttpClient | null = null

describe('Convex Facilitators', () => {
  beforeAll(() => {
    if (hasConvexCredentials && convexUrl) {
      convex = new ConvexHttpClient(convexUrl)
    }
  })

  describe('list', () => {
    it.skipIf(skipWithoutConvex)('returns list of facilitators', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const facilitators = await convex.query(api.facilitators.list, {})

      expect(facilitators).toBeDefined()
      expect(Array.isArray(facilitators)).toBe(true)
    })

    it.skipIf(skipWithoutConvex)('facilitators have expected structure', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const facilitators = await convex.query(api.facilitators.list, {})

      if (facilitators.length > 0) {
        const facilitator = facilitators[0]
        expect(facilitator).toHaveProperty('name')
        expect(facilitator).toHaveProperty('slug')
        expect(facilitator).toHaveProperty('status')
        expect(facilitator).toHaveProperty('networks')
        expect(Array.isArray(facilitator.networks)).toBe(true)
      }
    })
  })

  describe('getBySlug', () => {
    it.skipIf(skipWithoutConvex)('returns facilitator by slug', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      // Get a real facilitator first
      const facilitators = await convex.query(api.facilitators.list, {})

      if (facilitators.length > 0) {
        const slug = facilitators[0].slug
        const facilitator = await convex.query(api.facilitators.getBySlug, { slug })

        expect(facilitator).toBeDefined()
        expect(facilitator?.slug).toBe(slug)
      }
    })

    it.skipIf(skipWithoutConvex)('returns null for non-existent slug', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const facilitator = await convex.query(api.facilitators.getBySlug, {
        slug: 'nonexistent-facilitator-xyz',
      })

      expect(facilitator).toBeNull()
    })
  })

  describe('getVerified', () => {
    it.skipIf(skipWithoutConvex)('returns only verified facilitators', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const facilitators = await convex.query(api.facilitators.getVerified, {})

      expect(Array.isArray(facilitators)).toBe(true)

      // All returned facilitators should be verified
      facilitators.forEach((f) => {
        expect(f.isVerified).toBe(true)
      })
    })
  })

  describe('getStats', () => {
    it.skipIf(skipWithoutConvex)('returns facilitator stats', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const stats = await convex.query(api.facilitators.getStats, {})

      expect(stats).toBeDefined()
      expect(typeof stats.total).toBe('number')
      expect(typeof stats.active).toBe('number')
      expect(typeof stats.verified).toBe('number')
      expect(typeof stats.totalDailyVolume).toBe('number')
      expect(typeof stats.avgUptime).toBe('number')
    })
  })
})
