'use client'

import { useState, useCallback, useMemo } from 'react'
import { useConnector, useTransactionSigner } from '@solana/connector'
import { PublicKey, Transaction } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress, getMint } from '@solana/spl-token'
import {
  TokenStakingClient,
  getVaultPDA,
  getStakePositionPDA,
} from '@/lib/solana/token-staking-client'
import { useSolanaConnection } from './use-solana'
import type {
  UseStakingReturn,
  UseTokenMetadataReturn,
  UseTokenBalanceReturn,
  UseStakingDataReturn,
  InitializeVaultParams,
  InitializeVaultResult,
  StakeTokensParams,
  StakeTokensResult,
  UnstakeTokensParams,
  UnstakeTokensResult,
  TokenMetadata,
  TokenBalance,
  StakingVault,
  StakePosition,
} from './types'

/**
 * Hook for staking operations (initialize vault, stake, unstake)
 *
 * @example
 * ```tsx
 * const { initializeVault, stakeTokens, isLoading, error } = useStaking()
 *
 * const handleStake = async () => {
 *   const result = await stakeTokens({
 *     targetAgent: 'AgentAddress...',
 *     tokenMint: 'TokenMintAddress...',
 *     amount: 100,
 *     category: 'Quality',
 *     decimals: 6,
 *   })
 *   if (result) {
 *     console.log('Staked:', result.signature)
 *   }
 * }
 * ```
 */
export function useStaking(): UseStakingReturn {
  const { selectedAccount, connected } = useConnector()
  const { signer, ready: signerReady } = useTransactionSigner()
  const { connection } = useSolanaConnection()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useMemo(() => new TokenStakingClient(connection), [connection])

  /**
   * Initialize a new staking vault on-chain
   */
  const initializeVault = useCallback(
    async (params: InitializeVaultParams): Promise<InitializeVaultResult | null> => {
      if (!connected || !selectedAccount || !signer || !signerReady) {
        setError('Wallet not connected')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const authority = new PublicKey(selectedAccount)
        const targetAgent = new PublicKey(params.targetAgent)
        const tokenMint = new PublicKey(params.tokenMint)

        // Convert to raw amounts
        const minStakeAmountRaw = BigInt(
          Math.floor(params.minStakeAmount * Math.pow(10, params.decimals))
        )
        const lockPeriodSeconds = BigInt(params.lockPeriodDays * 24 * 60 * 60)
        const weightMultiplier = params.weightMultiplier ?? 100

        // Build instruction
        const instruction = client.buildInitializeVaultInstruction(
          authority,
          targetAgent,
          tokenMint,
          minStakeAmountRaw,
          lockPeriodSeconds,
          weightMultiplier
        )

        // Create transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        const transaction = new Transaction({
          feePayer: authority,
          blockhash,
          lastValidBlockHeight,
        }).add(instruction)

        // Sign and send using the transaction signer
        const signature = await signer.signAndSendTransaction(transaction)

        // Wait for confirmation
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        })

        const [vaultAddress] = getVaultPDA(targetAgent, tokenMint)

        return { signature, vaultAddress: vaultAddress.toBase58() }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to initialize vault'
        setError(message)
        console.error('Initialize vault error:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [connected, selectedAccount, signer, signerReady, connection, client]
  )

  /**
   * Stake tokens on an agent
   */
  const stakeTokens = useCallback(
    async (params: StakeTokensParams): Promise<StakeTokensResult | null> => {
      if (!connected || !selectedAccount || !signer || !signerReady) {
        setError('Wallet not connected')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const staker = new PublicKey(selectedAccount)
        const targetAgent = new PublicKey(params.targetAgent)
        const tokenMint = new PublicKey(params.tokenMint)

        // Convert to raw amount
        const amountRaw = BigInt(Math.floor(params.amount * Math.pow(10, params.decimals)))

        // Check token balance
        const stakerTokenAccount = await getAssociatedTokenAddress(tokenMint, staker)
        try {
          const accountInfo = await getAccount(connection, stakerTokenAccount)
          if (accountInfo.amount < amountRaw) {
            throw new Error(
              `Insufficient balance. You have ${Number(accountInfo.amount) / Math.pow(10, params.decimals)} tokens`
            )
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes('could not find')) {
            throw new Error('You do not have a token account for this token')
          }
          throw err
        }

        // Build instruction
        const instruction = await client.buildStakeTokensInstruction(
          staker,
          targetAgent,
          tokenMint,
          amountRaw,
          params.category
        )

        // Create transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        const transaction = new Transaction({
          feePayer: staker,
          blockhash,
          lastValidBlockHeight,
        }).add(instruction)

        // Sign and send using the transaction signer
        const signature = await signer.signAndSendTransaction(transaction)

        // Wait for confirmation
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        })

        const [vault] = getVaultPDA(targetAgent, tokenMint)
        const [stakePosition] = getStakePositionPDA(vault, staker)

        return { signature, stakePositionAddress: stakePosition.toBase58() }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to stake tokens'
        setError(message)
        console.error('Stake tokens error:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [connected, selectedAccount, signer, signerReady, connection, client]
  )

  /**
   * Unstake tokens from a vault
   */
  const unstakeTokens = useCallback(
    async (params: UnstakeTokensParams): Promise<UnstakeTokensResult | null> => {
      if (!connected || !selectedAccount || !signer || !signerReady) {
        setError('Wallet not connected')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const staker = new PublicKey(selectedAccount)
        const targetAgent = new PublicKey(params.targetAgent)
        const tokenMint = new PublicKey(params.tokenMint)

        // Convert to raw amount
        const amountRaw = BigInt(Math.floor(params.amount * Math.pow(10, params.decimals)))

        // Build instruction
        const instruction = await client.buildUnstakeTokensInstruction(
          staker,
          targetAgent,
          tokenMint,
          amountRaw
        )

        // Create transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        const transaction = new Transaction({
          feePayer: staker,
          blockhash,
          lastValidBlockHeight,
        }).add(instruction)

        // Sign and send using the transaction signer
        const signature = await signer.signAndSendTransaction(transaction)

        // Wait for confirmation
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        })

        return { signature }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to unstake tokens'
        setError(message)
        console.error('Unstake tokens error:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [connected, selectedAccount, signer, signerReady, connection, client]
  )

  return {
    initializeVault,
    stakeTokens,
    unstakeTokens,
    isLoading,
    error,
    clearError: useCallback(() => setError(null), []),
  }
}

/**
 * Hook for fetching token metadata from Solana
 *
 * @example
 * ```tsx
 * const { fetchTokenMetadata, isLoading } = useTokenMetadata()
 *
 * useEffect(() => {
 *   fetchTokenMetadata('MintAddress...').then(metadata => {
 *     if (metadata) console.log('Decimals:', metadata.decimals)
 *   })
 * }, [fetchTokenMetadata])
 * ```
 */
export function useTokenMetadata(): UseTokenMetadataReturn {
  const { connection } = useSolanaConnection()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTokenMetadata = useCallback(
    async (mintAddress: string): Promise<TokenMetadata | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const mint = new PublicKey(mintAddress)
        const mintInfo = await getMint(connection, mint)

        return {
          decimals: mintInfo.decimals,
          supply: mintInfo.supply,
          isInitialized: mintInfo.isInitialized,
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch token metadata'
        setError(message)
        console.error('Fetch token metadata error:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [connection]
  )

  return {
    fetchTokenMetadata,
    isLoading,
    error,
  }
}

/**
 * Hook for checking token balance in connected wallet
 *
 * @example
 * ```tsx
 * const { fetchBalance, isLoading } = useTokenBalance()
 *
 * const checkBalance = async (mint: string) => {
 *   const result = await fetchBalance(mint)
 *   if (result) console.log('Balance:', result.balance)
 * }
 * ```
 */
export function useTokenBalance(): UseTokenBalanceReturn {
  const { selectedAccount, connected } = useConnector()
  const { connection } = useSolanaConnection()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(
    async (tokenMint: string): Promise<TokenBalance | null> => {
      if (!connected || !selectedAccount) {
        setError('Wallet not connected')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const owner = new PublicKey(selectedAccount)
        const mint = new PublicKey(tokenMint)

        // Get mint info for decimals
        const mintInfo = await getMint(connection, mint)

        // Get token account
        const tokenAccount = await getAssociatedTokenAddress(mint, owner)

        try {
          const accountInfo = await getAccount(connection, tokenAccount)
          const balance = Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals)

          return {
            balance,
            rawBalance: accountInfo.amount,
            decimals: mintInfo.decimals,
          }
        } catch {
          // Token account doesn't exist - balance is 0
          return {
            balance: 0,
            rawBalance: BigInt(0),
            decimals: mintInfo.decimals,
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch balance'
        setError(message)
        console.error('Fetch balance error:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [connected, selectedAccount, connection]
  )

  return {
    fetchBalance,
    isLoading,
    error,
  }
}

/**
 * Hook for fetching vault and stake position data from chain
 *
 * @example
 * ```tsx
 * const { fetchVault, vaultExists, isLoading } = useStakingData()
 *
 * const checkVault = async () => {
 *   const exists = await vaultExists('AgentAddress...', 'MintAddress...')
 *   if (exists) {
 *     const vault = await fetchVault('AgentAddress...', 'MintAddress...')
 *   }
 * }
 * ```
 */
export function useStakingData(): UseStakingDataReturn {
  const { selectedAccount, connected } = useConnector()
  const { connection } = useSolanaConnection()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useMemo(() => new TokenStakingClient(connection), [connection])

  /**
   * Fetch vault data
   */
  const fetchVault = useCallback(
    async (targetAgent: string, tokenMint: string): Promise<StakingVault | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const [vaultAddress] = getVaultPDA(
          new PublicKey(targetAgent),
          new PublicKey(tokenMint)
        )
        return await client.getStakingVault(vaultAddress)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch vault'
        setError(message)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [client]
  )

  /**
   * Fetch staker's position
   */
  const fetchStakePosition = useCallback(
    async (targetAgent: string, tokenMint: string): Promise<StakePosition | null> => {
      if (!connected || !selectedAccount) {
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        return await client.getStakerPosition(
          new PublicKey(selectedAccount),
          new PublicKey(targetAgent),
          new PublicKey(tokenMint)
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch stake position'
        setError(message)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [connected, selectedAccount, client]
  )

  /**
   * Fetch all vaults for an agent
   */
  const fetchAgentVaults = useCallback(
    async (targetAgent: string): Promise<StakingVault[]> => {
      setIsLoading(true)
      setError(null)

      try {
        return await client.getAgentVaults(new PublicKey(targetAgent))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch agent vaults'
        setError(message)
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [client]
  )

  /**
   * Check if vault exists
   */
  const vaultExists = useCallback(
    async (targetAgent: string, tokenMint: string): Promise<boolean> => {
      const vault = await fetchVault(targetAgent, tokenMint)
      return vault !== null && vault.isActive
    },
    [fetchVault]
  )

  return {
    fetchVault,
    fetchStakePosition,
    fetchAgentVaults,
    vaultExists,
    isLoading,
    error,
  }
}
