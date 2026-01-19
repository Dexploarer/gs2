/**
 * Identity Registry Program Client
 *
 * TypeScript client for interacting with the Identity Registry program.
 * Manages agent identities linked to Metaplex Core NFTs.
 *
 * Features:
 * - Agent registration with NFT linkage
 * - Identity updates and verification
 * - SOL staking for trust collateral
 * - Admin controls (rate limiting, pause)
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js'
import { IDENTITY_REGISTRY_PROGRAM_ID } from './programs'

// Re-export for convenience
export { IDENTITY_REGISTRY_PROGRAM_ID }

// PDA Seeds
const AGENT_SEED = Buffer.from('agent')
const STAKING_POOL_SEED = Buffer.from('staking_pool')
const STAKE_ACCOUNT_SEED = Buffer.from('stake_account')
const PROGRAM_CONFIG_SEED = Buffer.from('program_config')
const USER_RATE_LIMIT_SEED = Buffer.from('user_rate_limit')

// ============================================================================
// TYPES
// ============================================================================

export interface AgentIdentity {
  agentAddress: PublicKey
  assetAddress: PublicKey
  metadataUri: string
  registrationTimestamp: bigint
  lastActiveTimestamp: bigint
  activityCount: bigint
  isActive: boolean
  bump: number
}

export interface StakingPool {
  authority: PublicKey
  totalStaked: bigint
  totalStakers: number
  minStake: bigint
  unlockPeriodSeconds: bigint
  isPaused: boolean
  bump: number
}

export interface StakeAccount {
  agent: PublicKey
  stakedAmount: bigint
  stakedAt: bigint
  unlockAt: bigint
  lastSlashTimestamp: bigint
  slashCount: number
  isLocked: boolean
  bump: number
}

export interface ProgramConfig {
  admin: PublicKey
  isPaused: boolean
  pauseReason: string
  rateLimitPerMinute: number
  pausedAt: bigint
  bump: number
}

export interface UserRateLimit {
  user: PublicKey
  requestCount: number
  windowStart: bigint
  bump: number
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

export function getAgentIdentityPDA(
  agentAddress: PublicKey,
  programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [AGENT_SEED, agentAddress.toBuffer()],
    programId
  )
}

export function getStakingPoolPDA(
  programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([STAKING_POOL_SEED], programId)
}

export function getStakeAccountPDA(
  agentAddress: PublicKey,
  programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STAKE_ACCOUNT_SEED, agentAddress.toBuffer()],
    programId
  )
}

export function getProgramConfigPDA(
  programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROGRAM_CONFIG_SEED], programId)
}

export function getUserRateLimitPDA(
  user: PublicKey,
  programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_RATE_LIMIT_SEED, user.toBuffer()],
    programId
  )
}

// ============================================================================
// INSTRUCTION DISCRIMINATORS (from Anchor IDL)
// ============================================================================

const DISCRIMINATORS = {
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]),
  updateIdentity: Buffer.from([130, 54, 88, 104, 222, 124, 238, 252]),
  verifyIdentity: Buffer.from([177, 162, 9, 111, 44, 84, 80, 21]),
  deactivateAgent: Buffer.from([205, 171, 239, 225, 82, 126, 96, 166]),
  initializeStakingPool: Buffer.from([63, 144, 152, 249, 210, 189, 59, 155]),
  stakeCollateral: Buffer.from([88, 42, 51, 179, 124, 181, 254, 97]),
  unstakeCollateral: Buffer.from([72, 244, 105, 31, 143, 57, 206, 59]),
  slashAgent: Buffer.from([186, 35, 159, 224, 128, 46, 176, 95]),
  pauseStaking: Buffer.from([67, 210, 243, 112, 159, 34, 18, 100]),
  unpauseStaking: Buffer.from([214, 25, 146, 89, 178, 194, 186, 39]),
  initializeProgramConfig: Buffer.from([125, 156, 41, 246, 158, 139, 192, 57]),
  pauseProgram: Buffer.from([63, 94, 213, 139, 88, 209, 52, 57]),
  unpauseProgram: Buffer.from([127, 58, 115, 129, 29, 173, 162, 44]),
  updateRateLimit: Buffer.from([57, 245, 88, 189, 213, 218, 245, 124]),
  initializeUserRateLimit: Buffer.from([38, 233, 159, 122, 255, 176, 118, 219]),
  checkRateLimit: Buffer.from([198, 144, 50, 237, 163, 145, 241, 25]),
  transferAdmin: Buffer.from([42, 242, 66, 106, 228, 124, 83, 203]),
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class IdentityRegistryClient {
  private connection: Connection
  private programId: PublicKey

  constructor(
    connection: Connection,
    programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
  ) {
    this.connection = connection
    this.programId = programId
  }

  // ==========================================================================
  // INSTRUCTION BUILDERS
  // ==========================================================================

  /**
   * Build register agent instruction
   */
  buildRegisterAgentInstruction(
    agent: PublicKey,
    assetAddress: PublicKey,
    metadataUri: string
  ): TransactionInstruction {
    const [agentIdentity] = getAgentIdentityPDA(agent, this.programId)

    const metadataBuffer = Buffer.from(metadataUri)
    const data = Buffer.alloc(8 + 32 + 4 + metadataBuffer.length)
    let offset = 0
    DISCRIMINATORS.registerAgent.copy(data, offset)
    offset += 8
    assetAddress.toBuffer().copy(data, offset)
    offset += 32
    data.writeUInt32LE(metadataBuffer.length, offset)
    offset += 4
    metadataBuffer.copy(data, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: agentIdentity, isSigner: false, isWritable: true },
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build update identity instruction
   */
  buildUpdateIdentityInstruction(
    agent: PublicKey,
    metadataUri: string
  ): TransactionInstruction {
    const [agentIdentity] = getAgentIdentityPDA(agent, this.programId)

    const metadataBuffer = Buffer.from(metadataUri)
    const data = Buffer.alloc(8 + 4 + metadataBuffer.length)
    let offset = 0
    DISCRIMINATORS.updateIdentity.copy(data, offset)
    offset += 8
    data.writeUInt32LE(metadataBuffer.length, offset)
    offset += 4
    metadataBuffer.copy(data, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: agentIdentity, isSigner: false, isWritable: true },
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: agent, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build deactivate agent instruction
   */
  buildDeactivateAgentInstruction(agent: PublicKey): TransactionInstruction {
    const [agentIdentity] = getAgentIdentityPDA(agent, this.programId)

    return new TransactionInstruction({
      keys: [
        { pubkey: agentIdentity, isSigner: false, isWritable: true },
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: agent, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: DISCRIMINATORS.deactivateAgent,
    })
  }

  /**
   * Build stake collateral instruction
   */
  buildStakeCollateralInstruction(
    agent: PublicKey,
    amount: bigint
  ): TransactionInstruction {
    const [agentIdentity] = getAgentIdentityPDA(agent, this.programId)
    const [stakingPool] = getStakingPoolPDA(this.programId)
    const [stakeAccount] = getStakeAccountPDA(agent, this.programId)

    const data = Buffer.alloc(8 + 8)
    DISCRIMINATORS.stakeCollateral.copy(data, 0)
    data.writeBigUInt64LE(amount, 8)

    return new TransactionInstruction({
      keys: [
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: agentIdentity, isSigner: false, isWritable: true },
        { pubkey: stakingPool, isSigner: false, isWritable: true },
        { pubkey: stakeAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build unstake collateral instruction
   */
  buildUnstakeCollateralInstruction(
    agent: PublicKey,
    amount: bigint
  ): TransactionInstruction {
    const [agentIdentity] = getAgentIdentityPDA(agent, this.programId)
    const [stakingPool] = getStakingPoolPDA(this.programId)
    const [stakeAccount] = getStakeAccountPDA(agent, this.programId)

    const data = Buffer.alloc(8 + 8)
    DISCRIMINATORS.unstakeCollateral.copy(data, 0)
    data.writeBigUInt64LE(amount, 8)

    return new TransactionInstruction({
      keys: [
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: agentIdentity, isSigner: false, isWritable: true },
        { pubkey: stakingPool, isSigner: false, isWritable: true },
        { pubkey: stakeAccount, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  // ==========================================================================
  // ACCOUNT FETCHERS
  // ==========================================================================

  /**
   * Fetch agent identity
   */
  async getAgentIdentity(agentAddress: PublicKey): Promise<AgentIdentity | null> {
    const [pda] = getAgentIdentityPDA(agentAddress, this.programId)
    return this.fetchAgentIdentity(pda)
  }

  /**
   * Fetch agent identity by PDA
   */
  async fetchAgentIdentity(pda: PublicKey): Promise<AgentIdentity | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseAgentIdentity(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch agent identity:', error)
      return null
    }
  }

  /**
   * Fetch staking pool
   */
  async getStakingPool(): Promise<StakingPool | null> {
    const [pda] = getStakingPoolPDA(this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseStakingPool(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch staking pool:', error)
      return null
    }
  }

  /**
   * Fetch stake account for agent
   */
  async getStakeAccount(agentAddress: PublicKey): Promise<StakeAccount | null> {
    const [pda] = getStakeAccountPDA(agentAddress, this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseStakeAccount(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch stake account:', error)
      return null
    }
  }

  /**
   * Get all registered agents
   */
  async getAllAgents(): Promise<{ address: PublicKey; identity: AgentIdentity }[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [{ dataSize: AGENT_IDENTITY_SIZE }],
      })

      const agents: { address: PublicKey; identity: AgentIdentity }[] = []
      for (const { pubkey, account } of accounts) {
        const identity = parseAgentIdentity(account.data)
        if (identity) {
          agents.push({ address: pubkey, identity })
        }
      }

      return agents
    } catch (error) {
      console.error('Failed to fetch all agents:', error)
      return []
    }
  }

  /**
   * Get all active agents
   */
  async getActiveAgents(): Promise<{ address: PublicKey; identity: AgentIdentity }[]> {
    const allAgents = await this.getAllAgents()
    return allAgents.filter(({ identity }) => identity.isActive)
  }

  /**
   * Check if an agent is registered
   */
  async isAgentRegistered(agentAddress: PublicKey): Promise<boolean> {
    const identity = await this.getAgentIdentity(agentAddress)
    return identity !== null && identity.isActive
  }
}

// ============================================================================
// ACCOUNT SIZES
// ============================================================================

// AgentIdentity: discriminator(8) + pubkey(32) + pubkey(32) + string(4+256) + i64(8) + i64(8) + u64(8) + bool(1) + bump(1)
const AGENT_IDENTITY_SIZE = 8 + 32 + 32 + 260 + 8 + 8 + 8 + 1 + 1

// ============================================================================
// ACCOUNT PARSERS
// ============================================================================

function parseAgentIdentity(data: Buffer): AgentIdentity | null {
  try {
    let offset = 8 // Skip discriminator

    const agentAddress = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const assetAddress = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const metadataUriLen = data.readUInt32LE(offset)
    offset += 4

    const metadataUri = data.subarray(offset, offset + metadataUriLen).toString('utf-8')
    offset += metadataUriLen

    const registrationTimestamp = data.readBigInt64LE(offset)
    offset += 8

    const lastActiveTimestamp = data.readBigInt64LE(offset)
    offset += 8

    const activityCount = data.readBigUInt64LE(offset)
    offset += 8

    const isActive = data.readUInt8(offset) === 1
    offset += 1

    const bump = data.readUInt8(offset)

    return {
      agentAddress,
      assetAddress,
      metadataUri,
      registrationTimestamp,
      lastActiveTimestamp,
      activityCount,
      isActive,
      bump,
    }
  } catch {
    return null
  }
}

function parseStakingPool(data: Buffer): StakingPool | null {
  try {
    let offset = 8

    const authority = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const totalStaked = data.readBigUInt64LE(offset)
    offset += 8

    const totalStakers = data.readUInt32LE(offset)
    offset += 4

    const minStake = data.readBigUInt64LE(offset)
    offset += 8

    const unlockPeriodSeconds = data.readBigInt64LE(offset)
    offset += 8

    const isPaused = data.readUInt8(offset) === 1
    offset += 1

    const bump = data.readUInt8(offset)

    return {
      authority,
      totalStaked,
      totalStakers,
      minStake,
      unlockPeriodSeconds,
      isPaused,
      bump,
    }
  } catch {
    return null
  }
}

function parseStakeAccount(data: Buffer): StakeAccount | null {
  try {
    let offset = 8

    const agent = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const stakedAmount = data.readBigUInt64LE(offset)
    offset += 8

    const stakedAt = data.readBigInt64LE(offset)
    offset += 8

    const unlockAt = data.readBigInt64LE(offset)
    offset += 8

    const lastSlashTimestamp = data.readBigInt64LE(offset)
    offset += 8

    const slashCount = data.readUInt32LE(offset)
    offset += 4

    const isLocked = data.readUInt8(offset) === 1
    offset += 1

    const bump = data.readUInt8(offset)

    return {
      agent,
      stakedAmount,
      stakedAt,
      unlockAt,
      lastSlashTimestamp,
      slashCount,
      isLocked,
      bump,
    }
  } catch {
    return null
  }
}

// Note: lamportsToSol and solToLamports are exported from './utils'
