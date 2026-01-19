/**
 * Reputation Votes Functions
 *
 * Payment-backed community voting on agents and merchants.
 * Votes REQUIRE a transaction between voter and subject to prevent spam/sybil attacks.
 * Positive votes automatically create trust graph relationships for PageRank.
 */

import { query, mutation, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Helper to determine if a vote is positive
const isPositiveVote = (voteType: string): boolean => {
  return ['trustworthy', 'high_quality', 'reliable'].includes(voteType)
}

// Helper to map vote type to trust category
const voteTypeToCategory = (
  voteType: string
): 'trustworthiness' | 'quality' | 'reliability' | 'general' => {
  switch (voteType) {
    case 'trustworthy':
    case 'untrustworthy':
      return 'trustworthiness'
    case 'high_quality':
    case 'low_quality':
      return 'quality'
    case 'reliable':
    case 'unreliable':
      return 'reliability'
    default:
      return 'general'
  }
}

// Cast a vote (REQUIRES payment-backed transaction)
export const cast = mutation({
  args: {
    voterAgentId: v.id('agents'),
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
    voteType: v.union(
      v.literal('trustworthy'),
      v.literal('untrustworthy'),
      v.literal('high_quality'),
      v.literal('low_quality'),
      v.literal('reliable'),
      v.literal('unreliable')
    ),
    reason: v.optional(v.string()),
    basedOnTransactionId: v.id('agentTransactions'), // REQUIRED - enforces payment-backed voting
  },
  handler: async (ctx, args) => {
    // Get voter's Ghost Score for weighting
    const voter = await ctx.db.get('agents', args.voterAgentId)
    if (!voter) {
      throw new Error('Voter agent not found')
    }

    // CRITICAL: Verify transaction exists and involves both voter and subject
    const transaction = await ctx.db.get('agentTransactions', args.basedOnTransactionId)
    if (!transaction) {
      throw new Error('Transaction not found - votes must be backed by a real transaction')
    }

    // Verify the transaction involves the voter (either as primary agent or counterparty)
    const voterInvolved =
      transaction.agentId === args.voterAgentId ||
      transaction.counterpartyAgentId === args.voterAgentId

    if (!voterInvolved) {
      throw new Error('Voter must be party to the transaction')
    }

    // For agent votes, verify the subject is also in the transaction
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      const subjectInvolved =
        transaction.agentId === args.subjectAgentId ||
        transaction.counterpartyAgentId === args.subjectAgentId

      if (!subjectInvolved) {
        throw new Error('Subject agent must be party to the transaction')
      }

      // Voter and subject must be different parties in the transaction
      if (args.voterAgentId === args.subjectAgentId) {
        throw new Error('Cannot vote for yourself')
      }
    }

    // Check if voter has already voted on this subject
    let existingVote
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      existingVote = await ctx.db
        .query('reputationVotes')
        .withIndex('by_voter', (q) => q.eq('voterAgentId', args.voterAgentId))
        .filter((q) => q.eq(q.field('subjectAgentId'), args.subjectAgentId))
        .first()
    } else if (args.subjectType === 'merchant' && args.subjectMerchantId) {
      existingVote = await ctx.db
        .query('reputationVotes')
        .withIndex('by_voter', (q) => q.eq('voterAgentId', args.voterAgentId))
        .filter((q) => q.eq(q.field('subjectMerchantId'), args.subjectMerchantId))
        .first()
    }

    // Calculate vote weight based on Ghost Score
    // Higher Ghost Score = more weight (linear scale)
    const weight = voter.ghostScore / 100

    let voteId
    if (existingVote) {
      // Update existing vote
      await ctx.db.patch('reputationVotes', existingVote._id, {
        voteType: args.voteType,
        weight,
        voterGhostScore: voter.ghostScore,
        reason: args.reason,
        basedOnTransactionId: args.basedOnTransactionId,
        timestamp: Date.now(),
      })
      voteId = existingVote._id
    } else {
      // Create new vote
      voteId = await ctx.db.insert('reputationVotes', {
        voterAgentId: args.voterAgentId,
        voterGhostScore: voter.ghostScore,
        subjectType: args.subjectType,
        subjectAgentId: args.subjectAgentId,
        subjectMerchantId: args.subjectMerchantId,
        voteType: args.voteType,
        weight,
        reason: args.reason,
        basedOnTransactionId: args.basedOnTransactionId,
        isActive: true,
        timestamp: Date.now(),
      })
    }

    // AUTO-CREATE TRUST RELATIONSHIP for positive votes between agents
    // This feeds the PageRank trust graph
    if (
      args.subjectType === 'agent' &&
      args.subjectAgentId &&
      isPositiveVote(args.voteType)
    ) {
      const category = voteTypeToCategory(args.voteType)

      // Create trust relationship from voter to subject
      await ctx.runMutation(internal.trustGraph.upsertRelationshipInternal, {
        fromAgentId: args.voterAgentId,
        toAgentId: args.subjectAgentId,
        relationshipType: 'vote',
        directWeight: Math.min(weight * 10, 100), // Scale weight to 0-100
        categories: [category],
        sourceVoteId: voteId,
      })
    }

    // Trigger reputation recalculation
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      await ctx.scheduler.runAfter(0, internal.reputationScores.calculate, {
        agentId: args.subjectAgentId,
      })
    }

    return voteId
  },
})

// Get votes for a subject (internal - for other Convex functions)
export const getForSubject = internalQuery({
  args: {
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
  },
  handler: async (ctx, args) => {
    let votes
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      votes = await ctx.db
        .query('reputationVotes')
        .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.subjectAgentId!))
        .filter((q) => q.eq(q.field('isActive'), true))
        .collect()
    } else if (args.subjectType === 'merchant' && args.subjectMerchantId) {
      votes = await ctx.db
        .query('reputationVotes')
        .withIndex('by_subject_merchant', (q) => q.eq('subjectMerchantId', args.subjectMerchantId!))
        .filter((q) => q.eq(q.field('isActive'), true))
        .collect()
    } else {
      return []
    }

    return votes
  },
})

// Get votes for a subject (public - for frontend)
export const getForSubjectPublic = query({
  args: {
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
  },
  handler: async (ctx, args) => {
    let votes
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      votes = await ctx.db
        .query('reputationVotes')
        .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.subjectAgentId!))
        .filter((q) => q.eq(q.field('isActive'), true))
        .collect()
    } else if (args.subjectType === 'merchant' && args.subjectMerchantId) {
      votes = await ctx.db
        .query('reputationVotes')
        .withIndex('by_subject_merchant', (q) => q.eq('subjectMerchantId', args.subjectMerchantId!))
        .filter((q) => q.eq(q.field('isActive'), true))
        .collect()
    } else {
      return []
    }

    return votes
  },
})

// Get votes by a voter
export const getByVoter = query({
  args: {
    voterAgentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query('reputationVotes')
      .withIndex('by_voter', (q) => q.eq('voterAgentId', args.voterAgentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .order('desc')
      .take(args.limit ?? 50)

    // Enrich with subject data
    return await Promise.all(
      votes.map(async (vote) => {
        let subject = null
        if (vote.subjectType === 'agent' && vote.subjectAgentId) {
          const agent = await ctx.db.get('agents', vote.subjectAgentId)
          subject = agent ? { type: 'agent' as const, name: agent.name, id: agent._id } : null
        } else if (vote.subjectType === 'merchant' && vote.subjectMerchantId) {
          const merchant = await ctx.db.get('merchants', vote.subjectMerchantId)
          subject = merchant
            ? { type: 'merchant' as const, name: merchant.name, id: merchant._id }
            : null
        }

        return {
          ...vote,
          subject,
        }
      })
    )
  },
})

// Get vote statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allVotes = await ctx.db
      .query('reputationVotes')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    const totalVotes = allVotes.length

    const voteTypeCounts = allVotes.reduce(
      (acc, v) => {
        acc[v.voteType] = (acc[v.voteType] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const avgWeight = allVotes.reduce((sum, v) => sum + v.weight, 0) / (totalVotes || 1)

    return {
      totalVotes,
      voteTypeCounts,
      avgWeight: Math.round(avgWeight * 100) / 100,
    }
  },
})

// Cast a vote (internal - for HTTP actions) - REQUIRES payment-backed transaction
export const castInternal = internalMutation({
  args: {
    voterAgentId: v.id('agents'),
    subjectType: v.union(v.literal('agent'), v.literal('merchant')),
    subjectAgentId: v.optional(v.id('agents')),
    subjectMerchantId: v.optional(v.id('merchants')),
    voteType: v.union(
      v.literal('trustworthy'),
      v.literal('untrustworthy'),
      v.literal('high_quality'),
      v.literal('low_quality'),
      v.literal('reliable'),
      v.literal('unreliable')
    ),
    reason: v.optional(v.string()),
    basedOnTransactionId: v.id('agentTransactions'), // REQUIRED - enforces payment-backed voting
  },
  handler: async (ctx, args) => {
    // Get voter's Ghost Score for weighting
    const voter = await ctx.db.get('agents', args.voterAgentId)
    if (!voter) {
      throw new Error('Voter agent not found')
    }

    // CRITICAL: Verify transaction exists and involves both voter and subject
    const transaction = await ctx.db.get('agentTransactions', args.basedOnTransactionId)
    if (!transaction) {
      throw new Error('Transaction not found - votes must be backed by a real transaction')
    }

    // Verify the transaction involves the voter (either as primary agent or counterparty)
    const voterInvolved =
      transaction.agentId === args.voterAgentId ||
      transaction.counterpartyAgentId === args.voterAgentId

    if (!voterInvolved) {
      throw new Error('Voter must be party to the transaction')
    }

    // For agent votes, verify the subject is also in the transaction
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      const subjectInvolved =
        transaction.agentId === args.subjectAgentId ||
        transaction.counterpartyAgentId === args.subjectAgentId

      if (!subjectInvolved) {
        throw new Error('Subject agent must be party to the transaction')
      }

      if (args.voterAgentId === args.subjectAgentId) {
        throw new Error('Cannot vote for yourself')
      }
    }

    // Check if voter has already voted on this subject
    let existingVote
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      existingVote = await ctx.db
        .query('reputationVotes')
        .withIndex('by_voter', (q) => q.eq('voterAgentId', args.voterAgentId))
        .filter((q) => q.eq(q.field('subjectAgentId'), args.subjectAgentId))
        .first()
    } else if (args.subjectType === 'merchant' && args.subjectMerchantId) {
      existingVote = await ctx.db
        .query('reputationVotes')
        .withIndex('by_voter', (q) => q.eq('voterAgentId', args.voterAgentId))
        .filter((q) => q.eq(q.field('subjectMerchantId'), args.subjectMerchantId))
        .first()
    }

    // Calculate vote weight based on Ghost Score
    const weight = voter.ghostScore / 100

    let voteId
    if (existingVote) {
      // Update existing vote
      await ctx.db.patch('reputationVotes', existingVote._id, {
        voteType: args.voteType,
        weight,
        voterGhostScore: voter.ghostScore,
        reason: args.reason,
        basedOnTransactionId: args.basedOnTransactionId,
        timestamp: Date.now(),
      })
      voteId = existingVote._id
    } else {
      // Create new vote
      voteId = await ctx.db.insert('reputationVotes', {
        voterAgentId: args.voterAgentId,
        voterGhostScore: voter.ghostScore,
        subjectType: args.subjectType,
        subjectAgentId: args.subjectAgentId,
        subjectMerchantId: args.subjectMerchantId,
        voteType: args.voteType,
        weight,
        reason: args.reason,
        basedOnTransactionId: args.basedOnTransactionId,
        isActive: true,
        timestamp: Date.now(),
      })
    }

    // AUTO-CREATE TRUST RELATIONSHIP for positive votes between agents
    if (
      args.subjectType === 'agent' &&
      args.subjectAgentId &&
      isPositiveVote(args.voteType)
    ) {
      const category = voteTypeToCategory(args.voteType)

      await ctx.runMutation(internal.trustGraph.upsertRelationshipInternal, {
        fromAgentId: args.voterAgentId,
        toAgentId: args.subjectAgentId,
        relationshipType: 'vote',
        directWeight: Math.min(weight * 10, 100),
        categories: [category],
        sourceVoteId: voteId,
      })
    }

    // Trigger reputation recalculation
    if (args.subjectType === 'agent' && args.subjectAgentId) {
      await ctx.scheduler.runAfter(0, internal.reputationScores.calculate, {
        agentId: args.subjectAgentId,
      })
    }

    return voteId
  },
})
