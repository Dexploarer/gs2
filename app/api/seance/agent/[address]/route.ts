/**
 * GET /api/seance/agent/[address]
 *
 * Get complete reputation data for an agent by Solana address
 */

import { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { errorResponse, errors } from '@/lib/api/errors'
import { checkRateLimit, getRateLimitIdentifier, getRateLimitTier } from '@/lib/api/rateLimit'
import { getCached, setCache, cacheKeys, cacheTTL } from '@/lib/api/cache'
import type { AgentReputationResponse } from '@/lib/api/types'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const resolvedParams = await params
    // Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = await getRateLimitTier(request.headers)
    await checkRateLimit(identifier, rateLimit)

    const { address } = resolvedParams

    if (!address) {
      throw errors.badRequest('Agent address is required')
    }

    // Check cache
    const cacheKey = cacheKeys.agent(address)
    const cached = getCached(cacheKey)
    if (cached) {
      return Response.json(
        {
          success: true,
          data: cached,
          meta: {
            timestamp: Date.now(),
            cached: true,
            ttl: cacheTTL.agent,
          },
        },
        {
          headers: {
            'Cache-Control': `public, s-maxage=${cacheTTL.agent}`,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Find agent by address
    const agents = await fetchQuery(api.agents.list, { limit: 1000 })
    const agent = agents.find((a: { address: string }) => a.address === address)

    if (!agent) {
      throw errors.notFound('Agent')
    }

    // Fetch all agent data in parallel
    const [profile, reputation, credentials, capabilities, transactionStats] = await Promise.all([
      fetchQuery(api.agentProfiles.get, { agentId: agent._id }),
      fetchQuery(api.reputationScores.getForAgent, { agentId: agent._id }),
      fetchQuery(api.credentials.getForAgent, { agentId: agent._id, includeRevoked: false }),
      fetchQuery(api.agentCapabilities.getByAgent, { agentId: agent._id, verifiedOnly: false }),
      fetchQuery(api.agentTransactions.getStats, { agentId: agent._id, timeRangeHours: 24 * 365 }),
    ])

    // Build response
    const response: AgentReputationResponse = {
      agent: {
        address: agent.address,
        name: agent.name,
        ghostScore: agent.ghostScore,
        tier: agent.tier,
        isActive: agent.isActive,
        createdAt: agent.createdAt,
      },
      profile: profile
        ? {
            model: profile.model,
            provider: profile.provider,
            avgResponseTime: profile.avgResponseTime,
            totalRequests: profile.totalRequests,
            successfulRequests: profile.successfulRequests,
            uptime: profile.uptime,
            totalEarningsUSDC: profile.totalEarningsUSDC,
            totalSpendingUSDC: profile.totalSpendingUSDC,
            category: profile.primaryCategory,
            tags: profile.tags,
            errorRate: profile.errorRate,
          }
        : undefined,
      reputation: reputation
        ? {
            overallScore: reputation.overallScore,
            trustScore: reputation.trustScore,
            qualityScore: reputation.qualityScore,
            reliabilityScore: reputation.reliabilityScore,
            economicScore: reputation.economicScore,
            socialScore: reputation.socialScore,
            trend: reputation.trend,
            rank: reputation.rank,
          }
        : undefined,
      credentials: credentials.map((c) => ({
        credentialId: c.credentialId,
        type: c.type,
        issuedBy: c.issuedBy,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt,
        isRevoked: c.isRevoked,
      })),
      capabilities: capabilities.map((c) => ({
        capability: c.capability,
        level: c.level,
        isVerified: c.isVerified,
        successRate: c.successRate,
        usageCount: c.usageCount,
      })),
      stats: {
        totalTransactions: transactionStats.totalTransactions,
        totalVolume: transactionStats.totalVolume,
        successRate: transactionStats.successRate,
        avgConfirmationTime: transactionStats.avgConfirmationTime,
      },
    }

    // Cache response
    setCache(cacheKey, response, cacheTTL.agent)

    return Response.json(
      {
        success: true,
        data: response,
        meta: {
          timestamp: Date.now(),
          cached: false,
        },
      },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${cacheTTL.agent}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
