/**
 * Convex HTTP Actions
 *
 * HTTP endpoints for Seance API (Oracle service for x402 reputation data)
 * Replaces Next.js API routes with Convex-native HTTP handlers
 *
 * Note: Many endpoints are simplified as the underlying internal queries
 * need to be implemented. This provides the HTTP router structure.
 */

import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

// ==========================================
// SEANCE API - AGENT REPUTATION
// ==========================================

/**
 * GET /seance/agent/:address
 *
 * Get agent reputation data by address
 */
http.route({
  path: '/seance/agent/:address',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const address = url.pathname.split('/').pop() || ''

    if (!address) {
      return new Response(JSON.stringify({ error: 'Agent address required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      // Use existing internal query from solanaSync
      const agent = await ctx.runQuery(internal.solanaSync.getAgentByAddress, { address })

      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({
          agent: {
            address: agent.address,
            name: agent.name,
            description: agent.description,
            ghostScore: agent.ghostScore,
            tier: agent.tier,
            isActive: agent.isActive,
          },
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error fetching agent:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error', message: String(error) }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }),
})

/**
 * GET /seance/agent/:address/transactions
 *
 * Get transaction history for an agent
 */
http.route({
  path: '/seance/agent/:address/transactions',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const address = url.pathname.split('/')[3] || ''

    if (!address) {
      return new Response(JSON.stringify({ error: 'Agent address required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const agent = await ctx.runQuery(internal.solanaSync.getAgentByAddress, { address })

      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Get transactions for this agent
      const limitParam = url.searchParams.get('limit')
      const limit = limitParam ? parseInt(limitParam, 10) : 50

      const transactions = await ctx.runQuery(internal.agentTransactions.getByAgentInternal, {
        agentId: agent._id,
        limit,
      })

      return new Response(
        JSON.stringify({
          transactions,
          total: transactions.length,
          agent: {
            address: agent.address,
            name: agent.name,
            ghostScore: agent.ghostScore,
            tier: agent.tier,
          },
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error fetching transactions:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

/**
 * GET /seance/agent/:address/attestations
 *
 * Get attestations received by an agent
 */
http.route({
  path: '/seance/agent/:address/attestations',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const address = url.pathname.split('/')[3] || ''

    if (!address) {
      return new Response(JSON.stringify({ error: 'Agent address required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const agent = await ctx.runQuery(internal.solanaSync.getAgentByAddress, { address })

      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Use existing internal query
      const attestations = await ctx.runQuery(internal.agentAttestations.getForSubject, {
        subjectAgentId: agent._id,
        activeOnly: true,
      })

      return new Response(
        JSON.stringify({
          attestations,
          total: attestations.length,
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error fetching attestations:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

// ==========================================
// SEANCE API - FACILITATOR DATA
// ==========================================

/**
 * GET /seance/facilitator/:slug
 *
 * Get facilitator status and metrics
 */
http.route({
  path: '/seance/facilitator/:slug',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const slug = url.pathname.split('/').pop() || ''

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Facilitator slug required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})
      const facilitator = facilitators.find((f: { slug: string }) => f.slug === slug)

      if (!facilitator) {
        return new Response(JSON.stringify({ error: 'Facilitator not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const health = await ctx.runQuery(internal.monitoring.getLatestHealth, {
        facilitatorId: facilitator._id,
      })

      return new Response(
        JSON.stringify({
          facilitator,
          health,
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error fetching facilitator:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

// ==========================================
// SEANCE API - NETWORK STATS
// ==========================================

/**
 * GET /seance/stats
 *
 * Get network-wide statistics
 */
http.route({
  path: '/seance/stats',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    try {
      // Get all agents using existing internal query
      const agents = await ctx.runQuery(internal.solanaSync.getAllAgents)
      const facilitators = await ctx.runQuery(internal.monitoring.getActiveFacilitators, {})

      return new Response(
        JSON.stringify({
          stats: {
            totalAgents: agents.length,
            activeAgents: agents.filter((a: { isActive?: boolean }) => a.isActive).length,
            totalFacilitators: facilitators.length,
            activeFacilitators: facilitators.filter((f: { status?: string }) => f.status === 'active').length,
          },
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error fetching stats:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

// ==========================================
// SEANCE API - MERCHANT DATA
// ==========================================

/**
 * GET /seance/merchant/:id/analytics
 *
 * Get merchant analytics (time-series metrics)
 */
http.route({
  path: '/seance/merchant/:id/analytics',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const merchantIdStr = url.pathname.split('/')[3] || ''
    const days = parseInt(url.searchParams.get('days') || '30')
    const periodType = url.searchParams.get('periodType') as 'hourly' | 'daily' | 'weekly' | undefined

    if (!merchantIdStr) {
      return new Response(JSON.stringify({ error: 'Merchant ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      // Type for summary result
      type SummaryResult = { snapshotCount: number; [key: string]: unknown }

      // Use existing merchant analytics internal queries
      const [summaryResult, timeSeries] = await Promise.all([
        ctx.runQuery(internal.merchantAnalytics.getSummary, {
          merchantId: merchantIdStr as any,
          days,
        }),
        ctx.runQuery(internal.merchantAnalytics.getAnalytics, {
          merchantId: merchantIdStr as any,
          periodType,
          limit: 30,
        }),
      ])

      const summary = summaryResult as SummaryResult

      // If no snapshots exist, fall back to realtime calculation
      let finalSummary: unknown = summary
      let dataSource = 'snapshots'

      if (summary.snapshotCount === 0) {
        finalSummary = await ctx.runQuery(internal.merchantAnalytics.getRealtimeAnalytics, {
          merchantId: merchantIdStr as any,
          days,
        })
        dataSource = 'realtime'
      }

      return new Response(
        JSON.stringify({
          analytics: {
            summary: finalSummary,
            timeSeries,
            dataSource,
          },
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error fetching merchant analytics:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

/**
 * POST /seance/attest
 *
 * Submit an attestation
 */
http.route({
  path: '/seance/attest',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json()

      const {
        attestorAgentId,
        subjectAgentId,
        attestationType,
        claim,
        confidence,
        basedOn,
        evidence,
        relatedTransactionId,
        relatedCapability,
        expiresAt,
      } = body

      // Validate required fields
      if (!attestorAgentId || !subjectAgentId || !attestationType || !claim || confidence === undefined) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields',
            required: ['attestorAgentId', 'subjectAgentId', 'attestationType', 'claim', 'confidence'],
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      const attestationId = await ctx.runMutation(internal.agentAttestations.createInternal, {
        attestorAgentId,
        subjectAgentId,
        attestationType,
        claim,
        confidence,
        basedOn,
        evidence,
        relatedTransactionId,
        relatedCapability,
        expiresAt,
      })

      return new Response(
        JSON.stringify({
          success: true,
          attestationId,
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error creating attestation:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to create attestation',
          message: String(error),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }),
})

/**
 * POST /seance/vote
 *
 * Submit a reputation vote
 */
http.route({
  path: '/seance/vote',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json()

      const {
        voterAgentId,
        subjectType,
        subjectAgentId,
        subjectMerchantId,
        voteType,
        reason,
        basedOnTransactionId,
      } = body

      // Validate required fields
      if (!voterAgentId || !subjectType || !voteType) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields',
            required: ['voterAgentId', 'subjectType', 'voteType'],
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Validate subject ID based on type
      if (subjectType === 'agent' && !subjectAgentId) {
        return new Response(
          JSON.stringify({ error: 'subjectAgentId required for agent votes' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (subjectType === 'merchant' && !subjectMerchantId) {
        return new Response(
          JSON.stringify({ error: 'subjectMerchantId required for merchant votes' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      const voteId = await ctx.runMutation(internal.reputationVotes.castInternal, {
        voterAgentId,
        subjectType,
        subjectAgentId,
        subjectMerchantId,
        voteType,
        reason,
        basedOnTransactionId,
      })

      return new Response(
        JSON.stringify({
          success: true,
          voteId,
          meta: {
            timestamp: Date.now(),
            source: 'GhostSpeak Seance API',
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('[Seance API] Error creating vote:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to create vote',
          message: String(error),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }),
})

// ==========================================
// HEALTH CHECK
// ==========================================

/**
 * GET /seance/health
 *
 * API health check
 */
http.route({
  path: '/seance/health',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: Date.now(),
        version: '2.0',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }),
})

// ==========================================
// CORS & OPTIONS
// ==========================================

http.route({
  path: '/seance/*',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }),
})

export default http
