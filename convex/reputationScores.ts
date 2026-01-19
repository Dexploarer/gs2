/**
 * Reputation Scores Functions
 *
 * Calculate and manage reputation scores for agents and merchants
 */

import { query, internalQuery, internalMutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Get reputation score for an agent (internal - for reputation calculations)
export const getForAgentInternal = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const score = await ctx.db
      .query('reputationScores')
      .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.agentId))
      .first()

    if (!score) return null

    return score
  },
})

// Get reputation score for an agent (public - for frontend)
export const getForAgent = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    const score = await ctx.db
      .query('reputationScores')
      .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.agentId))
      .first()

    if (!score) return null

    // Enrich with agent data
    const agent = await ctx.db.get('agents', args.agentId)

    return {
      ...score,
      agent: agent
        ? {
            name: agent.name,
            address: agent.address,
            ghostScore: agent.ghostScore,
            tier: agent.tier,
          }
        : null,
    }
  },
})

// Get reputation score for a merchant
export const getForMerchant = query({
  args: { merchantId: v.id('merchants') },
  handler: async (ctx, args) => {
    const score = await ctx.db
      .query('reputationScores')
      .withIndex('by_subject_merchant', (q) => q.eq('subjectMerchantId', args.merchantId))
      .first()

    if (!score) return null

    // Enrich with merchant data
    const merchant = await ctx.db.get('merchants', args.merchantId)

    return {
      ...score,
      merchant: merchant
        ? {
            name: merchant.name,
            facilitatorId: merchant.facilitatorId,
          }
        : null,
    }
  },
})

// Get top agents by overall score
export const getTopAgents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scores = await ctx.db
      .query('reputationScores')
      .withIndex('by_overall_score')
      .order('desc')
      .take(args.limit ?? 20)

    // Filter for agents only
    const agentScores = scores.filter((s) => s.subjectType === 'agent' && s.subjectAgentId)

    // Enrich with agent data
    return await Promise.all(
      agentScores.map(async (score) => {
        const agent = score.subjectAgentId
          ? await ctx.db.get('agents', score.subjectAgentId)
          : null

        return {
          ...score,
          agent: agent
            ? {
                name: agent.name,
                address: agent.address,
                ghostScore: agent.ghostScore,
                tier: agent.tier,
              }
            : null,
        }
      })
    )
  },
})

// Type definitions for internal queries
interface ProfileData {
  uptime: number
  errorRate: number
  successfulRequests: number
  totalRequests: number
  endorsements?: number
}

interface VoteData {
  voteType: string
}

interface AttestationData {
  attestationType: string
}

interface TransactionStatsData {
  successRate: number
  totalVolume: number
  totalTransactions: number
}

interface ExistingScoreData {
  overallScore: number
  scoreChange30d: number
}

// Staking stats type for internal queries
interface StakingStatsData {
  totalStakingWeight: number
  uniqueStakers: number
  totalStakedValue: number
  attestationCount: number
  avgStakerGhostScore: number
  stakingTrustBonus: number
}

// Calculate reputation score for an agent
export const calculate = internalAction({
  args: { agentId: v.id('agents') },
  returns: v.object({
    overallScore: v.number(),
    trend: v.union(v.literal('rising'), v.literal('falling'), v.literal('stable')),
  }),
  handler: async (ctx, args) => {
    // Gather all data needed for scoring (including staking data)
    const [profileResult, votesResult, attestationsResult, _reviews, transactionsResult, stakingResult] = await Promise.all([
      ctx.runQuery(internal.agentProfiles.getInternal, { agentId: args.agentId }),
      ctx.runQuery(internal.reputationVotes.getForSubject, {
        subjectType: 'agent',
        subjectAgentId: args.agentId,
      }),
      ctx.runQuery(internal.agentAttestations.getForSubject, { subjectAgentId: args.agentId }),
      // Reviews would be from merchantReviews if this agent is also a merchant
      Promise.resolve([]),
      ctx.runQuery(internal.agentTransactions.getStatsInternal, {
        agentId: args.agentId,
        timeRangeHours: 24 * 30, // Last 30 days
      }),
      // NEW: Query staking stats from BYOT staking system
      ctx.runQuery(internal.tokenStaking.getStakingStatsForGhostScore, { agentId: args.agentId }),
    ])

    // Cast results to proper types
    const profile = profileResult as ProfileData | null
    const votes = votesResult as VoteData[]
    const attestations = attestationsResult as AttestationData[]
    const transactions = transactionsResult as TransactionStatsData
    const stakingStats = stakingResult as StakingStatsData

    // Calculate component scores (0-100)

    // 1. Trust Score - based on votes, attestations, AND staking
    const positiveVotes = votes.filter(
      (v: VoteData) =>
        v.voteType === 'trustworthy' || v.voteType === 'high_quality' || v.voteType === 'reliable'
    ).length
    const negativeVotes = votes.filter(
      (v: VoteData) =>
        v.voteType === 'untrustworthy' ||
        v.voteType === 'low_quality' ||
        v.voteType === 'unreliable'
    ).length
    const totalVotes = positiveVotes + negativeVotes

    let trustScore = 50 // Baseline
    if (totalVotes > 0) {
      trustScore = (positiveVotes / totalVotes) * 100
    }
    // Boost from attestations
    trustScore = Math.min(100, trustScore + attestations.length * 2)
    // NEW: Boost from staking (economic commitment from others signals trust)
    trustScore = Math.min(100, trustScore + stakingStats.stakingTrustBonus * 0.3)

    // 2. Quality Score - based on performance metrics
    const qualityScore: number = profile
      ? (profile.uptime * 0.4 +
          (100 - profile.errorRate) * 0.3 +
          (profile.successfulRequests / (profile.totalRequests || 1)) * 100 * 0.3)
      : 50

    // 3. Reliability Score - based on uptime and success rate
    const reliabilityScore = profile
      ? (profile.uptime * 0.6 + (transactions.successRate || 0) * 0.4)
      : 50

    // 4. Economic Score - based on transaction volume, activity, AND staking
    const baseEconomicScore = Math.min(
      80, // Cap at 80 before staking boost
      (transactions.totalVolume / 1000) * 10 + // $1000 = 10 points
        (transactions.totalTransactions / 100) * 20 // 100 txs = 20 points
    )
    // NEW: Add staking component to economic score
    // log2(totalStakedValue + 1) * 3 gives up to ~20 points for high staking
    const stakingEconomicBonus = Math.min(20, Math.log2(stakingStats.totalStakedValue + 1) * 3)
    const economicScore = Math.min(100, baseEconomicScore + stakingEconomicBonus)

    // 5. Social Score - based on community engagement AND staker diversity
    const baseSocialScore = Math.min(
      80, // Cap at 80 before staking boost
      totalVotes * 5 + // Each vote = 5 points
        attestations.length * 10 + // Each attestation = 10 points
        (profile?.endorsements || 0) * 3 // Each endorsement = 3 points
    )
    // NEW: Staker diversity bonus - more unique stakers = more social trust
    const stakerDiversityBonus = Math.min(20, stakingStats.uniqueStakers * 2)
    const socialScore = Math.min(100, baseSocialScore + stakerDiversityBonus)

    // 6. NEW: Staking Score - dedicated component for economic commitment
    // This captures the trust signal from BYOT staking
    const stakingScore = stakingStats.stakingTrustBonus

    // Calculate overall score (0-100 scale, then multiply by 10 for 0-1000)
    // Weights: Trust 20%, Quality 20%, Reliability 15%, Economic 15%, Social 15%, Staking 15%
    const overallScore: number = (
      trustScore * 0.20 +
      qualityScore * 0.20 +
      reliabilityScore * 0.15 +
      economicScore * 0.15 +
      socialScore * 0.15 +
      stakingScore * 0.15 // NEW: 15% weight for staking
    ) * 10 // Scale to 0-1000

    // Determine trend
    const existingScoreResult = await ctx.runQuery(internal.reputationScores.getForAgentInternal, {
      agentId: args.agentId,
    })
    const existingScore = existingScoreResult as ExistingScoreData | null

    let scoreChange7d = 0
    let scoreChange30d = 0
    let trend: 'rising' | 'falling' | 'stable' = 'stable'

    if (existingScore) {
      scoreChange7d = overallScore - (existingScore.overallScore || 0)
      scoreChange30d = existingScore.scoreChange30d || 0

      if (scoreChange7d > 10) trend = 'rising'
      else if (scoreChange7d < -10) trend = 'falling'
    }

    // Save the score
    await ctx.runMutation(internal.reputationScores.upsert, {
      subjectType: 'agent',
      subjectAgentId: args.agentId,
      subjectMerchantId: undefined,
      overallScore,
      trustScore,
      qualityScore,
      reliabilityScore,
      economicScore,
      socialScore,
      stakingScore, // NEW: Include staking score
      totalVotes,
      positiveVotes,
      negativeVotes,
      totalAttestations: attestations.length,
      totalReviews: 0,
      avgReviewRating: undefined,
      scoreChange7d,
      scoreChange30d,
      trend,
    })

    return { overallScore, trend }
  },
})

// Upsert reputation score
export const upsert = internalMutation({
  args: {
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
    overallScore: v.number(),
    trustScore: v.number(),
    qualityScore: v.number(),
    reliabilityScore: v.number(),
    economicScore: v.number(),
    socialScore: v.number(),
    stakingScore: v.optional(v.number()), // NEW: Staking score from BYOT
    totalVotes: v.number(),
    positiveVotes: v.number(),
    negativeVotes: v.number(),
    totalAttestations: v.number(),
    totalReviews: v.number(),
    avgReviewRating: v.optional(v.number()),
    scoreChange7d: v.number(),
    scoreChange30d: v.number(),
    trend: v.union(v.literal('rising'), v.literal('falling'), v.literal('stable')),
  },
  handler: async (ctx, args) => {
    // Find existing score
    let existing
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      existing = await ctx.db
        .query('reputationScores')
        .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.subjectAgentId!))
        .first()
    } else if (args.subjectType === 'merchant' && args.subjectMerchantId) {
      existing = await ctx.db
        .query('reputationScores')
        .withIndex('by_subject_merchant', (q) => q.eq('subjectMerchantId', args.subjectMerchantId!))
        .first()
    }

    const now = Date.now()
    const nextCalculation = now + 60 * 60 * 1000 // Recalculate in 1 hour

    if (existing) {
      // Update existing score
      await ctx.db.patch('reputationScores', existing._id, {
        overallScore: args.overallScore,
        trustScore: args.trustScore,
        qualityScore: args.qualityScore,
        reliabilityScore: args.reliabilityScore,
        economicScore: args.economicScore,
        socialScore: args.socialScore,
        stakingScore: args.stakingScore, // NEW: Include staking score
        totalVotes: args.totalVotes,
        positiveVotes: args.positiveVotes,
        negativeVotes: args.negativeVotes,
        totalAttestations: args.totalAttestations,
        totalReviews: args.totalReviews,
        avgReviewRating: args.avgReviewRating,
        scoreChange7d: args.scoreChange7d,
        scoreChange30d: args.scoreChange30d,
        trend: args.trend,
        lastCalculatedAt: now,
        nextCalculationAt: nextCalculation,
      })

      return existing._id
    } else {
      // Create new score
      return await ctx.db.insert('reputationScores', {
        subjectType: args.subjectType,
        subjectAgentId: args.subjectAgentId,
        subjectMerchantId: args.subjectMerchantId,
        overallScore: args.overallScore,
        trustScore: args.trustScore,
        qualityScore: args.qualityScore,
        reliabilityScore: args.reliabilityScore,
        economicScore: args.economicScore,
        socialScore: args.socialScore,
        stakingScore: args.stakingScore, // NEW: Include staking score
        totalVotes: args.totalVotes,
        positiveVotes: args.positiveVotes,
        negativeVotes: args.negativeVotes,
        totalAttestations: args.totalAttestations,
        totalReviews: args.totalReviews,
        avgReviewRating: args.avgReviewRating,
        scoreChange7d: args.scoreChange7d,
        scoreChange30d: args.scoreChange30d,
        trend: args.trend,
        rank: undefined,
        categoryRank: undefined,
        lastCalculatedAt: now,
        nextCalculationAt: nextCalculation,
      })
    }
  },
})

// Get scores that need recalculation
export const getNeedingRecalculation = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now()

    const scores = await ctx.db
      .query('reputationScores')
      .withIndex('by_last_calculated')
      .order('asc')
      .take(args.limit ?? 100)

    // Filter for scores that are due for recalculation
    const due = scores.filter((s) => s.nextCalculationAt <= now)

    return due.map((s) => ({
      _id: s._id,
      subjectType: s.subjectType,
      subjectAgentId: s.subjectAgentId,
      subjectMerchantId: s.subjectMerchantId,
    }))
  },
})

// Get reputation statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allScores = await ctx.db.query('reputationScores').collect()

    const agentScores = allScores.filter((s) => s.subjectType === 'agent')
    const merchantScores = allScores.filter((s) => s.subjectType === 'merchant')

    const avgOverallScore =
      allScores.reduce((sum, s) => sum + s.overallScore, 0) / (allScores.length || 1)

    const risingCount = allScores.filter((s) => s.trend === 'rising').length
    const fallingCount = allScores.filter((s) => s.trend === 'falling').length
    const stableCount = allScores.filter((s) => s.trend === 'stable').length

    return {
      totalScores: allScores.length,
      agentScores: agentScores.length,
      merchantScores: merchantScores.length,
      avgOverallScore: Math.round(avgOverallScore),
      risingCount,
      fallingCount,
      stableCount,
    }
  },
})
