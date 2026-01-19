/**
 * Shared types for hooks
 */

import type { Doc, Id } from '@/convex/_generated/dataModel'
import type { StakeCategory, StakingVault, StakePosition } from '@/lib/solana/token-staking-client'

// Re-export for convenience
export type { StakeCategory, StakingVault, StakePosition }

/**
 * Common hook return type pattern for async operations
 */
export interface AsyncHookState {
  isLoading: boolean
  error: string | null
}

/**
 * Extended hook state with clear error utility
 */
export interface AsyncHookStateWithClear extends AsyncHookState {
  clearError: () => void
}

/**
 * Result of vault initialization
 */
export interface InitializeVaultResult {
  signature: string
  vaultAddress: string
}

/**
 * Result of staking tokens
 */
export interface StakeTokensResult {
  signature: string
  stakePositionAddress: string
}

/**
 * Result of unstaking tokens
 */
export interface UnstakeTokensResult {
  signature: string
}

/**
 * Parameters for initializing a vault
 */
export interface InitializeVaultParams {
  targetAgent: string
  tokenMint: string
  minStakeAmount: number
  lockPeriodDays: number
  weightMultiplier?: number
  decimals: number
}

/**
 * Parameters for staking tokens
 */
export interface StakeTokensParams {
  targetAgent: string
  tokenMint: string
  amount: number
  category: StakeCategory
  decimals: number
}

/**
 * Parameters for unstaking tokens
 */
export interface UnstakeTokensParams {
  targetAgent: string
  tokenMint: string
  amount: number
  decimals: number
}

/**
 * Token metadata from chain
 */
export interface TokenMetadata {
  decimals: number
  supply: bigint
  isInitialized: boolean
}

/**
 * Token balance info
 */
export interface TokenBalance {
  balance: number
  rawBalance: bigint
  decimals: number
}

/**
 * Return type for useStaking hook
 */
export interface UseStakingReturn extends AsyncHookStateWithClear {
  initializeVault: (params: InitializeVaultParams) => Promise<InitializeVaultResult | null>
  stakeTokens: (params: StakeTokensParams) => Promise<StakeTokensResult | null>
  unstakeTokens: (params: UnstakeTokensParams) => Promise<UnstakeTokensResult | null>
}

/**
 * Return type for useTokenMetadata hook
 */
export interface UseTokenMetadataReturn extends AsyncHookState {
  fetchTokenMetadata: (mintAddress: string) => Promise<TokenMetadata | null>
}

/**
 * Return type for useTokenBalance hook
 */
export interface UseTokenBalanceReturn extends AsyncHookState {
  fetchBalance: (tokenMint: string) => Promise<TokenBalance | null>
}

/**
 * Return type for useStakingData hook
 */
export interface UseStakingDataReturn extends AsyncHookState {
  fetchVault: (targetAgent: string, tokenMint: string) => Promise<StakingVault | null>
  fetchStakePosition: (targetAgent: string, tokenMint: string) => Promise<StakePosition | null>
  fetchAgentVaults: (targetAgent: string) => Promise<StakingVault[]>
  vaultExists: (targetAgent: string, tokenMint: string) => Promise<boolean>
}

// ============================================================================
// Component Prop Types
// ============================================================================

/**
 * Token owner info (agent or merchant)
 */
export interface TokenOwnerInfo {
  type: 'agent' | 'merchant' | string
  name: string
  address?: string
}

/**
 * Staking token with owner info
 */
export type StakingTokenWithOwner = Doc<'stakingTokens'> & {
  owner: TokenOwnerInfo | null
}

/**
 * Target entity info (agent or merchant)
 */
export interface StakeTargetInfo {
  type: 'agent' | 'merchant' | string
  name: string
  address?: string
}

/**
 * Token info for stake display
 */
export interface StakeTokenInfo {
  symbol: string
  name: string
  mint?: string
  decimals?: number
}

/**
 * Stake with enriched details
 */
export interface StakeWithDetails {
  _id: Id<'tokenStakes'>
  stakerAddress: string
  targetAgentId?: Id<'agents'>
  targetMerchantId?: Id<'merchants'>
  amount: number
  trustWeight: number
  status: 'active' | 'unlocking' | 'unstaked' | string
  attestationType: string
  stakedAt: number
  lockedUntil: number
  unstakedAt?: number
  txSignature?: string
  token: StakeTokenInfo | null
  target: StakeTargetInfo | null
}

/**
 * Attestation type options
 */
export type AttestationType =
  | 'endorsement'
  | 'quality'
  | 'reliability'
  | 'capability'
  | 'security'
  | 'general'

/**
 * Map attestation type to on-chain stake category
 */
export function mapAttestationToCategory(type: AttestationType): StakeCategory {
  const mapping: Record<AttestationType, StakeCategory> = {
    endorsement: 'General',
    quality: 'Quality',
    reliability: 'Reliability',
    capability: 'Capability',
    security: 'Security',
    general: 'General',
  }
  return mapping[type]
}

/**
 * Agent tier type
 */
export type AgentTier = 'bronze' | 'silver' | 'gold' | 'platinum'

/**
 * Tab type for staking page
 */
export type StakingTabType = 'overview' | 'register' | 'stake' | 'my-stakes'
