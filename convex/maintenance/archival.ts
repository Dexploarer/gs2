/**
 * Data Archival
 *
 * Archives historical data to maintain database performance.
 * Keeps last 90 days detailed, aggregates older data.
 */

import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'

// ========================================
// ARCHIVAL CONFIGURATION
// ========================================

const RETENTION_DAYS = {
  transactions: 90, // Keep detailed transactions for 90 days
  healthRecords: 7, // Keep health records for 7 days
  scoreHistory: 180, // Keep score history for 180 days
  trustEvents: 90, // Keep trust events for 90 days
}

// ========================================
// MAIN ARCHIVAL ACTION
// ========================================

/**
 * Archive historical data
 * Called by cron daily at 1:00 UTC
 */
export const archiveAll = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[Archival] Starting historical data archival...')

    const results = {
      transactions: 0,
      healthRecords: 0,
      scoreHistory: 0,
      trustEvents: 0,
    }

    // Archive transactions
    try {
      results.transactions = await ctx.runMutation(internal.maintenance.archival.archiveTransactions, {})
      console.log(`[Archival] Archived ${results.transactions} transactions`)
    } catch (error) {
      console.error('[Archival] Failed to archive transactions:', error)
    }

    // Archive health records
    try {
      results.healthRecords = await ctx.runMutation(internal.maintenance.archival.archiveHealthRecords, {})
      console.log(`[Archival] Archived ${results.healthRecords} health records`)
    } catch (error) {
      console.error('[Archival] Failed to archive health records:', error)
    }

    // Archive score history
    try {
      results.scoreHistory = await ctx.runMutation(internal.maintenance.archival.archiveScoreHistory, {})
      console.log(`[Archival] Archived ${results.scoreHistory} score history records`)
    } catch (error) {
      console.error('[Archival] Failed to archive score history:', error)
    }

    // Archive trust events
    try {
      results.trustEvents = await ctx.runMutation(internal.maintenance.archival.archiveTrustEvents, {})
      console.log(`[Archival] Archived ${results.trustEvents} trust events`)
    } catch (error) {
      console.error('[Archival] Failed to archive trust events:', error)
    }

    const total =
      results.transactions + results.healthRecords + results.scoreHistory + results.trustEvents
    console.log(`[Archival] Total archived: ${total} records`)

    return {
      archived: total,
      details: results,
      timestamp: Date.now(),
    }
  },
})

// ========================================
// TRANSACTION ARCHIVAL
// ========================================

/**
 * Archive old transactions
 * Creates daily aggregates and removes individual records older than retention period
 */
export const archiveTransactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_DAYS.transactions * 24 * 60 * 60 * 1000

    // Find transactions older than retention period
    const oldTransactions = await ctx.db
      .query('agentTransactions')
      .filter((q) => q.lt(q.field('timestamp'), cutoffDate))
      .take(1000) // Process in batches

    if (oldTransactions.length === 0) {
      return 0
    }

    // Group by agent and day for aggregation
    const aggregates = new Map<
      string,
      {
        agentId: string
        date: string
        txCount: number
        successCount: number
        failedCount: number
        totalAmountUSDC: number
        totalFeesUSDC: number
      }
    >()

    for (const tx of oldTransactions) {
      const date = new Date(tx.timestamp).toISOString().split('T')[0]
      const key = `${tx.agentId}-${date}`

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          agentId: tx.agentId,
          date,
          txCount: 0,
          successCount: 0,
          failedCount: 0,
          totalAmountUSDC: 0,
          totalFeesUSDC: 0,
        })
      }

      const agg = aggregates.get(key)!
      agg.txCount++
      if (tx.status === 'confirmed') agg.successCount++
      if (tx.status === 'failed') agg.failedCount++
      agg.totalAmountUSDC += tx.amountUSDC
      agg.totalFeesUSDC += tx.feeUSDC ?? 0
    }

    // Store aggregates in the transactionAggregates table
    const now = Date.now()
    for (const [, agg] of aggregates) {
      const dateStart = new Date(agg.date).getTime()
      const dateEnd = dateStart + 24 * 60 * 60 * 1000 - 1 // End of day

      // Check if aggregate already exists for this agent/day
      const existing = await ctx.db
        .query('transactionAggregates')
        .withIndex('by_agent_period', (q) =>
          q.eq('agentId', agg.agentId as Id<'agents'>).eq('period', 'daily').eq('periodStart', dateStart)
        )
        .first()

      if (existing) {
        // Update existing aggregate
        await ctx.db.patch(existing._id, {
          totalTransactions: existing.totalTransactions + agg.txCount,
          successfulTransactions: existing.successfulTransactions + agg.successCount,
          failedTransactions: existing.failedTransactions + agg.failedCount,
          totalAmountUSDC: existing.totalAmountUSDC + agg.totalAmountUSDC,
          totalFeesUSDC: existing.totalFeesUSDC + agg.totalFeesUSDC,
          avgTransactionUSDC:
            (existing.totalAmountUSDC + agg.totalAmountUSDC) /
            (existing.totalTransactions + agg.txCount),
          updatedAt: now,
        })
      } else {
        // Create new aggregate
        await ctx.db.insert('transactionAggregates', {
          agentId: agg.agentId as Id<'agents'>,
          period: 'daily',
          periodStart: dateStart,
          periodEnd: dateEnd,
          totalTransactions: agg.txCount,
          successfulTransactions: agg.successCount,
          failedTransactions: agg.failedCount,
          totalAmountUSDC: agg.totalAmountUSDC,
          totalFeesUSDC: agg.totalFeesUSDC,
          avgTransactionUSDC: agg.txCount > 0 ? agg.totalAmountUSDC / agg.txCount : 0,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // Delete old transactions after archiving
    for (const tx of oldTransactions) {
      await ctx.db.delete(tx._id)
    }

    return oldTransactions.length
  },
})

// ========================================
// HEALTH RECORDS ARCHIVAL
// ========================================

/**
 * Archive old health records
 * Keeps only the most recent records per facilitator
 */
export const archiveHealthRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_DAYS.healthRecords * 24 * 60 * 60 * 1000

    // Find old health records
    const oldRecords = await ctx.db
      .query('facilitatorHealth')
      .filter((q) => q.lt(q.field('timestamp'), cutoffDate))
      .take(1000)

    if (oldRecords.length === 0) {
      return 0
    }

    // Delete old records
    for (const record of oldRecords) {
      await ctx.db.delete(record._id)
    }

    return oldRecords.length
  },
})

// ========================================
// SCORE HISTORY ARCHIVAL
// ========================================

/**
 * Archive old score history
 * Keeps recent history, aggregates older data
 */
export const archiveScoreHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_DAYS.scoreHistory * 24 * 60 * 60 * 1000

    // Find old score history records
    const oldRecords = await ctx.db
      .query('scoreHistory')
      .filter((q) => q.lt(q.field('timestamp'), cutoffDate))
      .take(1000)

    if (oldRecords.length === 0) {
      return 0
    }

    // Delete old records (keeping only records within retention period)
    for (const record of oldRecords) {
      await ctx.db.delete(record._id)
    }

    return oldRecords.length
  },
})

// ========================================
// TRUST EVENTS ARCHIVAL
// ========================================

/**
 * Archive old trust events
 */
export const archiveTrustEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_DAYS.trustEvents * 24 * 60 * 60 * 1000

    // Find old trust events
    const oldEvents = await ctx.db
      .query('trustEvents')
      .filter((q) => q.lt(q.field('timestamp'), cutoffDate))
      .take(1000)

    if (oldEvents.length === 0) {
      return 0
    }

    // Delete old events
    for (const event of oldEvents) {
      await ctx.db.delete(event._id)
    }

    return oldEvents.length
  },
})

// ========================================
// COLLECTION STATE ARCHIVAL
// ========================================

/**
 * Archive old collection state records
 */
export const archiveCollectionState = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Keep only the most recent state per collector/facilitator
    const states = await ctx.db.query('collectionState').collect()

    // Group by collector name
    const byCollector = new Map<string, typeof states>()
    for (const state of states) {
      const key = state.facilitatorSlug
        ? `${state.collectorName}-${state.facilitatorSlug}`
        : state.collectorName

      if (!byCollector.has(key)) {
        byCollector.set(key, [])
      }
      byCollector.get(key)!.push(state)
    }

    let deleted = 0

    // Keep only the most recent for each key
    for (const [_, records] of byCollector) {
      if (records.length > 1) {
        // Sort by lastRunAt desc
        records.sort((a, b) => b.lastRunAt - a.lastRunAt)

        // Delete all but the most recent
        for (let i = 1; i < records.length; i++) {
          await ctx.db.delete(records[i]._id)
          deleted++
        }
      }
    }

    return deleted
  },
})

// ========================================
// QUERY HELPERS
// ========================================

/**
 * Get archival statistics
 */
export const getArchivalStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Count records that would be archived
    const transactionCutoff = now - RETENTION_DAYS.transactions * 24 * 60 * 60 * 1000
    const healthCutoff = now - RETENTION_DAYS.healthRecords * 24 * 60 * 60 * 1000
    const scoreCutoff = now - RETENTION_DAYS.scoreHistory * 24 * 60 * 60 * 1000
    const trustCutoff = now - RETENTION_DAYS.trustEvents * 24 * 60 * 60 * 1000

    const oldTransactions = await ctx.db
      .query('agentTransactions')
      .filter((q) => q.lt(q.field('timestamp'), transactionCutoff))
      .collect()

    const oldHealth = await ctx.db
      .query('facilitatorHealth')
      .filter((q) => q.lt(q.field('timestamp'), healthCutoff))
      .collect()

    const oldScore = await ctx.db
      .query('scoreHistory')
      .filter((q) => q.lt(q.field('timestamp'), scoreCutoff))
      .collect()

    const oldTrust = await ctx.db
      .query('trustEvents')
      .filter((q) => q.lt(q.field('timestamp'), trustCutoff))
      .collect()

    return {
      pendingArchival: {
        transactions: oldTransactions.length,
        healthRecords: oldHealth.length,
        scoreHistory: oldScore.length,
        trustEvents: oldTrust.length,
      },
      retentionDays: RETENTION_DAYS,
    }
  },
})
