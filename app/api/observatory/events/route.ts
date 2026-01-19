import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import {
  observatoryEventsQuerySchema,
  searchParamsToRecord,
  validationError,
} from '@/lib/validation'

/**
 * Observatory API - Trust Events
 * GET /api/observatory/events
 *
 * Query params (validated with Zod):
 * - limit: number (default: 50, max: 100)
 * - eventType: 'score_increase' | 'credential_issued' | etc.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const params = searchParamsToRecord(request.nextUrl.searchParams)
    const result = observatoryEventsQuerySchema.safeParse(params)

    if (!result.success) {
      return NextResponse.json(validationError(result.error), { status: 400 })
    }

    const { limit, eventType } = result.data

    // Fetch real events from Convex
    const events = await fetchQuery(api.trustEvents.getRecent, {
      limit,
      eventType,
    })

    return NextResponse.json(
      {
        total: events.length,
        events: events.map((event) => ({
          id: event._id,
          agentId: event.agentId,
          agent: event.agent,
          eventType: event.eventType,
          oldScore: event.oldScore,
          newScore: event.newScore,
          reason: event.reason,
          timestamp: event.timestamp,
        })),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
