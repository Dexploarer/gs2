import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import {
  observatoryEndpointsQuerySchema,
  searchParamsToRecord,
  validationError,
} from '@/lib/validation'

/**
 * Observatory API - Endpoints
 * GET /api/observatory/endpoints
 *
 * Query params (validated with Zod):
 * - limit: number (default: 50, max: 100)
 * - protocol: 'x402' | 'http' | 'https'
 * - minSuccessRate: number (0-100)
 * - minGhostScore: number (0-1000)
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const params = searchParamsToRecord(request.nextUrl.searchParams)
    const result = observatoryEndpointsQuerySchema.safeParse(params)

    if (!result.success) {
      return NextResponse.json(validationError(result.error), { status: 400 })
    }

    const { limit, protocol, minSuccessRate, minGhostScore } = result.data

    // Fetch real endpoints from Convex
    const endpoints = await fetchQuery(api.endpoints.list, {
      limit,
      protocol,
      minSuccessRate,
      minGhostScore,
    })

    return NextResponse.json(
      {
        total: endpoints.length,
        endpoints: endpoints.map((endpoint) => ({
          id: endpoint._id,
          name: endpoint.name,
          url: endpoint.url,
          protocol: endpoint.protocol,
          provider: endpoint.agent,
          price: endpoint.priceUSDC,
          successRate: endpoint.successRate,
          avgResponseTime: endpoint.avgResponseTime,
          totalCalls: endpoint.totalCalls,
          verified: endpoint.isVerified,
          capabilities: endpoint.capabilities,
          lastTested: endpoint.lastTested,
        })),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching endpoints:', error)
    return NextResponse.json({ error: 'Failed to fetch endpoints' }, { status: 500 })
  }
}
