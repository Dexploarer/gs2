/**
 * x402 Extended Payment Schemes
 *
 * Convex functions for managing upto, subscription, and batch payment schemes.
 */

import { v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'

// ==========================================
// UPTO SCHEME FUNCTIONS
// ==========================================

/**
 * Create a new upto authorization
 */
export const createUptoAuthorization = mutation({
  args: {
    authorizationId: v.string(),
    payerId: v.id('agents'),
    recipientId: v.id('agents'),
    recipientAddress: v.string(),
    maxAmount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    baseCost: v.number(),
    unitCost: v.number(),
    unitType: v.string(),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const id = await ctx.db.insert('x402UptoAuthorizations', {
      authorizationId: args.authorizationId,
      payerId: args.payerId,
      recipientId: args.recipientId,
      recipientAddress: args.recipientAddress,
      maxAmount: args.maxAmount,
      usedAmount: 0,
      remainingAmount: args.maxAmount,
      currency: args.currency,
      network: args.network,
      baseCost: args.baseCost,
      unitCost: args.unitCost,
      unitType: args.unitType,
      status: 'active',
      expiresAt: args.expiresAt,
      totalUnitsUsed: 0,
      chargeCount: 0,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    })

    return { id, authorizationId: args.authorizationId }
  },
})

/**
 * Charge against an upto authorization
 */
export const chargeUptoAuthorization = mutation({
  args: {
    authorizationId: v.string(),
    unitsUsed: v.number(),
    txSignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query('x402UptoAuthorizations')
      .withIndex('by_authorization', (q) =>
        q.eq('authorizationId', args.authorizationId)
      )
      .first()

    if (!auth) {
      throw new Error('Authorization not found')
    }

    if (auth.status !== 'active') {
      throw new Error(`Authorization is ${auth.status}`)
    }

    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      await ctx.db.patch('x402UptoAuthorizations', auth._id, {
        status: 'expired',
        updatedAt: Date.now(),
      })
      throw new Error('Authorization has expired')
    }

    // Calculate charge
    const variableCost = auth.unitCost * args.unitsUsed
    const totalCharge = Math.min(
      auth.baseCost + variableCost,
      auth.remainingAmount
    )

    if (totalCharge > auth.remainingAmount) {
      throw new Error('Insufficient authorized amount remaining')
    }

    const now = Date.now()

    // Record the charge
    const chargeId = await ctx.db.insert('x402UptoCharges', {
      authorizationId: args.authorizationId,
      txSignature: args.txSignature,
      amount: totalCharge,
      unitsUsed: args.unitsUsed,
      unitType: auth.unitType,
      breakdown: {
        base: auth.baseCost,
        variable: variableCost,
      },
      status: args.txSignature ? 'completed' : 'pending',
      timestamp: now,
    })

    // Update authorization
    const newUsedAmount = auth.usedAmount + totalCharge
    const newRemainingAmount = auth.maxAmount - newUsedAmount
    const isExhausted = newRemainingAmount <= 0

    await ctx.db.patch('x402UptoAuthorizations', auth._id, {
      usedAmount: newUsedAmount,
      remainingAmount: newRemainingAmount,
      totalUnitsUsed: auth.totalUnitsUsed + args.unitsUsed,
      chargeCount: auth.chargeCount + 1,
      status: isExhausted ? 'exhausted' : 'active',
      updatedAt: now,
    })

    return {
      chargeId,
      amount: totalCharge,
      breakdown: { base: auth.baseCost, variable: variableCost },
      remainingAmount: newRemainingAmount,
      isExhausted,
    }
  },
})

/**
 * Get upto authorization by ID
 */
export const getUptoAuthorization = query({
  args: {
    authorizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402UptoAuthorizations')
      .withIndex('by_authorization', (q) =>
        q.eq('authorizationId', args.authorizationId)
      )
      .first()
  },
})

/**
 * Get active authorizations for a payer
 */
export const getPayerAuthorizations = query({
  args: {
    payerId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402UptoAuthorizations')
      .withIndex('by_payer', (q) => q.eq('payerId', args.payerId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect()
  },
})

/**
 * Revoke an upto authorization
 */
export const revokeUptoAuthorization = mutation({
  args: {
    authorizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query('x402UptoAuthorizations')
      .withIndex('by_authorization', (q) =>
        q.eq('authorizationId', args.authorizationId)
      )
      .first()

    if (!auth) {
      throw new Error('Authorization not found')
    }

    await ctx.db.patch('x402UptoAuthorizations', auth._id, {
      status: 'revoked',
      updatedAt: Date.now(),
    })

    return { success: true, refundableAmount: auth.remainingAmount }
  },
})

// ==========================================
// SUBSCRIPTION SCHEME FUNCTIONS
// ==========================================

/**
 * Create a new subscription
 */
export const createSubscription = mutation({
  args: {
    subscriptionId: v.string(),
    subscriberId: v.id('agents'),
    recipientId: v.id('agents'),
    recipientAddress: v.string(),
    amount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    period: v.union(
      v.literal('hourly'),
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('monthly'),
      v.literal('yearly')
    ),
    periodSeconds: v.optional(v.number()),
    autoRenew: v.boolean(),
    maxRenewals: v.optional(v.number()),
    gracePeriodSeconds: v.optional(v.number()),
    trialDays: v.optional(v.number()),
    features: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Calculate period duration
    const periodDurations: Record<string, number> = {
      hourly: 3600000,
      daily: 86400000,
      weekly: 604800000,
      monthly: 2592000000, // 30 days
      yearly: 31536000000, // 365 days
    }
    const periodMs = args.periodSeconds
      ? args.periodSeconds * 1000
      : periodDurations[args.period]

    // Handle trial
    const hasTrial = args.trialDays && args.trialDays > 0
    const trialEnd = hasTrial ? now + args.trialDays! * 86400000 : undefined
    const periodStart = hasTrial ? trialEnd! : now
    const periodEnd = periodStart + periodMs

    const id = await ctx.db.insert('x402Subscriptions', {
      subscriptionId: args.subscriptionId,
      subscriberId: args.subscriberId,
      recipientId: args.recipientId,
      recipientAddress: args.recipientAddress,
      amount: args.amount,
      currency: args.currency,
      network: args.network,
      period: args.period,
      periodSeconds: args.periodSeconds,
      status: hasTrial ? 'trial' : 'active',
      autoRenew: args.autoRenew,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEnd,
      maxRenewals: args.maxRenewals,
      renewalCount: 0,
      gracePeriodSeconds: args.gracePeriodSeconds,
      features: args.features,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      subscriptionId: args.subscriptionId,
      periodStart,
      periodEnd,
      trialEnd,
    }
  },
})

/**
 * Record a subscription payment
 */
export const recordSubscriptionPayment = mutation({
  args: {
    subscriptionId: v.string(),
    txSignature: v.string(),
    amount: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query('x402Subscriptions')
      .withIndex('by_subscription', (q) =>
        q.eq('subscriptionId', args.subscriptionId)
      )
      .first()

    if (!sub) {
      throw new Error('Subscription not found')
    }

    const now = Date.now()

    // Record payment
    const paymentId = await ctx.db.insert('x402SubscriptionPayments', {
      subscriptionId: args.subscriptionId,
      txSignature: args.txSignature,
      amount: args.amount,
      currency: sub.currency,
      network: sub.network,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: 'completed',
      timestamp: now,
    })

    // Update subscription
    await ctx.db.patch('x402Subscriptions', sub._id, {
      currentPeriodStart: args.periodStart,
      currentPeriodEnd: args.periodEnd,
      renewalCount: sub.renewalCount + 1,
      status: 'active',
      updatedAt: now,
    })

    return { paymentId }
  },
})

/**
 * Get subscription by ID
 */
export const getSubscription = query({
  args: {
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402Subscriptions')
      .withIndex('by_subscription', (q) =>
        q.eq('subscriptionId', args.subscriptionId)
      )
      .first()
  },
})

/**
 * Get subscriptions for a subscriber
 */
export const getSubscriberSubscriptions = query({
  args: {
    subscriberId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402Subscriptions')
      .withIndex('by_subscriber', (q) => q.eq('subscriberId', args.subscriberId))
      .collect()
  },
})

/**
 * Get active subscriptions for a recipient (service provider)
 */
export const getRecipientSubscriptions = query({
  args: {
    recipientId: v.id('agents'),
    status: v.optional(
      v.union(
        v.literal('active'),
        v.literal('paused'),
        v.literal('trial')
      )
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query('x402Subscriptions')
      .withIndex('by_recipient', (q) => q.eq('recipientId', args.recipientId))

    if (args.status) {
      return await q.filter((f) => f.eq(f.field('status'), args.status)).collect()
    }

    return await q.collect()
  },
})

/**
 * Cancel a subscription
 */
export const cancelSubscription = mutation({
  args: {
    subscriptionId: v.string(),
    immediate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query('x402Subscriptions')
      .withIndex('by_subscription', (q) =>
        q.eq('subscriptionId', args.subscriptionId)
      )
      .first()

    if (!sub) {
      throw new Error('Subscription not found')
    }

    const now = Date.now()

    if (args.immediate) {
      await ctx.db.patch('x402Subscriptions', sub._id, {
        status: 'cancelled',
        autoRenew: false,
        cancelledAt: now,
        updatedAt: now,
      })
    } else {
      // Cancel at end of current period
      await ctx.db.patch('x402Subscriptions', sub._id, {
        autoRenew: false,
        cancelledAt: now,
        updatedAt: now,
      })
    }

    return {
      success: true,
      effectiveDate: args.immediate ? now : sub.currentPeriodEnd,
    }
  },
})

/**
 * Get subscriptions due for renewal
 */
export const getDueSubscriptions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    return await ctx.db
      .query('x402Subscriptions')
      .withIndex('by_period_end')
      .filter((q) =>
        q.and(
          q.lt(q.field('currentPeriodEnd'), now),
          q.eq(q.field('autoRenew'), true),
          q.or(
            q.eq(q.field('status'), 'active'),
            q.eq(q.field('status'), 'trial')
          )
        )
      )
      .take(args.limit ?? 100)
  },
})

// ==========================================
// BATCH SCHEME FUNCTIONS
// ==========================================

/**
 * Create a new batch payment
 */
export const createBatchPayment = mutation({
  args: {
    batchId: v.string(),
    initiatorId: v.id('agents'),
    totalAmount: v.number(),
    currency: v.string(),
    network: v.union(v.literal('base'), v.literal('solana')),
    executionMode: v.union(v.literal('atomic'), v.literal('best-effort')),
    payments: v.array(
      v.object({
        recipientAddress: v.string(),
        recipientId: v.optional(v.id('agents')),
        amount: v.number(),
        reference: v.optional(v.string()),
        metadata: v.optional(v.any()),
      })
    ),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Validate total
    const calculatedTotal = args.payments.reduce((sum, p) => sum + p.amount, 0)
    if (Math.abs(calculatedTotal - args.totalAmount) > 0.000001) {
      throw new Error(
        `Total mismatch: declared ${args.totalAmount} != calculated ${calculatedTotal}`
      )
    }

    // Create batch
    const batchDocId = await ctx.db.insert('x402BatchPayments', {
      batchId: args.batchId,
      initiatorId: args.initiatorId,
      totalAmount: args.totalAmount,
      successAmount: 0,
      failedAmount: 0,
      currency: args.currency,
      network: args.network,
      executionMode: args.executionMode,
      paymentCount: args.payments.length,
      successCount: 0,
      failedCount: 0,
      status: 'pending',
      description: args.description,
      metadata: args.metadata,
      createdAt: now,
    })

    // Create payment items
    const itemIds = []
    for (const payment of args.payments) {
      const itemId = await ctx.db.insert('x402BatchPaymentItems', {
        batchId: args.batchId,
        recipientId: payment.recipientId,
        recipientAddress: payment.recipientAddress,
        amount: payment.amount,
        reference: payment.reference,
        status: 'pending',
        metadata: payment.metadata,
      })
      itemIds.push(itemId)
    }

    return { id: batchDocId, batchId: args.batchId, itemCount: itemIds.length }
  },
})

/**
 * Update batch payment item status
 */
export const updateBatchPaymentItem = mutation({
  args: {
    batchId: v.string(),
    recipientAddress: v.string(),
    status: v.union(
      v.literal('completed'),
      v.literal('failed')
    ),
    txSignature: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query('x402BatchPaymentItems')
      .withIndex('by_batch', (q) => q.eq('batchId', args.batchId))
      .filter((q) => q.eq(q.field('recipientAddress'), args.recipientAddress))
      .first()

    if (!item) {
      throw new Error('Batch payment item not found')
    }

    const now = Date.now()

    await ctx.db.patch('x402BatchPaymentItems', item._id, {
      status: args.status,
      txSignature: args.txSignature,
      errorMessage: args.errorMessage,
      processedAt: now,
    })

    // Update batch totals
    const batch = await ctx.db
      .query('x402BatchPayments')
      .withIndex('by_batch', (q) => q.eq('batchId', args.batchId))
      .first()

    if (batch) {
      const isSuccess = args.status === 'completed'
      const newSuccessAmount = isSuccess
        ? batch.successAmount + item.amount
        : batch.successAmount
      const newFailedAmount = !isSuccess
        ? batch.failedAmount + item.amount
        : batch.failedAmount
      const newSuccessCount = isSuccess
        ? batch.successCount + 1
        : batch.successCount
      const newFailedCount = !isSuccess
        ? batch.failedCount + 1
        : batch.failedCount

      const totalProcessed = newSuccessCount + newFailedCount
      const isComplete = totalProcessed === batch.paymentCount

      let newStatus: 'processing' | 'completed' | 'partial' | 'failed' =
        'processing'
      if (isComplete) {
        if (newFailedCount === 0) {
          newStatus = 'completed'
        } else if (newSuccessCount === 0) {
          newStatus = 'failed'
        } else {
          newStatus = 'partial'
        }
      }

      await ctx.db.patch('x402BatchPayments', batch._id, {
        successAmount: newSuccessAmount,
        failedAmount: newFailedAmount,
        successCount: newSuccessCount,
        failedCount: newFailedCount,
        status: newStatus,
        completedAt: isComplete ? now : undefined,
      })
    }

    return { success: true }
  },
})

/**
 * Get batch payment by ID
 */
export const getBatchPayment = query({
  args: {
    batchId: v.string(),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query('x402BatchPayments')
      .withIndex('by_batch', (q) => q.eq('batchId', args.batchId))
      .first()

    if (!batch) return null

    const items = await ctx.db
      .query('x402BatchPaymentItems')
      .withIndex('by_batch', (q) => q.eq('batchId', args.batchId))
      .collect()

    return { ...batch, items }
  },
})

/**
 * Get batch payments for an initiator
 */
export const getInitiatorBatches = query({
  args: {
    initiatorId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('x402BatchPayments')
      .withIndex('by_initiator', (q) => q.eq('initiatorId', args.initiatorId))
      .order('desc')
      .take(args.limit ?? 50)
  },
})

// ==========================================
// INTERNAL FUNCTIONS (for crons)
// ==========================================

/**
 * Process expired upto authorizations (cron)
 */
export const expireUptoAuthorizations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    const expired = await ctx.db
      .query('x402UptoAuthorizations')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .filter((q) =>
        q.and(
          q.neq(q.field('expiresAt'), undefined),
          q.lt(q.field('expiresAt'), now)
        )
      )
      .collect()

    let count = 0
    for (const auth of expired) {
      await ctx.db.patch('x402UptoAuthorizations', auth._id, {
        status: 'expired',
        updatedAt: now,
      })
      count++
    }

    return { expiredCount: count }
  },
})

/**
 * Expire past-due subscriptions (cron)
 */
export const expireSubscriptions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Get subscriptions past grace period
    const pastDue = await ctx.db
      .query('x402Subscriptions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .filter((q) => q.lt(q.field('currentPeriodEnd'), now))
      .collect()

    let expiredCount = 0
    for (const sub of pastDue) {
      const gracePeriodMs = (sub.gracePeriodSeconds || 0) * 1000
      const graceEnd = sub.currentPeriodEnd + gracePeriodMs

      if (now > graceEnd && !sub.autoRenew) {
        await ctx.db.patch('x402Subscriptions', sub._id, {
          status: 'expired',
          updatedAt: now,
        })
        expiredCount++
      }
    }

    return { expiredCount }
  },
})
