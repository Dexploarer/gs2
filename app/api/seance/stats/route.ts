/**
 * GET /api/seance/stats
 *
 * Get network-wide statistics and trending agents
 */

import { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { errorResponse } from '@/lib/api/errors'
import { checkRateLimit, getRateLimitIdentifier, getRateLimitTier } from '@/lib/api/rateLimit'
import { getCached, setCache, cacheKeys, cacheTTL } from '@/lib/api/cache'
import type { NetworkStatsResponse } from '@/lib/api/types'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = await getRateLimitTier(request.headers)
    await checkRateLimit(identifier, rateLimit)

    // Check cache
    const cacheKey = cacheKeys.stats()
    const cached = getCached(cacheKey)
    if (cached) {
      return Response.json(
        {
          success: true,
          data: cached,
          meta: {
            timestamp: Date.now(),
            cached: true,
            ttl: cacheTTL.stats,
          },
        },
        {
          headers: {
            'Cache-Control': `public, s-maxage=${cacheTTL.stats}`,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Fetch all stats in parallel
    const [
      agentStats,
      transactionStats,
      credentialStats,
      merchantStats,
      facilitatorStats,
      topAgents,
    ] = await Promise.all([
      fetchQuery(api.agentProfiles.getStats, {}),
      fetchQuery(api.agentTransactions.getStats, { timeRangeHours: 24 * 30 }), // Last 30 days
      fetchQuery(api.credentials.getStats, {}),
      fetchQuery(api.merchants.getStats, {}),
      fetchQuery(api.facilitatorHealth.getLatestForAll, {}),
      fetchQuery(api.reputationScores.getTopAgents, { limit: 10 }),
    ])

    // Calculate facilitator stats
    const onlineFacilitators = facilitatorStats.filter(
      (f) => f.health?.status === 'online'
    ).length

    // Build response
    const response: NetworkStatsResponse = {
      agents: {
        total: agentStats.totalAgents,
        active: agentStats.activeAgents,
        avgGhostScore: Math.round(
          topAgents.reduce((sum, a) => sum + a.overallScore, 0) /
            (topAgents.length || 1)
        ),
      },
      transactions: {
        totalVolume: transactionStats.totalVolume,
        totalCount: transactionStats.totalTransactions,
        successRate: transactionStats.successRate,
        avgConfirmationTime: transactionStats.avgConfirmationTime,
      },
      credentials: {
        total: credentialStats.total,
        active: credentialStats.active,
        typeCounts: credentialStats.typeCounts,
      },
      merchants: {
        total: merchantStats.total,
        active: merchantStats.active,
      },
      facilitators: {
        total: facilitatorStats.length,
        online: onlineFacilitators,
      },
      trending: {
        topAgents: topAgents
          .filter((a) => a.trend === 'rising')
          .slice(0, 5)
          .map((a) => ({
            name: a.agent?.name || 'Unknown',
            address: a.agent?.address || 'Unknown',
            ghostScore: a.agent?.ghostScore || 0,
            trend: a.trend,
          })),
      },
    }

    // Cache response
    setCache(cacheKey, response, cacheTTL.stats)

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
          'Cache-Control': `public, s-maxage=${cacheTTL.stats}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
