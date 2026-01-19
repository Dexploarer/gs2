/**
 * Token Staking Program Client
 *
 * TypeScript client for interacting with the BYOT token staking program.
 * Supports initializing vaults, staking tokens, and unstaking.
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import { TOKEN_STAKING_PROGRAM_ID } from './programs'

// Re-export for backward compatibility
export { TOKEN_STAKING_PROGRAM_ID }

// PDA Seeds
const VAULT_SEED = Buffer.from('vault')
const VAULT_TOKEN_SEED = Buffer.from('vault_token')
const STAKE_SEED = Buffer.from('stake')

// Stake categories matching Rust enum
export type StakeCategory =
  | 'General'
  | 'Quality'
  | 'Reliability'
  | 'Capability'
  | 'Security'

export const StakeCategoryIndex: Record<StakeCategory, number> = {
  General: 0,
  Quality: 1,
  Reliability: 2,
  Capability: 3,
  Security: 4,
}

// Account types
export interface StakingVault {
  targetAgent: PublicKey
  tokenMint: PublicKey
  vaultTokenAccount: PublicKey
  minStakeAmount: bigint
  lockPeriodSeconds: bigint
  weightMultiplier: number
  totalStaked: bigint
  totalStakers: number
  authority: PublicKey
  isActive: boolean
  isVerified: boolean
  createdAt: bigint
  updatedAt: bigint
  bump: number
  vaultBump: number
}

export interface StakePosition {
  vault: PublicKey
  staker: PublicKey
  targetAgent: PublicKey
  tokenMint: PublicKey
  amount: bigint
  category: StakeCategory
  trustWeight: bigint
  stakedAt: bigint
  lockedUntil: bigint
  unstakedAt: bigint
  isActive: boolean
  isSlashed: boolean
  bump: number
}

/**
 * Derive vault PDA
 */
export function getVaultPDA(
  targetAgent: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey = TOKEN_STAKING_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, targetAgent.toBuffer(), tokenMint.toBuffer()],
    programId
  )
}

/**
 * Derive vault token account PDA
 */
export function getVaultTokenAccountPDA(
  vault: PublicKey,
  programId: PublicKey = TOKEN_STAKING_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_TOKEN_SEED, vault.toBuffer()],
    programId
  )
}

/**
 * Derive stake position PDA
 */
export function getStakePositionPDA(
  vault: PublicKey,
  staker: PublicKey,
  programId: PublicKey = TOKEN_STAKING_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STAKE_SEED, vault.toBuffer(), staker.toBuffer()],
    programId
  )
}

/**
 * Token Staking Program Client
 */
export class TokenStakingClient {
  private connection: Connection
  private programId: PublicKey

  constructor(
    connection: Connection,
    programId: PublicKey = TOKEN_STAKING_PROGRAM_ID
  ) {
    this.connection = connection
    this.programId = programId
  }

  /**
   * Build initialize vault instruction
   */
  buildInitializeVaultInstruction(
    authority: PublicKey,
    targetAgent: PublicKey,
    tokenMint: PublicKey,
    minStakeAmount: bigint,
    lockPeriodSeconds: bigint,
    weightMultiplier: number
  ): TransactionInstruction {
    const [vault] = getVaultPDA(targetAgent, tokenMint, this.programId)
    const [vaultTokenAccount] = getVaultTokenAccountPDA(vault, this.programId)

    // Anchor discriminator for initialize_vault
    const discriminator = Buffer.from([48, 191, 163, 44, 71, 129, 63, 164])

    // Serialize instruction data
    const data = Buffer.alloc(8 + 8 + 8 + 2)
    let offset = 0
    discriminator.copy(data, offset)
    offset += 8
    data.writeBigUInt64LE(minStakeAmount, offset)
    offset += 8
    data.writeBigInt64LE(lockPeriodSeconds, offset)
    offset += 8
    data.writeUInt16LE(weightMultiplier, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: targetAgent, isSigner: false, isWritable: false },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build stake tokens instruction
   */
  async buildStakeTokensInstruction(
    staker: PublicKey,
    targetAgent: PublicKey,
    tokenMint: PublicKey,
    amount: bigint,
    category: StakeCategory
  ): Promise<TransactionInstruction> {
    const [vault] = getVaultPDA(targetAgent, tokenMint, this.programId)
    const [vaultTokenAccount] = getVaultTokenAccountPDA(vault, this.programId)
    const [stakePosition] = getStakePositionPDA(vault, staker, this.programId)
    const stakerTokenAccount = await getAssociatedTokenAddress(tokenMint, staker)

    // Anchor discriminator for stake_tokens
    const discriminator = Buffer.from([136, 126, 91, 63, 35, 255, 226, 251])

    // Serialize instruction data
    const data = Buffer.alloc(8 + 8 + 1)
    let offset = 0
    discriminator.copy(data, offset)
    offset += 8
    data.writeBigUInt64LE(amount, offset)
    offset += 8
    data.writeUInt8(StakeCategoryIndex[category], offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: staker, isSigner: true, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: stakePosition, isSigner: false, isWritable: true },
        { pubkey: stakerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: targetAgent, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build unstake tokens instruction
   */
  async buildUnstakeTokensInstruction(
    staker: PublicKey,
    targetAgent: PublicKey,
    tokenMint: PublicKey,
    amount: bigint
  ): Promise<TransactionInstruction> {
    const [vault] = getVaultPDA(targetAgent, tokenMint, this.programId)
    const [vaultTokenAccount] = getVaultTokenAccountPDA(vault, this.programId)
    const [stakePosition] = getStakePositionPDA(vault, staker, this.programId)
    const stakerTokenAccount = await getAssociatedTokenAddress(tokenMint, staker)

    // Anchor discriminator for unstake_tokens
    const discriminator = Buffer.from([58, 119, 215, 143, 203, 223, 32, 86])

    // Serialize instruction data
    const data = Buffer.alloc(8 + 8)
    let offset = 0
    discriminator.copy(data, offset)
    offset += 8
    data.writeBigUInt64LE(amount, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: staker, isSigner: true, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: stakePosition, isSigner: false, isWritable: true },
        { pubkey: stakerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: targetAgent, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Fetch staking vault account data
   */
  async getStakingVault(vaultAddress: PublicKey): Promise<StakingVault | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(vaultAddress)

      if (!accountInfo || !accountInfo.data) {
        return null
      }

      return parseStakingVault(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch staking vault:', error)
      return null
    }
  }

  /**
   * Fetch stake position account data
   */
  async getStakePosition(stakeAddress: PublicKey): Promise<StakePosition | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(stakeAddress)

      if (!accountInfo || !accountInfo.data) {
        return null
      }

      return parseStakePosition(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch stake position:', error)
      return null
    }
  }

  /**
   * Get all stake positions for a vault
   */
  async getVaultStakePositions(vaultAddress: PublicKey): Promise<StakePosition[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: STAKE_POSITION_SIZE },
          {
            memcmp: {
              offset: 8,
              bytes: vaultAddress.toBase58(),
            },
          },
        ],
      })

      const positions: StakePosition[] = []

      for (const { account } of accounts) {
        const position = parseStakePosition(account.data)
        if (position && position.isActive) {
          positions.push(position)
        }
      }

      return positions
    } catch (error) {
      console.error('Failed to fetch vault stake positions:', error)
      return []
    }
  }

  /**
   * Get all vaults for a target agent
   */
  async getAgentVaults(targetAgent: PublicKey): Promise<StakingVault[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: STAKING_VAULT_SIZE },
          {
            memcmp: {
              offset: 8,
              bytes: targetAgent.toBase58(),
            },
          },
        ],
      })

      const vaults: StakingVault[] = []

      for (const { account } of accounts) {
        const vault = parseStakingVault(account.data)
        if (vault) {
          vaults.push(vault)
        }
      }

      return vaults
    } catch (error) {
      console.error('Failed to fetch agent vaults:', error)
      return []
    }
  }

  /**
   * Get all active vaults
   */
  async getAllActiveVaults(): Promise<{ address: PublicKey; vault: StakingVault }[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [{ dataSize: STAKING_VAULT_SIZE }],
      })

      const vaults: { address: PublicKey; vault: StakingVault }[] = []

      for (const { pubkey, account } of accounts) {
        const vault = parseStakingVault(account.data)
        if (vault && vault.isActive) {
          vaults.push({ address: pubkey, vault })
        }
      }

      return vaults
    } catch (error) {
      console.error('Failed to fetch all vaults:', error)
      return []
    }
  }

  /**
   * Get staker's position for a specific vault
   */
  async getStakerPosition(
    staker: PublicKey,
    targetAgent: PublicKey,
    tokenMint: PublicKey
  ): Promise<StakePosition | null> {
    const [vault] = getVaultPDA(targetAgent, tokenMint, this.programId)
    const [stakePosition] = getStakePositionPDA(vault, staker, this.programId)
    return this.getStakePosition(stakePosition)
  }
}

// Account sizes (8-byte discriminator + fields)
const STAKING_VAULT_SIZE = 8 + 32 * 4 + 8 * 2 + 2 + 8 + 4 + 32 + 1 + 1 + 8 * 2 + 1 + 1
const STAKE_POSITION_SIZE = 8 + 32 * 4 + 8 + 1 + 8 * 4 + 1 + 1 + 1

// Helper functions for parsing account data
function parseStakingVault(data: Buffer): StakingVault | null {
  try {
    // Skip 8-byte discriminator
    let offset = 8

    const targetAgent = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const tokenMint = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const vaultTokenAccount = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const minStakeAmount = data.readBigUInt64LE(offset)
    offset += 8
    const lockPeriodSeconds = data.readBigInt64LE(offset)
    offset += 8
    const weightMultiplier = data.readUInt16LE(offset)
    offset += 2
    const totalStaked = data.readBigUInt64LE(offset)
    offset += 8
    const totalStakers = data.readUInt32LE(offset)
    offset += 4
    const authority = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const isActive = data.readUInt8(offset) === 1
    offset += 1
    const isVerified = data.readUInt8(offset) === 1
    offset += 1
    const createdAt = data.readBigInt64LE(offset)
    offset += 8
    const updatedAt = data.readBigInt64LE(offset)
    offset += 8
    const bump = data.readUInt8(offset)
    offset += 1
    const vaultBump = data.readUInt8(offset)

    return {
      targetAgent,
      tokenMint,
      vaultTokenAccount,
      minStakeAmount,
      lockPeriodSeconds,
      weightMultiplier,
      totalStaked,
      totalStakers,
      authority,
      isActive,
      isVerified,
      createdAt,
      updatedAt,
      bump,
      vaultBump,
    }
  } catch {
    return null
  }
}

function parseStakePosition(data: Buffer): StakePosition | null {
  try {
    const categories: StakeCategory[] = [
      'General',
      'Quality',
      'Reliability',
      'Capability',
      'Security',
    ]

    // Skip 8-byte discriminator
    let offset = 8

    const vault = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const staker = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const targetAgent = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const tokenMint = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    const amount = data.readBigUInt64LE(offset)
    offset += 8
    const categoryIndex = data.readUInt8(offset)
    offset += 1
    const trustWeight = data.readBigUInt64LE(offset)
    offset += 8
    const stakedAt = data.readBigInt64LE(offset)
    offset += 8
    const lockedUntil = data.readBigInt64LE(offset)
    offset += 8
    const unstakedAt = data.readBigInt64LE(offset)
    offset += 8
    const isActive = data.readUInt8(offset) === 1
    offset += 1
    const isSlashed = data.readUInt8(offset) === 1
    offset += 1
    const bump = data.readUInt8(offset)

    return {
      vault,
      staker,
      targetAgent,
      tokenMint,
      amount,
      category: categories[categoryIndex] || 'General',
      trustWeight,
      stakedAt,
      lockedUntil,
      unstakedAt,
      isActive,
      isSlashed,
      bump,
    }
  } catch {
    return null
  }
}

/**
 * Calculate trust weight for a stake amount
 * Matches the Rust implementation: log2(amount + 1) * multiplier / 100
 */
export function calculateTrustWeight(
  amount: bigint,
  weightMultiplier: number
): bigint {
  const baseWeight = Math.log2(Number(amount) + 1) * 100
  return BigInt(Math.floor((baseWeight * weightMultiplier) / 100))
}

// Legacy exports for backward compatibility
export const deriveVaultAddress = (
  targetAgent: string,
  tokenMint: string,
  programId: string = TOKEN_STAKING_PROGRAM_ID.toBase58()
) => {
  const [address, bump] = getVaultPDA(
    new PublicKey(targetAgent),
    new PublicKey(tokenMint),
    new PublicKey(programId)
  )
  return { address: address.toBase58(), bump }
}

export const deriveStakePositionAddress = (
  vaultAddress: string,
  staker: string,
  programId: string = TOKEN_STAKING_PROGRAM_ID.toBase58()
) => {
  const [vault] = [new PublicKey(vaultAddress)]
  const [address, bump] = getStakePositionPDA(
    vault,
    new PublicKey(staker),
    new PublicKey(programId)
  )
  return { address: address.toBase58(), bump }
}
