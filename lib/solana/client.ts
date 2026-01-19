/**
 * Solana RPC client setup
 *
 * Provides both Web3.js v4 (Connection) and v5 (createSolanaRpc) clients.
 * Use getConnection() for server-side code and API routes.
 * Use hooks (useSolanaConnection) for client-side React components.
 */

import { Connection, type Commitment } from '@solana/web3.js'
import { createSolanaRpc } from '@solana/rpc'
import { createSolanaRpcSubscriptions } from '@solana/rpc-subscriptions'
import { SOLANA_CONFIG } from './config'

// Default commitment level
const DEFAULT_COMMITMENT: Commitment = 'confirmed'

// ============================================================================
// Web3.js v4 (Connection) - for compatibility with existing code
// ============================================================================

/**
 * Singleton Connection instance for server-side usage
 * Use this in API routes, GraphQL resolvers, and other server code.
 */
let connectionInstance: Connection | null = null

/**
 * Get the shared Connection instance (server-side singleton)
 *
 * @example
 * ```ts
 * import { getConnection } from '@/lib/solana/client'
 *
 * export async function GET() {
 *   const connection = getConnection()
 *   const balance = await connection.getBalance(pubkey)
 * }
 * ```
 */
export function getConnection(commitment: Commitment = DEFAULT_COMMITMENT): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(SOLANA_CONFIG.rpcUrl, commitment)
  }
  return connectionInstance
}

// ============================================================================
// Web3.js v5 (createSolanaRpc) - modern API
// ============================================================================

/**
 * Create Solana RPC client (v5)
 */
export function createRpcClient() {
  return createSolanaRpc(SOLANA_CONFIG.rpcUrl)
}

/**
 * Create Solana RPC subscriptions client
 */
export function createRpcSubscriptionsClient() {
  // Convert HTTP URL to WebSocket URL
  const wsUrl = SOLANA_CONFIG.rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://')
  return createSolanaRpcSubscriptions(wsUrl)
}

/**
 * Singleton RPC client instance (v5)
 */
let rpcClient: ReturnType<typeof createRpcClient> | null = null

export function getRpcClient() {
  if (!rpcClient) {
    rpcClient = createRpcClient()
  }
  return rpcClient
}
