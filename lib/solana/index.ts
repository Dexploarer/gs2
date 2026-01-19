/**
 * Solana Utilities for GhostSpeak v2
 *
 * Re-exports all Solana-related utilities including:
 * - Program IDs (single source of truth)
 * - Client configuration and RPC connections
 * - Payment verification for x402
 * - NFT identity management
 * - Upgrade authority management
 * - Multi-sig governance client
 * - Vault monitoring for BYOT token staking
 */

// Program IDs - ALWAYS import from here for consistency
export * from './programs'

// Core client and configuration
export * from './client'
export * from './config'
export * from './utils'

// Payment and verification
export * from './payment-verification'

// Identity
export * from './nft-identity'

// Upgrade authority and governance
export * from './upgrade-authority'
export * from './multisig-client'

// Token staking vault monitoring
export * from './vault-monitor'

// Token staking program client
export * from './token-staking-client'

// Program clients for all GhostSpeak Solana programs
export * from './identity-registry-client'
export * from './vote-registry-client'
export * from './validation-registry-client'
export * from './reputation-registry-client'
