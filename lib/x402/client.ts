/**
 * x402 Payment Client
 *
 * Client-side utilities for handling x402 payments
 * Compatible with PayAI, Coinbase CDP, and other facilitators
 */

import { type X402Config, getFacilitatorUrl, getUSDCAddress } from './config'

export interface PaymentRequirement {
  amount: string // In USDC (e.g., "0.01")
  recipient: string // Wallet address
  network: string // CAIP-2 network identifier
  token?: string // Token mint address (optional, defaults to USDC)
  description?: string
  metadata?: Record<string, unknown>
}

export interface SettlementResponse {
  txSignature: string
  blockhash?: string
  lastValidBlockHeight?: number
  [key: string]: unknown
}

export interface PaymentResponse {
  success: boolean
  txSignature?: string
  error?: string
  settlementResponse?: SettlementResponse
}

/**
 * Create a 402 Payment Required response header
 */
export function createPaymentRequirement(
  config: X402Config,
  requirement: PaymentRequirement
): Record<string, string> {
  const usdcAddress = getUSDCAddress(config.network)

  const paymentReq = {
    amount: requirement.amount,
    recipient: requirement.recipient,
    network: config.network,
    token: requirement.token || usdcAddress,
    description: requirement.description,
    metadata: requirement.metadata,
  }

  return {
    'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(paymentReq)).toString('base64'),
  }
}

/**
 * Verify a payment with the facilitator
 */
export async function verifyPayment(
  config: X402Config,
  paymentSignature: string
): Promise<PaymentResponse> {
  const facilitatorUrl = getFacilitatorUrl(config.facilitator)

  try {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signature: paymentSignature,
        network: config.network,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Facilitator verification failed: ${response.status}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      txSignature: data.txSignature,
      settlementResponse: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Settle a payment via the facilitator
 */
export async function settlePayment(
  config: X402Config,
  paymentData: {
    txSignature: string
    amount: string
    recipient: string
  }
): Promise<PaymentResponse> {
  const facilitatorUrl = getFacilitatorUrl(config.facilitator)

  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...paymentData,
        network: config.network,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Facilitator settlement failed: ${response.status}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      txSignature: data.txSignature,
      settlementResponse: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Parse a PAYMENT-REQUIRED header
 */
export function parsePaymentRequirement(header: string): PaymentRequirement | null {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Check if a response requires payment (status 402)
 */
export function requiresPayment(response: Response): boolean {
  return response.status === 402 && response.headers.has('PAYMENT-REQUIRED')
}

/**
 * Extract payment requirement from 402 response
 */
export function getPaymentRequirement(response: Response): PaymentRequirement | null {
  if (!requiresPayment(response)) {
    return null
  }

  const header = response.headers.get('PAYMENT-REQUIRED')
  if (!header) {
    return null
  }

  return parsePaymentRequirement(header)
}
