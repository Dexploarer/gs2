/**
 * GhostSpeak v2 Solana Program IDs
 *
 * Centralized configuration for all deployed Solana programs.
 * All program interactions MUST use these constants to ensure consistency.
 *
 * Network-aware configuration:
 * - Set NEXT_PUBLIC_SOLANA_CLUSTER to 'devnet' or 'mainnet-beta'
 * - Program IDs are automatically selected based on the cluster
 * - Override individual programs via environment variables if needed
 *
 * Programs:
 * 1. Identity Registry - Agent identity NFTs (Metaplex Core)
 * 2. Reputation Registry - On-chain reputation scores + multi-sig governance
 * 3. Validation Registry - x402 payment proof verification
 * 4. Vote Registry - Peer voting consensus system
 * 5. Token Staking - BYOT token staking for endorsements
 */

import { PublicKey } from '@solana/web3.js'

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet'

/**
 * Current Solana network from environment
 * Defaults to devnet for safety
 */
export const SOLANA_NETWORK: SolanaNetwork =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaNetwork) || 'devnet'

/**
 * Check if we're on mainnet
 */
export const IS_MAINNET = SOLANA_NETWORK === 'mainnet-beta'

// ============================================================================
// PROGRAM IDS BY NETWORK
// ============================================================================

/**
 * Program IDs type
 */
interface ProgramIds {
  identityRegistry: string
  reputationRegistry: string
  validationRegistry: string
  voteRegistry: string
  tokenStaking: string
}

/**
 * Devnet Program IDs (deployed and tested)
 */
const DEVNET_PROGRAM_IDS: ProgramIds = {
  identityRegistry: '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e',
  reputationRegistry: 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp',
  validationRegistry: '9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc',
  voteRegistry: 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6',
  tokenStaking: '4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL',
}

/**
 * Mainnet Program IDs (to be deployed)
 * These will be different addresses after mainnet deployment
 * Override via environment variables when deploying to mainnet
 */
const MAINNET_PROGRAM_IDS: ProgramIds = {
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.identityRegistry,
  reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.reputationRegistry,
  validationRegistry: process.env.NEXT_PUBLIC_VALIDATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.validationRegistry,
  voteRegistry: process.env.NEXT_PUBLIC_VOTE_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.voteRegistry,
  tokenStaking: process.env.NEXT_PUBLIC_TOKEN_STAKING_PROGRAM_ID || DEVNET_PROGRAM_IDS.tokenStaking,
}

/**
 * Get program IDs for current network
 */
function getProgramIdsForNetwork(): ProgramIds {
  return IS_MAINNET ? MAINNET_PROGRAM_IDS : DEVNET_PROGRAM_IDS
}

// ============================================================================
// PROGRAM IDS - Single source of truth
// ============================================================================

const CURRENT_PROGRAM_IDS = getProgramIdsForNetwork()

/**
 * Identity Registry Program
 * - Manages agent identity NFTs via Metaplex Core
 * - Creates verifiable on-chain identities for AI agents
 */
export const IDENTITY_REGISTRY_PROGRAM_ID = new PublicKey(
  CURRENT_PROGRAM_IDS.identityRegistry
)

/**
 * Reputation Registry Program
 * - Stores on-chain reputation scores
 * - Multi-sig authority governance system
 * - Proposal/approval workflow for score updates
 */
export const REPUTATION_REGISTRY_PROGRAM_ID = new PublicKey(
  CURRENT_PROGRAM_IDS.reputationRegistry
)

/**
 * Validation Registry Program
 * - Verifies x402 payment proofs on-chain
 * - Records validated transactions
 * - Integrates with facilitator health system
 */
export const VALIDATION_REGISTRY_PROGRAM_ID = new PublicKey(
  CURRENT_PROGRAM_IDS.validationRegistry
)

/**
 * Vote Registry Program
 * - Peer voting consensus for reputation updates
 * - Weighted voting based on agent reputation
 * - Time-bounded voting periods
 */
export const VOTE_REGISTRY_PROGRAM_ID = new PublicKey(
  CURRENT_PROGRAM_IDS.voteRegistry
)

/**
 * Token Staking Program
 * - BYOT (Bring Your Own Token) staking
 * - PDA-controlled vaults for secure staking
 * - Lock period enforcement on-chain
 * - Trust weight calculation for endorsements
 */
export const TOKEN_STAKING_PROGRAM_ID = new PublicKey(
  CURRENT_PROGRAM_IDS.tokenStaking
)

// ============================================================================
// PROGRAM ID MAP - For dynamic lookups
// ============================================================================

export const PROGRAM_IDS = {
  identityRegistry: IDENTITY_REGISTRY_PROGRAM_ID,
  reputationRegistry: REPUTATION_REGISTRY_PROGRAM_ID,
  validationRegistry: VALIDATION_REGISTRY_PROGRAM_ID,
  voteRegistry: VOTE_REGISTRY_PROGRAM_ID,
  tokenStaking: TOKEN_STAKING_PROGRAM_ID,
} as const

export type ProgramName = keyof typeof PROGRAM_IDS

// String versions for contexts where PublicKey isn't needed
// Uses the same network-aware configuration as PublicKey constants
export const PROGRAM_ID_STRINGS = {
  identityRegistry: CURRENT_PROGRAM_IDS.identityRegistry,
  reputationRegistry: CURRENT_PROGRAM_IDS.reputationRegistry,
  validationRegistry: CURRENT_PROGRAM_IDS.validationRegistry,
  voteRegistry: CURRENT_PROGRAM_IDS.voteRegistry,
  tokenStaking: CURRENT_PROGRAM_IDS.tokenStaking,
} as const

// ============================================================================
// SOLANA EXPLORER URLS
// ============================================================================

/**
 * Get explorer cluster parameter
 * mainnet-beta doesn't need cluster param, others do
 */
function getExplorerClusterParam(): string {
  if (SOLANA_NETWORK === 'mainnet-beta') return ''
  return `?cluster=${SOLANA_NETWORK}`
}

export const PROGRAM_EXPLORER_URLS = {
  identityRegistry: `https://explorer.solana.com/address/${PROGRAM_ID_STRINGS.identityRegistry}${getExplorerClusterParam()}`,
  reputationRegistry: `https://explorer.solana.com/address/${PROGRAM_ID_STRINGS.reputationRegistry}${getExplorerClusterParam()}`,
  validationRegistry: `https://explorer.solana.com/address/${PROGRAM_ID_STRINGS.validationRegistry}${getExplorerClusterParam()}`,
  voteRegistry: `https://explorer.solana.com/address/${PROGRAM_ID_STRINGS.voteRegistry}${getExplorerClusterParam()}`,
  tokenStaking: `https://explorer.solana.com/address/${PROGRAM_ID_STRINGS.tokenStaking}${getExplorerClusterParam()}`,
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get program ID by name
 */
export function getProgramId(name: ProgramName): PublicKey {
  return PROGRAM_IDS[name]
}

/**
 * Get program ID string by name
 */
export function getProgramIdString(name: ProgramName): string {
  return PROGRAM_ID_STRINGS[name]
}

/**
 * Check if a public key is one of our programs
 */
export function isGhostSpeakProgram(pubkey: PublicKey): boolean {
  const pubkeyStr = pubkey.toBase58()
  return Object.values(PROGRAM_ID_STRINGS).includes(pubkeyStr as (typeof PROGRAM_ID_STRINGS)[ProgramName])
}

/**
 * Get program name from public key
 */
export function getProgramName(pubkey: PublicKey): ProgramName | null {
  const pubkeyStr = pubkey.toBase58()
  for (const [name, id] of Object.entries(PROGRAM_ID_STRINGS)) {
    if (id === pubkeyStr) {
      return name as ProgramName
    }
  }
  return null
}

/**
 * Get explorer URL for a program
 */
export function getProgramExplorerUrl(name: ProgramName): string {
  return PROGRAM_EXPLORER_URLS[name]
}

// ============================================================================
// NETWORK-SPECIFIC EXPORTS (for Convex and other serverless environments)
// ============================================================================

/**
 * Export devnet program IDs directly for use in Convex functions
 * Convex can't use Next.js env vars, so these are the fallback
 */
export { DEVNET_PROGRAM_IDS }

/**
 * Get program IDs for a specific network
 * Useful when you need to explicitly query a specific network
 */
export function getProgramIdsForSpecificNetwork(network: SolanaNetwork): typeof DEVNET_PROGRAM_IDS {
  // For now, only devnet is deployed. Mainnet will use env vars when deployed.
  if (network === 'mainnet-beta') {
    return MAINNET_PROGRAM_IDS
  }
  return DEVNET_PROGRAM_IDS
}

/**
 * Get the current network
 */
export function getCurrentNetwork(): SolanaNetwork {
  return SOLANA_NETWORK
}

/**
 * Get RPC endpoint for network
 */
export function getRpcEndpoint(network: SolanaNetwork = SOLANA_NETWORK): string {
  switch (network) {
    case 'mainnet-beta':
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    case 'testnet':
      return 'https://api.testnet.solana.com'
    case 'devnet':
    default:
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
  }
}

// ============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

// Legacy aliases - gradually deprecate these
export const GHOSTSPEAK_IDENTITY_PROGRAM = IDENTITY_REGISTRY_PROGRAM_ID
export const GHOSTSPEAK_REPUTATION_PROGRAM = REPUTATION_REGISTRY_PROGRAM_ID
export const GHOSTSPEAK_VALIDATION_PROGRAM = VALIDATION_REGISTRY_PROGRAM_ID
export const GHOSTSPEAK_VOTE_PROGRAM = VOTE_REGISTRY_PROGRAM_ID
export const GHOSTSPEAK_STAKING_PROGRAM = TOKEN_STAKING_PROGRAM_ID
