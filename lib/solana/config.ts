/**
 * Solana configuration (Web3.js v5 / @solana/kit)
 */

import { address, type Address } from '@solana/addresses'
import { createSolanaRpc } from '@solana/rpc'

// Re-export Address type for convenience
export type { Address }

export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta'

export const SOLANA_CONFIG = {
  cluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet') as SolanaCluster,
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  programId: process.env.NEXT_PUBLIC_GHOSTSPEAK_PROGRAM_ID
    ? address(process.env.NEXT_PUBLIC_GHOSTSPEAK_PROGRAM_ID as Address)
    : null,
} as const

// USDC token decimals
export const USDC_DECIMALS = 6

// Create RPC client
export const rpc = createSolanaRpc(SOLANA_CONFIG.rpcUrl)

// Helper to convert string to Address
export function toAddress(addr: string): Address {
  return address(addr as Address)
}

export const SOLANA_ENDPOINTS = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
} as const

/**
 * Get RPC URL for cluster
 */
export function getRpcUrl(cluster: SolanaCluster = SOLANA_CONFIG.cluster): string {
  return SOLANA_ENDPOINTS[cluster]
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(signature: string, cluster: SolanaCluster = SOLANA_CONFIG.cluster): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://solscan.io/tx/${signature}${clusterParam}`
}

/**
 * Get explorer URL for address
 */
export function getAddressExplorerUrl(addr: string, cluster: SolanaCluster = SOLANA_CONFIG.cluster): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://solscan.io/account/${addr}${clusterParam}`
}
