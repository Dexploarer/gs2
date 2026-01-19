/**
 * x402 Transaction Webhook
 *
 * Receives transaction notifications from x402 facilitators (PayAI, Coinbase CDP)
 * and records them to Convex for analytics and trust scoring.
 *
 * Security: Implements HMAC-SHA256 signature verification for webhook authenticity.
 *
 * POST /api/webhooks/x402
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchMutation, fetchQuery } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { validateWebhookPayload, type X402PaymentWebhookData } from '@/lib/x402/mcp-client'
import { z } from 'zod'

export const runtime = 'edge'

// Webhook secret for verifying requests (set in environment)
const WEBHOOK_SECRET = process.env.X402_WEBHOOK_SECRET

// ============================================================================
// Webhook Payload Schema (Zod validation)
// ============================================================================

const webhookTransactionSchema = z.object({
  signature: z.string().optional(),
  txSignature: z.string().optional(),
  network: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  asset: z.string().optional(),
  payer: z.string().optional(),
  from: z.string().optional(),
  recipient: z.string().optional(),
  to: z.string().optional(),
  endpoint: z.string().optional(),
  resource: z.string().optional(),
  timestamp: z.number().optional(),
  status: z.string().optional(),
})

const webhookPaymentSchema = z.object({
  transactionHash: z.string().optional(),
  txHash: z.string().optional(),
  network: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  asset: z.string().optional(),
  payer: z.string().optional(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  receiver: z.string().optional(),
  endpoint: z.string().optional(),
  resource: z.string().optional(),
  timestamp: z.number().optional(),
  status: z.string().optional(),
})

const payaiWebhookSchema = z.object({
  transaction: webhookTransactionSchema,
})

const cdpWebhookSchema = z.object({
  payment: webhookPaymentSchema,
})

// ============================================================================
// HMAC Signature Verification (Edge Runtime Compatible)
// ============================================================================

/**
 * Compute HMAC-SHA256 signature using Web Crypto API (Edge compatible)
 */
async function computeHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData.buffer as ArrayBuffer)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to prevent length-based timing attacks
    let _result = 0
    const maxLen = Math.max(a.length, b.length)
    for (let i = 0; i < maxLen; i++) {
      _result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
    }
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verify webhook signature from facilitators
 * Supports both PayAI and Coinbase CDP signature formats
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string | null
): Promise<boolean> {
  // Production: Require webhook secret
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SECURITY: X402_WEBHOOK_SECRET not set in production')
      return false
    }
    console.warn('X402_WEBHOOK_SECRET not set - skipping verification (dev only)')
    return true
  }

  if (!signature) {
    console.error('SECURITY: Missing webhook signature header')
    return false
  }

  // Handle different signature formats:
  // PayAI: "sha256=<hex>" or just "<hex>"
  // CDP: "v1=<hex>" or just "<hex>"
  let normalizedSignature = signature
  if (signature.startsWith('sha256=')) {
    normalizedSignature = signature.slice(7)
  } else if (signature.startsWith('v1=')) {
    normalizedSignature = signature.slice(3)
  }

  // Compute expected signature
  const expectedSignature = await computeHmacSignature(payload, WEBHOOK_SECRET)

  // Use timing-safe comparison
  const isValid = timingSafeEqual(
    normalizedSignature.toLowerCase(),
    expectedSignature.toLowerCase()
  )

  if (!isValid) {
    console.error('SECURITY: Invalid webhook signature')
  }

  return isValid
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map network string to our enum values
 */
function normalizeNetwork(network: string): 'solana' | 'base' {
  const lower = network.toLowerCase()
  if (lower.includes('solana') || lower.startsWith('svm')) {
    return 'solana'
  }
  if (lower.includes('base') || lower.includes('eip155:8453')) {
    return 'base'
  }
  return 'solana'
}

/**
 * Valid webhook status values for X402PaymentWebhookData
 */
type WebhookStatus = 'pending' | 'verified' | 'settled' | 'failed'

/**
 * Normalize raw status string to valid webhook status
 */
function normalizeWebhookStatus(status: string | undefined): WebhookStatus {
  if (!status) return 'pending'
  const lower = status.toLowerCase()
  if (lower === 'verified' || lower === 'success' || lower === 'completed') {
    return 'verified'
  }
  if (lower === 'settled') {
    return 'settled'
  }
  if (lower === 'failed' || lower === 'error' || lower === 'rejected') {
    return 'failed'
  }
  return 'pending'
}

/**
 * Map webhook status to our database status enum
 */
function normalizeStatus(status: string): 'pending' | 'completed' | 'failed' {
  switch (status.toLowerCase()) {
    case 'verified':
    case 'settled':
    case 'success':
    case 'completed':
      return 'completed'
    case 'pending':
    case 'processing':
      return 'pending'
    case 'failed':
    case 'error':
    case 'rejected':
      return 'failed'
    default:
      return 'pending'
  }
}

/**
 * Find or create agent by address
 */
async function findOrCreateAgent(
  address: string,
  name?: string
): Promise<Id<'agents'> | null> {
  try {
    const existingAgent = await fetchQuery(api.agents.getByAddress, { address })

    if (existingAgent) {
      return existingAgent._id
    }

    const newAgentId = await fetchMutation(api.agents.create, {
      name: name || `Agent ${address.slice(0, 8)}...`,
      address,
      description: 'Auto-discovered via x402 webhook',
      category: 'x402-agent',
      tier: 'bronze',
      ghostScore: 100,
      capabilities: ['x402-payments'],
      verified: false,
    })

    return newAgentId
  } catch (error) {
    console.error('Failed to find/create agent:', error)
    return null
  }
}

/**
 * Parse PayAI webhook format to standard format
 */
function parsePayAIWebhook(data: z.infer<typeof payaiWebhookSchema>): X402PaymentWebhookData {
  const tx = data.transaction
  return {
    txSignature: String(tx.signature || tx.txSignature || ''),
    network: String(tx.network || 'solana'),
    facilitator: 'payai',
    amount: String(tx.amount || '0'),
    asset: String(tx.asset || 'USDC'),
    payer: String(tx.payer || tx.from || ''),
    recipient: String(tx.recipient || tx.to || ''),
    endpoint: String(tx.endpoint || tx.resource || ''),
    timestamp: tx.timestamp || Date.now(),
    status: normalizeWebhookStatus(tx.status),
  }
}

/**
 * Parse Coinbase CDP webhook format to standard format
 */
function parseCDPWebhook(data: z.infer<typeof cdpWebhookSchema>): X402PaymentWebhookData {
  const pay = data.payment
  return {
    txSignature: String(pay.transactionHash || pay.txHash || ''),
    network: String(pay.network || 'base'),
    facilitator: 'coinbase-cdp',
    amount: String(pay.amount || '0'),
    asset: String(pay.asset || 'USDC'),
    payer: String(pay.payer || pay.sender || ''),
    recipient: String(pay.recipient || pay.receiver || ''),
    endpoint: String(pay.endpoint || pay.resource || ''),
    timestamp: pay.timestamp || Date.now(),
    status: normalizeWebhookStatus(pay.status),
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()

    // Verify webhook signature
    const signature =
      request.headers.get('X-Webhook-Signature') ||
      request.headers.get('X-PayAI-Signature') ||
      request.headers.get('X-CDP-Signature')

    const isValid = await verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    // Parse JSON payload
    let rawPayload: unknown
    try {
      rawPayload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Validate and parse payload
    let webhookData: X402PaymentWebhookData

    // Try standard format first
    if (validateWebhookPayload(rawPayload)) {
      webhookData = rawPayload as X402PaymentWebhookData
    }
    // Try PayAI format
    else if (payaiWebhookSchema.safeParse(rawPayload).success) {
      const parsed = payaiWebhookSchema.parse(rawPayload)
      webhookData = parsePayAIWebhook(parsed)
    }
    // Try CDP format
    else if (cdpWebhookSchema.safeParse(rawPayload).success) {
      const parsed = cdpWebhookSchema.parse(rawPayload)
      webhookData = parseCDPWebhook(parsed)
    }
    // Invalid format
    else {
      return NextResponse.json(
        { error: 'Invalid webhook payload format' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!webhookData.payer || !webhookData.txSignature) {
      return NextResponse.json(
        { error: 'Missing required fields: payer and txSignature' },
        { status: 400 }
      )
    }

    // Find or create agent for the payer
    const agentId = await findOrCreateAgent(webhookData.payer)

    if (!agentId) {
      return NextResponse.json(
        { error: 'Failed to resolve agent' },
        { status: 500 }
      )
    }

    // Parse amount (handle micro-units)
    let amount = parseFloat(webhookData.amount)
    if (amount > 1000) {
      amount = amount / 1_000_000
    }

    // Record payment to Convex
    const paymentId = await fetchMutation(api.x402Payments.record, {
      txSignature: webhookData.txSignature,
      agentId,
      endpoint: webhookData.endpoint || 'unknown',
      amount,
      currency: webhookData.asset || 'USDC',
      status: normalizeStatus(webhookData.status),
      facilitator: webhookData.facilitator,
      network: normalizeNetwork(webhookData.network),
      responseTime:
        typeof webhookData.metadata?.responseTime === 'number'
          ? webhookData.metadata.responseTime
          : undefined,
    })

    // Update endpoint stats (non-critical)
    if (webhookData.endpoint) {
      try {
        await fetchMutation(api.endpoints.updateStats, {
          url: webhookData.endpoint,
          success: normalizeStatus(webhookData.status) === 'completed',
          responseTime:
            typeof webhookData.metadata?.responseTime === 'number'
              ? webhookData.metadata.responseTime
              : undefined,
        })
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({
      success: true,
      paymentId,
      message: 'Payment recorded successfully',
    })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/webhooks/x402',
    accepts: ['POST'],
    formats: ['payai', 'coinbase-cdp', 'generic'],
    signatureRequired: !!WEBHOOK_SECRET,
  })
}
