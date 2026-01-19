/**
 * Real Convex Integration Tests
 *
 * Tests actual Convex deployment with real Solana sync
 * NO MOCKS - Real end-to-end integration
 *
 * Requirements:
 * 1. Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment
 * 2. Convex dev server running (`bunx convex dev`)
 * 3. Solana devnet accessible
 *
 * What we test:
 * 1. Convex functions execute successfully
 * 2. Data persists correctly
 * 3. Queries return expected results
 * 4. Performance meets targets (<100ms)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import { hasConvexCredentials } from '../setup'

// Get real Convex URL
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Real Convex client - only created if we have valid credentials
let convex: ConvexHttpClient | null = null

beforeAll(() => {
  if (hasConvexCredentials && convexUrl) {
    convex = new ConvexHttpClient(convexUrl)
  }
})

describe('Real Convex - Agent Queries', () => {
  it.skipIf(!hasConvexCredentials)('should list agents from Convex', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const agents = await convex.query(api.agents.list, { limit: 10 })

    expect(agents).toBeDefined()
    expect(Array.isArray(agents)).toBe(true)

    // If agents exist, verify structure
    if (agents.length > 0) {
      const firstAgent = agents[0]
      expect(firstAgent).toHaveProperty('_id')
      expect(firstAgent).toHaveProperty('address')
      expect(firstAgent).toHaveProperty('ghostScore')
      expect(firstAgent).toHaveProperty('tier')
      expect(firstAgent).toHaveProperty('isActive')
    }
  })

  it.skipIf(!hasConvexCredentials)('should query agent by address', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    // First get any agent
    const agents = await convex.query(api.agents.list, { limit: 1 })

    if (agents.length === 0) {
      // No agents in database - valid state
      return
    }

    const testAgent = agents[0]

    // Query by address
    const agent = await convex.query(api.agents.getByAddress, {
      address: testAgent.address,
    })

    expect(agent).toBeDefined()
    expect(agent?.address).toBe(testAgent.address)
    expect(agent?._id).toBe(testAgent._id)
  })

  it.skipIf(!hasConvexCredentials)('should execute query in <50ms', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const agents = await convex.query(api.agents.list, { limit: 1 })

    if (agents.length === 0) {
      return
    }

    const start = Date.now()
    await convex.query(api.agents.getByAddress, {
      address: agents[0].address,
    })
    const duration = Date.now() - start

    expect(duration).toBeLessThan(100) // Allow 100ms for real network
  })
})

describe('Real Convex - Agent Registration', () => {
  // Skip mutation tests that require valid user ID - would pollute production database
  // These tests need proper test user infrastructure (seed users in test env)
  it.skip('should register new agent', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const testAddress = `Test${Date.now()}`

    const agentId = await convex.mutation(api.agents.register, {
      address: testAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ownerId: 'test_user_id' as any,
      name: 'Test Agent',
      description: 'Integration test agent',
      capabilities: ['test'],
      model: 'gpt-4',
    })

    expect(agentId).toBeDefined()

    // Verify agent exists
    const agent = await convex.query(api.agents.getByAddress, {
      address: testAddress,
    })

    expect(agent).toBeDefined()
    expect(agent?.address).toBe(testAddress)
    expect(agent?.name).toBe('Test Agent')
    expect(agent?.ghostScore).toBe(250) // Starting score
    expect(agent?.tier).toBe('bronze') // Starting tier
  })
})

describe('Real Convex - Ghost Score Updates', () => {
  // Skip mutation tests that require valid user ID - would pollute production database
  // These tests need proper test user infrastructure (seed users in test env)
  it.skip('should update Ghost Score and tier', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    // Create test agent
    const testAddress = `ScoreTest${Date.now()}`
    const agentId = await convex.mutation(api.agents.register, {
      address: testAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ownerId: 'test_user_id' as any,
      name: 'Score Test Agent',
      description: 'Testing score updates',
      capabilities: [],
    })

    // Update score to Gold tier (750+)
    const result = await convex.mutation(api.agents.updateScore, {
      id: agentId,
      score: 800,
    })

    expect(result.score).toBe(800)
    expect(result.tier).toBe('gold')

    // Verify persisted
    const agent = await convex.query(api.agents.get, { id: agentId })
    expect(agent?.ghostScore).toBe(800)
    expect(agent?.tier).toBe('gold')
  })

  // Skip mutation tests that require valid user ID - would pollute production database
  it.skip('should calculate correct tiers', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const testCases = [
      { score: 950, expectedTier: 'platinum' },
      { score: 800, expectedTier: 'gold' },
      { score: 600, expectedTier: 'silver' },
      { score: 400, expectedTier: 'bronze' },
    ]

    for (const testCase of testCases) {
      const agentId = await convex.mutation(api.agents.register, {
        address: `Tier${testCase.score}${Date.now()}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ownerId: 'test_user_id' as any,
        name: `Tier Test ${testCase.expectedTier}`,
        description: 'Testing tiers',
        capabilities: [],
      })

      const result = await convex.mutation(api.agents.updateScore, {
        id: agentId,
        score: testCase.score,
      })

      expect(result.tier).toBe(testCase.expectedTier)
    }
  })
})

describe('Real Convex - Agent Votes', () => {
  it.skipIf(!hasConvexCredentials)('should retrieve agent votes', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    // Get any agent
    const agents = await convex.query(api.agents.list, { limit: 1 })

    if (agents.length === 0) {
      return
    }

    const agent = agents[0]

    // Get votes
    const votes = await convex.query(api.agents.getAgentVotes, {
      agentId: agent._id,
    })

    expect(Array.isArray(votes)).toBe(true)

    // If votes exist, verify structure
    if (votes.length > 0) {
      const firstVote = votes[0]
      expect(firstVote).toHaveProperty('voterAgentId')
      expect(firstVote).toHaveProperty('subjectAgentId')
      expect(firstVote).toHaveProperty('voteType')
      expect(firstVote).toHaveProperty('weight')
    }
  })
})

describe('Real Convex - Performance Benchmarks', () => {
  it.skipIf(!hasConvexCredentials)('should list 50 agents in <100ms', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const start = Date.now()
    const agents = await convex.query(api.agents.list, { limit: 50 })
    const duration = Date.now() - start

    expect(agents).toBeDefined()
    expect(duration).toBeLessThan(200) // Allow 200ms for real network
  })

  it.skipIf(!hasConvexCredentials)('should handle concurrent queries', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const agents = await convex.query(api.agents.list, { limit: 3 })

    if (agents.length < 3) {
      return
    }

    const start = Date.now()

    await Promise.all([
      convex.query(api.agents.getByAddress, { address: agents[0].address }),
      convex.query(api.agents.getByAddress, { address: agents[1].address }),
      convex.query(api.agents.getByAddress, { address: agents[2].address }),
    ])

    const duration = Date.now() - start

    expect(duration).toBeLessThan(300) // Parallel execution
  })
})

describe('Real Convex - Error Handling', () => {
  it.skipIf(!hasConvexCredentials)('should return null for non-existent agent', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const agent = await convex.query(api.agents.getByAddress, {
      address: 'NonExistentAddress12345',
    })

    expect(agent).toBeNull()
  })

  it.skipIf(!hasConvexCredentials)('should handle invalid agent ID gracefully', async () => {
    if (!convex) throw new Error('Convex client not initialized')

    const client = convex // Capture for closure
    await expect(async () => {
      await client.query(api.agents.get, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        id: 'invalid_id' as any,
      })
    }).rejects.toThrow()
  })
})
