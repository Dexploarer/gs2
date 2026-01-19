/**
 * GET /api/seance/merchant/[id]
 *
 * Get merchant analytics and reviews
 */

import { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { errorResponse, errors } from '@/lib/api/errors'
import { checkRateLimit, getRateLimitIdentifier, getRateLimitTier } from '@/lib/api/rateLimit'
import { getCached, setCache, cacheKeys, cacheTTL } from '@/lib/api/cache'
import type { MerchantAnalyticsResponse } from '@/lib/api/types'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    // Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = await getRateLimitTier(request.headers)
    await checkRateLimit(identifier, rateLimit)

    const { id } = resolvedParams

    if (!id) {
      throw errors.badRequest('Merchant ID is required')
    }

    // Check cache
    const cacheKey = cacheKeys.merchant(id)
    const cached = getCached(cacheKey)
    if (cached) {
      return Response.json(
        {
          success: true,
          data: cached,
          meta: {
            timestamp: Date.now(),
            cached: true,
            ttl: cacheTTL.merchant,
          },
        },
        {
          headers: {
            'Cache-Control': `public, s-maxage=${cacheTTL.merchant}`,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Fetch merchant data
    const merchant = await fetchQuery(api.merchants.get, { merchantId: id as unknown as import('@/convex/_generated/dataModel').Id<'merchants'> })

    if (!merchant) {
      throw errors.notFound('Merchant')
    }

    // Fetch review stats
    const reviewStats = await fetchQuery(api.merchantReviews.getStatsForMerchant, {
      merchantId: id as unknown as import('@/convex/_generated/dataModel').Id<'merchants'>,
    })

    // Build response
    const response: MerchantAnalyticsResponse = {
      merchant: {
        id: merchant._id,
        name: merchant.name,
        description: merchant.description,
        facilitator: {
          name: merchant.facilitator?.name || 'Unknown',
          slug: merchant.facilitator?.slug || 'unknown',
        },
        network: merchant.network,
        category: merchant.category,
        isActive: merchant.isActive,
      },
      endpoints: merchant.endpoints.map((e) => ({
        url: e.url,
        method: e.method,
        priceUSDC: e.priceUSDC,
        description: e.description,
      })),
      capabilities: merchant.capabilities,
      analytics: {
        totalCalls: merchant.totalCalls,
        successRate: merchant.successRate,
        discoveredAt: merchant.discoveredAt,
        lastSeen: merchant.lastSeen,
      },
      reviews: {
        totalReviews: reviewStats.totalReviews,
        avgRating: reviewStats.avgRating,
        ratingDistribution: reviewStats.ratingDistribution,
      },
    }

    // Cache response
    setCache(cacheKey, response, cacheTTL.merchant)

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
          'Cache-Control': `public, s-maxage=${cacheTTL.merchant}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
