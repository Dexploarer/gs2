/**
 * Data Cleanup
 *
 * Removes expired data, cleans up orphaned records, and validates data integrity.
 * Runs daily to maintain database health.
 */

import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'

// ========================================
// MAIN CLEANUP ACTION
// ========================================

/**
 * Run all cleanup tasks
 * Called by cron daily at 8:00 UTC
 */
export const cleanupAll = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[Cleanup] Starting data cleanup...')

    const results = {
      expiredCredentials: 0,
      orphanedProfiles: 0,
      staleIncidents: 0,
      inactiveAgents: 0,
    }

    // Clean up expired credentials
    try {
      results.expiredCredentials = await ctx.runMutation(
        internal.maintenance.cleanup.cleanupExpiredCredentials,
        {}
      )
      console.log(`[Cleanup] Cleaned ${results.expiredCredentials} expired credentials`)
    } catch (error) {
      console.error('[Cleanup] Failed to cleanup credentials:', error)
    }

    // Clean up orphaned profiles
    try {
      results.orphanedProfiles = await ctx.runMutation(
        internal.maintenance.cleanup.cleanupOrphanedProfiles,
        {}
      )
      console.log(`[Cleanup] Cleaned ${results.orphanedProfiles} orphaned profiles`)
    } catch (error) {
      console.error('[Cleanup] Failed to cleanup profiles:', error)
    }

    // Auto-resolve stale incidents
    try {
      results.staleIncidents = await ctx.runMutation(
        internal.maintenance.cleanup.resolveStaleIncidents,
        {}
      )
      console.log(`[Cleanup] Resolved ${results.staleIncidents} stale incidents`)
    } catch (error) {
      console.error('[Cleanup] Failed to resolve incidents:', error)
    }

    // Mark inactive agents
    try {
      results.inactiveAgents = await ctx.runMutation(
        internal.maintenance.cleanup.markInactiveAgents,
        {}
      )
      console.log(`[Cleanup] Marked ${results.inactiveAgents} agents as inactive`)
    } catch (error) {
      console.error('[Cleanup] Failed to mark inactive agents:', error)
    }

    const total =
      results.expiredCredentials +
      results.orphanedProfiles +
      results.staleIncidents +
      results.inactiveAgents

    console.log(`[Cleanup] Total cleaned: ${total} records`)

    return {
      cleaned: total,
      details: results,
      timestamp: Date.now(),
    }
  },
})

// ========================================
// CREDENTIAL CLEANUP
// ========================================

/**
 * Clean up expired credentials
 * Revokes credentials past their expiration date
 */
export const cleanupExpiredCredentials = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Find expired credentials that are still active
    const expiredCredentials = await ctx.db
      .query('credentials')
      .filter((q) =>
        q.and(
          q.eq(q.field('isRevoked'), false),
          q.neq(q.field('expiresAt'), undefined),
          q.lt(q.field('expiresAt'), now)
        )
      )
      .take(100)

    // Revoke expired credentials
    for (const credential of expiredCredentials) {
      await ctx.db.patch(credential._id, {
        isRevoked: true,
      })
    }

    return expiredCredentials.length
  },
})

// ========================================
// PROFILE CLEANUP
// ========================================

/**
 * Clean up orphaned agent profiles
 * Removes profiles without a corresponding agent
 */
export const cleanupOrphanedProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all profiles
    const profiles = await ctx.db.query('agentProfiles').take(1000)

    let cleaned = 0

    for (const profile of profiles) {
      // Check if agent exists
      const agent = await ctx.db.get('agents', profile.agentId)

      if (!agent) {
        // Delete orphaned profile
        await ctx.db.delete(profile._id)
        cleaned++
      }
    }

    return cleaned
  },
})

// ========================================
// INCIDENT CLEANUP
// ========================================

/**
 * Auto-resolve stale incidents
 * Resolves incidents that have been investigating for too long without updates
 */
export const resolveStaleIncidents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const staleThreshold = 24 * 60 * 60 * 1000 // 24 hours

    // Find stale incidents (investigating for > 24 hours)
    const staleIncidents = await ctx.db
      .query('facilitatorIncidents')
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'investigating'),
          q.lt(q.field('startedAt'), now - staleThreshold)
        )
      )
      .take(50)

    for (const incident of staleIncidents) {
      // Check if facilitator is now healthy
      const recentHealth = await ctx.db
        .query('facilitatorHealth')
        .withIndex('by_facilitator', (q) => q.eq('facilitatorId', incident.facilitatorId))
        .order('desc')
        .first()

      if (recentHealth?.status === 'online') {
        // Auto-resolve the incident
        await ctx.db.patch(incident._id, {
          status: 'resolved',
          resolvedAt: now,
          resolution: 'Auto-resolved: Facilitator recovered',
        })
      } else {
        // Escalate to identified status
        await ctx.db.patch(incident._id, {
          status: 'identified',
        })
      }
    }

    return staleIncidents.length
  },
})

// ========================================
// AGENT CLEANUP
// ========================================

/**
 * Mark inactive agents
 * Agents with no activity in 30 days are marked as inactive
 */
export const markInactiveAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const inactiveThreshold = 30 * 24 * 60 * 60 * 1000 // 30 days

    // Get active agents
    const activeAgents = await ctx.db
      .query('agents')
      .filter((q) => q.eq(q.field('isActive'), true))
      .take(500)

    let marked = 0

    for (const agent of activeAgents) {
      // Get agent's profile for last active time
      const profile = await ctx.db
        .query('agentProfiles')
        .withIndex('by_agent', (q) => q.eq('agentId', agent._id))
        .first()

      const lastActive = profile?.lastActiveAt ?? agent.createdAt

      if (lastActive < now - inactiveThreshold) {
        // Mark as inactive
        await ctx.db.patch(agent._id, {
          isActive: false,
          updatedAt: now,
        })

        // Record trust event
        await ctx.db.insert('trustEvents', {
          agentId: agent._id,
          eventType: 'score_decrease',
          reason: 'Marked inactive due to 30+ days of inactivity',
          timestamp: now,
        })

        marked++
      }
    }

    return marked
  },
})

// ========================================
// WEBHOOK CLEANUP
// ========================================

/**
 * Process webhook delivery queue
 * Retries failed webhooks and cleans up old entries
 */
export const processWebhookQueue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let processed = 0
    let failed = 0
    let expired = 0

    // Find pending webhooks that are due for delivery
    const pendingWebhooks = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .take(100)

    // Find webhooks that need retry
    const retryingWebhooks = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status', (q) => q.eq('status', 'retrying'))
      .filter((q) => q.lte(q.field('nextAttemptAt'), now))
      .take(100)

    const webhooksToProcess = [...pendingWebhooks, ...retryingWebhooks]

    for (const webhook of webhooksToProcess) {
      // Check if expired
      if (now >= webhook.expiresAt) {
        await ctx.db.patch(webhook._id, {
          status: 'failed',
          lastErrorMessage: 'Webhook delivery expired after max retries',
        })
        expired++
        continue
      }

      // Check if max attempts reached
      if (webhook.attempts >= webhook.maxAttempts) {
        await ctx.db.patch(webhook._id, {
          status: 'failed',
          lastErrorMessage: `Max attempts (${webhook.maxAttempts}) reached`,
        })
        failed++
        continue
      }

      // Attempt delivery (note: actual HTTP call should be in an action, not mutation)
      // Here we just increment the attempt counter and schedule for retry
      const nextAttemptDelay = Math.min(
        5 * 60 * 1000 * Math.pow(2, webhook.attempts), // Exponential backoff
        24 * 60 * 60 * 1000 // Max 24 hour delay
      )

      await ctx.db.patch(webhook._id, {
        status: 'retrying',
        attempts: webhook.attempts + 1,
        lastAttemptAt: now,
        nextAttemptAt: now + nextAttemptDelay,
      })

      processed++
    }

    // Clean up old delivered webhooks (older than 7 days)
    const cleanupCutoff = now - 7 * 24 * 60 * 60 * 1000
    const oldDelivered = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status', (q) => q.eq('status', 'delivered'))
      .filter((q) => q.lt(q.field('deliveredAt'), cleanupCutoff))
      .take(500)

    for (const webhook of oldDelivered) {
      await ctx.db.delete(webhook._id)
    }

    console.log(`[Cleanup] Webhook queue: processed=${processed}, failed=${failed}, expired=${expired}, cleaned=${oldDelivered.length}`)
    return processed + failed + expired + oldDelivered.length
  },
})

// ========================================
// DATA VALIDATION
// ========================================

/**
 * Validate agent identities
 * Checks for data integrity issues
 */
export const validateAgentIdentities = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query('agents').take(500)
    let issues = 0

    for (const agent of agents) {
      const problems: string[] = []

      // Check for missing required fields
      if (!agent.address) problems.push('Missing address')
      if (!agent.name) problems.push('Missing name')
      if (agent.ghostScore === undefined) problems.push('Missing ghostScore')

      // Check for invalid score range
      if (agent.ghostScore < 0 || agent.ghostScore > 1000) {
        problems.push(`Invalid ghostScore: ${agent.ghostScore}`)
      }

      // Check tier consistency
      const expectedTier = getTierForScore(agent.ghostScore ?? 0)
      if (agent.tier !== expectedTier) {
        problems.push(`Tier mismatch: ${agent.tier} should be ${expectedTier}`)

        // Fix the tier
        await ctx.db.patch(agent._id, {
          tier: expectedTier,
          updatedAt: Date.now(),
        })
      }

      if (problems.length > 0) {
        console.log(`[Validation] Agent ${agent.address}: ${problems.join(', ')}`)
        issues++
      }
    }

    return issues
  },
})

// ========================================
// QUERY HELPERS
// ========================================

/**
 * Get cleanup statistics
 */
export const getCleanupStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Count items that would be cleaned
    const expiredCredentials = await ctx.db
      .query('credentials')
      .filter((q) =>
        q.and(
          q.eq(q.field('isRevoked'), false),
          q.neq(q.field('expiresAt'), undefined),
          q.lt(q.field('expiresAt'), now)
        )
      )
      .collect()

    const staleIncidents = await ctx.db
      .query('facilitatorIncidents')
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'investigating'),
          q.lt(q.field('startedAt'), now - 24 * 60 * 60 * 1000)
        )
      )
      .collect()

    const inactiveThreshold = 30 * 24 * 60 * 60 * 1000
    const profiles = await ctx.db.query('agentProfiles').collect()
    const potentiallyInactive = profiles.filter(
      (p) => (p.lastActiveAt ?? 0) < now - inactiveThreshold
    ).length

    return {
      pendingCleanup: {
        expiredCredentials: expiredCredentials.length,
        staleIncidents: staleIncidents.length,
        potentiallyInactiveAgents: potentiallyInactive,
      },
    }
  },
})

// ========================================
// HELPERS
// ========================================

function getTierForScore(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (score >= 900) return 'platinum'
  if (score >= 750) return 'gold'
  if (score >= 500) return 'silver'
  return 'bronze'
}
