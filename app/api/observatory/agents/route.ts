import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import {
  observatoryAgentsQuerySchema,
  searchParamsToRecord,
  validationError,
} from '@/lib/validation'

/**
 * Observatory API - Agents
 * GET /api/observatory/agents
 *
 * Query params (validated with Zod):
 * - limit: number (default: 50, max: 100)
 * - minScore: number (0-1000)
 * - tier: 'bronze' | 'silver' | 'gold' | 'platinum'
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const params = searchParamsToRecord(request.nextUrl.searchParams)
    const result = observatoryAgentsQuerySchema.safeParse(params)

    if (!result.success) {
      return NextResponse.json(validationError(result.error), { status: 400 })
    }

    const { limit, minScore, tier } = result.data

    // Fetch real data from Convex
    const [agents, stats] = await Promise.all([
      fetchQuery(api.agents.list, { limit }),
      fetchQuery(api.agentProfiles.getStats, {}),
    ])

    // Filter by minScore and tier
    let filteredAgents = agents.filter((agent) => agent.ghostScore >= minScore)
    if (tier) {
      filteredAgents = filteredAgents.filter((agent) => agent.tier === tier)
    }

    // Calculate average Ghost Score
    const avgGhostScore =
      filteredAgents.length > 0
        ? Math.round(
            filteredAgents.reduce((sum, a) => sum + a.ghostScore, 0) / filteredAgents.length
          )
        : 0

    return NextResponse.json(
      {
        total: stats.totalAgents,
        activeAgents: stats.activeAgents,
        avgGhostScore,
        agents: filteredAgents.map((agent) => ({
          id: agent._id,
          name: agent.name,
          address: agent.address,
          ghostScore: agent.ghostScore,
          tier: agent.tier,
          capabilities: agent.capabilities,
          isActive: agent.isActive,
        })),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}
