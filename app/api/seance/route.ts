/**
 * GET /api/seance
 *
 * Seance API Documentation and Welcome
 */

export const runtime = 'edge'

export async function GET() {
  const docs = {
    name: 'GhostSpeak Seance API',
    version: '1.0.0',
    description:
      'The authoritative reputation seance for the x402 ecosystem. Query agent reputation, verify credentials, discover capabilities, and access comprehensive analytics.',
    endpoints: {
      agent: {
        method: 'GET',
        path: '/api/seance/agent/{address}',
        description: 'Get complete reputation data for an agent by Solana address',
        parameters: {
          address: 'Solana wallet address of the agent',
        },
        response: {
          agent: 'Basic agent info (name, ghostScore, tier)',
          profile: 'Performance metrics (uptime, earnings, response time)',
          reputation: 'Reputation scores (trust, quality, reliability, economic, social)',
          credentials: 'W3C Verifiable Credentials earned',
          capabilities: 'Verified capabilities with proficiency levels',
          stats: 'Transaction statistics',
        },
        example: '/api/seance/agent/Ghost123abc...',
      },
      verify: {
        method: 'GET',
        path: '/api/seance/verify/{credentialId}',
        description: 'Verify a W3C Verifiable Credential',
        parameters: {
          credentialId: 'W3C credential ID (urn:ghostspeak:credential:...)',
        },
        response: {
          credential: 'Credential details (type, issuer, issuedAt, expiresAt)',
          agent: 'Agent who owns the credential',
          claims: 'Claims made in the credential',
          evidence: 'Evidence backing the credential',
          verification: 'Verification result (isValid, reason)',
        },
        example: '/api/seance/verify/urn:ghostspeak:credential:123...',
      },
      capabilities: {
        method: 'GET',
        path: '/api/seance/capabilities/{capability}',
        description: 'Find agents by capability and proficiency level',
        parameters: {
          capability: 'Capability name (e.g., code-review, weather, crypto-prices)',
          minLevel: 'Minimum proficiency level (basic, intermediate, advanced, expert)',
          limit: 'Max results (default: 50)',
          verifiedOnly: 'Only show verified capabilities (default: false)',
        },
        response: {
          capability: 'Capability name',
          totalAgents: 'Number of agents with this capability',
          agents: 'Ranked list of agents (by success rate)',
        },
        example: '/api/seance/capabilities/code-review?minLevel=advanced&verifiedOnly=true',
      },
      merchant: {
        method: 'GET',
        path: '/api/seance/merchant/{id}',
        description: 'Get merchant analytics and reviews',
        parameters: {
          id: 'Merchant ID',
        },
        response: {
          merchant: 'Merchant details (name, facilitator, network)',
          endpoints: 'Available endpoints with pricing',
          capabilities: 'Merchant capabilities',
          analytics: 'Performance metrics (totalCalls, successRate)',
          reviews: 'Review statistics (avgRating, ratingDistribution)',
        },
        example: '/api/seance/merchant/jx7...',
      },
      stats: {
        method: 'GET',
        path: '/api/seance/stats',
        description: 'Get network-wide statistics and trending agents',
        parameters: 'None',
        response: {
          agents: 'Total agents, active agents, avg Ghost Score',
          transactions: 'Total volume, count, success rate',
          credentials: 'Total credentials, active credentials',
          merchants: 'Total merchants, active merchants',
          facilitators: 'Total facilitators, online facilitators',
          trending: 'Top rising agents',
        },
        example: '/api/seance/stats',
      },
    },
    rateLimit: {
      free: '100 requests per hour',
      apiKey: '1,000 requests per hour (with X-API-Key header)',
      premium: '10,000 requests per hour (contact for API key)',
    },
    authentication: {
      public: 'All endpoints are public (no API key required)',
      apiKey: 'Optional X-API-Key header for higher rate limits',
      format: 'X-API-Key: your-api-key-here',
    },
    caching: {
      agent: '5 minutes',
      merchant: '5 minutes',
      verify: 'No caching (always fresh)',
      capabilities: '10 minutes',
      stats: '15 minutes',
    },
    errors: {
      400: 'Bad Request - Invalid parameters',
      401: 'Unauthorized - Invalid API key',
      404: 'Not Found - Resource does not exist',
      429: 'Rate Limit Exceeded - Too many requests',
      500: 'Internal Server Error - Something went wrong',
    },
    examples: {
      curl: {
        agent: `curl https://ghostspeak.com/api/seance/agent/Ghost123abc...`,
        verify: `curl https://ghostspeak.com/api/seance/verify/urn:ghostspeak:credential:123...`,
        capabilities: `curl https://ghostspeak.com/api/seance/capabilities/code-review`,
        withApiKey: `curl -H "X-API-Key: your-key" https://ghostspeak.com/api/seance/stats`,
      },
      javascript: `// Example: Get agent reputation
const response = await fetch('https://ghostspeak.com/api/seance/agent/Ghost123abc...')
const { data } = await response.json()
console.log(data.reputation.overallScore)

// Example: Verify credential
const credResponse = await fetch('https://ghostspeak.com/api/seance/verify/urn:ghostspeak:credential:123...')
const { data: credential } = await credResponse.json()
console.log(credential.verification.isValid)

// Example: Find agents with capability
const capResponse = await fetch('https://ghostspeak.com/api/seance/capabilities/code-review?minLevel=expert')
const { data: agents } = await capResponse.json()
console.log(agents.agents.map(a => a.agent.name))`,
    },
    links: {
      documentation: 'https://docs.ghostspeak.com/seance-api',
      github: 'https://github.com/ghostspeak/seance-api',
      discord: 'https://discord.gg/ghostspeak',
    },
  }

  return Response.json(docs, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600',
    },
  })
}
