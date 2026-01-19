/**
 * Validation Registry Program Client
 *
 * TypeScript client for interacting with the Validation Registry program.
 * Verifies x402 payment endpoints through LLM-based validation tests.
 *
 * Features:
 * - Submit endpoint validations with test results
 * - Calculate consensus scores from multiple LLM tests
 * - Issue validation stamps for verified endpoints
 * - Query endpoint validation status
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js'
import { VALIDATION_REGISTRY_PROGRAM_ID } from './programs'

// Re-export for convenience
export { VALIDATION_REGISTRY_PROGRAM_ID }

// PDA Seeds
const VALIDATION_SEED = Buffer.from('validation')
const AUTHORITY_SEED = Buffer.from('authority')

// ============================================================================
// TYPES
// ============================================================================

export interface TestResult {
  llmModel: string
  success: boolean
  responseTime: bigint
  score: number
}

export interface EndpointValidation {
  endpointHash: Uint8Array
  endpointUrl: string
  providerAgent: PublicKey
  testResults: TestResult[]
  consensusScore: number
  stampIssued: boolean
  timestamp: bigint
  bump: number
}

export interface ValidationAuthority {
  authority: PublicKey
  bump: number
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

export function getValidationPDA(
  endpointHash: Uint8Array,
  programId: PublicKey = VALIDATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VALIDATION_SEED, Buffer.from(endpointHash)],
    programId
  )
}

export function getAuthorityPDA(
  programId: PublicKey = VALIDATION_REGISTRY_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([AUTHORITY_SEED], programId)
}

// ============================================================================
// INSTRUCTION DISCRIMINATORS (from Anchor IDL)
// ============================================================================

const DISCRIMINATORS = {
  initializeAuthority: Buffer.from([13, 186, 25, 16, 218, 31, 90, 1]),
  submitValidation: Buffer.from([224, 75, 32, 63, 177, 137, 242, 221]),
  queryValidations: Buffer.from([163, 117, 85, 0, 163, 254, 58, 54]),
  calculateConsensus: Buffer.from([87, 74, 198, 240, 8, 148, 101, 185]),
  issueValidationStamp: Buffer.from([157, 211, 53, 131, 210, 78, 253, 176]),
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class ValidationRegistryClient {
  private connection: Connection
  private programId: PublicKey

  constructor(
    connection: Connection,
    programId: PublicKey = VALIDATION_REGISTRY_PROGRAM_ID
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
    const [authorityAccount] = getAuthorityPDA(this.programId)

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
   * Build submit validation instruction
   */
  buildSubmitValidationInstruction(
    payer: PublicKey,
    providerAgent: PublicKey,
    endpointUrl: string,
    endpointHash: Uint8Array,
    testResults: TestResult[]
  ): TransactionInstruction {
    const [endpointValidation] = getValidationPDA(endpointHash, this.programId)

    // Serialize endpoint URL
    const urlBuffer = Buffer.from(endpointUrl)

    // Serialize test results
    const testResultsBuffers: Buffer[] = []
    for (const result of testResults) {
      const modelBuffer = Buffer.from(result.llmModel)
      const resultBuffer = Buffer.alloc(4 + modelBuffer.length + 1 + 8 + 1)
      let offset = 0

      resultBuffer.writeUInt32LE(modelBuffer.length, offset)
      offset += 4
      modelBuffer.copy(resultBuffer, offset)
      offset += modelBuffer.length
      resultBuffer.writeUInt8(result.success ? 1 : 0, offset)
      offset += 1
      resultBuffer.writeBigUInt64LE(result.responseTime, offset)
      offset += 8
      resultBuffer.writeUInt8(result.score, offset)

      testResultsBuffers.push(resultBuffer)
    }

    const testResultsBuffer = Buffer.concat([
      Buffer.alloc(4), // vec length
      ...testResultsBuffers,
    ])
    testResultsBuffer.writeUInt32LE(testResults.length, 0)

    // Build instruction data
    const data = Buffer.concat([
      DISCRIMINATORS.submitValidation,
      Buffer.alloc(4), // url length
      urlBuffer,
      Buffer.from(endpointHash),
      testResultsBuffer,
    ])

    // Write url length
    data.writeUInt32LE(urlBuffer.length, 8)

    return new TransactionInstruction({
      keys: [
        { pubkey: endpointValidation, isSigner: false, isWritable: true },
        { pubkey: providerAgent, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    })
  }

  /**
   * Build calculate consensus instruction
   */
  buildCalculateConsensusInstruction(
    authority: PublicKey,
    endpointValidation: PublicKey
  ): TransactionInstruction {
    const [authorityAccount] = getAuthorityPDA(this.programId)

    return new TransactionInstruction({
      keys: [
        { pubkey: endpointValidation, isSigner: false, isWritable: true },
        { pubkey: authorityAccount, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: DISCRIMINATORS.calculateConsensus,
    })
  }

  /**
   * Build issue validation stamp instruction
   */
  buildIssueValidationStampInstruction(
    authority: PublicKey,
    endpointValidation: PublicKey
  ): TransactionInstruction {
    const [authorityAccount] = getAuthorityPDA(this.programId)

    return new TransactionInstruction({
      keys: [
        { pubkey: endpointValidation, isSigner: false, isWritable: true },
        { pubkey: authorityAccount, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: DISCRIMINATORS.issueValidationStamp,
    })
  }

  // ==========================================================================
  // ACCOUNT FETCHERS
  // ==========================================================================

  /**
   * Fetch validation by endpoint hash
   */
  async getValidation(endpointHash: Uint8Array): Promise<EndpointValidation | null> {
    const [pda] = getValidationPDA(endpointHash, this.programId)
    return this.fetchValidation(pda)
  }

  /**
   * Fetch validation by PDA
   */
  async fetchValidation(pda: PublicKey): Promise<EndpointValidation | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseEndpointValidation(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch endpoint validation:', error)
      return null
    }
  }

  /**
   * Fetch authority configuration
   */
  async getAuthority(): Promise<ValidationAuthority | null> {
    const [pda] = getAuthorityPDA(this.programId)
    try {
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (!accountInfo?.data) return null
      return parseValidationAuthority(accountInfo.data)
    } catch (error) {
      console.error('Failed to fetch validation authority:', error)
      return null
    }
  }

  /**
   * Get all validations for a provider agent
   */
  async getValidationsForProvider(
    providerAgent: PublicKey
  ): Promise<{ address: PublicKey; validation: EndpointValidation }[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 8 + 32 + 4, // After discriminator, hash, and url length
              // This filter won't work perfectly due to variable url length
              // Better to filter client-side
              bytes: providerAgent.toBase58(),
            },
          },
        ],
      })

      // Filter client-side for accuracy
      const validations: { address: PublicKey; validation: EndpointValidation }[] = []
      for (const { pubkey, account } of accounts) {
        const validation = parseEndpointValidation(account.data)
        if (validation && validation.providerAgent.equals(providerAgent)) {
          validations.push({ address: pubkey, validation })
        }
      }

      return validations
    } catch (error) {
      console.error('Failed to fetch validations for provider:', error)
      return []
    }
  }

  /**
   * Get all validated endpoints (with stamp issued)
   */
  async getValidatedEndpoints(): Promise<{ address: PublicKey; validation: EndpointValidation }[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId)

      const validations: { address: PublicKey; validation: EndpointValidation }[] = []
      for (const { pubkey, account } of accounts) {
        // Skip authority account (different discriminator)
        if (account.data.length < 50) continue

        const validation = parseEndpointValidation(account.data)
        if (validation && validation.stampIssued) {
          validations.push({ address: pubkey, validation })
        }
      }

      return validations
    } catch (error) {
      console.error('Failed to fetch validated endpoints:', error)
      return []
    }
  }

  /**
   * Check if an endpoint is validated
   */
  async isEndpointValidated(endpointHash: Uint8Array): Promise<boolean> {
    const validation = await this.getValidation(endpointHash)
    return validation !== null && validation.stampIssued
  }

  /**
   * Get consensus score for endpoint
   */
  async getConsensusScore(endpointHash: Uint8Array): Promise<number | null> {
    const validation = await this.getValidation(endpointHash)
    return validation?.consensusScore ?? null
  }
}

// ============================================================================
// ACCOUNT PARSERS
// ============================================================================

function parseEndpointValidation(data: Buffer): EndpointValidation | null {
  try {
    let offset = 8 // Skip discriminator

    const endpointHash = new Uint8Array(data.subarray(offset, offset + 32))
    offset += 32

    const urlLength = data.readUInt32LE(offset)
    offset += 4
    const endpointUrl = data.subarray(offset, offset + urlLength).toString('utf-8')
    offset += urlLength

    const providerAgent = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32

    // Parse test results vec
    const numResults = data.readUInt32LE(offset)
    offset += 4

    const testResults: TestResult[] = []
    for (let i = 0; i < numResults; i++) {
      const modelLen = data.readUInt32LE(offset)
      offset += 4
      const llmModel = data.subarray(offset, offset + modelLen).toString('utf-8')
      offset += modelLen

      const success = data.readUInt8(offset) === 1
      offset += 1

      const responseTime = data.readBigUInt64LE(offset)
      offset += 8

      const score = data.readUInt8(offset)
      offset += 1

      testResults.push({ llmModel, success, responseTime, score })
    }

    const consensusScore = data.readUInt16LE(offset)
    offset += 2

    const stampIssued = data.readUInt8(offset) === 1
    offset += 1

    const timestamp = data.readBigInt64LE(offset)
    offset += 8

    const bump = data.readUInt8(offset)

    return {
      endpointHash,
      endpointUrl,
      providerAgent,
      testResults,
      consensusScore,
      stampIssued,
      timestamp,
      bump,
    }
  } catch {
    return null
  }
}

function parseValidationAuthority(data: Buffer): ValidationAuthority | null {
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
 * Hash an endpoint URL for PDA derivation
 */
export async function hashEndpointUrl(url: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return new Uint8Array(hashBuffer)
}

/**
 * Calculate consensus score from test results
 * Matches the on-chain calculation
 */
export function calculateConsensusScore(testResults: TestResult[]): number {
  if (testResults.length === 0) return 0

  let totalScore = 0
  let successCount = 0

  for (const result of testResults) {
    if (result.success) {
      successCount++
      totalScore += result.score
    }
  }

  if (successCount === 0) return 0

  // Base score: average of successful test scores
  const avgScore = totalScore / successCount

  // Success rate bonus (0-200 points)
  const successRate = successCount / testResults.length
  const successBonus = Math.floor(successRate * 200)

  // Minimum tests bonus (up to 100 points for 5+ tests)
  const testCountBonus = Math.min(100, testResults.length * 20)

  // Final score (0-1000)
  return Math.min(1000, Math.floor(avgScore * 7) + successBonus + testCountBonus)
}

/**
 * Check if validation meets stamp requirements
 * - At least 3 test results
 * - Consensus score >= 600
 */
export function meetsStampRequirements(validation: EndpointValidation): boolean {
  return validation.testResults.length >= 3 && validation.consensusScore >= 600
}
