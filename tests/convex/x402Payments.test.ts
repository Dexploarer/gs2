/**
 * Integration Tests: Convex x402 Payments
 *
 * Tests x402 payment functions against real Convex data
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
let realAgentId: Id<'agents'> | null = null

describe('Convex x402 Payments', () => {
  beforeAll(async () => {
    if (hasConvexCredentials && convexUrl) {
      convex = new ConvexHttpClient(convexUrl)

      // Get a real agent ID from the database
      try {
        const agents = await convex.query(api.agents.list, { limit: 1 })
        if (agents.length > 0) {
          realAgentId = agents[0]._id
        }
      } catch (error) {
        console.log('Could not fetch agent for testing:', error)
      }
    }
  })

  describe('getRecent', () => {
    it.skipIf(skipWithoutConvex)('returns recent payments', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const payments = await convex.query(api.x402Payments.getRecent, {
        limit: 10,
      })

      expect(Array.isArray(payments)).toBe(true)

      if (payments.length > 0) {
        const payment = payments[0]
        // Check fields from x402Payments schema
        expect(payment).toHaveProperty('txSignature')
        expect(payment).toHaveProperty('agentId')
        expect(payment).toHaveProperty('amount')
        expect(payment).toHaveProperty('network')
        expect(payment).toHaveProperty('status')
        expect(payment).toHaveProperty('timestamp')
      }
    })

    it.skipIf(skipWithoutConvex)('respects limit parameter', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const payments = await convex.query(api.x402Payments.getRecent, {
        limit: 5,
      })

      expect(payments.length).toBeLessThanOrEqual(5)
    })
  })

  describe('getStats', () => {
    it.skipIf(skipWithoutConvex)('returns payment statistics', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const stats = await convex.query(api.x402Payments.getStats, {})

      expect(stats).toBeDefined()
      expect(typeof stats.total).toBe('number')
      expect(typeof stats.completed).toBe('number')
      expect(typeof stats.failed).toBe('number')
      expect(typeof stats.pending).toBe('number')
      expect(typeof stats.successRate).toBe('number')
      expect(typeof stats.totalVolume).toBe('number')
    })

    it.skipIf(skipWithoutConvex)('filters by network', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const solanaStats = await convex.query(api.x402Payments.getStats, {
        network: 'solana',
      })

      expect(solanaStats).toBeDefined()
      expect(typeof solanaStats.total).toBe('number')
      expect(typeof solanaStats.successRate).toBe('number')
    })
  })

  describe('getStatsByNetwork', () => {
    it.skipIf(skipWithoutConvex)('returns stats grouped by network', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const stats = await convex.query(api.x402Payments.getStatsByNetwork, {})

      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('solana')
      expect(stats).toHaveProperty('base')
      expect(typeof stats.total).toBe('number')

      // Check solana stats structure
      expect(typeof stats.solana.count).toBe('number')
      expect(typeof stats.solana.volume).toBe('number')

      // Check base stats structure
      expect(typeof stats.base.count).toBe('number')
      expect(typeof stats.base.volume).toBe('number')
    })
  })

  describe('getByAgent', () => {
    it.skipIf(skipWithoutConvex)('returns payments for agent', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realAgentId) {
        const payments = await convex.query(api.x402Payments.getByAgent, {
          agentId: realAgentId,
          limit: 10,
        })

        expect(Array.isArray(payments)).toBe(true)
      } else {
        console.log('Skipping - no agents in database')
      }
    })
  })

  describe('getByEndpoint', () => {
    it.skipIf(skipWithoutConvex)('returns payments for endpoint', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      // Get a real endpoint first
      const endpoints = await convex.query(api.endpoints.list, { limit: 1 })

      if (endpoints.length > 0) {
        const endpoint = endpoints[0].url
        const payments = await convex.query(api.x402Payments.getByEndpoint, {
          endpoint,
          limit: 10,
        })

        expect(Array.isArray(payments)).toBe(true)
      } else {
        console.log('Skipping - no endpoints in database')
      }
    })
  })

  describe('getEndpointStats', () => {
    it.skipIf(skipWithoutConvex)('returns endpoint payment stats', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      // Get a real endpoint first
      const endpoints = await convex.query(api.endpoints.list, { limit: 1 })

      if (endpoints.length > 0) {
        const endpoint = endpoints[0].url
        const stats = await convex.query(api.x402Payments.getEndpointStats, {
          endpoint,
        })

        expect(stats).toBeDefined()
        expect(typeof stats.totalCalls).toBe('number')
        expect(typeof stats.successRate).toBe('number')
        expect(typeof stats.avgPrice).toBe('number')
        expect(typeof stats.maxPrice).toBe('number')
      } else {
        console.log('Skipping - no endpoints in database')
      }
    })
  })

  describe('getHourlyStats', () => {
    it.skipIf(skipWithoutConvex)('returns hourly payment stats', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const stats = await convex.query(api.x402Payments.getHourlyStats, {
        hours: 24,
      })

      expect(Array.isArray(stats)).toBe(true)

      if (stats.length > 0) {
        const hour = stats[0]
        expect(hour).toHaveProperty('hour')
        expect(hour).toHaveProperty('payments')
        expect(hour).toHaveProperty('volume')
      }
    })
  })

  describe('getStatsByFacilitator', () => {
    it.skipIf(skipWithoutConvex)('returns stats grouped by facilitator', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const stats = await convex.query(api.x402Payments.getStatsByFacilitator, {})

      expect(Array.isArray(stats)).toBe(true)

      if (stats.length > 0) {
        const facilitatorStats = stats[0]
        expect(facilitatorStats).toHaveProperty('name')
        expect(facilitatorStats).toHaveProperty('slug')
        expect(facilitatorStats).toHaveProperty('count')
        expect(facilitatorStats).toHaveProperty('successRate')
      }
    })
  })
})
