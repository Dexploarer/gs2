/**
 * GET /api/seance/verify/[credentialId]
 *
 * Verify a W3C Verifiable Credential
 */

import { NextRequest } from 'next/server'
import { fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { errorResponse, errors } from '@/lib/api/errors'
import { checkRateLimit, getRateLimitIdentifier, getRateLimitTier } from '@/lib/api/rateLimit'
import type { CredentialVerificationResponse } from '@/lib/api/types'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const resolvedParams = await params
    // Rate limiting
    const identifier = getRateLimitIdentifier(request)
    const rateLimit = await getRateLimitTier(request.headers)
    await checkRateLimit(identifier, rateLimit)

    const { credentialId } = resolvedParams

    if (!credentialId) {
      throw errors.badRequest('Credential ID is required')
    }

    // Fetch credential (no caching - always fresh verification)
    const credential = await fetchQuery(api.credentials.get, { credentialId })

    if (!credential) {
      throw errors.notFound('Credential')
    }

    // Check if valid
    const now = Date.now()
    const isExpired = credential.expiresAt ? credential.expiresAt < now : false
    const isRevoked = credential.isRevoked
    const isValid = !isExpired && !isRevoked

    let reason: string | undefined
    if (isRevoked) {
      reason = 'Credential has been revoked'
    } else if (isExpired) {
      reason = 'Credential has expired'
    }

    // Build response
    const response: CredentialVerificationResponse = {
      credential: {
        credentialId: credential.credentialId,
        type: credential.type,
        issuedBy: credential.issuedBy,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
        isRevoked: credential.isRevoked,
        isExpired,
      },
      agent: {
        name: credential.agent?.name || 'Unknown',
        address: credential.agent?.address || 'Unknown',
        ghostScore: credential.agent?.ghostScore || 0,
      },
      claims: credential.claims,
      evidence: credential.evidence.map((e) => ({
        evidenceType: e.evidenceType,
        source: e.source,
        isVerified: e.isVerified,
        verifiedBy: e.verifiedBy,
        verifiedAt: e.verifiedAt,
        collectedAt: e.collectedAt,
      })),
      verification: {
        isValid,
        reason,
      },
    }

    return Response.json(
      {
        success: true,
        data: response,
        meta: {
          timestamp: Date.now(),
          cached: false, // Never cached
        },
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
