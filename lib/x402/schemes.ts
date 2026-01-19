/**
 * x402 Payment Schemes
 *
 * Extended payment schemes beyond the basic "exact" scheme:
 * - upto: Variable pricing with pre-authorized maximum
 * - subscription: Recurring payments with billing periods
 * - batch: Multiple payments in a single transaction
 */

import type { X402Config } from './config'
import { getUSDCAddress } from './config'

// ==========================================
// SCHEME TYPES
// ==========================================

/**
 * Base payment scheme - all schemes extend this
 */
export type PaymentScheme = 'exact' | 'upto' | 'subscription' | 'batch'

/**
 * Exact scheme (existing) - fixed price per request
 */
export interface ExactSchemeRequirement {
  scheme: 'exact'
  amount: string // Fixed price in USDC
  recipient: string
  network: string
  token?: string
  description?: string
  metadata?: Record<string, unknown>
}

/**
 * Upto scheme - variable pricing with pre-authorized maximum
 *
 * Use cases:
 * - AI inference where cost varies by token count
 * - Data queries with varying result sizes
 * - Compute tasks with variable duration
 */
export interface UptoSchemeRequirement {
  scheme: 'upto'
  maxAmount: string // Maximum amount that can be charged
  recipient: string
  network: string
  token?: string
  description?: string
  metadata?: Record<string, unknown>
  // Pricing parameters
  pricing: {
    /** Base cost (always charged) */
    baseCost: string
    /** Per-unit cost */
    unitCost: string
    /** Unit type (tokens, bytes, seconds, etc.) */
    unitType: 'tokens' | 'bytes' | 'seconds' | 'requests' | 'custom'
    /** Custom unit name if unitType is 'custom' */
    customUnitName?: string
    /** Estimated units (for UI display) */
    estimatedUnits?: number
  }
}

/**
 * Subscription scheme - recurring payments
 *
 * Use cases:
 * - Monthly API access
 * - Ongoing service subscriptions
 * - Usage-based recurring billing
 */
export interface SubscriptionSchemeRequirement {
  scheme: 'subscription'
  amount: string // Amount per period
  recipient: string
  network: string
  token?: string
  description?: string
  metadata?: Record<string, unknown>
  // Subscription parameters
  subscription: {
    /** Subscription identifier */
    subscriptionId: string
    /** Billing period */
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    /** Custom period in seconds (if period is not standard) */
    periodSeconds?: number
    /** Trial period in seconds (0 = no trial) */
    trialPeriodSeconds?: number
    /** Whether to auto-renew */
    autoRenew: boolean
    /** Maximum renewals (0 = unlimited) */
    maxRenewals?: number
    /** Grace period in seconds before suspension */
    gracePeriodSeconds?: number
    /** Features included in subscription */
    features?: string[]
  }
}

/**
 * Batch scheme - multiple payments in single transaction
 *
 * Use cases:
 * - Paying multiple agents for a composite task
 * - Distributing royalties/rewards
 * - Multi-party escrow settlements
 */
export interface BatchSchemeRequirement {
  scheme: 'batch'
  totalAmount: string // Total across all recipients
  network: string
  token?: string
  description?: string
  metadata?: Record<string, unknown>
  // Batch parameters
  payments: Array<{
    /** Recipient address */
    recipient: string
    /** Amount for this recipient */
    amount: string
    /** Optional reference for this payment */
    reference?: string
    /** Optional metadata per payment */
    metadata?: Record<string, unknown>
  }>
  /** Execution mode */
  executionMode: 'atomic' | 'best-effort'
}

/**
 * Union of all payment requirements
 */
export type PaymentRequirementUnion =
  | ExactSchemeRequirement
  | UptoSchemeRequirement
  | SubscriptionSchemeRequirement
  | BatchSchemeRequirement

// ==========================================
// UPTO SCHEME UTILITIES
// ==========================================

/**
 * Calculate actual charge for upto scheme based on usage
 */
export function calculateUptoCharge(
  requirement: UptoSchemeRequirement,
  actualUnits: number
): { amount: string; breakdown: { base: string; variable: string } } {
  const baseCost = parseFloat(requirement.pricing.baseCost)
  const unitCost = parseFloat(requirement.pricing.unitCost)
  const maxAmount = parseFloat(requirement.maxAmount)

  const variableCost = unitCost * actualUnits
  const totalCost = Math.min(baseCost + variableCost, maxAmount)

  return {
    amount: totalCost.toFixed(6),
    breakdown: {
      base: baseCost.toFixed(6),
      variable: variableCost.toFixed(6),
    },
  }
}

/**
 * Create an upto scheme payment authorization
 */
export function createUptoAuthorization(
  config: X402Config,
  requirement: Omit<UptoSchemeRequirement, 'scheme' | 'network' | 'token'>
): UptoSchemeRequirement {
  return {
    scheme: 'upto',
    network: config.network,
    token: getUSDCAddress(config.network),
    ...requirement,
  }
}

/**
 * Validate upto usage is within bounds
 */
export function validateUptoUsage(
  requirement: UptoSchemeRequirement,
  actualUnits: number
): { valid: boolean; charge: string; error?: string } {
  const charge = calculateUptoCharge(requirement, actualUnits)
  const maxAmount = parseFloat(requirement.maxAmount)
  const chargeAmount = parseFloat(charge.amount)

  if (chargeAmount > maxAmount) {
    return {
      valid: false,
      charge: requirement.maxAmount, // Cap at max
      error: `Usage exceeds maximum: ${chargeAmount} > ${maxAmount}`,
    }
  }

  return { valid: true, charge: charge.amount }
}

// ==========================================
// SUBSCRIPTION SCHEME UTILITIES
// ==========================================

/**
 * Period durations in seconds
 */
export const PERIOD_SECONDS = {
  hourly: 3600,
  daily: 86400,
  weekly: 604800,
  monthly: 2592000, // 30 days
  yearly: 31536000, // 365 days
} as const

/**
 * Create a subscription payment requirement
 */
export function createSubscriptionRequirement(
  config: X402Config,
  requirement: Omit<SubscriptionSchemeRequirement, 'scheme' | 'network' | 'token'>
): SubscriptionSchemeRequirement {
  return {
    scheme: 'subscription',
    network: config.network,
    token: getUSDCAddress(config.network),
    ...requirement,
  }
}

/**
 * Check if subscription is due for renewal
 */
export function isSubscriptionDue(
  lastPaymentTimestamp: number,
  subscription: SubscriptionSchemeRequirement['subscription']
): { isDue: boolean; nextDueTimestamp: number; inGracePeriod: boolean } {
  const periodSeconds =
    subscription.periodSeconds || PERIOD_SECONDS[subscription.period]
  const now = Date.now()

  const nextDueTimestamp = lastPaymentTimestamp + periodSeconds * 1000
  const gracePeriodMs = (subscription.gracePeriodSeconds || 0) * 1000
  const graceEndTimestamp = nextDueTimestamp + gracePeriodMs

  return {
    isDue: now >= nextDueTimestamp,
    nextDueTimestamp,
    inGracePeriod: now >= nextDueTimestamp && now < graceEndTimestamp,
  }
}

/**
 * Calculate prorated amount for subscription changes
 */
export function calculateProratedAmount(
  subscription: SubscriptionSchemeRequirement['subscription'],
  amount: string,
  remainingDays: number,
  totalDays: number
): string {
  const amountNum = parseFloat(amount)
  const prorated = (amountNum * remainingDays) / totalDays
  return prorated.toFixed(6)
}

/**
 * Generate subscription ID
 */
export function generateSubscriptionId(
  recipient: string,
  subscriber: string
): string {
  const combined = `${recipient}:${subscriber}:${Date.now()}`
  // Simple hash - in production use crypto
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `sub_${Math.abs(hash).toString(16)}`
}

// ==========================================
// BATCH SCHEME UTILITIES
// ==========================================

/**
 * Create a batch payment requirement
 */
export function createBatchRequirement(
  config: X402Config,
  payments: BatchSchemeRequirement['payments'],
  options: {
    description?: string
    metadata?: Record<string, unknown>
    executionMode?: 'atomic' | 'best-effort'
  } = {}
): BatchSchemeRequirement {
  const totalAmount = payments
    .reduce((sum, p) => sum + parseFloat(p.amount), 0)
    .toFixed(6)

  return {
    scheme: 'batch',
    totalAmount,
    network: config.network,
    token: getUSDCAddress(config.network),
    payments,
    executionMode: options.executionMode || 'atomic',
    description: options.description,
    metadata: options.metadata,
  }
}

/**
 * Validate batch payment totals
 */
export function validateBatchPayments(
  requirement: BatchSchemeRequirement
): { valid: boolean; calculatedTotal: string; error?: string } {
  const calculatedTotal = requirement.payments
    .reduce((sum, p) => sum + parseFloat(p.amount), 0)
    .toFixed(6)

  const declaredTotal = parseFloat(requirement.totalAmount).toFixed(6)

  if (calculatedTotal !== declaredTotal) {
    return {
      valid: false,
      calculatedTotal,
      error: `Total mismatch: declared ${declaredTotal} != calculated ${calculatedTotal}`,
    }
  }

  // Validate each payment
  for (const payment of requirement.payments) {
    if (parseFloat(payment.amount) <= 0) {
      return {
        valid: false,
        calculatedTotal,
        error: `Invalid amount for recipient ${payment.recipient}: ${payment.amount}`,
      }
    }
  }

  return { valid: true, calculatedTotal }
}

/**
 * Split batch result by recipient status
 */
export interface BatchPaymentResult {
  recipient: string
  amount: string
  status: 'success' | 'failed' | 'pending'
  txSignature?: string
  error?: string
}

export function aggregateBatchResults(
  results: BatchPaymentResult[]
): {
  totalSuccess: string
  totalFailed: string
  successCount: number
  failedCount: number
} {
  let totalSuccess = 0
  let totalFailed = 0
  let successCount = 0
  let failedCount = 0

  for (const result of results) {
    const amount = parseFloat(result.amount)
    if (result.status === 'success') {
      totalSuccess += amount
      successCount++
    } else if (result.status === 'failed') {
      totalFailed += amount
      failedCount++
    }
  }

  return {
    totalSuccess: totalSuccess.toFixed(6),
    totalFailed: totalFailed.toFixed(6),
    successCount,
    failedCount,
  }
}

// ==========================================
// PAYMENT REQUIREMENT HELPERS
// ==========================================

/**
 * Determine scheme from payment requirement
 */
export function getScheme(
  requirement: PaymentRequirementUnion
): PaymentScheme {
  return requirement.scheme
}

/**
 * Check if requirement is valid for scheme
 */
export function isValidRequirement(
  requirement: PaymentRequirementUnion
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Common validations
  if (!requirement.network) {
    errors.push('Network is required')
  }

  switch (requirement.scheme) {
    case 'exact':
      if (!requirement.amount || parseFloat(requirement.amount) <= 0) {
        errors.push('Amount must be positive')
      }
      if (!requirement.recipient) {
        errors.push('Recipient is required')
      }
      break

    case 'upto':
      if (!requirement.maxAmount || parseFloat(requirement.maxAmount) <= 0) {
        errors.push('Max amount must be positive')
      }
      if (!requirement.recipient) {
        errors.push('Recipient is required')
      }
      if (!requirement.pricing) {
        errors.push('Pricing configuration is required')
      } else {
        if (parseFloat(requirement.pricing.baseCost) < 0) {
          errors.push('Base cost cannot be negative')
        }
        if (parseFloat(requirement.pricing.unitCost) < 0) {
          errors.push('Unit cost cannot be negative')
        }
      }
      break

    case 'subscription':
      if (!requirement.amount || parseFloat(requirement.amount) <= 0) {
        errors.push('Amount must be positive')
      }
      if (!requirement.recipient) {
        errors.push('Recipient is required')
      }
      if (!requirement.subscription) {
        errors.push('Subscription configuration is required')
      } else {
        if (!requirement.subscription.subscriptionId) {
          errors.push('Subscription ID is required')
        }
        if (!requirement.subscription.period) {
          errors.push('Billing period is required')
        }
      }
      break

    case 'batch':
      if (!requirement.payments || requirement.payments.length === 0) {
        errors.push('At least one payment is required')
      } else {
        const validation = validateBatchPayments(requirement)
        if (!validation.valid && validation.error) {
          errors.push(validation.error)
        }
      }
      break

    default:
      errors.push(`Unknown scheme: ${(requirement as { scheme: string }).scheme}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Encode payment requirement for header
 */
export function encodeRequirement(
  requirement: PaymentRequirementUnion
): string {
  return Buffer.from(JSON.stringify(requirement)).toString('base64')
}

/**
 * Decode payment requirement from header
 */
export function decodeRequirement(
  encoded: string
): PaymentRequirementUnion | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Create 402 headers for any scheme
 */
export function createPaymentHeaders(
  requirement: PaymentRequirementUnion
): Record<string, string> {
  const validation = isValidRequirement(requirement)
  if (!validation.valid) {
    throw new Error(`Invalid requirement: ${validation.errors.join(', ')}`)
  }

  return {
    'PAYMENT-REQUIRED': encodeRequirement(requirement),
    'X-PAYMENT-SCHEME': requirement.scheme,
  }
}
