/**
 * Vote Registry Program Client
 *
 * TypeScript client for interacting with the Vote Registry program.
 * Enables activity-weighted reputation voting and endorsements for agents.
 *
 * Features:
 * - Transaction receipts for x402 payments
 * - Peer voting on agents (requires valid receipt)
 * - Content ratings
 * - Agent endorsements (stake-weighted)
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js'
import {
  VOTE_REGISTRY_PROGRAM_ID,
  IDENTITY_REGISTRY_PROGRAM_ID,
  REPUTATION_REGISTRY_PROGRAM_ID,
} from './programs'

// Re-export for convenience
export { VOTE_REGISTRY_PROGRAM_ID }

// PDA Seeds
const TX_RECEIPT_SEED = Buffer.from('tx_receipt')
const PEER_VOTE_SEED = Buffer.from('peer_vote')
const CONTENT_RATING_SEED = Buffer.from('content_rating')
const ENDORSEMENT_SEED = Buffer.from('endorsement')

// ============================================================================
// TYPES
// ============================================================================

export type VoteType = 'Upvote' | 'Downvote' | 'Neutral'
export const VoteTypeIndex: Record<VoteType, number> = {
  Upvote: 0,
  Downvote: 1,
  Neutral: 2,
}

export type ContentType =
  | 'ApiResponse'
  | 'GeneratedText'
  | 'GeneratedImage'
  | 'GeneratedCode'
  | 'DataFeed'
  | 'Other'
export const ContentTypeIndex: Record<ContentType, number> = {
  ApiResponse: 0,
  GeneratedText: 1,
  GeneratedImage: 2,
  GeneratedCode: 3,
  DataFeed: 4,
  Other: 5,
}

export type EndorsementCategory =
  | 'Technical'
  | 'Reliability'
  | 'Quality'
  | 'Trustworthy'
  | 'Collaborative'
export const EndorsementCategoryIndex: Record<EndorsementCategory, number> = {
  Technical: 0,
  Reliability: 1,
  Quality: 2,
  Trustworthy: 3,
  Collaborative: 4,
}

export interface QualityScores {
  responseQuality: number
  responseSpeed: number
  accuracy: number
  professionalism: number
}

export interface TransactionReceipt {
  signature: string
  payer: PublicKey
  recipient: PublicKey
  amount: bigint
  timestamp: bigint
  contentType: ContentType
  voteCast: boolean
  bump: number
}

export interface PeerVote {
  voter: PublicKey
  votedAgent: PublicKey
  voteType: VoteType
  qualityScores: QualityScores
  commentHash: Uint8Array
  timestamp: bigint
  voterReputationSnapshot: number
  transactionReceipt: PublicKey
  voteWeight: number
  bump: number
}

export interface ContentRating {
  agent: PublicKey
  rater: PublicKey
  x402Signature: string
  qualityRating: number
  contentType: ContentType
  amountPaid: bigint
  timestamp: bigint
  raterReputationSnapshot: number
  bump: number
}

export interface AgentEndorsement {
  endorser: PublicKey
  endorsed: PublicKey
  strength: number
  category: EndorsementCategory
  timestamp: bigint
  endorserReputationSnapshot: number
  stakeAmount: bigint
  isActive: boolean
  bump: number
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

export function getTransactionReceiptPDA(
  payer: PublicKey,
  recipient: PublicKey,
  signatureHash: Uint8Array,
  programId: PublicKey = VOTE_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TX_RECEIPT_SEED, payer.toBuffer(), recipient.toBuffer(), Buffer.from(signatureHash)],
    programId
  )
}

export function getPeerVotePDA(
  transactionReceipt: PublicKey,
  programId: PublicKey = VOTE_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PEER_VOTE_SEED, transactionReceipt.toBuffer()],
    programId
  )
}

export function getContentRatingPDA(
  x402Signature: string,
  programId: PublicKey = VOTE_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONTENT_RATING_SEED, Buffer.from(x402Signature)],
    programId
  )
}

export function getEndorsementPDA(
  endorser: PublicKey,
  endorsed: PublicKey,
  programId: PublicKey = VOTE_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ENDORSEMENT_SEED, endorser.toBuffer(), endorsed.toBuffer()],
    programId
  )
}

// Helper to derive identity PDA (for cross-program invocation)
// Note: Not exported to avoid conflict with identity-registry-client
function deriveAgentIdentityPDA(
  agentAddress: PublicKey,
  programId: PublicKey = IDENTITY_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentAddress.toBuffer()],
    programId
  )
}

// Helper to derive reputation PDA (for cross-program invocation)
// Note: Not exported to avoid conflict with reputation-registry-client
function deriveReputationPDA(
  agentAddress: PublicKey,
  programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), agentAddress.toBuffer()],
    programId
  )
}

// ============================================================================
// INSTRUCTION DISCRIMINATORS (from Anchor IDL)
// ============================================================================

const DISCRIMINATORS = {
  createTransactionReceipt: Buffer.from([67, 122, 43, 192, 180, 76, 15, 151]),
  castPeerVote: Buffer.from([134, 128, 196, 183, 241, 250, 33, 45]),
  rateContent: Buffer.from([237, 161, 216, 135, 145, 73, 46, 59]),
  endorseAgent: Buffer.from([150, 194, 86, 132, 94, 161, 156, 198]),
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class VoteRegistryClient {
  private connection: Connection
  private programId: PublicKey

  constructor(
    connection: Connection,
    programId: PublicKey = VOTE_REGISTRY_PROGRAM_ID
  ) {
    this.connection = connection
    this.programId = programId
  }

  // ==========================================================================
  // INSTRUCTION BUILDERS
  // ==========================================================================

  /**
   * Build create transaction receipt instruction
   */
  buildCreateTransactionReceiptInstruction(
    creator: PublicKey,
    payer: PublicKey,
    recipient: PublicKey,
    signature: string,
    signatureHash: Uint8Array,
    amount: bigint,
    contentType: ContentType
  ): TransactionInstruction {
    const [receipt] = getTransactionReceiptPDA(
      payer,
      recipient,
      signatureHash,
      this.programId
    )

    const signatureBuffer = Buffer.from(signature)
    const data = Buffer.alloc(8 + 4 + signatureBuffer.length + 32 + 8 + 1)
    let offset = 0

    DISCRIMINATORS.createTransactionReceipt.copy(data, offset)
    offset += 8

    data.writeUInt32LE(signatureBuffer.length, offset)
    offset += 4
    signatureBuffer.copy(data, offset)
    offset += signatureBuffer.length

    Buffer.from(signatureHash).copy(data, offset)
    offset += 32

    data.writeBigUInt64LE(amount, offset)
    offset += 8

    data.writeUInt8(ContentTypeIndex[contentType], offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: receipt, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: false, isWritable: false },
        { pubkey: recipient, isSigner: false, isWritable: false },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build cast peer vote instruction
   */
  buildCastPeerVoteInstruction(
    voter: PublicKey,
    votedAgent: PublicKey,
    transactionReceipt: PublicKey,
    voteType: VoteType,
    qualityScores: QualityScores,
    commentHash: Uint8Array
  ): TransactionInstruction {
    const [peerVote] = getPeerVotePDA(transactionReceipt, this.programId)
    const [voterIdentity] = deriveAgentIdentityPDA(voter)
    const [voterReputation] = deriveReputationPDA(voter)
    const [votedAgentIdentity] = deriveAgentIdentityPDA(votedAgent)

    const data = Buffer.alloc(8 + 32 + 1 + 4 + 32)
    let offset = 0

    DISCRIMINATORS.castPeerVote.copy(data, offset)
    offset += 8

    votedAgent.toBuffer().copy(data, offset)
    offset += 32

    data.writeUInt8(VoteTypeIndex[voteType], offset)
    offset += 1

    data.writeUInt8(qualityScores.responseQuality, offset)
    offset += 1
    data.writeUInt8(qualityScores.responseSpeed, offset)
    offset += 1
    data.writeUInt8(qualityScores.accuracy, offset)
    offset += 1
    data.writeUInt8(qualityScores.professionalism, offset)
    offset += 1

    Buffer.from(commentHash).copy(data, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: peerVote, isSigner: false, isWritable: true },
        { pubkey: transactionReceipt, isSigner: false, isWritable: true },
        { pubkey: voterIdentity, isSigner: false, isWritable: false },
        { pubkey: voterReputation, isSigner: false, isWritable: false },
        { pubkey: votedAgentIdentity, isSigner: false, isWritable: false },
        { pubkey: voter, isSigner: true, isWritable: true },
        { pubkey: IDENTITY_REGISTRY_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: REPUTATION_REGISTRY_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build rate content instruction
   */
  buildRateContentInstruction(
    rater: PublicKey,
    ratedAgent: PublicKey,
    x402Signature: string,
    qualityRating: number,
    contentType: ContentType,
    amountPaid: bigint
  ): TransactionInstruction {
    const [contentRating] = getContentRatingPDA(x402Signature, this.programId)
    const [raterIdentity] = deriveAgentIdentityPDA(rater)
    const [raterReputation] = deriveReputationPDA(rater)
    const [ratedAgentIdentity] = deriveAgentIdentityPDA(ratedAgent)

    const signatureBuffer = Buffer.from(x402Signature)
    const data = Buffer.alloc(8 + 4 + signatureBuffer.length + 1 + 1 + 8)
    let offset = 0

    DISCRIMINATORS.rateContent.copy(data, offset)
    offset += 8

    data.writeUInt32LE(signatureBuffer.length, offset)
    offset += 4
    signatureBuffer.copy(data, offset)
    offset += signatureBuffer.length

    data.writeUInt8(qualityRating, offset)
    offset += 1

    data.writeUInt8(ContentTypeIndex[contentType], offset)
    offset += 1

    data.writeBigUInt64LE(amountPaid, offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: contentRating, isSigner: false, isWritable: true },
        { pubkey: raterIdentity, isSigner: false, isWritable: false },
        { pubkey: raterReputation, isSigner: false, isWritable: false },
        { pubkey: ratedAgentIdentity, isSigner: false, isWritable: false },
        { pubkey: ratedAgent, isSigner: false, isWritable: false },
        { pubkey: rater, isSigner: true, isWritable: true },
        { pubkey: IDENTITY_REGISTRY_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: REPUTATION_REGISTRY_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build endorse agent instruction
   */
  buildEndorseAgentInstruction(
    endorser: PublicKey,
    endorsedAgent: PublicKey,
    strength: number,
    category: EndorsementCategory
  ): TransactionInstruction {
    const [endorsement] = getEndorsementPDA(endorser, endorsedAgent, this.programId)
    const [endorserIdentity] = deriveAgentIdentityPDA(endorser)
    const [endorserReputation] = deriveReputationPDA(endorser)
    const [endorsedAgentIdentity] = deriveAgentIdentityPDA(endorsedAgent)

    const data = Buffer.alloc(8 + 32 + 1 + 1)
    let offset = 0

    DISCRIMINATORS.endorseAgent.copy(data, offset)
    offset += 8

    endorsedAgent.toBuffer().copy(data, offset)
    offset += 32

    data.writeUInt8(strength, offset)
    offset += 1

    data.writeUInt8(EndorsementCategoryIndex[category], offset)

    return new TransactionInstruction({
      keys: [
        { pubkey: endorsement, isSigner: false, isWritable: true },
        { pubkey: endorserIdentity, isSigner: false, isWritable: false },
        { pubkey: endorserReputation, isSigner: false, isWritable: false },
        { pubkey: endorsedAgentIdentity, isSigner: false, isWritable: false },
        { pubkey: endorser, isSigner: true, isWritable: true },
        { pubkey: IDENTITY_REGISTRY_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: REPUTATION_REGISTRY_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  // ==========================================================================
  // ACCOUNT FETCHERS
  // ==========================================================================

  /**
   * Fetch transaction receipt
   */
  async getTransactionReceipt(
    payer: PublicKey,
    recipient: PublicKey,
    signatureHash: Uint8Array
  ): Promise<TransactionReceipt | null> {
    const [pda] = getTransactionReceiptPDA(payer, recipient, signatureHash, this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseTransactionReceipt(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch transaction receipt:', error)
      return null
    }
  }

  /**
   * Fetch peer vote
   */
  async getPeerVote(transactionReceipt: PublicKey): Promise<PeerVote | null> {
    const [pda] = getPeerVotePDA(transactionReceipt, this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parsePeerVote(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch peer vote:', error)
      return null
    }
  }

  /**
   * Fetch all votes for an agent
   */
  async getVotesForAgent(agentAddress: PublicKey): Promise<PeerVote[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: PEER_VOTE_SIZE },
          {
            memcmp: {
              offset: 8 + 32, // After discriminator + voter pubkey
              bytes: agentAddress.toBase58(),
            },
          },
        ],
      })

      const votes: PeerVote[] = []
      for (const { account } of accounts) {
        const vote = parsePeerVote(account.data)
        if (vote) votes.push(vote)
      }
      return votes
    } catch (error) {
      console.error('Failed to fetch votes for agent:', error)
      return []
    }
  }

  /**
   * Fetch endorsement
   */
  async getEndorsement(
    endorser: PublicKey,
    endorsed: PublicKey
  ): Promise<AgentEndorsement | null> {
    const [pda] = getEndorsementPDA(endorser, endorsed, this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseAgentEndorsement(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch endorsement:', error)
      return null
    }
  }

  /**
   * Fetch all endorsements for an agent
   */
  async getEndorsementsForAgent(agentAddress: PublicKey): Promise<AgentEndorsement[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: ENDORSEMENT_SIZE },
          {
            memcmp: {
              offset: 8 + 32, // After discriminator + endorser pubkey
              bytes: agentAddress.toBase58(),
            },
          },
        ],
      })

      const endorsements: AgentEndorsement[] = []
      for (const { account } of accounts) {
        const endorsement = parseAgentEndorsement(account.data)
        if (endorsement && endorsement.isActive) endorsements.push(endorsement)
      }
      return endorsements
    } catch (error) {
      console.error('Failed to fetch endorsements for agent:', error)
      return []
    }
  }

  /**
   * Get vote statistics for an agent
   */
  async getVoteStatistics(agentAddress: PublicKey): Promise<{
    totalVotes: number
    upvotes: number
    downvotes: number
    neutral: number
    averageQuality: number
    upvoteRatio: number
  }> {
    const votes = await this.getVotesForAgent(agentAddress)

    let upvotes = 0
    let downvotes = 0
    let neutral = 0
    let totalQuality = 0

    for (const vote of votes) {
      if (vote.voteType === 'Upvote') upvotes++
      else if (vote.voteType === 'Downvote') downvotes++
      else neutral++

      const avgScore =
        (vote.qualityScores.responseQuality +
          vote.qualityScores.responseSpeed +
          vote.qualityScores.accuracy +
          vote.qualityScores.professionalism) /
        4
      totalQuality += avgScore
    }

    return {
      totalVotes: votes.length,
      upvotes,
      downvotes,
      neutral,
      averageQuality: votes.length > 0 ? totalQuality / votes.length : 0,
      upvoteRatio: votes.length > 0 ? upvotes / votes.length : 0,
    }
  }
}

// ============================================================================
// ACCOUNT SIZES
// ============================================================================

const PEER_VOTE_SIZE = 8 + 32 + 32 + 1 + 4 + 32 + 8 + 2 + 32 + 2 + 1 // ~160 bytes
const ENDORSEMENT_SIZE = 8 + 32 + 32 + 1 + 1 + 8 + 2 + 8 + 1 + 1 // ~96 bytes

// ============================================================================
// ACCOUNT PARSERS
// ============================================================================

const ContentTypes: ContentType[] = [
  'ApiResponse',
  'GeneratedText',
  'GeneratedImage',
  'GeneratedCode',
  'DataFeed',
  'Other',
]

const VoteTypes: VoteType[] = ['Upvote', 'Downvote', 'Neutral']

const EndorsementCategories: EndorsementCategory[] = [
  'Technical',
  'Reliability',
  'Quality',
  'Trustworthy',
  'Collaborative',
]

function parseTransactionReceipt(data: Buffer): TransactionReceipt | null {
  try {
    let offset = 8 // Skip discriminator

    const signatureLen = data.readUInt32LE(offset)
    offset += 4
    const signature = data.subarray(offset, offset + signatureLen).toString('utf-8')
    offset += signatureLen

    const payer = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const recipient = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const amount = data.readBigUInt64LE(offset)
    offset += 8

    const timestamp = data.readBigInt64LE(offset)
    offset += 8

    const contentTypeIndex = data.readUInt8(offset)
    offset += 1

    const voteCast = data.readUInt8(offset) === 1
    offset += 1

    const bump = data.readUInt8(offset)

    return {
      signature,
      payer,
      recipient,
      amount,
      timestamp,
      contentType: ContentTypes[contentTypeIndex] || 'Other',
      voteCast,
      bump,
    }
  } catch {
    return null
  }
}

function parsePeerVote(data: Buffer): PeerVote | null {
  try {
    let offset = 8 // Skip discriminator

    const voter = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const votedAgent = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const voteTypeIndex = data.readUInt8(offset)
    offset += 1

    const qualityScores: QualityScores = {
      responseQuality: data.readUInt8(offset),
      responseSpeed: data.readUInt8(offset + 1),
      accuracy: data.readUInt8(offset + 2),
      professionalism: data.readUInt8(offset + 3),
    }
    offset += 4

    const commentHash = new Uint8Array(data.subarray(offset, offset + 32))
    offset += 32

    const timestamp = data.readBigInt64LE(offset)
    offset += 8

    const voterReputationSnapshot = data.readUInt16LE(offset)
    offset += 2

    const transactionReceipt = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const voteWeight = data.readUInt16LE(offset)
    offset += 2

    const bump = data.readUInt8(offset)

    return {
      voter,
      votedAgent,
      voteType: VoteTypes[voteTypeIndex] || 'Neutral',
      qualityScores,
      commentHash,
      timestamp,
      voterReputationSnapshot,
      transactionReceipt,
      voteWeight,
      bump,
    }
  } catch {
    return null
  }
}

function parseAgentEndorsement(data: Buffer): AgentEndorsement | null {
  try {
    let offset = 8

    const endorser = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const endorsed = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    const strength = data.readUInt8(offset)
    offset += 1

    const categoryIndex = data.readUInt8(offset)
    offset += 1

    const timestamp = data.readBigInt64LE(offset)
    offset += 8

    const endorserReputationSnapshot = data.readUInt16LE(offset)
    offset += 2

    const stakeAmount = data.readBigUInt64LE(offset)
    offset += 8

    const isActive = data.readUInt8(offset) === 1
    offset += 1

    const bump = data.readUInt8(offset)

    return {
      endorser,
      endorsed,
      strength,
      category: EndorsementCategories[categoryIndex] || 'Technical',
      timestamp,
      endorserReputationSnapshot,
      stakeAmount,
      isActive,
      bump,
    }
  } catch {
    return null
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash a signature for PDA derivation
 */
export async function hashSignature(signature: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(signature)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return new Uint8Array(hashBuffer)
}

/**
 * Hash a comment for storage
 */
export async function hashComment(comment: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(comment)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return new Uint8Array(hashBuffer)
}

/**
 * Calculate vote weight from transaction amount
 * Higher amounts = more weight (capped at 200 = 2x)
 */
export function calculateVoteWeight(amountLamports: bigint): number {
  const solAmount = Number(amountLamports) / 1e9
  // Base weight is 100 (1x)
  // Every 0.1 SOL adds 10 to weight, max 200
  const bonus = Math.min(100, Math.floor(solAmount * 100))
  return 100 + bonus
}
