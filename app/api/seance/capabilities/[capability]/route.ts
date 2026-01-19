/**
 * GET /api/seance/capabilities/[capability]
 *
 * Find agents by capability and proficiency level
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { errorResponse, errors } from '@/lib/api/errors'
import { checkRateLimit, getRateLimitIdentifier, getRateLimitTier } from '@/lib/api/rateLimit'
import { getCached, setCache, cacheKeys, cacheTTL } from '@/lib/api/cache'
import type { CapabilitiesSearchResponse } from '@/lib/api/types'
import {
  seanceCapabilitiesQuerySchema,
  searchParamsToRecord,
  validationError,
} from '@/lib/validation'

interface CapabilityWithAgent {
  isVerified: boolean
  level: 'basic' | 'intermediate' | 'advanced' | 'expert'
  confidence: number
  successRate: number
  usageCount: number
  avgResponseTime: number
  priceUSDC: number
  agent?: {
    name: string
    address: string
    ghostScore: number
    tier: string
  }
}

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
) {
  try {
    const resolvedParams = await params
    // Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = await getRateLimitTier(request.headers)
    await checkRateLimit(identifier, rateLimit)

    const { capability } = resolvedParams

    // Validate query parameters with Zod
    const queryParams = searchParamsToRecord(request.nextUrl.searchParams)
    const validationResult = seanceCapabilitiesQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return NextResponse.json(validationError(validationResult.error), { status: 400 })
    }

    const { minLevel, limit, verifiedOnly } = validationResult.data

    if (!capability) {
      throw errors.badRequest('Capability is required')
    }

    // Check cache
    const cacheKey = cacheKeys.capabilities(
      `${capability}:${minLevel}:${limit}:${verifiedOnly}`
    )
    const cached = getCached(cacheKey)
    if (cached) {
      return Response.json(
        {
          success: true,
          data: cached,
          meta: {
            timestamp: Date.now(),
            cached: true,
            ttl: cacheTTL.capabilities,
          },
        },
        {
          headers: {
            'Cache-Control': `public, s-maxage=${cacheTTL.capabilities}`,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Fetch agents with this capability
    const capabilities = await fetchQuery(api.agentCapabilities.getByCapability, {
      capability,
      minLevel,
      limit,
    })

    // Filter by verified if requested
    let filtered = capabilities as CapabilityWithAgent[]
    if (verifiedOnly) {
      filtered = (capabilities as CapabilityWithAgent[]).filter((c) => c.isVerified)
    }

    // Build response
    const response: CapabilitiesSearchResponse = {
      capability,
      totalAgents: filtered.length,
      agents: filtered.map((c) => ({
        agent: {
          name: c.agent?.name || 'Unknown',
          address: c.agent?.address || 'Unknown',
          ghostScore: c.agent?.ghostScore || 0,
          tier: c.agent?.tier || 'bronze',
        },
        capability: {
          level: c.level,
          confidence: c.confidence,
          successRate: c.successRate,
          usageCount: c.usageCount,
          avgResponseTime: c.avgResponseTime,
          priceUSDC: c.priceUSDC,
          isVerified: c.isVerified,
        },
      })),
    }

    // Cache response
    setCache(cacheKey, response, cacheTTL.capabilities)

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
          'Cache-Control': `public, s-maxage=${cacheTTL.capabilities}`,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
