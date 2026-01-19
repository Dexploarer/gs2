/**
 * Validation Utilities
 *
 * Centralized validation helpers using Zod for runtime type safety.
 * Use these validators in API routes to ensure type-safe input handling.
 */

import { z } from 'zod'
import { PublicKey } from '@solana/web3.js'

// ============================================================================
// Solana Address Validation
// ============================================================================

/**
 * Validate a Solana public key string
 * Returns true if the string is a valid base58 Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Safely parse a Solana address string to PublicKey
 * Returns null if invalid instead of throwing
 */
export function parseSolanaAddress(address: string): PublicKey | null {
  try {
    return new PublicKey(address)
  } catch {
    return null
  }
}

/**
 * Zod schema for Solana public key validation
 */
export const solanaAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .refine(isValidSolanaAddress, {
    message: 'Invalid Solana address',
  })

/**
 * Zod transformer that parses to PublicKey
 */
export const solanaPublicKeySchema = solanaAddressSchema.transform((addr) => new PublicKey(addr))

// ============================================================================
// Common API Validation Schemas
// ============================================================================

/**
 * Pagination schema for API queries
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v || '50', 10), 100))
    .pipe(z.number().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((v) => parseInt(v || '0', 10))
    .pipe(z.number().min(0)),
})

/**
 * Staking action schema for GET requests
 */
export const stakingGetActionSchema = z.enum([
  'vault',
  'position',
  'derive-vault',
  'agent-vaults',
  'vault-positions',
  'all-vaults',
  'calculate-weight',
])

/**
 * Staking action schema for POST requests
 */
export const stakingPostActionSchema = z.enum([
  'build-stake',
  'build-unstake',
  'build-init-vault',
])

/**
 * Stake category enum
 */
export const stakeCategorySchema = z.enum([
  'General',
  'Quality',
  'Reliability',
  'Capability',
  'Security',
])

// ============================================================================
// Staking API Request Schemas
// ============================================================================

export const getVaultRequestSchema = z.object({
  action: z.literal('vault'),
  vaultAddress: solanaAddressSchema,
})

export const getPositionRequestSchema = z.object({
  action: z.literal('position'),
  vaultAddress: solanaAddressSchema,
  staker: solanaAddressSchema,
})

export const deriveVaultRequestSchema = z.object({
  action: z.literal('derive-vault'),
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
})

export const getAgentVaultsRequestSchema = z.object({
  action: z.literal('agent-vaults'),
  targetAgent: solanaAddressSchema,
})

export const getVaultPositionsRequestSchema = z.object({
  action: z.literal('vault-positions'),
  vaultAddress: solanaAddressSchema,
})

export const calculateWeightRequestSchema = z.object({
  action: z.literal('calculate-weight'),
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
  multiplier: z.string().regex(/^\d+$/, 'Multiplier must be a numeric string'),
})

export const buildStakeRequestSchema = z.object({
  action: z.literal('build-stake'),
  staker: solanaAddressSchema,
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
  amount: z.union([z.string(), z.number()]).transform(String),
  category: stakeCategorySchema,
})

export const buildUnstakeRequestSchema = z.object({
  action: z.literal('build-unstake'),
  staker: solanaAddressSchema,
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
  amount: z.union([z.string(), z.number()]).transform(String),
})

export const buildInitVaultRequestSchema = z.object({
  action: z.literal('build-init-vault'),
  authority: solanaAddressSchema,
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
  minStakeAmount: z.union([z.string(), z.number()]).transform(String),
  lockPeriodSeconds: z.union([z.string(), z.number()]).transform(String),
  weightMultiplier: z.number().min(1).max(1000),
})

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Create a standardized validation error response
 * Updated for Zod v4: uses .issues instead of .errors
 */
export function validationError(zodError: z.ZodError) {
  return {
    error: 'Validation failed',
    details: zodError.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

/**
 * Safe JSON parse with type validation
 */
export function safeJsonParse<T>(
  json: string,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const parsed = JSON.parse(json)
    const result = schema.safeParse(parsed)
    if (result.success) {
      return { success: true, data: result.data }
    }
    return { success: false, error: result.error }
  } catch {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          message: 'Invalid JSON',
          path: [],
        },
      ]),
    }
  }
}

// ============================================================================
// Observatory API Validation Schemas
// ============================================================================

export const observatoryAgentsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v || '50', 10), 100))
    .pipe(z.number().min(1).max(100)),
  minScore: z
    .string()
    .optional()
    .transform((v) => parseInt(v || '0', 10))
    .pipe(z.number().min(0).max(1000)),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
})

export const observatoryPaymentsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v || '50', 10), 100))
    .pipe(z.number().min(1).max(100)),
  network: z.enum(['solana', 'base']).optional(),
  status: z.enum(['completed', 'pending', 'failed']).optional(),
})

export const observatoryEndpointsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v || '50', 10), 100))
    .pipe(z.number().min(1).max(100)),
  protocol: z.enum(['x402', 'http', 'https']).optional(),
  minSuccessRate: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined))
    .pipe(z.number().min(0).max(100).optional()),
  minGhostScore: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().min(0).max(1000).optional()),
})

export const observatoryEventsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v || '50', 10), 100))
    .pipe(z.number().min(1).max(100)),
  eventType: z
    .enum([
      'score_increase',
      'score_decrease',
      'credential_issued',
      'credential_revoked',
      'tier_upgrade',
      'tier_downgrade',
      'verification_passed',
      'verification_failed',
    ])
    .optional(),
})

// ============================================================================
// Seance API Validation Schemas
// ============================================================================

export const seanceCapabilitiesQuerySchema = z.object({
  minLevel: z.enum(['basic', 'intermediate', 'advanced', 'expert']).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v || '50', 10), 100))
    .pipe(z.number().min(1).max(100)),
  verifiedOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

// ============================================================================
// Helper: Convert URLSearchParams to Record
// ============================================================================

export function searchParamsToRecord(
  params: URLSearchParams
): Record<string, string | undefined> {
  const obj: Record<string, string | undefined> = {}
  params.forEach((value, key) => {
    obj[key] = value || undefined
  })
  return obj
}

// ============================================================================
// Type Exports
// ============================================================================

export type StakingGetAction = z.infer<typeof stakingGetActionSchema>
export type StakingPostAction = z.infer<typeof stakingPostActionSchema>
export type StakeCategory = z.infer<typeof stakeCategorySchema>
export type BuildStakeRequest = z.infer<typeof buildStakeRequestSchema>
export type BuildUnstakeRequest = z.infer<typeof buildUnstakeRequestSchema>
export type BuildInitVaultRequest = z.infer<typeof buildInitVaultRequestSchema>
export type ObservatoryAgentsQuery = z.infer<typeof observatoryAgentsQuerySchema>
export type ObservatoryPaymentsQuery = z.infer<typeof observatoryPaymentsQuerySchema>
export type ObservatoryEndpointsQuery = z.infer<typeof observatoryEndpointsQuerySchema>
export type ObservatoryEventsQuery = z.infer<typeof observatoryEventsQuerySchema>
export type SeanceCapabilitiesQuery = z.infer<typeof seanceCapabilitiesQuerySchema>
