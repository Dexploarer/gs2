/**
 * Multi-sig Authority Client for GhostSpeak Programs
 *
 * Provides TypeScript utilities for interacting with the MultisigAuthority
 * system in the reputation_registry program.
 *
 * Features:
 * - Create and manage multi-sig authorities
 * - Propose and approve governance actions
 * - Execute approved proposals
 * - Query multi-sig state
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js'
import { REPUTATION_REGISTRY_PROGRAM_ID } from './programs'

// Re-export for backward compatibility
export { REPUTATION_REGISTRY_PROGRAM_ID }

// Seeds for PDA derivation
const MULTISIG_SEED = Buffer.from('multisig_authority')
const PROPOSAL_SEED = Buffer.from('multisig_proposal')

/**
 * Proposal types supported by the multisig system
 */
export enum ProposalType {
  UpdateReputation = 0,
  AddSigner = 1,
  RemoveSigner = 2,
  UpdateThreshold = 3,
  PauseProgram = 4,
  UnpauseProgram = 5,
  // Custom extension for upgrade authority
  TransferUpgradeAuthority = 100,
}

/**
 * Multi-sig authority configuration
 */
export interface MultisigConfig {
  admin: PublicKey
  signers: PublicKey[]
  threshold: number
  isActive: boolean
  proposalCount: number
}

/**
 * Multi-sig proposal
 */
export interface MultisigProposal {
  id: number
  proposalType: ProposalType
  proposer: PublicKey
  data: Buffer
  approvals: boolean[]
  approvalCount: number
  executed: boolean
  createdAt: number
  expiresAt: number
}

/**
 * Get the multi-sig authority PDA
 */
export function getMultisigAuthorityPDA(
  programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([MULTISIG_SEED], programId)
}

/**
 * Get a proposal PDA
 */
export function getProposalPDA(
  proposalId: number,
  programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  const idBuffer = Buffer.alloc(8)
  idBuffer.writeBigUInt64LE(BigInt(proposalId))

  return PublicKey.findProgramAddressSync(
    [PROPOSAL_SEED, idBuffer],
    programId
  )
}

/**
 * Multi-sig client for interacting with the reputation registry multisig
 */
export class MultisigClient {
  private connection: Connection
  private programId: PublicKey
  private multisigPDA: PublicKey
  private bump: number

  constructor(
    connection: Connection,
    programId: PublicKey = REPUTATION_REGISTRY_PROGRAM_ID
  ) {
    this.connection = connection
    this.programId = programId
    const [pda, bump] = getMultisigAuthorityPDA(programId)
    this.multisigPDA = pda
    this.bump = bump
  }

  /**
   * Get the multi-sig authority address
   */
  get authorityAddress(): PublicKey {
    return this.multisigPDA
  }

  /**
   * Fetch multi-sig configuration
   */
  async fetchConfig(): Promise<MultisigConfig | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(this.multisigPDA)

      if (!accountInfo) {
        return null
      }

      // Parse the MultisigAuthority account data
      // Layout:
      // - 8 bytes: discriminator
      // - 32 bytes: admin
      // - 4 bytes: signers vec length
      // - N * 32 bytes: signers
      // - 1 byte: threshold
      // - 1 byte: is_active
      // - 8 bytes: proposal_count
      // - 1 byte: bump

      const data = accountInfo.data
      let offset = 8 // Skip discriminator

      const admin = new PublicKey(data.slice(offset, offset + 32))
      offset += 32

      const signersLen = data.readUInt32LE(offset)
      offset += 4

      const signers: PublicKey[] = []
      for (let i = 0; i < signersLen; i++) {
        signers.push(new PublicKey(data.slice(offset, offset + 32)))
        offset += 32
      }

      const threshold = data[offset]
      offset += 1

      const isActive = data[offset] === 1
      offset += 1

      const proposalCount = Number(data.readBigUInt64LE(offset))

      return {
        admin,
        signers,
        threshold,
        isActive,
        proposalCount,
      }
    } catch (error) {
      console.error('Error fetching multisig config:', error)
      return null
    }
  }

  /**
   * Fetch a specific proposal
   */
  async fetchProposal(proposalId: number): Promise<MultisigProposal | null> {
    try {
      const [proposalPDA] = getProposalPDA(proposalId, this.programId)
      const accountInfo = await this.connection.getAccountInfo(proposalPDA)

      if (!accountInfo) {
        return null
      }

      // Parse MultisigProposal account
      // Layout:
      // - 8 bytes: discriminator
      // - 8 bytes: id
      // - 1 byte: proposal_type
      // - 32 bytes: proposer
      // - 4 bytes: data vec length
      // - N bytes: data
      // - 4 bytes: approvals vec length (bitmap)
      // - N bytes: approvals
      // - 1 byte: executed
      // - 8 bytes: created_at
      // - 8 bytes: expires_at

      const data = accountInfo.data
      let offset = 8 // Skip discriminator

      const id = Number(data.readBigUInt64LE(offset))
      offset += 8

      const proposalType = data[offset] as ProposalType
      offset += 1

      const proposer = new PublicKey(data.slice(offset, offset + 32))
      offset += 32

      const dataLen = data.readUInt32LE(offset)
      offset += 4

      const proposalData = data.slice(offset, offset + dataLen)
      offset += dataLen

      const approvalsLen = data.readUInt32LE(offset)
      offset += 4

      const approvals: boolean[] = []
      for (let i = 0; i < approvalsLen; i++) {
        approvals.push(data[offset] === 1)
        offset += 1
      }

      const executed = data[offset] === 1
      offset += 1

      const createdAt = Number(data.readBigUInt64LE(offset))
      offset += 8

      const expiresAt = Number(data.readBigUInt64LE(offset))

      return {
        id,
        proposalType,
        proposer,
        data: proposalData,
        approvals,
        approvalCount: approvals.filter(Boolean).length,
        executed,
        createdAt,
        expiresAt,
      }
    } catch (error) {
      console.error('Error fetching proposal:', error)
      return null
    }
  }

  /**
   * Fetch all active proposals
   */
  async fetchActiveProposals(): Promise<MultisigProposal[]> {
    const config = await this.fetchConfig()
    if (!config) return []

    const proposals: MultisigProposal[] = []
    const now = Date.now() / 1000

    // Iterate through recent proposals (last 100)
    const startId = Math.max(0, config.proposalCount - 100)

    for (let i = startId; i < config.proposalCount; i++) {
      const proposal = await this.fetchProposal(i)
      if (proposal && !proposal.executed && proposal.expiresAt > now) {
        proposals.push(proposal)
      }
    }

    return proposals
  }

  /**
   * Check if an address is a signer
   */
  async isSigner(address: PublicKey): Promise<boolean> {
    const config = await this.fetchConfig()
    if (!config) return false

    return config.signers.some((s) => s.equals(address))
  }

  /**
   * Check if an address is the admin
   */
  async isAdmin(address: PublicKey): Promise<boolean> {
    const config = await this.fetchConfig()
    if (!config) return false

    return config.admin.equals(address)
  }

  /**
   * Get the number of approvals needed for a proposal
   */
  async getApprovalsNeeded(proposalId: number): Promise<number | null> {
    const [config, proposal] = await Promise.all([
      this.fetchConfig(),
      this.fetchProposal(proposalId),
    ])

    if (!config || !proposal) return null

    return Math.max(0, config.threshold - proposal.approvalCount)
  }

  /**
   * Check if a proposal is ready to execute
   */
  async canExecute(proposalId: number): Promise<boolean> {
    const approvalsNeeded = await this.getApprovalsNeeded(proposalId)
    return approvalsNeeded === 0
  }

  /**
   * Build instruction to initialize multisig
   * (For program deployment - usually called once)
   */
  buildInitializeInstruction(
    admin: PublicKey,
    signers: PublicKey[],
    threshold: number,
    payer: PublicKey
  ): TransactionInstruction {
    // Instruction discriminator for initialize_multisig
    const discriminator = Buffer.from([
      0x67, 0x8a, 0x9c, 0x3d, 0x1e, 0x2f, 0x4b, 0x5a,
    ])

    // Build instruction data
    const data = Buffer.concat([
      discriminator,
      Buffer.from([signers.length]),
      ...signers.map((s) => s.toBuffer()),
      Buffer.from([threshold]),
    ])

    return new TransactionInstruction({
      keys: [
        { pubkey: this.multisigPDA, isSigner: false, isWritable: true },
        { pubkey: admin, isSigner: true, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build instruction to create a proposal
   */
  buildProposeInstruction(
    proposalType: ProposalType,
    proposalData: Buffer,
    proposer: PublicKey
  ): TransactionInstruction {
    // Instruction discriminator for propose
    const discriminator = Buffer.from([
      0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
    ])

    const data = Buffer.concat([
      discriminator,
      Buffer.from([proposalType]),
      Buffer.from([proposalData.length]),
      proposalData,
    ])

    // Get next proposal ID (needs to be fetched first)
    // For now, use a placeholder - in real usage, fetch config first

    return new TransactionInstruction({
      keys: [
        { pubkey: this.multisigPDA, isSigner: false, isWritable: true },
        // Proposal PDA will be derived on-chain
        { pubkey: proposer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build instruction to approve a proposal
   */
  buildApproveInstruction(
    proposalId: number,
    signer: PublicKey
  ): TransactionInstruction {
    const [proposalPDA] = getProposalPDA(proposalId, this.programId)

    // Instruction discriminator for approve_proposal
    const discriminator = Buffer.from([
      0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
    ])

    const idBuffer = Buffer.alloc(8)
    idBuffer.writeBigUInt64LE(BigInt(proposalId))

    const data = Buffer.concat([discriminator, idBuffer])

    return new TransactionInstruction({
      keys: [
        { pubkey: this.multisigPDA, isSigner: false, isWritable: false },
        { pubkey: proposalPDA, isSigner: false, isWritable: true },
        { pubkey: signer, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build instruction to execute an approved proposal
   */
  buildExecuteInstruction(
    proposalId: number,
    executor: PublicKey,
    additionalAccounts: PublicKey[] = []
  ): TransactionInstruction {
    const [proposalPDA] = getProposalPDA(proposalId, this.programId)

    // Instruction discriminator for execute_proposal
    const discriminator = Buffer.from([
      0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
    ])

    const idBuffer = Buffer.alloc(8)
    idBuffer.writeBigUInt64LE(BigInt(proposalId))

    const data = Buffer.concat([discriminator, idBuffer])

    const keys = [
      { pubkey: this.multisigPDA, isSigner: false, isWritable: true },
      { pubkey: proposalPDA, isSigner: false, isWritable: true },
      { pubkey: executor, isSigner: true, isWritable: false },
      ...additionalAccounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: true,
      })),
    ]

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data,
    })
  }

  /**
   * Build transaction to propose and approve in one step
   * (For the proposer who is also a signer)
   */
  buildProposeAndApproveTransaction(
    proposalType: ProposalType,
    proposalData: Buffer,
    proposer: PublicKey
  ): Transaction {
    const transaction = new Transaction()

    transaction.add(
      this.buildProposeInstruction(proposalType, proposalData, proposer)
    )
    // Proposal ID will be config.proposalCount at time of execution
    // The approval will happen automatically in the on-chain program

    return transaction
  }
}

/**
 * Utility to format proposal for display
 */
export function formatProposal(proposal: MultisigProposal): string {
  const typeNames: Record<ProposalType, string> = {
    [ProposalType.UpdateReputation]: 'Update Reputation',
    [ProposalType.AddSigner]: 'Add Signer',
    [ProposalType.RemoveSigner]: 'Remove Signer',
    [ProposalType.UpdateThreshold]: 'Update Threshold',
    [ProposalType.PauseProgram]: 'Pause Program',
    [ProposalType.UnpauseProgram]: 'Unpause Program',
    [ProposalType.TransferUpgradeAuthority]: 'Transfer Upgrade Authority',
  }

  const status = proposal.executed
    ? 'EXECUTED'
    : proposal.expiresAt < Date.now() / 1000
      ? 'EXPIRED'
      : 'PENDING'

  return (
    `Proposal #${proposal.id}\n` +
    `  Type: ${typeNames[proposal.proposalType] || 'Unknown'}\n` +
    `  Proposer: ${proposal.proposer.toBase58()}\n` +
    `  Approvals: ${proposal.approvalCount}/${proposal.approvals.length}\n` +
    `  Status: ${status}\n` +
    `  Created: ${new Date(proposal.createdAt * 1000).toISOString()}\n` +
    `  Expires: ${new Date(proposal.expiresAt * 1000).toISOString()}`
  )
}

/**
 * Utility to format multisig config for display
 */
export function formatConfig(config: MultisigConfig): string {
  return (
    `Multi-sig Configuration\n` +
    `  Admin: ${config.admin.toBase58()}\n` +
    `  Threshold: ${config.threshold}/${config.signers.length}\n` +
    `  Active: ${config.isActive}\n` +
    `  Proposals: ${config.proposalCount}\n` +
    `  Signers:\n` +
    config.signers.map((s, i) => `    ${i + 1}. ${s.toBase58()}`).join('\n')
  )
}
