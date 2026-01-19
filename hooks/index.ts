/**
 * Centralized hooks export
 *
 * This file provides a single entry point for all application hooks.
 * Import hooks from '@/hooks' instead of individual files.
 *
 * @example
 * ```tsx
 * import {
 *   useStaking,
 *   useTokenMetadata,
 *   useSolanaConnection,
 *   SolanaConnectionProvider,
 * } from '@/hooks'
 * ```
 */

// Solana connection context and hooks
export {
  SolanaConnectionProvider,
  useSolanaConnection,
  useConnection,
  type SolanaConnectionContextType,
} from './use-solana'

// Staking hooks
export {
  useStaking,
  useTokenMetadata,
  useTokenBalance,
  useStakingData,
} from './use-staking'

// Types - re-export for convenience
export type {
  // Hook return types
  UseStakingReturn,
  UseTokenMetadataReturn,
  UseTokenBalanceReturn,
  UseStakingDataReturn,
  AsyncHookState,
  AsyncHookStateWithClear,

  // Staking operation types
  InitializeVaultParams,
  InitializeVaultResult,
  StakeTokensParams,
  StakeTokensResult,
  UnstakeTokensParams,
  UnstakeTokensResult,

  // Token types
  TokenMetadata,
  TokenBalance,

  // Component prop types
  TokenOwnerInfo,
  StakingTokenWithOwner,
  StakeTargetInfo,
  StakeTokenInfo,
  StakeWithDetails,
  AttestationType,
  AgentTier,
  StakingTabType,
} from './types'

// Utility functions
export { mapAttestationToCategory } from './types'

// Re-export on-chain types from lib for convenience
export type { StakeCategory, StakingVault, StakePosition } from './types'
