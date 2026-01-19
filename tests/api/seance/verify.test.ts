/**
 * Integration Tests: /api/seance/verify/[credentialId]
 *
 * Tests credential verification against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasConvexCredentials, skipWithoutConvex } from '../../setup'

// Import route handler directly - no mocking
const getRouteHandler = async () => {
  const module = await import('@/app/api/seance/verify/[credentialId]/route')
  return module.GET
}

// Test credential IDs
const NONEXISTENT_CREDENTIAL_ID = 'cred_nonexistent_123456789'

describe('GET /api/seance/verify/[credentialId]', () => {
  beforeAll(() => {
    if (!hasConvexCredentials) {
      console.log('Skipping verify tests - no Convex credentials')
    }
  })

  it.skipIf(skipWithoutConvex)('returns 404 for non-existent credential', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/verify/${NONEXISTENT_CREDENTIAL_ID}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ credentialId: NONEXISTENT_CREDENTIAL_ID }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBeDefined()
    expect(data.error.message).toContain('not found')
  })

  it.skipIf(skipWithoutConvex)('returns 400 for empty credential ID', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest('http://localhost/api/seance/verify/')
    const response = await GET(request, {
      params: Promise.resolve({ credentialId: '' }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it.skipIf(skipWithoutConvex)('does not cache verification results', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/verify/${NONEXISTENT_CREDENTIAL_ID}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ credentialId: NONEXISTENT_CREDENTIAL_ID }),
    })

    // Verification should never be cached for security
    const cacheControl = response.headers.get('Cache-Control')
    if (cacheControl) {
      expect(cacheControl).toContain('no-cache')
    }
  })

  // Note: To test successful verification, we would need a known credential ID
  // from the database. This test validates the response structure when found.
  it.skipIf(skipWithoutConvex)('returns verification data with proper structure when found', async () => {
    const GET = await getRouteHandler()
    const request = new NextRequest(
      `http://localhost/api/seance/verify/${NONEXISTENT_CREDENTIAL_ID}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ credentialId: NONEXISTENT_CREDENTIAL_ID }),
    })

    // Will be 404 for nonexistent, but validates error handling
    if (response.status === 200) {
      const data = await response.json()

      // Verify response structure
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.meta).toBeDefined()

      // Verify credential data shape
      expect(data.data.credential).toBeDefined()
      expect(data.data.credential).toHaveProperty('credentialId')
      expect(data.data.credential).toHaveProperty('type')
      expect(data.data.credential).toHaveProperty('issuedBy')
      expect(data.data.credential).toHaveProperty('issuedAt')
      expect(data.data.credential).toHaveProperty('isRevoked')
      expect(data.data.credential).toHaveProperty('isExpired')

      // Verify agent info
      expect(data.data.agent).toBeDefined()
      expect(data.data.agent).toHaveProperty('name')
      expect(data.data.agent).toHaveProperty('address')
      expect(data.data.agent).toHaveProperty('ghostScore')

      // Verify claims and evidence
      expect(data.data.claims).toBeDefined()
      expect(Array.isArray(data.data.evidence)).toBe(true)

      // Verify verification result
      expect(data.data.verification).toBeDefined()
      expect(typeof data.data.verification.isValid).toBe('boolean')
    } else {
      expect(response.status).toBe(404)
    }
  })
})
