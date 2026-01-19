import { NextResponse } from 'next/server'

/**
 * Observatory API - Root endpoint
 * GET /api/observatory
 */
export async function GET() {
  return NextResponse.json({
    name: 'GhostSpeak Observatory API',
    version: '2.0.0',
    description: 'Real-time monitoring of AI agent commerce, x402 payments, and trust metrics',
    endpoints: {
      payments: '/api/observatory/payments',
      endpoints: '/api/observatory/endpoints',
      agents: '/api/observatory/agents',
      metrics: '/api/observatory/metrics',
      events: '/api/observatory/events',
      health: '/api/observatory/health',
    },
    documentation: 'https://docs.ghostspeak.io/observatory',
  })
}
