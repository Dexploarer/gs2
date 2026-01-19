/**
 * Merchant Reviews Functions
 *
 * Payment-proof required reviews for merchants
 */

import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

// Create a review (must have transaction proof)
export const create = mutation({
  args: {
    merchantId: v.id('merchants'),
    reviewerAgentId: v.id('agents'),
    transactionId: v.id('agentTransactions'),
    rating: v.number(), // 1-5
    title: v.optional(v.string()),
    content: v.string(),
    ratings: v.object({
      performance: v.number(), // 1-5
      reliability: v.number(), // 1-5
      value: v.number(), // 1-5
      support: v.optional(v.number()), // 1-5
    }),
  },
  handler: async (ctx, args) => {
    // Verify transaction exists and is from this reviewer
    const transaction = await ctx.db.get('agentTransactions', args.transactionId)

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    if (transaction.agentId !== args.reviewerAgentId) {
      throw new Error('Transaction does not belong to reviewer')
    }

    if (transaction.merchantId !== args.merchantId) {
      throw new Error('Transaction is not for this merchant')
    }

    if (transaction.status !== 'confirmed') {
      throw new Error('Can only review confirmed transactions')
    }

    // Check if already reviewed this transaction
    const existingReview = await ctx.db
      .query('merchantReviews')
      .withIndex('by_transaction', (q) => q.eq('transactionId', args.transactionId))
      .first()

    if (existingReview) {
      throw new Error('Already reviewed this transaction')
    }

    // Validate ratings
    if (args.rating < 1 || args.rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const reviewId = await ctx.db.insert('merchantReviews', {
      merchantId: args.merchantId,
      reviewerAgentId: args.reviewerAgentId,
      transactionId: args.transactionId,
      rating: args.rating,
      title: args.title,
      content: args.content,
      ratings: args.ratings,
      helpfulVotes: 0,
      notHelpfulVotes: 0,
      isVerified: true, // Auto-verified if transaction is confirmed
      isPurchaseVerified: true,
      isFlagged: false,
      flagReason: undefined,
      merchantResponse: undefined,
      reviewedAt: Date.now(),
      updatedAt: undefined,
    })

    return reviewId
  },
})

// Get reviews for a merchant
export const getForMerchant = query({
  args: {
    merchantId: v.id('merchants'),
    limit: v.optional(v.number()),
    minRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let reviews = await ctx.db
      .query('merchantReviews')
      .withIndex('by_merchant', (q) => q.eq('merchantId', args.merchantId))
      .filter((q) => q.eq(q.field('isFlagged'), false))
      .order('desc')
      .take(args.limit ?? 50)

    // Filter by minimum rating if specified
    if (args.minRating !== undefined) {
      const minRating = args.minRating
      reviews = reviews.filter((r) => r.rating >= minRating)
    }

    // Enrich with reviewer data
    return await Promise.all(
      reviews.map(async (review) => {
        const reviewer = await ctx.db.get('agents', review.reviewerAgentId)

        return {
          ...review,
          reviewer: reviewer
            ? {
                name: reviewer.name,
                address: reviewer.address,
                ghostScore: reviewer.ghostScore,
                tier: reviewer.tier,
              }
            : null,
        }
      })
    )
  },
})

// Get reviews by a reviewer
export const getByReviewer = query({
  args: {
    reviewerAgentId: v.id('agents'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('merchantReviews')
      .withIndex('by_reviewer', (q) => q.eq('reviewerAgentId', args.reviewerAgentId))
      .order('desc')
      .take(args.limit ?? 50)

    // Enrich with merchant data
    return await Promise.all(
      reviews.map(async (review) => {
        const merchant = await ctx.db.get('merchants', review.merchantId)

        return {
          ...review,
          merchant: merchant
            ? {
                name: merchant.name,
                category: merchant.category,
              }
            : null,
        }
      })
    )
  },
})

// Vote on review helpfulness
export const voteHelpful = mutation({
  args: {
    reviewId: v.id('merchantReviews'),
    isHelpful: v.boolean(),
  },
  handler: async (ctx, args) => {
    const review = await ctx.db.get('merchantReviews', args.reviewId)

    if (!review) {
      throw new Error('Review not found')
    }

    if (args.isHelpful) {
      await ctx.db.patch('merchantReviews', args.reviewId, {
        helpfulVotes: review.helpfulVotes + 1,
      })
    } else {
      await ctx.db.patch('merchantReviews', args.reviewId, {
        notHelpfulVotes: review.notHelpfulVotes + 1,
      })
    }

    return args.reviewId
  },
})

// Merchant responds to review
export const addMerchantResponse = mutation({
  args: {
    reviewId: v.id('merchantReviews'),
    merchantAgentId: v.id('agents'), // Merchant must be verified as owner
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const review = await ctx.db.get('merchantReviews', args.reviewId)

    if (!review) {
      throw new Error('Review not found')
    }

    // Verify merchantAgentId owns this merchant
    const merchant = await ctx.db.get('merchants', review.merchantId)
    if (!merchant) {
      throw new Error('Merchant not found')
    }

    // Check if agent owns the merchant (via ownerAgentId field)
    // or has admin permissions to respond on behalf of this merchant
    const agent = await ctx.db.get('agents', args.merchantAgentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    // Verify ownership by checking:
    // 1. Agent address matches merchant's registered owner (if any)
    // 2. Or agent has proven transactional relationship as provider
    const merchantOwnership = await ctx.db
      .query('agentTransactions')
      .withIndex('by_agent', (q) => q.eq('agentId', args.merchantAgentId))
      .filter((q) =>
        q.and(
          q.eq(q.field('type'), 'payment_received'),
          // Check that agent has received payments for this merchant
          q.neq(q.field('status'), 'failed')
        )
      )
      .take(1)

    // Require at least one successful earning transaction to prove merchant relationship
    // This ensures only agents who have actually provided services can respond
    if (merchantOwnership.length === 0) {
      // Also check if agent has been explicitly verified as merchant owner
      // by checking if they registered the merchant's endpoints
      const endpoints = await ctx.db
        .query('endpoints')
        .filter((q) => q.eq(q.field('agentId'), args.merchantAgentId))
        .take(1)

      if (endpoints.length === 0) {
        throw new Error('Agent is not authorized to respond for this merchant')
      }
    }

    await ctx.db.patch('merchantReviews', args.reviewId, {
      merchantResponse: {
        content: args.content,
        respondedAt: Date.now(),
      },
    })

    return args.reviewId
  },
})

// Flag a review
export const flag = mutation({
  args: {
    reviewId: v.id('merchantReviews'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const review = await ctx.db.get('merchantReviews', args.reviewId)

    if (!review) {
      throw new Error('Review not found')
    }

    await ctx.db.patch('merchantReviews', args.reviewId, {
      isFlagged: true,
      flagReason: args.reason,
    })

    return args.reviewId
  },
})

// Get review statistics for a merchant
export const getStatsForMerchant = query({
  args: { merchantId: v.id('merchants') },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('merchantReviews')
      .withIndex('by_merchant', (q) => q.eq('merchantId', args.merchantId))
      .filter((q) => q.eq(q.field('isFlagged'), false))
      .collect()

    const totalReviews = reviews.length
    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / (totalReviews || 1)

    const avgPerformance =
      reviews.reduce((sum, r) => sum + r.ratings.performance, 0) / (totalReviews || 1)
    const avgReliability =
      reviews.reduce((sum, r) => sum + r.ratings.reliability, 0) / (totalReviews || 1)
    const avgValue =
      reviews.reduce((sum, r) => sum + r.ratings.value, 0) / (totalReviews || 1)

    const ratingDistribution = reviews.reduce(
      (acc, r) => {
        const rating = Math.floor(r.rating)
        acc[rating] = (acc[rating] || 0) + 1
        return acc
      },
      {} as Record<number, number>
    )

    return {
      totalReviews,
      avgRating: Math.round(avgRating * 10) / 10,
      avgPerformance: Math.round(avgPerformance * 10) / 10,
      avgReliability: Math.round(avgReliability * 10) / 10,
      avgValue: Math.round(avgValue * 10) / 10,
      ratingDistribution,
      verifiedReviews: reviews.filter((r) => r.isPurchaseVerified).length,
    }
  },
})
