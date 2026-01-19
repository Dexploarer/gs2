/**
 * Integration Tests: Convex Trust Scoring
 *
 * Tests trust scoring functions against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { hasConvexCredentials, skipWithoutConvex } from '../setup'

// Get real Convex URL
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Real Convex client
let convex: ConvexHttpClient | null = null
let realEndpointId: Id<'endpoints'> | null = null

describe('Convex Trust Scoring', () => {
  beforeAll(async () => {
    if (hasConvexCredentials && convexUrl) {
      convex = new ConvexHttpClient(convexUrl)

      // Get a real endpoint ID from the database
      try {
        const endpoints = await convex.query(api.endpoints.list, { limit: 1 })
        if (endpoints.length > 0) {
          realEndpointId = endpoints[0]._id
        }
      } catch (error) {
        console.log('Could not fetch endpoint for testing:', error)
      }
    }
  })

  describe('getEndpointTrustScore', () => {
    it.skipIf(skipWithoutConvex)('returns score data for endpoint', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realEndpointId) {
        const score = await convex.query(api.trustScoring.getEndpointTrustScore, {
          endpointId: realEndpointId,
        })

        if (score) {
          expect(typeof score.trustScore).toBe('number')
          expect(score.trustScore).toBeGreaterThanOrEqual(0)
          expect(score.trustScore).toBeLessThanOrEqual(1000)
          expect(score).toHaveProperty('verificationTier')
          expect(score).toHaveProperty('badge')
          expect(score).toHaveProperty('label')
        }
      } else {
        console.log('Skipping - no endpoints in database')
      }
    })
  })

  describe('getLeaderboard', () => {
    it.skipIf(skipWithoutConvex)('returns list of top trusted endpoints', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const endpoints = await convex.query(api.trustScoring.getLeaderboard, {
        limit: 10,
      })

      expect(Array.isArray(endpoints)).toBe(true)

      if (endpoints.length > 1) {
        // Should be sorted by trust score descending
        for (let i = 0; i < endpoints.length - 1; i++) {
          expect(endpoints[i].trustScore).toBeGreaterThanOrEqual(endpoints[i + 1].trustScore)
        }
      }
    })

    it.skipIf(skipWithoutConvex)('respects limit parameter', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const endpoints = await convex.query(api.trustScoring.getLeaderboard, {
        limit: 3,
      })

      expect(endpoints.length).toBeLessThanOrEqual(3)
    })
  })

  describe('getScoreHistory', () => {
    it.skipIf(skipWithoutConvex)('returns score history for endpoint', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realEndpointId) {
        const history = await convex.query(api.trustScoring.getScoreHistory, {
          endpointId: realEndpointId,
          limit: 10,
        })

        expect(Array.isArray(history)).toBe(true)
      } else {
        console.log('Skipping - no endpoints in database')
      }
    })
  })

  describe('getScoreChanges', () => {
    it.skipIf(skipWithoutConvex)('returns recent score changes', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const changes = await convex.query(api.trustScoring.getScoreChanges, {
        hoursBack: 24,
        threshold: 10,
      })

      expect(Array.isArray(changes)).toBe(true)

      if (changes.length > 0) {
        const change = changes[0]
        expect(change).toHaveProperty('endpointId')
        expect(change).toHaveProperty('change')
      }
    })
  })
})
