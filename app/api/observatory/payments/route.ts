import { NextRequest, NextResponse } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import {
  observatoryPaymentsQuerySchema,
  searchParamsToRecord,
  validationError,
} from '@/lib/validation'

/**
 * Observatory API - Payments
 * GET /api/observatory/payments
 *
 * Query params (validated with Zod):
 * - limit: number (default: 50, max: 100)
 * - network: 'solana' | 'base'
 * - status: 'completed' | 'pending' | 'failed'
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const params = searchParamsToRecord(request.nextUrl.searchParams)
    const result = observatoryPaymentsQuerySchema.safeParse(params)

    if (!result.success) {
      return NextResponse.json(validationError(result.error), { status: 400 })
    }

    const { limit, network, status } = result.data
    // Fetch real data from Convex
    const [payments, stats] = await Promise.all([
      fetchQuery(api.x402Payments.getRecent, { limit }),
      fetchQuery(api.x402Payments.getStats, {}),
    ])

    // Filter by network and status if specified
    let filteredPayments = payments
    if (network) {
      filteredPayments = filteredPayments.filter((p) => p.network === network)
    }
    if (status) {
      filteredPayments = filteredPayments.filter((p) => p.status === status)
    }

    return NextResponse.json(
      {
        total: stats.total,
        volume: stats.totalVolume,
        successRate: stats.successRate,
        payments: filteredPayments.map((payment) => ({
          id: payment._id,
          txSignature: payment.txSignature,
          agentId: payment.agentId,
          endpoint: payment.endpoint,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          network: payment.network,
          facilitator: payment.facilitator,
          responseTime: payment.responseTime,
          timestamp: payment.timestamp,
        })),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
