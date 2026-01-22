/**
 * Integration Tests: Convex Token Staking
 *
 * Tests token staking functions against real Convex data
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

describe('Convex Token Staking', () => {
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

  describe('listActive', () => {
    it.skipIf(skipWithoutConvex)('returns list of active stake tokens', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const tokens = await convex.query(api.tokenStaking.listActive, {})

      expect(Array.isArray(tokens)).toBe(true)

      if (tokens.length > 0) {
        const token = tokens[0]
        expect(token).toHaveProperty('tokenMint')
        expect(token).toHaveProperty('tokenSymbol')
        expect(token).toHaveProperty('isActive')
        expect(token.isActive).toBe(true)
      }
    })
  })

  describe('getByMint', () => {
    it.skipIf(skipWithoutConvex)('returns token by mint address', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      // Get an active token first
      const tokens = await convex.query(api.tokenStaking.listActive, {})

      if (tokens.length > 0) {
        const tokenMint = tokens[0].tokenMint
        const token = await convex.query(api.tokenStaking.getByMint, { tokenMint })

        expect(token).toBeDefined()
        expect(token?.tokenMint).toBe(tokenMint)
      } else {
        console.log('Skipping - no tokens in database')
      }
    })

    it.skipIf(skipWithoutConvex)('returns null for non-existent mint', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const token = await convex.query(api.tokenStaking.getByMint, {
        tokenMint: 'NonExistentMint123456789',
      })

      expect(token).toBeNull()
    })
  })

  describe('getForAgent', () => {
    it.skipIf(skipWithoutConvex)('returns stakes for agent', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realAgentId) {
        const stakes = await convex.query(api.tokenStaking.getForAgent, { agentId: realAgentId })

        expect(Array.isArray(stakes)).toBe(true)
      } else {
        console.log('Skipping - no agents in database')
      }
    })
  })

  describe('getStakesForAgent', () => {
    it.skipIf(skipWithoutConvex)('returns detailed stakes for agent', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realAgentId) {
        const stakes = await convex.query(api.tokenStaking.getStakesForAgent, {
          targetAgentId: realAgentId,
        })

        expect(Array.isArray(stakes)).toBe(true)

        if (stakes.length > 0) {
          const stake = stakes[0]
          expect(stake).toHaveProperty('targetAgentId')
          expect(stake).toHaveProperty('stakerAddress')
          expect(stake).toHaveProperty('amount')
          expect(stake).toHaveProperty('status')
        }
      } else {
        console.log('Skipping - no agents in database')
      }
    })

    it.skipIf(skipWithoutConvex)('filters by status', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realAgentId) {
        const activeStakes = await convex.query(api.tokenStaking.getStakesForAgent, {
          targetAgentId: realAgentId,
          status: 'active',
        })

        expect(Array.isArray(activeStakes)).toBe(true)

        activeStakes.forEach((stake) => {
          expect(stake.status).toBe('active')
        })
      } else {
        console.log('Skipping - no agents in database')
      }
    })
  })

  describe('getStatsForAgent', () => {
    it.skipIf(skipWithoutConvex)('returns staking stats for agent', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      if (realAgentId) {
        const stats = await convex.query(api.tokenStaking.getStatsForAgent, {
          agentId: realAgentId,
        })

        expect(stats).toBeDefined()
        expect(typeof stats.totalStakes).toBe('number')
        expect(typeof stats.uniqueStakers).toBe('number')
        expect(typeof stats.totalWeight).toBe('number')
        expect(typeof stats.totalStakedValue).toBe('number')
        expect(typeof stats.registeredTokens).toBe('number')
      } else {
        console.log('Skipping - no agents in database')
      }
    })
  })

  describe('getStakesByStaker', () => {
    it.skipIf(skipWithoutConvex)('returns stakes by staker address', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      // Get a real agent to use as staker
      const agents = await convex.query(api.agents.list, { limit: 1 })

      if (agents.length > 0) {
        const stakerAddress = agents[0].address
        const stakes = await convex.query(api.tokenStaking.getStakesByStaker, {
          stakerAddress,
        })

        expect(Array.isArray(stakes)).toBe(true)
      } else {
        console.log('Skipping - no agents in database')
      }
    })
  })
})
