/**
 * Anomaly Detection
 *
 * Detects unusual patterns in agent behavior, facilitator health, and transaction volume.
 * Runs every 5 minutes to identify critical issues early.
 */

import { internalAction, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'

// ========================================
// MAIN DETECTION ACTION
// ========================================

/**
 * Run all anomaly detection checks
 * Called by cron every 5 minutes
 */
interface AnomalyResult {
  type: string
  agentId?: string
  facilitatorId?: string
  facilitatorSlug?: string
  metric?: string
  currentValue?: number
  historicalValue?: number
  changePercent?: number
  threshold?: number
  consecutiveFailures?: number
  severity: string
}

export const detectAll = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    total: number
    agent: number
    facilitator: number
    volume: number
    details: {
      agent: AnomalyResult[]
      facilitator: AnomalyResult[]
      volume: AnomalyResult[]
    }
  }> => {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    console.log('[Anomalies] Running anomaly detection...')

    // Run all detection checks in parallel
    const [agentAnomalies, facilitatorAnomalies, volumeAnomalies] = await Promise.all([
      ctx.runMutation(internal.analysis.anomalies.detectAgentAnomalies, {
        oneHourAgo,
        oneDayAgo,
        now,
      }),
      ctx.runMutation(internal.analysis.anomalies.detectFacilitatorAnomalies, { now }),
      ctx.runMutation(internal.analysis.anomalies.detectVolumeAnomalies, {
        oneHourAgo,
        oneDayAgo,
        now,
      }),
    ])

    const totalAnomalies = agentAnomalies.length + facilitatorAnomalies.length + volumeAnomalies.length

    console.log(`[Anomalies] Found ${totalAnomalies} anomalies:`)
    console.log(`  - Agent: ${agentAnomalies.length}`)
    console.log(`  - Facilitator: ${facilitatorAnomalies.length}`)
    console.log(`  - Volume: ${volumeAnomalies.length}`)

    return {
      total: totalAnomalies,
      agent: agentAnomalies.length,
      facilitator: facilitatorAnomalies.length,
      volume: volumeAnomalies.length,
      details: {
        agent: agentAnomalies,
        facilitator: facilitatorAnomalies,
        volume: volumeAnomalies,
      },
    }
  },
})

// ========================================
// AGENT ANOMALY DETECTION
// ========================================

/**
 * Detect agent performance anomalies
 * - Success rate drops > 20%
 * - Error rate spikes > 2x normal
 */
export const detectAgentAnomalies = internalMutation({
  args: {
    oneHourAgo: v.number(),
    oneDayAgo: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const anomalies: Array<{
      type: string
      agentId: string
      metric: string
      currentValue: number
      historicalValue: number
      changePercent: number
      severity: string
    }> = []

    // Get all agent profiles
    const profiles = await ctx.db.query('agentProfiles').collect()

    for (const profile of profiles) {
      // Get recent transactions for this agent
      const recentTxs = await ctx.db
        .query('agentTransactions')
        .withIndex('by_agent', (q) => q.eq('agentId', profile.agentId))
        .filter((q) => q.gte(q.field('timestamp'), args.oneHourAgo))
        .collect()

      const historicalTxs = await ctx.db
        .query('agentTransactions')
        .withIndex('by_agent', (q) => q.eq('agentId', profile.agentId))
        .filter((q) =>
          q.and(
            q.gte(q.field('timestamp'), args.oneDayAgo),
            q.lt(q.field('timestamp'), args.oneHourAgo)
          )
        )
        .collect()

      // Need at least 5 transactions to detect anomalies
      if (recentTxs.length < 5 || historicalTxs.length < 10) continue

      // Calculate success rates
      const recentSuccessRate =
        (recentTxs.filter((t) => t.status === 'confirmed').length / recentTxs.length) * 100
      const historicalSuccessRate =
        (historicalTxs.filter((t) => t.status === 'confirmed').length / historicalTxs.length) * 100

      // Check for 20%+ drop in success rate
      const successRateDrop = historicalSuccessRate - recentSuccessRate
      if (successRateDrop > 20 && historicalSuccessRate > 50) {
        const anomaly = {
          type: 'agent_success_rate_drop',
          agentId: profile.agentId,
          metric: 'success_rate',
          currentValue: Math.round(recentSuccessRate),
          historicalValue: Math.round(historicalSuccessRate),
          changePercent: Math.round(-successRateDrop),
          severity: successRateDrop > 40 ? 'high' : 'medium',
        }
        anomalies.push(anomaly)

        // Record as trust event
        await ctx.db.insert('trustEvents', {
          agentId: profile.agentId,
          eventType: 'verification_failed',
          oldScore: Math.round(historicalSuccessRate * 10),
          newScore: Math.round(recentSuccessRate * 10),
          reason: `Success rate dropped ${Math.round(successRateDrop)}% (from ${Math.round(historicalSuccessRate)}% to ${Math.round(recentSuccessRate)}%)`,
          metadata: anomaly,
          timestamp: args.now,
        })
      }

      // Check for error rate spike (2x normal)
      const recentErrorRate =
        (recentTxs.filter((t) => t.status === 'failed').length / recentTxs.length) * 100
      const historicalErrorRate =
        (historicalTxs.filter((t) => t.status === 'failed').length / historicalTxs.length) * 100

      if (recentErrorRate > historicalErrorRate * 2 && recentErrorRate > 10) {
        const anomaly = {
          type: 'agent_error_rate_spike',
          agentId: profile.agentId,
          metric: 'error_rate',
          currentValue: Math.round(recentErrorRate),
          historicalValue: Math.round(historicalErrorRate),
          changePercent: Math.round(
            ((recentErrorRate - historicalErrorRate) / (historicalErrorRate || 1)) * 100
          ),
          severity: recentErrorRate > 30 ? 'high' : 'medium',
        }
        anomalies.push(anomaly)

        await ctx.db.insert('trustEvents', {
          agentId: profile.agentId,
          eventType: 'score_decrease',
          reason: `Error rate spiked to ${Math.round(recentErrorRate)}% (was ${Math.round(historicalErrorRate)}%)`,
          metadata: anomaly,
          timestamp: args.now,
        })
      }
    }

    return anomalies
  },
})

// ========================================
// FACILITATOR ANOMALY DETECTION
// ========================================

/**
 * Detect facilitator health anomalies
 * - 3+ consecutive health check failures
 */
export const detectFacilitatorAnomalies = internalMutation({
  args: {
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const anomalies: Array<{
      type: string
      facilitatorId: string
      facilitatorSlug: string
      consecutiveFailures: number
      severity: string
    }> = []

    // Get all facilitators
    const facilitators = await ctx.db.query('facilitators').collect()

    for (const facilitator of facilitators) {
      // Get recent health checks
      const recentHealth = await ctx.db
        .query('facilitatorHealth')
        .withIndex('by_facilitator', (q) => q.eq('facilitatorId', facilitator._id))
        .order('desc')
        .take(5)

      // Count consecutive failures
      let consecutiveFailures = 0
      for (const health of recentHealth) {
        if (health.status === 'offline') {
          consecutiveFailures++
        } else {
          break
        }
      }

      // Alert if 3+ consecutive failures
      if (consecutiveFailures >= 3) {
        const anomaly = {
          type: 'facilitator_consecutive_failures',
          facilitatorId: facilitator._id,
          facilitatorSlug: facilitator.slug,
          consecutiveFailures,
          severity: consecutiveFailures >= 5 ? 'critical' : 'high',
        }
        anomalies.push(anomaly)

        // Check if incident already exists for this facilitator
        const existingIncident = await ctx.db
          .query('facilitatorIncidents')
          .withIndex('by_facilitator', (q) => q.eq('facilitatorId', facilitator._id))
          .filter((q) =>
            q.and(
              q.neq(q.field('status'), 'resolved'),
              q.gte(q.field('startedAt'), args.now - 6 * 60 * 60 * 1000) // Last 6 hours
            )
          )
          .first()

        if (!existingIncident) {
          // Create new incident
          await ctx.db.insert('facilitatorIncidents', {
            facilitatorId: facilitator._id,
            severity: consecutiveFailures >= 5 ? 'critical' : 'high',
            status: 'investigating',
            title: `${facilitator.name} experiencing outage`,
            description: `Facilitator has ${consecutiveFailures} consecutive health check failures`,
            affectedNetworks: facilitator.networks as string[],
            affectedServices: ['verify', 'settle'],
            startedAt: args.now,
            affectedTransactions: 0,
            reportedBy: 'auto-monitor',
          })
        }
      }
    }

    return anomalies
  },
})

// ========================================
// VOLUME ANOMALY DETECTION
// ========================================

/**
 * Detect transaction volume anomalies
 * - 50%+ volume drop
 * - 3x volume spike
 */
export const detectVolumeAnomalies = internalMutation({
  args: {
    oneHourAgo: v.number(),
    oneDayAgo: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const anomalies: Array<{
      type: string
      metric: string
      currentValue: number
      historicalValue: number
      changePercent: number
      severity: string
    }> = []

    // Get recent transaction count
    const recentTxs = await ctx.db
      .query('agentTransactions')
      .withIndex('by_timestamp', (q) => q.gte('timestamp', args.oneHourAgo))
      .collect()

    // Get historical transaction count (same hour yesterday)
    const historicalTxs = await ctx.db
      .query('agentTransactions')
      .withIndex('by_timestamp', (q) => q.gte('timestamp', args.oneDayAgo))
      .filter((q) => q.lt(q.field('timestamp'), args.oneDayAgo + 60 * 60 * 1000))
      .collect()

    // Need enough data to compare
    if (historicalTxs.length < 10) return anomalies

    const recentCount = recentTxs.length
    const historicalCount = historicalTxs.length

    // Check for 50%+ volume drop
    const volumeDropPercent = ((historicalCount - recentCount) / historicalCount) * 100
    if (volumeDropPercent > 50) {
      anomalies.push({
        type: 'network_volume_drop',
        metric: 'transaction_count',
        currentValue: recentCount,
        historicalValue: historicalCount,
        changePercent: Math.round(-volumeDropPercent),
        severity: volumeDropPercent > 75 ? 'high' : 'medium',
      })
    }

    // Check for 3x volume spike (could indicate spam or unusual activity)
    if (recentCount > historicalCount * 3 && recentCount > 100) {
      anomalies.push({
        type: 'network_volume_spike',
        metric: 'transaction_count',
        currentValue: recentCount,
        historicalValue: historicalCount,
        changePercent: Math.round(((recentCount - historicalCount) / historicalCount) * 100),
        severity: recentCount > historicalCount * 5 ? 'high' : 'medium',
      })
    }

    return anomalies
  },
})

// ========================================
// ALERT MANAGEMENT
// ========================================

/**
 * Record an anomaly alert
 */
export const recordAlert = internalMutation({
  args: {
    type: v.string(),
    severity: v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('critical')),
    title: v.string(),
    description: v.string(),
    metadata: v.optional(v.any()),
    agentId: v.optional(v.id('agents')),
    facilitatorId: v.optional(v.id('facilitators')),
  },
  handler: async (ctx, args) => {
    // Store in trustEvents for now (could add dedicated alerts table)
    if (args.agentId) {
      await ctx.db.insert('trustEvents', {
        agentId: args.agentId,
        eventType: 'score_decrease',
        reason: `${args.type}: ${args.title}`,
        metadata: {
          severity: args.severity,
          description: args.description,
          ...args.metadata,
        },
        timestamp: Date.now(),
      })
    }

    console.log(`[Alert] ${args.severity.toUpperCase()}: ${args.title}`)

    return { recorded: true }
  },
})
