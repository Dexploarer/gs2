/**
 * Reputation Registry Program Client
 *
 * TypeScript client for interacting with the Reputation Registry program.
 * Manages on-chain reputation scores for AI agents.
 *
 * Features:
 * - Initialize and query agent reputation
 * - Update reputation scores (authority-gated)
 * - Record payment proofs
 * - Time-weighted decay system
 *
 * Note: For multi-sig governance operations, see multisig-client.ts
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js'
import { REPUTATION_REGISTRY_PROGRAM_ID } from './programs'

// Re-export for convenience
export { REPUTATION_REGISTRY_PROGRAM_ID }

// PDA Seeds
const REPUTATION_SEED = Buffer.from('reputation')
const AUTHORITY_SEED = Buffer.from('authority')

// ============================================================================
// TYPES
// ============================================================================

export interface ComponentScores {
  trust: number
  quality: number
  reliability: number
  economic: number
  social: number
}

export interface ReputationStats {
  totalVotes: number
  positiveVotes: number
  negativeVotes: number
  totalReviews: number
  avgReviewRating: number
}

export interface AgentReputation {
  agentAddress: PublicKey
  overallScore: number
  componentScores: ComponentScores
  stats: ReputationStats
  paymentProofsMerkleRoot: Uint8Array
  lastUpdated: bigint
  bump: number
}

export interface ReputationAuthority {
  authority: PublicKey
  bump: number
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

export function getReputationPDA(
  agentAddress: PublicKey,
  programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REPUTATION_SEED, agentAddress.toBuffer()],
    programId
  )
}

export function getReputationAuthorityPDA(
  programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([AUTHORITY_SEED], programId)
}

// ============================================================================
// INSTRUCTION DISCRIMINATORS (from Anchor IDL)
// ============================================================================

const DISCRIMINATORS = {
  initializeAuthority: Buffer.from([13, 186, 25, 16, 218, 31, 90, 1]),
  initializeReputation: Buffer.from([150, 240, 109, 53, 147, 42, 152, 162]),
  updateReputation: Buffer.from([194, 220, 43, 201, 54, 209, 49, 178]),
  recordPaymentProof: Buffer.from([225, 6, 44, 34, 208, 255, 224, 82]),
  getReputation: Buffer.from([46, 251, 16, 79, 119, 77, 230, 230]),
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class ReputationRegistryClient {
  private connection: Connection
  private programId: PublicKey

  constructor(
    connection: Connection,
    programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
  ) {
    this.connection = connection
    this.programId = programId
  }

  // ==========================================================================
  // INSTRUCTION BUILDERS
  // ==========================================================================

  /**
   * Build initialize authority instruction (one-time setup)
   */
  buildInitializeAuthorityInstruction(
    authority: PublicKey,
    initializer: PublicKey
  ): TransactionInstruction {
    const [authorityAccount] = getReputationAuthorityPDA(this.programId)

    return new TransactionInstruction({
      keys: [
        { pubkey: authorityAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: initializer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: DISCRIMINATORS.initializeAuthority,
    })
  }

  /**
   * Build initialize reputation instruction
   */
  buildInitializeReputationInstruction(
    agentAddress: PublicKey,
    payer: PublicKey
  ): TransactionInstruction {
    const [agentReputation] = getReputationPDA(agentAddress, this.programId)

    return new TransactionInstruction({
      keys: [
        { pubkey: agentReputation, isSigner: false, isWritable: true },
        { pubkey: agentAddress, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: DISCRIMINATORS.initializeReputation,
    })
  }

  /**
   * Build update reputation instruction
   */
  buildUpdateReputationInstruction(
    authority: PublicKey,
    agentAddress: PublicKey,
    overallScore: number,
    componentScores: ComponentScores,
    stats: ReputationStats,
    paymentProofsMerkleRoot: Uint8Array
  ): TransactionInstruction {
    const [agentReputation] = getReputationPDA(agentAddress, this.programId)
    const [authorityAccount] = getReputationAuthorityPDA(this.programId)

    // Serialize instruction data
    const data = Buffer.alloc(8 + 2 + 5 + 17 + 32)
    let offset = 0

    DISCRIMINATORS.updateReputation.copy(data, offset)
    offset += 8

    // overall_score (u16)
    data.writeUInt16LE(overallScore, offset)
    offset += 2

    // component_scores (5 * u8)
    data.writeUInt8(componentScores.trust, offset)
    offset += 1
    data.writeUInt8(componentScores.quality, offset)
    offset += 1
    data.writeUInt8(componentScores.reliability, offset)
    offset += 1
    data.writeUInt8(componentScores.economic, offset)
    offset += 1
    data.writeUInt8(componentScores.social, offset)
    offset += 1

    // stats
    data.writeUInt32LE(stats.totalVotes, offset)
    offset += 4
    data.writeUInt32LE(stats.positiveVotes, offset)
    offset += 4
    data.writeUInt32LE(stats.negativeVotes, offset)
    offset += 4
    data.writeUInt32LE(stats.totalReviews, offset)
    offset += 4
    data.writeUInt8(stats.avgReviewRating, offset)
    offset += 1

    // merkle_root (32 bytes)
    Buffer.from(paymentProofsMerkleRoot).copy(data, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: agentReputation, isSigner: false, isWritable: true },
        { pubkey: authorityAccount, isSigner: false, isWritable: false },
        { pubkey: agentAddress, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build record payment proof instruction
   */
  buildRecordPaymentProofInstruction(
    authority: PublicKey,
    agentAddress: PublicKey,
    paymentSignature: string
  ): TransactionInstruction {
    const [agentReputation] = getReputationPDA(agentAddress, this.programId)

    const signatureBuffer = Buffer.from(paymentSignature)
    const data = Buffer.alloc(8 + 4 + signatureBuffer.length)

    DISCRIMINATORS.recordPaymentProof.copy(data, 0)
    data.writeUInt32LE(signatureBuffer.length, 8)
    signatureBuffer.copy(data, 12)

    return new TransactionInstruction({
      keys: [
        { pubkey: agentReputation, isSigner: false, isWritable: true },
        { pubkey: agentAddress, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  // ==========================================================================
  // ACCOUNT FETCHERS
  // ==========================================================================

  /**
   * Fetch agent reputation
   */
  async getReputation(agentAddress: PublicKey): Promise<AgentReputation | null> {
    const [pda] = getReputationPDA(agentAddress, this.programId)
    return this.fetchReputation(pda)
  }

  /**
   * Fetch reputation by PDA
   */
  async fetchReputation(pda: PublicKey): Promise<AgentReputation | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseAgentReputation(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch agent reputation:', error)
      return null
    }
  }

  /**
   * Fetch authority configuration
   */
  async getAuthority(): Promise<ReputationAuthority | null> {
    const [pda] = getReputationAuthorityPDA(this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseReputationAuthority(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch reputation authority:', error)
      return null
    }
  }

  /**
   * Get all agent reputations
   */
  async getAllReputations(): Promise<{ address: PublicKey; reputation: AgentReputation }[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [{ dataSize: REPUTATION_SIZE }],
      })

      const reputations: { address: PublicKey; reputation: AgentReputation }[] = []
      for (const { pubkey, account } of accounts) {
        const reputation = parseAgentReputation(account.data)
        if (reputation) {
          reputations.push({ address: pubkey, reputation })
        }
      }

      return reputations
    } catch (error) {
      console.error('Failed to fetch all reputations:', error)
      return []
    }
  }

  /**
   * Get top agents by reputation score
   */
  async getTopAgents(limit: number = 10): Promise<{ address: PublicKey; reputation: AgentReputation }[]> {
    const allReputations = await this.getAllReputations()
    return allReputations
      .sort((a, b) => b.reputation.overallScore - a.reputation.overallScore)
      .slice(0, limit)
  }

  /**
   * Check if agent has reputation initialized
   */
  async hasReputation(agentAddress: PublicKey): Promise<boolean> {
    const reputation = await this.getReputation(agentAddress)
    return reputation !== null
  }

  /**
   * Get reputation score for agent
   */
  async getScore(agentAddress: PublicKey): Promise<number | null> {
    const reputation = await this.getReputation(agentAddress)
    return reputation?.overallScore ?? null
  }
}

// ============================================================================
// ACCOUNT SIZE
// ============================================================================

// AgentReputation: discriminator(8) + pubkey(32) + u16(2) + componentScores(5) + stats(17) + merkleRoot(32) + i64(8) + bump(1)
const REPUTATION_SIZE = 8 + 32 + 2 + 5 + 17 + 32 + 8 + 1 // = 105 bytes

// ============================================================================
// ACCOUNT PARSERS
// ============================================================================

function parseAgentReputation(data: Buffer): AgentReputation | null {
  try {
    let offset = 8 // Skip discriminator

    const agentAddress = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const overallScore = data.readUInt16LE(offset)
    offset += 2

    const componentScores: ComponentScores = {
      trust: data.readUInt8(offset),
      quality: data.readUInt8(offset + 1),
      reliability: data.readUInt8(offset + 2),
      economic: data.readUInt8(offset + 3),
      social: data.readUInt8(offset + 4),
    }
    offset += 5

    const stats: ReputationStats = {
      totalVotes: data.readUInt32LE(offset),
      positiveVotes: data.readUInt32LE(offset + 4),
      negativeVotes: data.readUInt32LE(offset + 8),
      totalReviews: data.readUInt32LE(offset + 12),
      avgReviewRating: data.readUInt8(offset + 16),
    }
    offset += 17

    const paymentProofsMerkleRoot = new Uint8Array(data.subarray(offset, offset + 32))
    offset += 32

    const lastUpdated = data.readBigInt64LE(offset)
    offset += 8

    const bump = data.readUInt8(offset)

    return {
      agentAddress,
      overallScore,
      componentScores,
      stats,
      paymentProofsMerkleRoot,
      lastUpdated,
      bump,
    }
  } catch {
    return null
  }
}

function parseReputationAuthority(data: Buffer): ReputationAuthority | null {
  try {
    let offset = 8 // Skip discriminator

    const authority = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const bump = data.readUInt8(offset)

    return { authority, bump }
  } catch {
    return null
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate overall score from component scores
 * Weighted average with:
 * - Trust: 30%
 * - Quality: 25%
 * - Reliability: 20%
 * - Economic: 15%
 * - Social: 10%
 */
export function calculateOverallScore(components: ComponentScores): number {
  return Math.round(
    components.trust * 3 +
    components.quality * 2.5 +
    components.reliability * 2 +
    components.economic * 1.5 +
    components.social * 1
  )
}

/**
 * Get reputation tier from score
 */
export function getReputationTier(score: number): 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Unranked' {
  if (score >= 900) return 'Diamond'
  if (score >= 750) return 'Platinum'
  if (score >= 600) return 'Gold'
  if (score >= 400) return 'Silver'
  if (score >= 200) return 'Bronze'
  return 'Unranked'
}

/**
 * Calculate vote ratio
 */
export function getVoteRatio(stats: ReputationStats): number {
  if (stats.totalVotes === 0) return 0
  return stats.positiveVotes / stats.totalVotes
}

/**
 * Check if reputation meets minimum threshold
 */
export function meetsMinimumReputation(reputation: AgentReputation, minScore: number = 500): boolean {
  return reputation.overallScore >= minScore
}

/**
 * Create empty merkle root (32 zero bytes)
 */
export function emptyMerkleRoot(): Uint8Array {
  return new Uint8Array(32).fill(0)
}

/**
 * Create default component scores for new agents
 */
export function defaultComponentScores(): ComponentScores {
  return {
    trust: 50,
    quality: 50,
    reliability: 50,
    economic: 50,
    social: 50,
  }
}

/**
 * Create empty stats for new agents
 */
export function emptyStats(): ReputationStats {
  return {
    totalVotes: 0,
    positiveVotes: 0,
    negativeVotes: 0,
    totalReviews: 0,
    avgReviewRating: 0,
  }
}
