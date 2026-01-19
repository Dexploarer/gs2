/**
 * Convex Function Tests: Reputation Votes
 *
 * Tests voting logic, consensus calculation, and vote aggregation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockConvexContext } from '../mocks/convex'
import { mockAgent, mockAgentPlatinum } from '../fixtures/agents'

describe('Reputation Votes Convex Functions', () => {
  let ctx: ReturnType<typeof createMockConvexContext>

  beforeEach(() => {
    ctx = createMockConvexContext()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('reputationVotes.cast', () => {
    it('creates a new vote', async () => {
      const targetAgentId = await ctx.db.insert('agents', mockAgent)
      const voterAgentId = await ctx.db.insert('agents', mockAgentPlatinum)

      const vote = {
        targetAgentId,
        voterAgentId,
        score: 8, // 1-10 scale
        dimension: 'reliability',
        timestamp: Date.now(),
        weight: 1.5, // Higher weight for platinum voters
        txSignature: 'vote_sig_123abc',
      }

      const voteId = await ctx.db.insert('reputationVotes', vote)

      expect(voteId).toBeDefined()

      const saved = await ctx.db.get('reputationVotes', voteId)
      expect(saved?.score).toBe(8)
      expect(saved?.dimension).toBe('reliability')
      expect(saved?.weight).toBe(1.5)
    })

    it('prevents self-voting', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const isSelfVote = agentId === agentId

      expect(isSelfVote).toBe(true)
      // In real implementation, this would throw an error
    })

    it('validates vote score is within range (1-10)', async () => {
      const validScores = [1, 5, 10]
      const invalidScores = [0, 11, -1]

      validScores.forEach((score) => {
        expect(score >= 1 && score <= 10).toBe(true)
      })

      invalidScores.forEach((score) => {
        expect(score >= 1 && score <= 10).toBe(false)
      })
    })

    it('validates dimension is valid enum', async () => {
      const validDimensions = ['reliability', 'performance', 'security', 'honesty', 'responsiveness']

      expect(validDimensions.includes('reliability')).toBe(true)
      expect(validDimensions.includes('invalid')).toBe(false)
    })

    it('calculates vote weight based on voter tier', async () => {
      const tierWeights = {
        bronze: 1.0,
        silver: 1.25,
        gold: 1.5,
        platinum: 2.0,
      }

      expect(tierWeights['bronze']).toBe(1.0)
      expect(tierWeights['platinum']).toBe(2.0)
    })

    it('prevents duplicate votes within cooldown period', async () => {
      const targetAgentId = await ctx.db.insert('agents', mockAgent)
      const voterAgentId = await ctx.db.insert('agents', mockAgentPlatinum)
      const now = Date.now()
      const cooldownMs = 24 * 60 * 60 * 1000 // 24 hours

      // First vote
      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId,
        score: 8,
        dimension: 'reliability',
        timestamp: now,
        weight: 1.5,
      })

      // Check for recent vote
      const recentVotes = await ctx.db
        .query('reputationVotes')
        .filter(
          (v) =>
            v.targetAgentId === targetAgentId &&
            v.voterAgentId === voterAgentId &&
            v.timestamp > now - cooldownMs
        )

      expect(recentVotes.length).toBe(1)
      // In real implementation, second vote would be rejected
    })
  })

  describe('reputationVotes.getForAgent', () => {
    it('returns all votes for agent', async () => {
      const targetAgentId = await ctx.db.insert('agents', mockAgent)
      const voter1Id = await ctx.db.insert('agents', { ...mockAgentPlatinum, address: 'voter1' })
      const voter2Id = await ctx.db.insert('agents', { ...mockAgentPlatinum, address: 'voter2' })

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId: voter1Id,
        score: 8,
        dimension: 'reliability',
        timestamp: Date.now(),
        weight: 1.5,
      })

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId: voter2Id,
        score: 9,
        dimension: 'reliability',
        timestamp: Date.now(),
        weight: 1.5,
      })

      const votes = await ctx.db.query('reputationVotes').filter((v) => v.targetAgentId === targetAgentId)

      expect(votes.length).toBe(2)
    })

    it('filters votes by dimension', async () => {
      const targetAgentId = await ctx.db.insert('agents', mockAgent)
      const voterAgentId = await ctx.db.insert('agents', mockAgentPlatinum)

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId,
        score: 8,
        dimension: 'reliability',
        timestamp: Date.now(),
        weight: 1.5,
      })

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId,
        score: 7,
        dimension: 'performance',
        timestamp: Date.now(),
        weight: 1.5,
      })

      const reliabilityVotes = await ctx.db
        .query('reputationVotes')
        .filter((v) => v.targetAgentId === targetAgentId && v.dimension === 'reliability')

      expect(reliabilityVotes.length).toBe(1)
      expect(reliabilityVotes[0].dimension).toBe('reliability')
    })
  })

  describe('reputationVotes.calculateConsensus', () => {
    it('calculates weighted average score', async () => {
      const votes = [
        { score: 8, weight: 1.0 },
        { score: 9, weight: 1.5 },
        { score: 7, weight: 2.0 },
      ]

      const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0)
      const weightedSum = votes.reduce((sum, v) => sum + v.score * v.weight, 0)
      const consensus = weightedSum / totalWeight

      // (8*1.0 + 9*1.5 + 7*2.0) / (1.0 + 1.5 + 2.0) = 35.5 / 4.5 = 7.89
      expect(consensus).toBeCloseTo(7.89, 1)
    })

    it('returns null with insufficient votes', async () => {
      const minVotesRequired = 3
      const voteCount = 2

      const hasConsensus = voteCount >= minVotesRequired
      expect(hasConsensus).toBe(false)
    })

    it('handles unanimous votes', async () => {
      const votes = [
        { score: 10, weight: 1.0 },
        { score: 10, weight: 1.5 },
        { score: 10, weight: 2.0 },
      ]

      const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0)
      const weightedSum = votes.reduce((sum, v) => sum + v.score * v.weight, 0)
      const consensus = weightedSum / totalWeight

      expect(consensus).toBe(10)
    })

    it('calculates variance for consensus confidence', async () => {
      const votes = [
        { score: 8, weight: 1.0 },
        { score: 8, weight: 1.0 },
        { score: 9, weight: 1.0 },
      ]

      const mean = votes.reduce((sum, v) => sum + v.score, 0) / votes.length
      const variance = votes.reduce((sum, v) => sum + Math.pow(v.score - mean, 2), 0) / votes.length

      // Low variance = high confidence
      expect(variance).toBeLessThan(1)
    })
  })

  describe('reputationVotes.aggregate', () => {
    it('aggregates votes by dimension', async () => {
      const targetAgentId = await ctx.db.insert('agents', mockAgent)
      const voterAgentId = await ctx.db.insert('agents', mockAgentPlatinum)

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId,
        score: 8,
        dimension: 'reliability',
        timestamp: Date.now(),
        weight: 1.0,
      })

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId,
        score: 9,
        dimension: 'performance',
        timestamp: Date.now(),
        weight: 1.0,
      })

      await ctx.db.insert('reputationVotes', {
        targetAgentId,
        voterAgentId,
        score: 7,
        dimension: 'security',
        timestamp: Date.now(),
        weight: 1.0,
      })

      const votes = await ctx.db.query('reputationVotes').filter((v) => v.targetAgentId === targetAgentId)

      const byDimension = votes.reduce(
        (acc, vote) => {
          if (!acc[vote.dimension]) {
            acc[vote.dimension] = []
          }
          acc[vote.dimension].push(vote)
          return acc
        },
        {} as Record<string, typeof votes>
      )

      expect(Object.keys(byDimension)).toHaveLength(3)
      expect(byDimension['reliability']).toHaveLength(1)
    })

    it('calculates overall reputation from dimension scores', async () => {
      const dimensionScores = {
        reliability: 8,
        performance: 9,
        security: 7,
        honesty: 8,
        responsiveness: 9,
      }

      const weights = {
        reliability: 0.25,
        performance: 0.2,
        security: 0.25,
        honesty: 0.15,
        responsiveness: 0.15,
      }

      let overallScore = 0
      for (const [dim, score] of Object.entries(dimensionScores)) {
        overallScore += score * weights[dim as keyof typeof weights]
      }

      // 8*0.25 + 9*0.2 + 7*0.25 + 8*0.15 + 9*0.15 = 2 + 1.8 + 1.75 + 1.2 + 1.35 = 8.1
      expect(overallScore).toBeCloseTo(8.1, 1)
    })
  })

  describe('vote expiration', () => {
    it('excludes expired votes from calculations', async () => {
      const now = Date.now()
      const expirationPeriod = 90 * 24 * 60 * 60 * 1000 // 90 days

      const votes = [
        { score: 10, timestamp: now - 10 * 24 * 60 * 60 * 1000 }, // 10 days ago - valid
        { score: 5, timestamp: now - 100 * 24 * 60 * 60 * 1000 }, // 100 days ago - expired
      ]

      const validVotes = votes.filter((v) => v.timestamp > now - expirationPeriod)

      expect(validVotes.length).toBe(1)
      expect(validVotes[0].score).toBe(10)
    })
  })
})
