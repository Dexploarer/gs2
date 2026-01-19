/**
 * GraphQL Resolver Types
 *
 * Type definitions and type guards for GraphQL resolvers.
 * Ensures type safety when processing data from Convex.
 */

import type { Id } from '@/convex/_generated/dataModel'

// ============================================================================
// Vote Types
// ============================================================================

export interface VoteMetadata {
  quality?: QualityScoresInput
  qualityScores?: QualityScoresInput
  responseTime?: number
  comment?: string
}

export interface QualityScoresInput {
  responseQuality?: number
  responseSpeed?: number
  response?: number
  speed?: number
  accuracy?: number
  professionalism?: number
  professional?: number
}

export interface ConvexVote {
  _id: Id<'reputationVotes'>
  voterAgentId: Id<'agents'>
  subjectAgentId?: Id<'agents'>
  voteType: 'trustworthy' | 'suspicious' | 'neutral'
  weight: number
  confidence?: number
  timestamp: number
  basedOnTransactionId?: Id<'agentTransactions'>
  metadata?: VoteMetadata
}

export interface QualityScores {
  responseQuality: number
  responseSpeed: number
  accuracy: number
  professionalism: number
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ConvexVote
 */
export function isConvexVote(value: unknown): value is ConvexVote {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v._id === 'string' &&
    typeof v.voterAgentId === 'string' &&
    typeof v.voteType === 'string' &&
    ['trustworthy', 'suspicious', 'neutral'].includes(v.voteType as string) &&
    typeof v.weight === 'number' &&
    typeof v.timestamp === 'number'
  )
}

/**
 * Type guard for VoteMetadata
 */
export function isVoteMetadata(value: unknown): value is VoteMetadata {
  if (!value || typeof value !== 'object') return false
  return true // Metadata can have any shape, we just need to ensure it's an object
}

/**
 * Type guard for QualityScoresInput
 */
export function isQualityScoresInput(value: unknown): value is QualityScoresInput {
  if (!value || typeof value !== 'object') return false
  const q = value as Record<string, unknown>
  // All fields are optional, but if present they should be numbers
  const numericFields = [
    'responseQuality',
    'responseSpeed',
    'response',
    'speed',
    'accuracy',
    'professionalism',
    'professional',
  ]
  return numericFields.every(
    (field) => !(field in q) || typeof q[field] === 'number'
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extract quality scores from a vote
 */
export function extractQualityScores(vote: ConvexVote): QualityScores {
  const metadata = vote.metadata
  const quality = metadata?.quality || metadata?.qualityScores

  const confidence = vote.confidence ?? 50
  const weight = vote.weight ?? 1
  const baseScore = Math.min(100, Math.max(0, confidence * weight))

  if (quality && isQualityScoresInput(quality)) {
    return {
      responseQuality: quality.responseQuality ?? quality.response ?? baseScore,
      responseSpeed: quality.responseSpeed ?? quality.speed ?? baseScore,
      accuracy: quality.accuracy ?? baseScore,
      professionalism: quality.professionalism ?? quality.professional ?? baseScore,
    }
  }

  return {
    responseQuality: baseScore,
    responseSpeed: baseScore,
    accuracy: baseScore,
    professionalism: baseScore,
  }
}

/**
 * Calculate aggregate quality from an array of votes
 */
export function calculateAggregateQuality(votes: ConvexVote[]): {
  averageQuality: number
  qualityScores: QualityScores
} {
  if (votes.length === 0) {
    return {
      averageQuality: 0,
      qualityScores: {
        responseQuality: 0,
        responseSpeed: 0,
        accuracy: 0,
        professionalism: 0,
      },
    }
  }

  let totalResponseQuality = 0
  let totalResponseSpeed = 0
  let totalAccuracy = 0
  let totalProfessionalism = 0

  for (const vote of votes) {
    const scores = extractQualityScores(vote)
    totalResponseQuality += scores.responseQuality
    totalResponseSpeed += scores.responseSpeed
    totalAccuracy += scores.accuracy
    totalProfessionalism += scores.professionalism
  }

  const count = votes.length
  const avgResponseQuality = Math.round(totalResponseQuality / count)
  const avgResponseSpeed = Math.round(totalResponseSpeed / count)
  const avgAccuracy = Math.round(totalAccuracy / count)
  const avgProfessionalism = Math.round(totalProfessionalism / count)

  const averageQuality = Math.round(
    (avgResponseQuality + avgResponseSpeed + avgAccuracy + avgProfessionalism) / 4
  )

  return {
    averageQuality,
    qualityScores: {
      responseQuality: avgResponseQuality,
      responseSpeed: avgResponseSpeed,
      accuracy: avgAccuracy,
      professionalism: avgProfessionalism,
    },
  }
}

/**
 * Safely cast unknown votes array to typed array
 */
export function asConvexVotes(votes: unknown[]): ConvexVote[] {
  return votes.filter(isConvexVote)
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentSortableFields {
  reputation: number
  totalVotes: number
  averageQuality: number
  upvoteRatio: number
  createdAt: string
  updatedAt: string
}

/**
 * Get sortable field value from agent
 */
export function getAgentSortValue(
  agent: AgentSortableFields,
  field: string
): number | string {
  const normalizedField = field.toLowerCase()
  switch (normalizedField) {
    case 'reputation':
      return agent.reputation
    case 'totalvotes':
    case 'total_votes':
      return agent.totalVotes
    case 'averagequality':
    case 'average_quality':
      return agent.averageQuality
    case 'upvoteratio':
    case 'upvote_ratio':
      return agent.upvoteRatio
    case 'createdat':
    case 'created_at':
      return agent.createdAt
    case 'updatedat':
    case 'updated_at':
      return agent.updatedAt
    default:
      return agent.reputation
  }
}
