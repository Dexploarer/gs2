/**
 * API Key management functions (Convex 1.31+)
 *
 * Handles API key validation, creation, and usage tracking
 */

import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

/**
 * Validate API key and return key info
 */
export const validateKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query('apiKeys')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()

    if (!apiKey) {
      return null
    }

    // Get user info for tier determination
    const user = apiKey.userId ? await ctx.db.get('users', apiKey.userId) : null

    return {
      userId: apiKey.userId,
      permissions: apiKey.permissions,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      tier: determineTier(apiKey.permissions),
      userName: user?.name,
    }
  },
})

/**
 * Record API key usage
 */
export const recordUsage = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query('apiKeys')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()

    if (apiKey) {
      await ctx.db.patch('apiKeys', apiKey._id, {
        usageCount: apiKey.usageCount + 1,
        lastUsedAt: Date.now(),
      })
    }
  },
})

/**
 * Create new API key for user
 */
export const create = mutation({
  args: {
    userId: v.id('users'),
    name: v.string(),
    permissions: v.array(v.string()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Generate a secure API key
    const key = generateApiKey()

    const now = Date.now()
    const expiresAt = args.expiresInDays
      ? now + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined

    const apiKeyId = await ctx.db.insert('apiKeys', {
      key,
      userId: args.userId,
      name: args.name,
      permissions: args.permissions,
      usageCount: 0,
      createdAt: now,
      expiresAt,
      isActive: true,
    })

    return { apiKeyId, key }
  },
})

/**
 * Revoke API key
 */
export const revoke = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query('apiKeys')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()

    if (apiKey) {
      await ctx.db.patch('apiKeys', apiKey._id, {
        isActive: false,
      })
    }
  },
})

/**
 * List user's API keys
 */
export const listByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('apiKeys')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
  },
})

/**
 * Get API key by ID (without exposing the actual key)
 */
export const get = query({
  args: { id: v.id('apiKeys') },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db.get('apiKeys', args.id)
    if (!apiKey) return null

    return {
      id: apiKey._id,
      name: apiKey.name,
      permissions: apiKey.permissions,
      usageCount: apiKey.usageCount,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      // Don't expose the actual key
      keyPreview: `${apiKey.key.slice(0, 8)}...${apiKey.key.slice(-4)}`,
    }
  },
})

/**
 * Delete API key
 */
export const remove = mutation({
  args: { id: v.id('apiKeys') },
  handler: async (ctx, args) => {
    await ctx.db.delete('apiKeys', args.id)
  },
})

// Helper functions

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const prefix = 'gs_' // GhostSpeak prefix
  let key = prefix

  // Generate 32 random characters
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return key
}

/**
 * Determine tier based on permissions
 */
function determineTier(permissions: string[]): 'free' | 'basic' | 'pro' | 'enterprise' {
  if (permissions.includes('*') || permissions.includes('admin')) {
    return 'enterprise'
  }
  if (permissions.includes('write') && permissions.includes('webhook')) {
    return 'pro'
  }
  if (permissions.includes('write')) {
    return 'basic'
  }
  return 'free'
}
