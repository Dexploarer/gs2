/**
 * User management functions (Convex 1.31+ with explicit table names)
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * Get user by wallet address
 */
export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', args.walletAddress))
      .unique()
  },
})

/**
 * Create or update user (upsert)
 */
export const upsert = mutation({
  args: {
    walletAddress: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', args.walletAddress))
      .unique()

    const now = Date.now()

    if (existing) {
      // Update existing user
      await ctx.db.patch('users', existing._id, {
        name: args.name ?? existing.name,
        email: args.email ?? existing.email,
        lastLoginAt: now,
      })
      return existing._id
    } else {
      // Create new user
      return await ctx.db.insert('users', {
        walletAddress: args.walletAddress,
        name: args.name,
        email: args.email,
        createdAt: now,
        lastLoginAt: now,
      })
    }
  },
})

/**
 * Get user by ID (explicit table name)
 */
export const get = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get('users', args.id)
  },
})
