/**
 * Token Staking API Routes
 *
 * Provides endpoints for interacting with the BYOT token staking program.
 * All inputs are validated with Zod schemas for type safety.
 */

import { NextRequest, NextResponse } from 'next/server'
import { PublicKey, Transaction } from '@solana/web3.js'
import { z } from 'zod'
import { getConnection } from '@/lib/solana/client'
import {
  TokenStakingClient,
  getVaultPDA,
  getStakePositionPDA,
  calculateTrustWeight,
  type StakeCategory,
} from '@/lib/solana/token-staking-client'
import {
  solanaAddressSchema,
  stakeCategorySchema,
  validationError,
  parseSolanaAddress,
} from '@/lib/validation'

// ============================================================================
// GET Request Schemas
// ============================================================================

const getVaultSchema = z.object({
  action: z.literal('vault'),
  vaultAddress: solanaAddressSchema,
})

const getPositionSchema = z.object({
  action: z.literal('position'),
  vaultAddress: solanaAddressSchema,
  staker: solanaAddressSchema,
})

const deriveVaultSchema = z.object({
  action: z.literal('derive-vault'),
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
})

const getAgentVaultsSchema = z.object({
  action: z.literal('agent-vaults'),
  targetAgent: solanaAddressSchema,
})

const getVaultPositionsSchema = z.object({
  action: z.literal('vault-positions'),
  vaultAddress: solanaAddressSchema,
})

const calculateWeightSchema = z.object({
  action: z.literal('calculate-weight'),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer'),
  multiplier: z.string().regex(/^\d+$/, 'Multiplier must be a positive integer'),
})

// ============================================================================
// POST Request Schemas
// ============================================================================

const buildStakeSchema = z.object({
  action: z.literal('build-stake'),
  staker: solanaAddressSchema,
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
  amount: z.union([z.string(), z.number()]).transform(String),
  category: stakeCategorySchema,
})

const buildUnstakeSchema = z.object({
  action: z.literal('build-unstake'),
  staker: solanaAddressSchema,
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
  amount: z.union([z.string(), z.number()]).transform(String),
})

const buildInitVaultSchema = z.object({
  action: z.literal('build-init-vault'),
  authority: solanaAddressSchema,
  targetAgent: solanaAddressSchema,
  tokenMint: solanaAddressSchema,
  minStakeAmount: z.union([z.string(), z.number()]).transform(String),
  lockPeriodSeconds: z.union([z.string(), z.number()]).transform(String),
  weightMultiplier: z.coerce.number().min(1).max(1000),
})

// ============================================================================
// Helper Functions
// ============================================================================

function searchParamsToObject(params: URLSearchParams): Record<string, string | null> {
  const obj: Record<string, string | null> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

/**
 * GET /api/staking
 *
 * Query parameters:
 * - action: 'vault' | 'position' | 'agent-vaults' | 'vault-positions' | 'all-vaults'
 * - vaultAddress: Vault PDA address (for vault, vault-positions)
 * - targetAgent: Agent address (for agent-vaults)
 * - tokenMint: Token mint address (for deriving vault)
 * - staker: Staker address (for position)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = searchParamsToObject(searchParams)
    const action = params.action

    const connection = getConnection()
    const client = new TokenStakingClient(connection)

    switch (action) {
      case 'vault': {
        const result = getVaultSchema.safeParse(params)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const vaultPubkey = parseSolanaAddress(result.data.vaultAddress)
        if (!vaultPubkey) {
          return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
        }

        const vault = await client.getStakingVault(vaultPubkey)
        if (!vault) {
          return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
        }

        return NextResponse.json({
          vault: {
            targetAgent: vault.targetAgent.toBase58(),
            tokenMint: vault.tokenMint.toBase58(),
            vaultTokenAccount: vault.vaultTokenAccount.toBase58(),
            minStakeAmount: vault.minStakeAmount.toString(),
            lockPeriodSeconds: vault.lockPeriodSeconds.toString(),
            weightMultiplier: vault.weightMultiplier,
            totalStaked: vault.totalStaked.toString(),
            totalStakers: vault.totalStakers,
            authority: vault.authority.toBase58(),
            isActive: vault.isActive,
            isVerified: vault.isVerified,
          },
        })
      }

      case 'position': {
        const result = getPositionSchema.safeParse(params)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const vaultPubkey = parseSolanaAddress(result.data.vaultAddress)
        const stakerPubkey = parseSolanaAddress(result.data.staker)
        if (!vaultPubkey || !stakerPubkey) {
          return NextResponse.json({ error: 'Invalid address format' }, { status: 400 })
        }

        const [stakePosition] = getStakePositionPDA(vaultPubkey, stakerPubkey)

        const position = await client.getStakePosition(stakePosition)
        if (!position) {
          return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        }

        return NextResponse.json({
          position: {
            vault: position.vault.toBase58(),
            staker: position.staker.toBase58(),
            targetAgent: position.targetAgent.toBase58(),
            tokenMint: position.tokenMint.toBase58(),
            amount: position.amount.toString(),
            category: position.category,
            trustWeight: position.trustWeight.toString(),
            stakedAt: position.stakedAt.toString(),
            lockedUntil: position.lockedUntil.toString(),
            unstakedAt: position.unstakedAt.toString(),
            isActive: position.isActive,
            isSlashed: position.isSlashed,
          },
        })
      }

      case 'derive-vault': {
        const result = deriveVaultSchema.safeParse(params)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const agentPubkey = parseSolanaAddress(result.data.targetAgent)
        const mintPubkey = parseSolanaAddress(result.data.tokenMint)
        if (!agentPubkey || !mintPubkey) {
          return NextResponse.json({ error: 'Invalid address format' }, { status: 400 })
        }

        const [vaultAddress, bump] = getVaultPDA(agentPubkey, mintPubkey)

        return NextResponse.json({
          vaultAddress: vaultAddress.toBase58(),
          bump,
        })
      }

      case 'agent-vaults': {
        const result = getAgentVaultsSchema.safeParse(params)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const agentPubkey = parseSolanaAddress(result.data.targetAgent)
        if (!agentPubkey) {
          return NextResponse.json({ error: 'Invalid agent address' }, { status: 400 })
        }

        const vaults = await client.getAgentVaults(agentPubkey)

        return NextResponse.json({
          vaults: vaults.map((vault) => ({
            targetAgent: vault.targetAgent.toBase58(),
            tokenMint: vault.tokenMint.toBase58(),
            minStakeAmount: vault.minStakeAmount.toString(),
            lockPeriodSeconds: vault.lockPeriodSeconds.toString(),
            totalStaked: vault.totalStaked.toString(),
            totalStakers: vault.totalStakers,
            isActive: vault.isActive,
          })),
        })
      }

      case 'vault-positions': {
        const result = getVaultPositionsSchema.safeParse(params)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const vaultPubkey = parseSolanaAddress(result.data.vaultAddress)
        if (!vaultPubkey) {
          return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
        }

        const positions = await client.getVaultStakePositions(vaultPubkey)

        return NextResponse.json({
          positions: positions.map((pos) => ({
            staker: pos.staker.toBase58(),
            amount: pos.amount.toString(),
            category: pos.category,
            trustWeight: pos.trustWeight.toString(),
            stakedAt: pos.stakedAt.toString(),
            lockedUntil: pos.lockedUntil.toString(),
            isActive: pos.isActive,
          })),
        })
      }

      case 'all-vaults': {
        const vaults = await client.getAllActiveVaults()

        return NextResponse.json({
          vaults: vaults.map(({ address, vault }) => ({
            address: address.toBase58(),
            targetAgent: vault.targetAgent.toBase58(),
            tokenMint: vault.tokenMint.toBase58(),
            totalStaked: vault.totalStaked.toString(),
            totalStakers: vault.totalStakers,
            isActive: vault.isActive,
          })),
        })
      }

      case 'calculate-weight': {
        const result = calculateWeightSchema.safeParse(params)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const weight = calculateTrustWeight(
          BigInt(result.data.amount),
          parseInt(result.data.multiplier, 10)
        )

        return NextResponse.json({
          amount: result.data.amount,
          multiplier: result.data.multiplier,
          trustWeight: weight.toString(),
        })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: [
              'vault',
              'position',
              'derive-vault',
              'agent-vaults',
              'vault-positions',
              'all-vaults',
              'calculate-weight',
            ],
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Staking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/staking
 *
 * Build unsigned transactions for staking operations.
 * Returns base64-encoded transaction for client to sign.
 *
 * Body:
 * - action: 'build-stake' | 'build-unstake' | 'build-init-vault'
 * - staker/authority: Signer address
 * - targetAgent: Agent address
 * - tokenMint: Token mint address
 * - amount: Amount (for stake/unstake)
 * - category: Stake category (for stake)
 * - minStakeAmount, lockPeriodSeconds, weightMultiplier (for init-vault)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    const connection = getConnection()
    const client = new TokenStakingClient(connection)

    switch (action) {
      case 'build-stake': {
        const result = buildStakeSchema.safeParse(body)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const stakerPubkey = new PublicKey(result.data.staker)
        const agentPubkey = new PublicKey(result.data.targetAgent)
        const mintPubkey = new PublicKey(result.data.tokenMint)

        const instruction = await client.buildStakeTokensInstruction(
          stakerPubkey,
          agentPubkey,
          mintPubkey,
          BigInt(result.data.amount),
          result.data.category as StakeCategory
        )

        const transaction = new Transaction().add(instruction)
        const { blockhash } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = stakerPubkey

        const serialized = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })

        return NextResponse.json({
          transaction: serialized.toString('base64'),
          message: 'Transaction built. Sign and submit to stake tokens.',
        })
      }

      case 'build-unstake': {
        const result = buildUnstakeSchema.safeParse(body)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const stakerPubkey = new PublicKey(result.data.staker)
        const agentPubkey = new PublicKey(result.data.targetAgent)
        const mintPubkey = new PublicKey(result.data.tokenMint)

        const instruction = await client.buildUnstakeTokensInstruction(
          stakerPubkey,
          agentPubkey,
          mintPubkey,
          BigInt(result.data.amount)
        )

        const transaction = new Transaction().add(instruction)
        const { blockhash } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = stakerPubkey

        const serialized = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })

        return NextResponse.json({
          transaction: serialized.toString('base64'),
          message: 'Transaction built. Sign and submit to unstake tokens.',
        })
      }

      case 'build-init-vault': {
        const result = buildInitVaultSchema.safeParse(body)
        if (!result.success) {
          return NextResponse.json(validationError(result.error), { status: 400 })
        }

        const authorityPubkey = new PublicKey(result.data.authority)
        const agentPubkey = new PublicKey(result.data.targetAgent)
        const mintPubkey = new PublicKey(result.data.tokenMint)

        const instruction = client.buildInitializeVaultInstruction(
          authorityPubkey,
          agentPubkey,
          mintPubkey,
          BigInt(result.data.minStakeAmount),
          BigInt(result.data.lockPeriodSeconds),
          result.data.weightMultiplier
        )

        const transaction = new Transaction().add(instruction)
        const { blockhash } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = authorityPubkey

        const serialized = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })

        return NextResponse.json({
          transaction: serialized.toString('base64'),
          message: 'Transaction built. Sign and submit to initialize vault.',
        })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: ['build-stake', 'build-unstake', 'build-init-vault'],
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Staking API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
