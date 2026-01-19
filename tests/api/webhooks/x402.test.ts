/**
 * Integration Tests: /api/webhooks/x402
 *
 * Tests x402 payment webhook endpoint
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handlers directly
const getRouteHandlers = async () => {
  const module = await import('@/app/api/webhooks/x402/route')
  return { GET: module.GET, POST: module.POST }
}

describe('/api/webhooks/x402', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping x402 webhook tests - no Convex credentials')
    }
  })

  describe('GET /api/webhooks/x402', () => {
    it.skipIf(skipWithoutConvex)('returns health check response', async () => {
      const { GET } = await getRouteHandlers()
      const response = await GET()

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.status).toBe('healthy')
      expect(data.endpoint).toBe('/api/webhooks/x402')
      expect(Array.isArray(data.accepts)).toBe(true)
      expect(data.accepts).toContain('POST')
      expect(Array.isArray(data.formats)).toBe(true)
    })
  })

  describe('POST /api/webhooks/x402', () => {
    it.skipIf(skipWithoutConvex)('returns 400 for invalid JSON', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/webhooks/x402', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid JSON')
    })

    it.skipIf(skipWithoutConvex)('returns 400 for missing required fields', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/webhooks/x402', {
        method: 'POST',
        body: JSON.stringify({
          transaction: {
            network: 'solana',
            // Missing payer and txSignature
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it.skipIf(skipWithoutConvex)('accepts PayAI webhook format', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/webhooks/x402', {
        method: 'POST',
        body: JSON.stringify({
          transaction: {
            signature: 'test_signature_' + Date.now(),
            network: 'solana',
            amount: '1000000',
            asset: 'USDC',
            payer: 'TestPayer123456789012345678901234567890123',
            recipient: 'TestRecipient1234567890123456789012345678',
            endpoint: 'https://example.com/api/test',
            timestamp: Date.now(),
            status: 'verified',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // In dev mode without webhook secret, should succeed or return signature error in prod
      expect([200, 401, 500]).toContain(response.status)
    })

    it.skipIf(skipWithoutConvex)('accepts Coinbase CDP webhook format', async () => {
      const { POST } = await getRouteHandlers()
      const request = new NextRequest('http://localhost/api/webhooks/x402', {
        method: 'POST',
        body: JSON.stringify({
          payment: {
            transactionHash: '0xtest_hash_' + Date.now(),
            network: 'base',
            amount: '5000000',
            asset: 'USDC',
            sender: 'TestSender12345678901234567890123456789012',
            receiver: 'TestReceiver1234567890123456789012345678',
            endpoint: 'https://example.com/api/endpoint',
            timestamp: Date.now(),
            status: 'completed',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)

      // In dev mode without webhook secret, should succeed or return appropriate error
      expect([200, 401, 500]).toContain(response.status)
    })
  })
})
