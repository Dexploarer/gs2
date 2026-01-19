/**
 * Convex File Storage Functions
 *
 * Handles file uploads for:
 * - Agent avatars
 * - User profile pictures
 * - Merchant logos
 * - Credential evidence documents (PDFs, images)
 */

import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// ==========================================
// FILE UPLOAD MUTATIONS
// ==========================================

/**
 * Generate upload URL for file storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Upload agent avatar
 */
export const uploadAgentAvatar = mutation({
  args: {
    agentId: v.id('agents'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get('agents', args.agentId)

    if (!agent) {
      throw new Error('Agent not found')
    }

    // Delete old avatar if it exists
    if (agent.avatarStorageId) {
      await ctx.storage.delete(agent.avatarStorageId)
    }

    // Update agent with new avatar storage ID
    await ctx.db.patch('agents', args.agentId, {
      avatarStorageId: args.storageId,
      updatedAt: Date.now(),
    })

    return { success: true, storageId: args.storageId }
  },
})

/**
 * Upload user profile picture
 */
export const uploadUserAvatar = mutation({
  args: {
    userId: v.id('users'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)

    if (!user) {
      throw new Error('User not found')
    }

    // Delete old avatar if it exists
    if (user.avatarStorageId) {
      await ctx.storage.delete(user.avatarStorageId)
    }

    // Update user with new avatar storage ID
    await ctx.db.patch('users', args.userId, {
      avatarStorageId: args.storageId,
      lastLoginAt: Date.now(),
    })

    return { success: true, storageId: args.storageId }
  },
})

/**
 * Upload merchant logo
 */
export const uploadMerchantLogo = mutation({
  args: {
    merchantId: v.id('merchants'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const merchant = await ctx.db.get('merchants', args.merchantId)

    if (!merchant) {
      throw new Error('Merchant not found')
    }

    // Delete old logo if it exists
    if (merchant.logoStorageId) {
      await ctx.storage.delete(merchant.logoStorageId)
    }

    // Update merchant with new logo storage ID
    await ctx.db.patch('merchants', args.merchantId, {
      logoStorageId: args.storageId,
      lastSeen: Date.now(),
    })

    return { success: true, storageId: args.storageId }
  },
})

/**
 * Upload credential evidence document
 */
export const uploadCredentialEvidence = mutation({
  args: {
    credentialId: v.id('credentials'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const credential = await ctx.db.get('credentials', args.credentialId)

    if (!credential) {
      throw new Error('Credential not found')
    }

    // Delete old evidence document if it exists
    if (credential.evidenceDocumentStorageId) {
      await ctx.storage.delete(credential.evidenceDocumentStorageId)
    }

    // Update credential with new evidence document storage ID
    await ctx.db.patch('credentials', args.credentialId, {
      evidenceDocumentStorageId: args.storageId,
    })

    return { success: true, storageId: args.storageId }
  },
})

/**
 * Delete file from storage
 */
export const deleteFile = mutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId)
    return { success: true }
  },
})

// ==========================================
// FILE RETRIEVAL QUERIES
// ==========================================

/**
 * Get file URL
 */
export const getFileUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Get agent avatar URL
 */
export const getAgentAvatarUrl = query({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get('agents', args.agentId)

    if (!agent || !agent.avatarStorageId) {
      return null
    }

    return await ctx.storage.getUrl(agent.avatarStorageId)
  },
})

/**
 * Get user avatar URL
 */
export const getUserAvatarUrl = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)

    if (!user || !user.avatarStorageId) {
      return null
    }

    return await ctx.storage.getUrl(user.avatarStorageId)
  },
})

/**
 * Get merchant logo URL
 */
export const getMerchantLogoUrl = query({
  args: {
    merchantId: v.id('merchants'),
  },
  handler: async (ctx, args) => {
    const merchant = await ctx.db.get('merchants', args.merchantId)

    if (!merchant || !merchant.logoStorageId) {
      return null
    }

    return await ctx.storage.getUrl(merchant.logoStorageId)
  },
})

/**
 * Get credential evidence document URL
 */
export const getCredentialEvidenceUrl = query({
  args: {
    credentialId: v.id('credentials'),
  },
  handler: async (ctx, args) => {
    const credential = await ctx.db.get('credentials', args.credentialId)

    if (!credential || !credential.evidenceDocumentStorageId) {
      return null
    }

    return await ctx.storage.getUrl(credential.evidenceDocumentStorageId)
  },
})

/**
 * Get file metadata
 */
export const getFileMetadata = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId)
    return {
      storageId: args.storageId,
      url,
    }
  },
})

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Validate file type
 */
export function validateFileType(
  contentType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.some((type) => contentType.startsWith(type))
}

/**
 * Validate file size
 */
export function validateFileSize(
  sizeBytes: number,
  maxSizeMB: number
): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return sizeBytes <= maxSizeBytes
}

/**
 * Allowed file types for avatars/logos
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

/**
 * Allowed file types for evidence documents
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/json',
]

/**
 * Max file sizes
 */
export const MAX_AVATAR_SIZE_MB = 5 // 5MB
export const MAX_DOCUMENT_SIZE_MB = 10 // 10MB
