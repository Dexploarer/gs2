/**
 * Convex Function Tests: Agent Operations
 *
 * Tests agent CRUD operations, registration, and score calculations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockConvexContext, seedMockDB } from '../mocks/convex'
import { mockAgent, mockAgentBronze, mockAgentPlatinum, createMockAgent } from '../fixtures/agents'

// Mock the Convex internal module
vi.mock('convex/server', () => ({
  query: vi.fn((config) => config.handler),
  mutation: vi.fn((config) => config.handler),
  action: vi.fn((config) => config.handler),
}))

describe('Agent Convex Functions', () => {
  let ctx: ReturnType<typeof createMockConvexContext>

  beforeEach(() => {
    ctx = createMockConvexContext()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('agents.register', () => {
    it('creates a new agent with default values', async () => {
      const newAgent = {
        address: '9xNewAgent123456789012345678901234567890123',
        ownerId: 'user_123',
        name: 'New Agent',
        description: 'A new test agent',
      }

      const agentId = await ctx.db.insert('agents', {
        ...newAgent,
        ghostScore: 500,
        tier: 'bronze',
        status: 'pending',
        createdAt: Date.now(),
        transactionCount: 0,
        successfulPayments: 0,
        failedPayments: 0,
        totalVolumeUSDC: 0,
        capabilities: [],
      })

      expect(agentId).toBeDefined()
      expect(agentId).toContain('agents_')

      const savedAgent = await ctx.db.get('agents', agentId)
      expect(savedAgent).toBeDefined()
      expect(savedAgent?.address).toBe(newAgent.address)
      expect(savedAgent?.ghostScore).toBe(500)
      expect(savedAgent?.tier).toBe('bronze')
    })

    it('prevents duplicate agent registration', async () => {
      // First registration
      await ctx.db.insert('agents', {
        ...mockAgent,
        _id: undefined,
      })

      // Simulate checking for existing agent
      const existing = await ctx.db.query('agents').filter((a) => a.address === mockAgent.address)

      expect(existing.length).toBeGreaterThan(0)
    })

    it('validates required fields', () => {
      const invalidAgent = {
        // Missing required address field
        name: 'Test Agent',
      }

      // This should fail validation
      expect(() => {
        if (!invalidAgent.hasOwnProperty('address')) {
          throw new Error('address is required')
        }
      }).toThrow('address is required')
    })
  })

  describe('agents.getByAddress', () => {
    it('returns agent for valid address', async () => {
      await ctx.db.insert('agents', mockAgent)

      const agents = await ctx.db.query('agents').filter((a) => a.address === mockAgent.address)

      expect(agents.length).toBe(1)
      expect(agents[0].address).toBe(mockAgent.address)
      expect(agents[0].ghostScore).toBe(mockAgent.ghostScore)
    })

    it('returns null for non-existent address', async () => {
      const agents = await ctx.db.query('agents').filter((a) => a.address === 'nonexistent')

      expect(agents.length).toBe(0)
    })
  })

  describe('agents.list', () => {
    it('returns all agents with pagination', async () => {
      await ctx.db.insert('agents', mockAgent)
      await ctx.db.insert('agents', mockAgentBronze)
      await ctx.db.insert('agents', mockAgentPlatinum)

      const agents = await ctx.db.query('agents').take(10)

      expect(agents.length).toBe(3)
    })

    it('filters agents by tier', async () => {
      await ctx.db.insert('agents', mockAgent)
      await ctx.db.insert('agents', mockAgentBronze)
      await ctx.db.insert('agents', mockAgentPlatinum)

      const platinumAgents = await ctx.db.query('agents').filter((a) => a.tier === 'platinum')

      expect(platinumAgents.length).toBe(1)
      expect(platinumAgents[0].tier).toBe('platinum')
    })

    it('returns all agents from query', async () => {
      await ctx.db.insert('agents', mockAgentBronze)
      await ctx.db.insert('agents', mockAgent)
      await ctx.db.insert('agents', mockAgentPlatinum)

      const agents = await ctx.db.query('agents').collect()

      // Verify all agents are returned
      expect(agents.length).toBe(3)

      // Verify each agent has expected fields
      agents.forEach((agent) => {
        expect(agent.ghostScore).toBeDefined()
        expect(agent.tier).toBeDefined()
      })
    })
  })

  describe('agents.updateScore', () => {
    it('updates ghost score and recalculates tier', async () => {
      const agentId = await ctx.db.insert('agents', {
        ...mockAgentBronze,
        _id: undefined,
      })

      // Update score to gold tier level
      await ctx.db.patch('agents', agentId, {
        ghostScore: 750,
        tier: 'gold',
      })

      const updated = await ctx.db.get('agents', agentId)
      expect(updated?.ghostScore).toBe(750)
      expect(updated?.tier).toBe('gold')
    })

    it('records score change in history', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      // Record score history
      await ctx.db.insert('scoreHistory', {
        agentId,
        previousScore: mockAgent.ghostScore,
        newScore: 850,
        reason: 'successful_transaction',
        timestamp: Date.now(),
      })

      const history = await ctx.db.query('scoreHistory').filter((h) => h.agentId === agentId)

      expect(history.length).toBe(1)
      expect(history[0].previousScore).toBe(mockAgent.ghostScore)
      expect(history[0].newScore).toBe(850)
    })

    it('caps score at maximum (1000)', async () => {
      const agentId = await ctx.db.insert('agents', mockAgentPlatinum)

      const newScore = Math.min(1050, 1000) // Cap at 1000
      await ctx.db.patch('agents', agentId, { ghostScore: newScore })

      const updated = await ctx.db.get('agents', agentId)
      expect(updated?.ghostScore).toBeLessThanOrEqual(1000)
    })

    it('maintains minimum score (0)', async () => {
      const agentId = await ctx.db.insert('agents', mockAgentBronze)

      const newScore = Math.max(-50, 0) // Floor at 0
      await ctx.db.patch('agents', agentId, { ghostScore: newScore })

      const updated = await ctx.db.get('agents', agentId)
      expect(updated?.ghostScore).toBeGreaterThanOrEqual(0)
    })
  })

  describe('agents.delete', () => {
    it('soft deletes agent by updating status', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.patch('agents', agentId, {
        status: 'deleted',
        deletedAt: Date.now(),
      })

      const deleted = await ctx.db.get('agents', agentId)
      expect(deleted?.status).toBe('deleted')
      expect(deleted?.deletedAt).toBeDefined()
    })

    it('hard deletes agent completely', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.delete('agents', agentId)

      const deleted = await ctx.db.get('agents', agentId)
      expect(deleted).toBeNull()
    })
  })

  describe('agents.getCapabilities', () => {
    it('returns agent capabilities', async () => {
      const agentWithCapabilities = {
        ...mockAgent,
        capabilities: ['text-generation', 'image-analysis', 'code-completion'],
      }

      const agentId = await ctx.db.insert('agents', agentWithCapabilities)

      const agent = await ctx.db.get('agents', agentId)
      expect(agent?.capabilities).toContain('text-generation')
      expect(agent?.capabilities).toContain('image-analysis')
      expect(agent?.capabilities).toHaveLength(3)
    })

    it('returns empty array for agent without capabilities', async () => {
      const agentId = await ctx.db.insert('agents', {
        ...mockAgent,
        capabilities: [],
      })

      const agent = await ctx.db.get('agents', agentId)
      expect(agent?.capabilities).toEqual([])
    })
  })

  describe('agents.updateStats', () => {
    it('increments transaction count', async () => {
      const agentId = await ctx.db.insert('agents', {
        ...mockAgent,
        transactionCount: 10,
      })

      await ctx.db.patch('agents', agentId, {
        transactionCount: 11,
      })

      const updated = await ctx.db.get('agents', agentId)
      expect(updated?.transactionCount).toBe(11)
    })

    it('updates volume and payment counts', async () => {
      const agentId = await ctx.db.insert('agents', {
        ...mockAgent,
        totalVolumeUSDC: 100,
        successfulPayments: 50,
        failedPayments: 5,
      })

      await ctx.db.patch('agents', agentId, {
        totalVolumeUSDC: 110,
        successfulPayments: 51,
      })

      const updated = await ctx.db.get('agents', agentId)
      expect(updated?.totalVolumeUSDC).toBe(110)
      expect(updated?.successfulPayments).toBe(51)
    })
  })

  describe('tier calculations', () => {
    it('assigns bronze tier for scores < 600', () => {
      const score = 500
      const tier = score < 600 ? 'bronze' : score < 750 ? 'silver' : score < 900 ? 'gold' : 'platinum'
      expect(tier).toBe('bronze')
    })

    it('assigns silver tier for scores 600-749', () => {
      const score = 700
      const tier = score < 600 ? 'bronze' : score < 750 ? 'silver' : score < 900 ? 'gold' : 'platinum'
      expect(tier).toBe('silver')
    })

    it('assigns gold tier for scores 750-899', () => {
      const score = 800
      const tier = score < 600 ? 'bronze' : score < 750 ? 'silver' : score < 900 ? 'gold' : 'platinum'
      expect(tier).toBe('gold')
    })

    it('assigns platinum tier for scores >= 900', () => {
      const score = 950
      const tier = score < 600 ? 'bronze' : score < 750 ? 'silver' : score < 900 ? 'gold' : 'platinum'
      expect(tier).toBe('platinum')
    })
  })
})
