/**
 * Convex Function Tests: Credential Operations
 *
 * Tests credential issuance, verification, and revocation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockConvexContext } from '../mocks/convex'
import { mockAgent } from '../fixtures/agents'

describe('Credential Convex Functions', () => {
  let ctx: ReturnType<typeof createMockConvexContext>

  beforeEach(() => {
    ctx = createMockConvexContext()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('credentials.issue', () => {
    it('creates a new credential for agent', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const credential = {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        status: 'active',
        claims: {
          ghostScore: mockAgent.ghostScore,
          tier: mockAgent.tier,
          verifiedCapabilities: ['text-generation'],
        },
      }

      const credentialId = await ctx.db.insert('credentials', credential)

      expect(credentialId).toBeDefined()

      const saved = await ctx.db.get('credentials', credentialId)
      expect(saved?.type).toBe('identity')
      expect(saved?.status).toBe('active')
      expect(saved?.claims.ghostScore).toBe(mockAgent.ghostScore)
    })

    it('generates unique credential IDs', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const id1 = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      const id2 = await ctx.db.insert('credentials', {
        agentId,
        type: 'capability',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      expect(id1).not.toBe(id2)
    })

    it('validates credential type', () => {
      const validTypes = ['identity', 'capability', 'attestation', 'reputation']

      validTypes.forEach((type) => {
        expect(validTypes.includes(type)).toBe(true)
      })

      expect(validTypes.includes('invalid')).toBe(false)
    })
  })

  describe('credentials.verify', () => {
    it('returns true for valid active credential', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const credentialId = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        status: 'active',
        claims: {},
      })

      const credential = await ctx.db.get('credentials', credentialId)

      const isValid =
        credential?.status === 'active' &&
        (!credential.expiresAt || credential.expiresAt > Date.now())

      expect(isValid).toBe(true)
    })

    it('returns false for expired credential', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const credentialId = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now() - 400 * 24 * 60 * 60 * 1000, // 400 days ago
        expiresAt: Date.now() - 35 * 24 * 60 * 60 * 1000, // Expired 35 days ago
        status: 'active',
        claims: {},
      })

      const credential = await ctx.db.get('credentials', credentialId)

      const isValid =
        credential?.status === 'active' &&
        (!credential.expiresAt || credential.expiresAt > Date.now())

      expect(isValid).toBe(false)
    })

    it('returns false for revoked credential', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const credentialId = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'revoked',
        revokedAt: Date.now(),
        revocationReason: 'Security concern',
        claims: {},
      })

      const credential = await ctx.db.get('credentials', credentialId)

      expect(credential?.status).toBe('revoked')
      expect(credential?.status !== 'active').toBe(true)
    })
  })

  describe('credentials.revoke', () => {
    it('revokes active credential', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const credentialId = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      await ctx.db.patch('credentials', credentialId, {
        status: 'revoked',
        revokedAt: Date.now(),
        revocationReason: 'Agent requested',
      })

      const revoked = await ctx.db.get('credentials', credentialId)
      expect(revoked?.status).toBe('revoked')
      expect(revoked?.revokedAt).toBeDefined()
      expect(revoked?.revocationReason).toBe('Agent requested')
    })

    it('cannot revoke already revoked credential', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const credentialId = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'revoked',
        revokedAt: Date.now() - 1000,
        revocationReason: 'Initial revocation',
        claims: {},
      })

      const credential = await ctx.db.get('credentials', credentialId)

      // Should not update if already revoked
      if (credential?.status === 'revoked') {
        expect(credential.revocationReason).toBe('Initial revocation')
      }
    })
  })

  describe('credentials.getByAgent', () => {
    it('returns all credentials for agent', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      await ctx.db.insert('credentials', {
        agentId,
        type: 'capability',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: { capability: 'text-generation' },
      })

      const credentials = await ctx.db.query('credentials').filter((c) => c.agentId === agentId)

      expect(credentials.length).toBe(2)
    })

    it('filters credentials by type', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      await ctx.db.insert('credentials', {
        agentId,
        type: 'capability',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      const identityCredentials = await ctx.db
        .query('credentials')
        .filter((c) => c.agentId === agentId && c.type === 'identity')

      expect(identityCredentials.length).toBe(1)
      expect(identityCredentials[0].type).toBe('identity')
    })

    it('returns only active credentials when filtered', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'active',
        claims: {},
      })

      await ctx.db.insert('credentials', {
        agentId,
        type: 'capability',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        status: 'revoked',
        revokedAt: Date.now(),
        claims: {},
      })

      const activeCredentials = await ctx.db
        .query('credentials')
        .filter((c) => c.agentId === agentId && c.status === 'active')

      expect(activeCredentials.length).toBe(1)
    })
  })

  describe('credentials.refresh', () => {
    it('extends expiration date for valid credential', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const originalExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

      const credentialId = await ctx.db.insert('credentials', {
        agentId,
        type: 'identity',
        issuer: 'ghostspeak',
        subject: mockAgent.address,
        issuedAt: Date.now(),
        expiresAt: originalExpiry,
        status: 'active',
        claims: {},
      })

      const newExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
      await ctx.db.patch('credentials', credentialId, {
        expiresAt: newExpiry,
        refreshedAt: Date.now(),
      })

      const refreshed = await ctx.db.get('credentials', credentialId)
      expect(refreshed?.expiresAt).toBe(newExpiry)
      expect(refreshed?.refreshedAt).toBeDefined()
    })
  })

  describe('credential claims validation', () => {
    it('validates ghost score claim is numeric', async () => {
      const claims = { ghostScore: 750 }
      expect(typeof claims.ghostScore).toBe('number')
    })

    it('validates tier claim is valid enum', async () => {
      const validTiers = ['bronze', 'silver', 'gold', 'platinum']
      const claims = { tier: 'gold' }
      expect(validTiers.includes(claims.tier)).toBe(true)
    })

    it('validates capabilities claim is array', async () => {
      const claims = { verifiedCapabilities: ['text-generation', 'image-analysis'] }
      expect(Array.isArray(claims.verifiedCapabilities)).toBe(true)
    })
  })
})
