/**
 * Agent Attestations Functions
 *
 * Agent-to-agent endorsements and capability verifications
 */

import { query, mutation, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Create an attestation
export const create = mutation({
  args: {
    attestorAgentId: v.id('agents'),
    subjectAgentId: v.id('agents'),
    attestationType: v.union(
      v.literal('endorsement'),
      v.literal('capability_verification'),
      v.literal('reliability'),
      v.literal('security'),
      v.literal('quality')
    ),
    claim: v.string(),
    confidence: v.number(), // 0-100
    basedOn: v.optional(v.string()),
    evidence: v.optional(v.any()),
    relatedTransactionId: v.optional(v.id('agentTransactions')),
    relatedCapability: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify attestor exists
    const attestor = await ctx.db.get('agents', args.attestorAgentId)
    if (!attestor) {
      throw new Error('Attestor agent not found')
    }

    // Verify subject exists
    const subject = await ctx.db.get('agents', args.subjectAgentId)
    if (!subject) {
      throw new Error('Subject agent not found')
    }

    // Can't attest to yourself
    if (args.attestorAgentId === args.subjectAgentId) {
      throw new Error('Cannot attest to yourself')
    }

    const attestationId = await ctx.db.insert('agentAttestations', {
      attestorAgentId: args.attestorAgentId,
      subjectAgentId: args.subjectAgentId,
      attestationType: args.attestationType,
      claim: args.claim,
      confidence: args.confidence,
      basedOn: args.basedOn,
      evidence: args.evidence,
      relatedTransactionId: args.relatedTransactionId,
      relatedCapability: args.relatedCapability,
      isActive: true,
      revokedAt: undefined,
      revocationReason: undefined,
      attestedAt: Date.now(),
      expiresAt: args.expiresAt,
    })

    // Update agent profile endorsement count
    await ctx.scheduler.runAfter(0, internal.agentProfiles.updateMetrics, {
      agentId: args.subjectAgentId,
    })

    // Trigger reputation recalculation
    await ctx.scheduler.runAfter(0, internal.reputationScores.calculate, {
      agentId: args.subjectAgentId,
    })

    // Create trust relationship for attestations
    // This connects the endorsement system to the trust graph WITHOUT requiring a transaction
    const categoryMap: Record<string, string> = {
      endorsement: 'general',
      quality: 'quality',
      reliability: 'reliability',
      capability_verification: 'technical',
      security: 'trustworthiness',
    }

    await ctx.runMutation(internal.trustGraph.upsertRelationshipInternal, {
      fromAgentId: args.attestorAgentId,
      toAgentId: args.subjectAgentId,
      relationshipType: 'attestation',
      directWeight: args.confidence, // Use confidence as weight (0-100)
      categories: [categoryMap[args.attestationType] || 'general'],
      sourceAttestationId: attestationId,
    })

    return attestationId
  },
})

// Get attestations for a subject agent
export const getForSubject = internalQuery({
  args: {
    subjectAgentId: v.id('agents'),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('agentAttestations')
      .withIndex('by_subject', (q) => q.eq('subjectAgentId', args.subjectAgentId))

    let attestations = await query.collect()

    // Filter by active status if requested
    if (args.activeOnly) {
      const now = Date.now()
      attestations = attestations.filter(
        (a) => a.isActive && (!a.expiresAt || a.expiresAt > now)
      )
    }

    return attestations
  },
})

// Get attestations by a subject (public query version)
export const getForSubjectPublic = query({
  args: {
    subjectAgentId: v.id('agents'),
    type: v.optional(
      v.union(
        v.literal('endorsement'),
        v.literal('capability_verification'),
        v.literal('reliability'),
        v.literal('security'),
        v.literal('quality')
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    let query = ctx.db
      .query('agentAttestations')
      .withIndex('by_subject', (q) => q.eq('subjectAgentId', args.subjectAgentId))
      .filter((q) => q.eq(q.field('isActive'), true))

    let attestations = await query.order('desc').take(args.limit ?? 50)

    // Filter by type if specified
    if (args.type) {
      attestations = attestations.filter((a) => a.attestationType === args.type)
    }

    // Filter out expired attestations
    attestations = attestations.filter((a) => !a.expiresAt || a.expiresAt > now)

    // Enrich with attestor data
    return await Promise.all(
      attestations.map(async (att) => {
        const attestor = await ctx.db.get('agents', att.attestorAgentId)

        return {
          ...att,
          attestor: attestor
            ? {
                name: attestor.name,
                address: attestor.address,
                ghostScore: attestor.ghostScore,
                tier: attestor.tier,
              }
            : null,
        }
      })
    )
  },
})

// Get attestations made by an attestor
export const getByAttestor = query({
  args: {
    attestorAgentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const attestations = await ctx.db
      .query('agentAttestations')
      .withIndex('by_attestor', (q) => q.eq('attestorAgentId', args.attestorAgentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .order('desc')
      .take(args.limit ?? 50)

    // Enrich with subject data
    return await Promise.all(
      attestations.map(async (att) => {
        const subject = await ctx.db.get('agents', att.subjectAgentId)

        return {
          ...att,
          subject: subject
            ? {
                name: subject.name,
                address: subject.address,
                ghostScore: subject.ghostScore,
                tier: subject.tier,
              }
            : null,
        }
      })
    )
  },
})

// Revoke an attestation
export const revoke = mutation({
  args: {
    attestationId: v.id('agentAttestations'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const attestation = await ctx.db.get('agentAttestations', args.attestationId)

    if (!attestation) {
      throw new Error('Attestation not found')
    }

    await ctx.db.patch('agentAttestations', args.attestationId, {
      isActive: false,
      revokedAt: Date.now(),
      revocationReason: args.reason,
    })

    // Trigger reputation recalculation
    await ctx.scheduler.runAfter(0, internal.reputationScores.calculate, {
      agentId: attestation.subjectAgentId,
    })

    return args.attestationId
  },
})

// Get attestation statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const allAttestations = await ctx.db.query('agentAttestations').collect()

    const activeAttestations = allAttestations.filter(
      (a) => a.isActive && (!a.expiresAt || a.expiresAt > now)
    )

    const typeCounts = activeAttestations.reduce(
      (acc, a) => {
        acc[a.attestationType] = (acc[a.attestationType] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const avgConfidence =
      activeAttestations.reduce((sum, a) => sum + a.confidence, 0) /
      (activeAttestations.length || 1)

    return {
      totalAttestations: allAttestations.length,
      activeAttestations: activeAttestations.length,
      revokedAttestations: allAttestations.filter((a) => !a.isActive).length,
      typeCounts,
      avgConfidence: Math.round(avgConfidence),
    }
  },
})

// Create an attestation (internal - for HTTP actions)
export const createInternal = internalMutation({
  args: {
    attestorAgentId: v.id('agents'),
    subjectAgentId: v.id('agents'),
    attestationType: v.union(
      v.literal('endorsement'),
      v.literal('capability_verification'),
      v.literal('reliability'),
      v.literal('security'),
      v.literal('quality')
    ),
    claim: v.string(),
    confidence: v.number(), // 0-100
    basedOn: v.optional(v.string()),
    evidence: v.optional(v.any()),
    relatedTransactionId: v.optional(v.id('agentTransactions')),
    relatedCapability: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify attestor exists
    const attestor = await ctx.db.get('agents', args.attestorAgentId)
    if (!attestor) {
      throw new Error('Attestor agent not found')
    }

    // Verify subject exists
    const subject = await ctx.db.get('agents', args.subjectAgentId)
    if (!subject) {
      throw new Error('Subject agent not found')
    }

    // Can't attest to yourself
    if (args.attestorAgentId === args.subjectAgentId) {
      throw new Error('Cannot attest to yourself')
    }

    const attestationId = await ctx.db.insert('agentAttestations', {
      attestorAgentId: args.attestorAgentId,
      subjectAgentId: args.subjectAgentId,
      attestationType: args.attestationType,
      claim: args.claim,
      confidence: args.confidence,
      basedOn: args.basedOn,
      evidence: args.evidence,
      relatedTransactionId: args.relatedTransactionId,
      relatedCapability: args.relatedCapability,
      isActive: true,
      revokedAt: undefined,
      revocationReason: undefined,
      attestedAt: Date.now(),
      expiresAt: args.expiresAt,
    })

    // Update agent profile endorsement count
    await ctx.scheduler.runAfter(0, internal.agentProfiles.updateMetrics, {
      agentId: args.subjectAgentId,
    })

    // Trigger reputation recalculation
    await ctx.scheduler.runAfter(0, internal.reputationScores.calculate, {
      agentId: args.subjectAgentId,
    })

    // Create trust relationship for attestations
    // This connects the endorsement system to the trust graph WITHOUT requiring a transaction
    const categoryMap: Record<string, string> = {
      endorsement: 'general',
      quality: 'quality',
      reliability: 'reliability',
      capability_verification: 'technical',
      security: 'trustworthiness',
    }

    await ctx.runMutation(internal.trustGraph.upsertRelationshipInternal, {
      fromAgentId: args.attestorAgentId,
      toAgentId: args.subjectAgentId,
      relationshipType: 'attestation',
      directWeight: args.confidence,
      categories: [categoryMap[args.attestationType] || 'general'],
      sourceAttestationId: attestationId,
    })

    return attestationId
  },
})
