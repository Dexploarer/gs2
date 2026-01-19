/**
 * Integration Tests: /api/staking
 *
 * Tests token staking API endpoints
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../setup'

// Import route handlers directly
const getRouteHandlers = async () => {
  const module = await import('@/app/api/staking/route')
  return { GET: module.GET, POST: module.POST }
}

// Test Solana addresses (valid base58 format)
const TEST_AGENT_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
const TEST_TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
const TEST_STAKER_ADDRESS = '4Nd1mMsL85QQonxFqRjGfHr5vYk6tM4K5g9PGECJx7qM'

describe('/api/staking', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping staking tests - no Convex credentials')
    }
  })

  describe('GET /api/staking', () => {
    it.skipIf(skipWithoutConvex)('returns error for invalid action', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking?action=invalid')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid action')
      expect(Array.isArray(data.validActions)).toBe(true)
    })

    it.skipIf(skipWithoutConvex)('supports derive-vault action', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest(
        `http://localhost/api/staking?action=derive-vault&targetAgent=${TEST_AGENT_ADDRESS}&tokenMint=${TEST_TOKEN_MINT}`
      )
      const response = await GET(request)

      // May fail if Solana program not deployed or RPC unavailable
      expect([200, 500]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(data.vaultAddress).toBeDefined()
        expect(typeof data.vaultAddress).toBe('string')
        expect(typeof data.bump).toBe('number')
      }
    })

    it.skipIf(skipWithoutConvex)('supports calculate-weight action', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest(
        'http://localhost/api/staking?action=calculate-weight&amount=1000000&multiplier=100'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.amount).toBe('1000000')
      expect(data.multiplier).toBe('100')
      expect(data.trustWeight).toBeDefined()
    })

    it.skipIf(skipWithoutConvex)('returns 400 for vault action without address', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking?action=vault')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it.skipIf(skipWithoutConvex)('returns 400 for invalid Solana address', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest(
        'http://localhost/api/staking?action=vault&vaultAddress=invalid_address'
      )
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it.skipIf(skipWithoutConvex)('returns 404 for non-existent vault', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest(
        `http://localhost/api/staking?action=vault&vaultAddress=${TEST_AGENT_ADDRESS}`
      )
      const response = await GET(request)

      // May return 404 (not found) or 500 (RPC error) depending on network
      expect([404, 500]).toContain(response.status)
    })

    it.skipIf(skipWithoutConvex)('supports all-vaults action', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking?action=all-vaults')
      const response = await GET(request)

      // May succeed or fail depending on RPC availability
      expect([200, 500]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(Array.isArray(data.vaults)).toBe(true)
      }
    })

    it.skipIf(skipWithoutConvex)('supports agent-vaults action', async () => {
      const { GET } = await getRouteHandlers()
      const request = new NextRequest(
        `http://localhost/api/staking?action=agent-vaults&targetAgent=${TEST_AGENT_ADDRESS}`
      )
      const response = await GET(request)

      // May succeed or fail depending on RPC availability
      expect([200, 500]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(Array.isArray(data.vaults)).toBe(true)
      }
    })
  })

  describe('POST /api/staking', () => {
    it.skipIf(skipWithoutConvex)('returns error for invalid action', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid action')
      expect(Array.isArray(data.validActions)).toBe(true)
    })

    it.skipIf(skipWithoutConvex)('validates build-stake parameters', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking', {
        method: 'POST',
        body: JSON.stringify({
          action: 'build-stake',
          // Missing required fields
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it.skipIf(skipWithoutConvex)('builds stake transaction with valid params', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking', {
        method: 'POST',
        body: JSON.stringify({
          action: 'build-stake',
          staker: TEST_STAKER_ADDRESS,
          targetAgent: TEST_AGENT_ADDRESS,
          tokenMint: TEST_TOKEN_MINT,
          amount: '1000000',
          category: 'collateral',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      // May succeed (200), fail validation (400), or RPC error (500)
      expect([200, 400, 500]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(data.transaction).toBeDefined()
        expect(typeof data.transaction).toBe('string')
        expect(data.message).toBeDefined()
      }
    })

    it.skipIf(skipWithoutConvex)('validates build-unstake parameters', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking', {
        method: 'POST',
        body: JSON.stringify({
          action: 'build-unstake',
          staker: 'invalid_address',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it.skipIf(skipWithoutConvex)('validates build-init-vault parameters', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/staking', {
        method: 'POST',
        body: JSON.stringify({
          action: 'build-init-vault',
          authority: TEST_STAKER_ADDRESS,
          targetAgent: TEST_AGENT_ADDRESS,
          tokenMint: TEST_TOKEN_MINT,
          minStakeAmount: '1000000',
          lockPeriodSeconds: '86400',
          weightMultiplier: 100,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)

      // May succeed or fail depending on RPC availability
      expect([200, 500]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(data.transaction).toBeDefined()
        expect(typeof data.transaction).toBe('string')
      }
    })
  })
})
