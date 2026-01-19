/**
 * Trust Scoring System
 *
 * Calculates trust scores for x402 endpoints based on:
 * - Performance (40%): Success rate, latency, uptime
 * - Reliability (30%): Consistency, error handling
 * - Economic (20%): Price fairness, refund rate
 * - Reputation (10%): Agent's Ghost Score, verification level
 */

/**
 * Verification tiers for endpoints
 */
export const VERIFICATION_TIERS = {
  UNVERIFIED: { level: 0, badge: null, label: 'Unverified' },
  TESTED: { level: 1, badge: 'bronze', label: 'Tested' },
  VERIFIED: { level: 2, badge: 'silver', label: 'Verified' },
  TRUSTED: { level: 3, badge: 'gold', label: 'Trusted' },
  CERTIFIED: { level: 4, badge: 'platinum', label: 'Certified' },
} as const

export type VerificationTier = keyof typeof VERIFICATION_TIERS

/**
 * Requirements for each verification tier
 */
export const TIER_REQUIREMENTS = {
  UNVERIFIED: { minCalls: 0 },
  TESTED: { minCalls: 100, minSuccessRate: 80 },
  VERIFIED: { minCalls: 1000, minSuccessRate: 90, manualReview: true },
  TRUSTED: { minCalls: 10000, minSuccessRate: 95, attestation: true },
  CERTIFIED: { minCalls: 50000, minSuccessRate: 98, onChainReputation: true, audit: true },
} as const

/**
 * Endpoint metrics for trust scoring
 */
export interface EndpointMetrics {
  // Performance
  successRate: number // 0-100%
  avgLatency: number // milliseconds
  uptime: number // 0-100%

  // Reliability
  consistencyScore: number // 0-100 (response quality variance)
  errorHandlingScore: number // 0-100 (graceful degradation)

  // Economic
  priceUSDC: number // Price per call
  marketAveragePrice: number // Average price for similar endpoints
  refundRate: number // 0-100%

  // Reputation
  agentGhostScore: number // 0-1000
  verificationLevel: number // 0-4 (VERIFICATION_TIERS level)

  // Usage
  totalCalls: number
  uniqueCallers: number
  lastActive: number // timestamp
}

/**
 * Trust score breakdown by component
 */
export interface TrustScoreBreakdown {
  performance: number // 0-400 (40% of 1000)
  reliability: number // 0-300 (30% of 1000)
  economic: number // 0-200 (20% of 1000)
  reputation: number // 0-100 (10% of 1000)
  total: number // 0-1000
  tier: VerificationTier
  badge: string | null
}

/**
 * Calculate performance score component (40% weight)
 */
function calculatePerformanceScore(metrics: EndpointMetrics): number {
  // Success rate: 0-100% maps to 0-200 points
  const successRateScore = (metrics.successRate / 100) * 200

  // Latency: 0-5000ms maps to 100-0 points (lower is better)
  // Anything under 100ms gets full points, over 5000ms gets 0
  const latencyScore = Math.max(0, 100 - (metrics.avgLatency / 50))

  // Uptime: 0-100% maps to 0-100 points
  const uptimeScore = (metrics.uptime / 100) * 100

  return Math.round(successRateScore + latencyScore + uptimeScore)
}

/**
 * Calculate reliability score component (30% weight)
 */
function calculateReliabilityScore(metrics: EndpointMetrics): number {
  // Consistency: 0-100 maps to 0-150 points
  const consistencyScore = (metrics.consistencyScore / 100) * 150

  // Error handling: 0-100 maps to 0-150 points
  const errorHandlingScore = (metrics.errorHandlingScore / 100) * 150

  return Math.round(consistencyScore + errorHandlingScore)
}

/**
 * Calculate economic score component (20% weight)
 */
function calculateEconomicScore(metrics: EndpointMetrics): number {
  // Price fairness: ratio to market average
  // 1.0 (at market) = 100 points
  // 0.5 (50% cheaper) = 150 points
  // 2.0 (2x expensive) = 50 points
  let priceFairnessScore = 100
  if (metrics.marketAveragePrice > 0 && metrics.priceUSDC > 0) {
    const priceRatio = metrics.priceUSDC / metrics.marketAveragePrice
    priceFairnessScore = Math.max(0, Math.min(150, 150 - priceRatio * 50))
  }

  // Refund rate: lower is better (disputes handled well)
  // 0% = 50 points, 10% = 0 points
  const refundScore = Math.max(0, 50 - metrics.refundRate * 5)

  return Math.round(priceFairnessScore + refundScore)
}

/**
 * Calculate reputation score component (10% weight)
 */
function calculateReputationScore(metrics: EndpointMetrics): number {
  // Agent Ghost Score: 0-1000 maps to 0-50 points
  const ghostScoreComponent = (metrics.agentGhostScore / 1000) * 50

  // Verification level: 0-4 maps to 0-50 points
  const verificationComponent = (metrics.verificationLevel / 4) * 50

  return Math.round(ghostScoreComponent + verificationComponent)
}

/**
 * Determine verification tier based on metrics
 */
export function determineVerificationTier(metrics: EndpointMetrics): VerificationTier {
  const { totalCalls, successRate, agentGhostScore } = metrics

  // Check from highest to lowest tier
  if (
    totalCalls >= TIER_REQUIREMENTS.CERTIFIED.minCalls &&
    successRate >= TIER_REQUIREMENTS.CERTIFIED.minSuccessRate &&
    agentGhostScore >= 900
  ) {
    return 'CERTIFIED'
  }

  if (
    totalCalls >= TIER_REQUIREMENTS.TRUSTED.minCalls &&
    successRate >= TIER_REQUIREMENTS.TRUSTED.minSuccessRate &&
    agentGhostScore >= 750
  ) {
    return 'TRUSTED'
  }

  if (
    totalCalls >= TIER_REQUIREMENTS.VERIFIED.minCalls &&
    successRate >= TIER_REQUIREMENTS.VERIFIED.minSuccessRate
  ) {
    return 'VERIFIED'
  }

  if (
    totalCalls >= TIER_REQUIREMENTS.TESTED.minCalls &&
    successRate >= TIER_REQUIREMENTS.TESTED.minSuccessRate
  ) {
    return 'TESTED'
  }

  return 'UNVERIFIED'
}

/**
 * Calculate complete trust score for an endpoint
 */
export function calculateTrustScore(
  metrics: EndpointMetrics
): TrustScoreBreakdown {
  const performance = calculatePerformanceScore(metrics)
  const reliability = calculateReliabilityScore(metrics)
  const economic = calculateEconomicScore(metrics)
  const reputation = calculateReputationScore(metrics)

  const total = performance + reliability + economic + reputation
  const tier = determineVerificationTier(metrics)
  const badge = VERIFICATION_TIERS[tier].badge

  return {
    performance,
    reliability,
    economic,
    reputation,
    total,
    tier,
    badge,
  }
}

/**
 * Get default metrics for new endpoints
 */
export function getDefaultMetrics(): EndpointMetrics {
  return {
    successRate: 0,
    avgLatency: 0,
    uptime: 100,
    consistencyScore: 50, // Neutral starting point
    errorHandlingScore: 50,
    priceUSDC: 0,
    marketAveragePrice: 0.01, // Default market average
    refundRate: 0,
    agentGhostScore: 100, // Default starting score
    verificationLevel: 0,
    totalCalls: 0,
    uniqueCallers: 0,
    lastActive: Date.now(),
  }
}

/**
 * Calculate market average price for a category of endpoints
 */
export function calculateMarketAveragePrice(
  endpoints: Array<{ priceUSDC: number; totalCalls: number }>
): number {
  if (endpoints.length === 0) return 0.01

  // Weight by total calls (more used = more representative)
  const totalWeight = endpoints.reduce((sum, e) => sum + Math.log1p(e.totalCalls), 0)

  if (totalWeight === 0) {
    // Simple average if no calls
    return endpoints.reduce((sum, e) => sum + e.priceUSDC, 0) / endpoints.length
  }

  const weightedSum = endpoints.reduce(
    (sum, e) => sum + e.priceUSDC * Math.log1p(e.totalCalls),
    0
  )

  return weightedSum / totalWeight
}

/**
 * Update metrics from a transaction result
 */
export function updateMetricsFromTransaction(
  current: EndpointMetrics,
  transaction: {
    success: boolean
    responseTime: number
    wasRefunded?: boolean
  }
): EndpointMetrics {
  const newTotalCalls = current.totalCalls + 1

  // Update success rate (exponential moving average)
  const alpha = 0.1 // Learning rate
  const successValue = transaction.success ? 100 : 0
  const newSuccessRate = current.successRate * (1 - alpha) + successValue * alpha

  // Update average latency
  const newAvgLatency =
    (current.avgLatency * current.totalCalls + transaction.responseTime) / newTotalCalls

  // Update consistency score (lower variance = higher consistency)
  const latencyVariance = Math.abs(transaction.responseTime - current.avgLatency)
  const normalizedVariance = Math.min(100, latencyVariance / 10)
  const newConsistency = current.consistencyScore * 0.95 + (100 - normalizedVariance) * 0.05

  // Update refund rate
  const newRefundRate = transaction.wasRefunded
    ? current.refundRate * 0.9 + 10 // Increase if refunded
    : current.refundRate * 0.99 // Slowly decay

  return {
    ...current,
    totalCalls: newTotalCalls,
    successRate: Math.round(newSuccessRate * 100) / 100,
    avgLatency: Math.round(newAvgLatency),
    consistencyScore: Math.round(newConsistency * 100) / 100,
    refundRate: Math.round(newRefundRate * 100) / 100,
    lastActive: Date.now(),
  }
}

/**
 * Get trust score color for UI display
 */
export function getTrustScoreColor(score: number): string {
  if (score >= 800) return 'emerald' // Excellent
  if (score >= 600) return 'green' // Good
  if (score >= 400) return 'yellow' // Fair
  if (score >= 200) return 'orange' // Poor
  return 'red' // Very poor
}

/**
 * Get trust score label for UI display
 */
export function getTrustScoreLabel(score: number): string {
  if (score >= 800) return 'Excellent'
  if (score >= 600) return 'Good'
  if (score >= 400) return 'Fair'
  if (score >= 200) return 'Poor'
  return 'Very Poor'
}

/**
 * Format trust score for display
 */
export function formatTrustScore(score: number): string {
  return `${score}/1000`
}
