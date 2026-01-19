/**
 * x402 Payment Server Utilities
 *
 * Server-side utilities for handling x402 payments in Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { type X402Config, getDefaultConfig } from './config'
import { createPaymentRequirement, verifyPayment, type PaymentRequirement } from './client'

/**
 * Create a 402 Payment Required response
 */
export function createPaymentRequiredResponse(
  requirement: PaymentRequirement,
  config: X402Config = getDefaultConfig()
): NextResponse {
  const headers = createPaymentRequirement(config, requirement)

  return NextResponse.json(
    {
      error: 'Payment Required',
      message: 'This endpoint requires payment to access',
      requirement,
    },
    {
      status: 402,
      headers,
    }
  )
}

/**
 * Verify payment from request headers
 */
export async function verifyPaymentFromRequest(
  request: NextRequest,
  config: X402Config = getDefaultConfig()
): Promise<{ verified: boolean; error?: string; txSignature?: string }> {
  const paymentHeader = request.headers.get('X-PAYMENT')

  if (!paymentHeader) {
    return {
      verified: false,
      error: 'Missing X-PAYMENT header',
    }
  }

  try {
    const paymentData = JSON.parse(paymentHeader)
    const result = await verifyPayment(config, paymentData.signature)

    if (!result.success) {
      return {
        verified: false,
        error: result.error || 'Payment verification failed',
      }
    }

    return {
      verified: true,
      txSignature: result.txSignature,
    }
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Invalid payment data',
    }
  }
}

/**
 * Middleware wrapper for protected routes
 */
export function withX402Payment(
  handler: (request: NextRequest) => Promise<NextResponse>,
  requirement: PaymentRequirement,
  config: X402Config = getDefaultConfig()
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check if payment header is present
    const paymentHeader = request.headers.get('X-PAYMENT')

    if (!paymentHeader) {
      // No payment, return 402
      return createPaymentRequiredResponse(requirement, config)
    }

    // Verify payment
    const verification = await verifyPaymentFromRequest(request, config)

    if (!verification.verified) {
      // Payment verification failed
      return createPaymentRequiredResponse(requirement, config)
    }

    // Payment verified, proceed with handler
    const response = await handler(request)

    // Add payment response header
    response.headers.set(
      'PAYMENT-RESPONSE',
      JSON.stringify({
        verified: true,
        txSignature: verification.txSignature,
      })
    )

    return response
  }
}

/**
 * Helper to create a payment-gated API route
 */
export function createPaymentGatedRoute(
  requirement: PaymentRequirement,
  handler: (request: NextRequest) => Promise<NextResponse>,
  config?: X402Config
) {
  return withX402Payment(handler, requirement, config)
}

/**
 * Example: Protect a specific endpoint
 */
export const exampleProtectedEndpoint = withX402Payment(
  async (_request: NextRequest) => {
    // Your protected logic here
    return NextResponse.json({
      message: 'Success! Payment verified.',
      data: {
        // Your protected data
      },
    })
  },
  {
    amount: '0.01',
    recipient: process.env.TREASURY_WALLET_ADDRESS || '',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', // Solana Devnet
    description: 'Access to protected endpoint',
  }
)
