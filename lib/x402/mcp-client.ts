/**
 * x402 MCP Client
 *
 * Enhanced client using official @x402 packages for both EVM and SVM
 * payment schemes. Supports PayAI (Solana) and Coinbase CDP (Base) facilitators.
 */

import { x402Client, wrapAxiosWithPayment } from '@x402/axios'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { registerExactSvmScheme } from '@x402/svm/exact/client'
import { privateKeyToAccount } from 'viem/accounts'
import { createKeyPairSignerFromBytes } from '@solana/kit'
import { base58 } from '@scure/base'
import axios, { type AxiosInstance } from 'axios'

import { FACILITATORS, type FacilitatorKey } from './config'

export interface X402MCPClientConfig {
  evmPrivateKey?: `0x${string}`
  svmPrivateKey?: string
  facilitator?: FacilitatorKey
  baseURL?: string
}

export interface X402MCPClient {
  client: x402Client
  api: AxiosInstance
  facilitator: FacilitatorKey
  networks: {
    solana: boolean
    base: boolean
  }
}

/**
 * Creates an x402 MCP client with payment handling for both EVM and SVM networks.
 *
 * @example
 * ```typescript
 * const mcpClient = await createX402MCPClient({
 *   evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
 *   svmPrivateKey: process.env.SVM_PRIVATE_KEY,
 *   facilitator: 'PAYAI',
 * })
 *
 * // Make paid requests
 * const response = await mcpClient.api.get('/api/endpoint')
 * ```
 */
export async function createX402MCPClient(
  config: X402MCPClientConfig
): Promise<X402MCPClient> {
  const { evmPrivateKey, svmPrivateKey, facilitator = 'PAYAI', baseURL } = config

  if (!evmPrivateKey && !svmPrivateKey) {
    throw new Error(
      'At least one of EVM_PRIVATE_KEY or SVM_PRIVATE_KEY must be provided'
    )
  }

  const client = new x402Client()
  const networks = { solana: false, base: false }

  // Register EVM scheme for Base network payments
  if (evmPrivateKey) {
    const evmSigner = privateKeyToAccount(evmPrivateKey)
    registerExactEvmScheme(client, { signer: evmSigner })
    networks.base = true
  }

  // Register SVM scheme for Solana network payments
  if (svmPrivateKey) {
    const svmSigner = await createKeyPairSignerFromBytes(
      base58.decode(svmPrivateKey)
    )
    registerExactSvmScheme(client, { signer: svmSigner })
    networks.solana = true
  }

  // Create axios instance with payment handling
  const facilitatorConfig = FACILITATORS[facilitator]
  const api = wrapAxiosWithPayment(
    axios.create({
      baseURL: baseURL || facilitatorConfig.url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
    client
  )

  return {
    client,
    api,
    facilitator,
    networks,
  }
}

/**
 * Configuration for default x402 MCP client
 */
export function getDefaultMCPConfig(): X402MCPClientConfig {
  return {
    evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}` | undefined,
    svmPrivateKey: process.env.SVM_PRIVATE_KEY,
    facilitator: 'PAYAI',
  }
}

/**
 * Facilitator health check endpoints
 */
export const FACILITATOR_HEALTH_ENDPOINTS = {
  PAYAI: `${FACILITATORS.PAYAI.url}/health`,
  COINBASE_CDP: `${FACILITATORS.COINBASE_CDP.url}/health`,
  RAPID402: `${FACILITATORS.RAPID402.url}/health`,
  OPENX402: `${FACILITATORS.OPENX402.url}/health`,
} as const

/**
 * Check if a facilitator is healthy
 */
export async function checkFacilitatorHealth(
  facilitator: FacilitatorKey
): Promise<{
  healthy: boolean
  latency: number
  error?: string
}> {
  const url = FACILITATOR_HEALTH_ENDPOINTS[facilitator]
  const start = Date.now()

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    const latency = Date.now() - start

    return {
      healthy: response.ok,
      latency,
    }
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all supported networks for a facilitator
 */
export function getFacilitatorNetworks(facilitator: FacilitatorKey): string[] {
  return [...FACILITATORS[facilitator].networks]
}

/**
 * Check if a network is supported by a facilitator
 */
export function isNetworkSupported(
  facilitator: FacilitatorKey,
  network: string
): boolean {
  const networks = FACILITATORS[facilitator].networks as readonly string[]
  return networks.includes(network)
}

/**
 * Types for x402 payment data from webhooks
 */
export interface X402PaymentWebhookData {
  txSignature: string
  network: string
  facilitator: string
  amount: string
  asset: string
  payer: string
  recipient: string
  endpoint?: string
  timestamp: number
  status: 'pending' | 'verified' | 'settled' | 'failed'
  metadata?: Record<string, unknown>
}

/**
 * Validate webhook payload from facilitators
 */
export function validateWebhookPayload(
  payload: unknown
): payload is X402PaymentWebhookData {
  if (!payload || typeof payload !== 'object') return false

  const data = payload as Record<string, unknown>

  return (
    typeof data.txSignature === 'string' &&
    typeof data.network === 'string' &&
    typeof data.facilitator === 'string' &&
    typeof data.amount === 'string' &&
    typeof data.payer === 'string' &&
    typeof data.recipient === 'string' &&
    typeof data.status === 'string' &&
    ['pending', 'verified', 'settled', 'failed'].includes(data.status as string)
  )
}
