/**
 * Agent Transactions Functions
 *
 * Track every x402 payment from agent perspective
 */

import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Record a new transaction
export const record = internalMutation({
  args: {
    agentId: v.id('agents'),
    txSignature: v.string(),
    type: v.union(
      v.literal('payment_sent'),
      v.literal('payment_received'),
      v.literal('refund'),
      v.literal('fee')
    ),
    counterpartyAgentId: v.optional(v.id('agents')),
    merchantId: v.optional(v.id('merchants')),
    amountUSDC: v.number(),
    feeUSDC: v.number(),
    facilitatorId: v.id('facilitators'),
    network: v.string(),
    confirmationTime: v.number(),
    blockNumber: v.optional(v.number()),
    endpointUrl: v.optional(v.string()),
    serviceName: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('failed'),
      v.literal('refunded')
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert('agentTransactions', {
      ...args,
      timestamp: Date.now(),
    })

    // Update agent profile metrics
    if (args.type === 'payment_received' && args.status === 'confirmed') {
      await ctx.scheduler.runAfter(0, internal.agentProfiles.updateMetrics, {
        agentId: args.agentId,
      })
    } else if (args.type === 'payment_sent' && args.status === 'confirmed') {
      await ctx.scheduler.runAfter(0, internal.agentProfiles.updateMetrics, {
        agentId: args.agentId,
      })
    }

    return transactionId
  },
})

// Get transactions for an agent
export const getByAgent = query({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
    type: v.optional(
      v.union(
        v.literal('payment_sent'),
        v.literal('payment_received'),
        v.literal('refund'),
        v.literal('fee')
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('agentTransactions')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))

    let transactions = await query.order('desc').take(args.limit ?? 50)

    // Filter by type if specified
    if (args.type) {
      transactions = transactions.filter((t) => t.type === args.type)
    }

    // Enrich with facilitator and counterparty data
    return await Promise.all(
      transactions.map(async (tx) => {
        const facilitator = await ctx.db.get('facilitators', tx.facilitatorId)
        const counterpartyAgent = tx.counterpartyAgentId
          ? await ctx.db.get('agents', tx.counterpartyAgentId)
          : null
        const merchant = tx.merchantId ? await ctx.db.get('merchants', tx.merchantId) : null

        return {
          ...tx,
          facilitator: facilitator ? { name: facilitator.name, slug: facilitator.slug } : null,
          counterpartyAgent: counterpartyAgent
            ? { name: counterpartyAgent.name, address: counterpartyAgent.address }
            : null,
          merchant: merchant ? { name: merchant.name } : null,
        }
      })
    )
  },
})

// Get transaction by signature
export const getBySignature = query({
  args: { txSignature: v.string() },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query('agentTransactions')
      .withIndex('by_signature', (q) => q.eq('txSignature', args.txSignature))
      .first()

    if (!transaction) return null

    // Enrich with related data
    const agent = await ctx.db.get('agents', transaction.agentId)
    const facilitator = await ctx.db.get('facilitators', transaction.facilitatorId)
    const counterpartyAgent = transaction.counterpartyAgentId
      ? await ctx.db.get('agents', transaction.counterpartyAgentId)
      : null
    const merchant = transaction.merchantId
      ? await ctx.db.get('merchants', transaction.merchantId)
      : null

    return {
      ...transaction,
      agent: agent ? { name: agent.name, address: agent.address } : null,
      facilitator: facilitator ? { name: facilitator.name, slug: facilitator.slug } : null,
      counterpartyAgent: counterpartyAgent
        ? { name: counterpartyAgent.name, address: counterpartyAgent.address }
        : null,
      merchant: merchant ? { name: merchant.name } : null,
    }
  },
})

// Get recent transactions across all agents
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('confirmed'),
        v.literal('failed'),
        v.literal('refunded')
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('agentTransactions').withIndex('by_timestamp')

    let transactions = await query.order('desc').take(args.limit ?? 100)

    // Filter by status if specified
    if (args.status) {
      transactions = transactions.filter((t) => t.status === args.status)
    }

    // Enrich with agent and facilitator data
    return await Promise.all(
      transactions.map(async (tx) => {
        const agent = await ctx.db.get('agents', tx.agentId)
        const facilitator = await ctx.db.get('facilitators', tx.facilitatorId)

        return {
          ...tx,
          agent: agent ? { name: agent.name, address: agent.address } : null,
          facilitator: facilitator ? { name: facilitator.name, slug: facilitator.slug } : null,
        }
      })
    )
  },
})

// Get transaction statistics
export const getStats = query({
  args: {
    agentId: v.optional(v.id('agents')),
    timeRangeHours: v.optional(v.number()), // Default: 24 hours
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRangeHours ?? 24
    const cutoff = Date.now() - timeRange * 60 * 60 * 1000

    let transactions = await ctx.db.query('agentTransactions').collect()

    // Filter by time range
    transactions = transactions.filter((t) => t.timestamp >= cutoff)

    // Filter by agent if specified
    if (args.agentId) {
      transactions = transactions.filter((t) => t.agentId === args.agentId)
    }

    const totalTransactions = transactions.length
    const confirmedTransactions = transactions.filter((t) => t.status === 'confirmed').length
    const failedTransactions = transactions.filter((t) => t.status === 'failed').length
    const pendingTransactions = transactions.filter((t) => t.status === 'pending').length

    const totalVolume = transactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    const totalFees = transactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + t.feeUSDC, 0)

    const avgConfirmationTime =
      confirmedTransactions > 0
        ? transactions
            .filter((t) => t.status === 'confirmed')
            .reduce((sum, t) => sum + t.confirmationTime, 0) / confirmedTransactions
        : 0

    const paymentsSent = transactions.filter((t) => t.type === 'payment_sent').length
    const paymentsReceived = transactions.filter((t) => t.type === 'payment_received').length

    return {
      totalTransactions,
      confirmedTransactions,
      failedTransactions,
      pendingTransactions,
      successRate: totalTransactions > 0 ? (confirmedTransactions / totalTransactions) * 100 : 0,
      totalVolume,
      totalFees,
      avgConfirmationTime: Math.round(avgConfirmationTime),
      paymentsSent,
      paymentsReceived,
    }
  },
})

// Get transactions for an agent (internal - for HTTP actions)
export const getByAgentInternal = internalQuery({
  args: {
    agentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query('agentTransactions')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .order('desc')
      .take(args.limit ?? 50)

    // Enrich with facilitator and counterparty data
    return await Promise.all(
      transactions.map(async (tx) => {
        const facilitator = await ctx.db.get(tx.facilitatorId)
        const counterpartyAgent = tx.counterpartyAgentId
          ? await ctx.db.get(tx.counterpartyAgentId)
          : null
        const merchant = tx.merchantId ? await ctx.db.get(tx.merchantId) : null

        return {
          ...tx,
          facilitator: facilitator ? { name: facilitator.name, slug: facilitator.slug } : null,
          counterpartyAgent: counterpartyAgent
            ? { name: counterpartyAgent.name, address: counterpartyAgent.address }
            : null,
          merchant: merchant ? { name: merchant.name } : null,
        }
      })
    )
  },
})

// Get transaction statistics (internal - for reputation calculations)
export const getStatsInternal = internalQuery({
  args: {
    agentId: v.optional(v.id('agents')),
    timeRangeHours: v.optional(v.number()), // Default: 24 hours
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRangeHours ?? 24
    const cutoff = Date.now() - timeRange * 60 * 60 * 1000

    let transactions = await ctx.db.query('agentTransactions').collect()

    // Filter by time range
    transactions = transactions.filter((t) => t.timestamp >= cutoff)

    // Filter by agent if specified
    if (args.agentId) {
      transactions = transactions.filter((t) => t.agentId === args.agentId)
    }

    const totalTransactions = transactions.length
    const confirmedTransactions = transactions.filter((t) => t.status === 'confirmed').length
    const failedTransactions = transactions.filter((t) => t.status === 'failed').length
    const pendingTransactions = transactions.filter((t) => t.status === 'pending').length

    const totalVolume = transactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amountUSDC, 0)

    const totalFees = transactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + t.feeUSDC, 0)

    const avgConfirmationTime =
      confirmedTransactions > 0
        ? transactions
            .filter((t) => t.status === 'confirmed')
            .reduce((sum, t) => sum + t.confirmationTime, 0) / confirmedTransactions
        : 0

    const paymentsSent = transactions.filter((t) => t.type === 'payment_sent').length
    const paymentsReceived = transactions.filter((t) => t.type === 'payment_received').length

    return {
      totalTransactions,
      confirmedTransactions,
      failedTransactions,
      pendingTransactions,
      successRate: totalTransactions > 0 ? (confirmedTransactions / totalTransactions) * 100 : 0,
      totalVolume,
      totalFees,
      avgConfirmationTime: Math.round(avgConfirmationTime),
      paymentsSent,
      paymentsReceived,
    }
  },
})

// Update transaction status
export const updateStatus = internalMutation({
  args: {
    txSignature: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('failed'),
      v.literal('refunded')
    ),
    confirmationTime: v.optional(v.number()),
    blockNumber: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query('agentTransactions')
      .withIndex('by_signature', (q) => q.eq('txSignature', args.txSignature))
      .first()

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    await ctx.db.patch('agentTransactions', transaction._id, {
      status: args.status,
      confirmationTime: args.confirmationTime ?? transaction.confirmationTime,
      blockNumber: args.blockNumber ?? transaction.blockNumber,
      errorMessage: args.errorMessage,
    })

    return transaction._id
  },
})

// Get transactions between two agents
export const getBetweenAgents = query({
  args: {
    agentId1: v.id('agents'),
    agentId2: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allTransactions = await ctx.db.query('agentTransactions').collect()

    const filteredTransactions = allTransactions.filter(
      (tx) =>
        (tx.agentId === args.agentId1 && tx.counterpartyAgentId === args.agentId2) ||
        (tx.agentId === args.agentId2 && tx.counterpartyAgentId === args.agentId1)
    )

    const sorted = filteredTransactions.sort((a, b) => b.timestamp - a.timestamp)
    const limited = sorted.slice(0, args.limit ?? 50)

    // Enrich with data
    return await Promise.all(
      limited.map(async (tx) => {
        const agent = await ctx.db.get('agents', tx.agentId)
        const counterparty = tx.counterpartyAgentId
          ? await ctx.db.get('agents', tx.counterpartyAgentId)
          : null
        const facilitator = await ctx.db.get('facilitators', tx.facilitatorId)

        return {
          ...tx,
          agent: agent ? { name: agent.name, address: agent.address } : null,
          counterpartyAgent: counterparty
            ? { name: counterparty.name, address: counterparty.address }
            : null,
          facilitator: facilitator ? { name: facilitator.name } : null,
        }
      })
    )
  },
})
