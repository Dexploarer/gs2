/**
 * Solana Program Upgrade Authority Management
 *
 * Provides utilities for managing program upgrade authorities including:
 * - Querying current upgrade authority
 * - Transferring authority to multi-sig wallets
 * - Monitoring authority changes
 * - Integration with governance programs (Squads)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  IDENTITY_REGISTRY_PROGRAM_ID,
  REPUTATION_REGISTRY_PROGRAM_ID,
  VOTE_REGISTRY_PROGRAM_ID,
  VALIDATION_REGISTRY_PROGRAM_ID,
  TOKEN_STAKING_PROGRAM_ID,
} from './programs'

// BPF Upgradeable Loader Program ID
export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111'
)

// Squads Protocol v3 Program ID (common governance solution)
const SQUADS_PROGRAM_ID = new PublicKey(
  'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu'
)

// Re-export for convenience
export const GHOSTSPEAK_PROGRAMS = {
  identityRegistry: IDENTITY_REGISTRY_PROGRAM_ID,
  reputationRegistry: REPUTATION_REGISTRY_PROGRAM_ID,
  voteRegistry: VOTE_REGISTRY_PROGRAM_ID,
  validationRegistry: VALIDATION_REGISTRY_PROGRAM_ID,
  tokenStaking: TOKEN_STAKING_PROGRAM_ID,
} as const

export type GhostSpeakProgram = keyof typeof GHOSTSPEAK_PROGRAMS

/**
 * Program upgrade authority info
 */
export interface UpgradeAuthorityInfo {
  programId: PublicKey
  programDataAddress: PublicKey
  upgradeAuthority: PublicKey | null
  slot: number
  isImmutable: boolean
}

/**
 * Authority transfer proposal
 */
export interface AuthorityTransferProposal {
  id: string
  programId: PublicKey
  currentAuthority: PublicKey
  proposedAuthority: PublicKey
  proposedAt: number
  expiresAt: number
  approvals: PublicKey[]
  threshold: number
  executed: boolean
}

/**
 * Get the program data address for an upgradeable program
 */
export function getProgramDataAddress(programId: PublicKey): PublicKey {
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  )
  return programDataAddress
}

/**
 * Fetch upgrade authority info for a program
 */
export async function fetchUpgradeAuthorityInfo(
  connection: Connection,
  programId: PublicKey
): Promise<UpgradeAuthorityInfo | null> {
  try {
    const programDataAddress = getProgramDataAddress(programId)
    const accountInfo = await connection.getAccountInfo(programDataAddress)

    if (!accountInfo) {
      return null
    }

    // Parse program data account (first 45 bytes contain header)
    // Offset 0: 1 byte - account type (3 = ProgramData)
    // Offset 1: 8 bytes - slot when last deployed
    // Offset 9: 1 byte - option flag (1 = Some authority, 0 = None/immutable)
    // Offset 10: 32 bytes - upgrade authority (if present)

    const data = accountInfo.data
    const accountType = data[0]

    if (accountType !== 3) {
      throw new Error('Invalid program data account type')
    }

    const slot = Number(data.readBigUInt64LE(1))
    const hasAuthority = data[9] === 1

    let upgradeAuthority: PublicKey | null = null
    if (hasAuthority) {
      upgradeAuthority = new PublicKey(data.slice(10, 42))
    }

    return {
      programId,
      programDataAddress,
      upgradeAuthority,
      slot,
      isImmutable: !hasAuthority,
    }
  } catch (error) {
    console.error('Error fetching upgrade authority:', error)
    return null
  }
}

/**
 * Fetch upgrade authority info for all GhostSpeak programs
 */
export async function fetchAllGhostSpeakAuthorities(
  connection: Connection
): Promise<Map<GhostSpeakProgram, UpgradeAuthorityInfo | null>> {
  const results = new Map<GhostSpeakProgram, UpgradeAuthorityInfo | null>()

  const entries = Object.entries(GHOSTSPEAK_PROGRAMS) as [
    GhostSpeakProgram,
    PublicKey,
  ][]

  await Promise.all(
    entries.map(async ([name, programId]) => {
      const info = await fetchUpgradeAuthorityInfo(connection, programId)
      results.set(name, info)
    })
  )

  return results
}

/**
 * Build instruction to set new upgrade authority
 * Note: This must be signed by the current upgrade authority
 */
export function buildSetUpgradeAuthorityInstruction(
  programId: PublicKey,
  currentAuthority: PublicKey,
  newAuthority: PublicKey | null // null = make immutable
): TransactionInstruction {
  const programDataAddress = getProgramDataAddress(programId)

  // SetAuthority instruction layout:
  // [4] instruction discriminator (4 = SetAuthority for upgradeable loader)
  // [1] option: 0 = None (immutable), 1 = Some
  // [32] new authority pubkey (if Some)

  const data = Buffer.alloc(newAuthority ? 37 : 5)
  data.writeUInt32LE(4, 0) // SetAuthority instruction

  if (newAuthority) {
    data.writeUInt8(1, 4) // Some
    newAuthority.toBuffer().copy(data, 5)
  } else {
    data.writeUInt8(0, 4) // None (make immutable)
  }

  return new TransactionInstruction({
    keys: [
      { pubkey: programDataAddress, isSigner: false, isWritable: true },
      { pubkey: currentAuthority, isSigner: true, isWritable: false },
      ...(newAuthority
        ? [{ pubkey: newAuthority, isSigner: false, isWritable: false }]
        : []),
    ],
    programId: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    data,
  })
}

/**
 * Build transaction to transfer upgrade authority
 */
export function buildTransferAuthorityTransaction(
  programId: PublicKey,
  currentAuthority: PublicKey,
  newAuthority: PublicKey
): Transaction {
  const transaction = new Transaction()

  transaction.add(
    buildSetUpgradeAuthorityInstruction(programId, currentAuthority, newAuthority)
  )

  return transaction
}

/**
 * Build transaction to make program immutable (irreversible!)
 */
export function buildMakeImmutableTransaction(
  programId: PublicKey,
  currentAuthority: PublicKey
): Transaction {
  const transaction = new Transaction()

  transaction.add(
    buildSetUpgradeAuthorityInstruction(programId, currentAuthority, null)
  )

  return transaction
}

/**
 * Check if an authority is a Squads multi-sig
 */
export async function isSquadsMultisig(
  connection: Connection,
  authority: PublicKey
): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(authority)
    if (!accountInfo) return false

    // Squads multisig accounts are owned by Squads program
    return accountInfo.owner.equals(SQUADS_PROGRAM_ID)
  } catch {
    return false
  }
}

/**
 * Monitor authority changes for a program
 * Returns subscription ID that can be used to unsubscribe
 */
export function monitorAuthorityChanges(
  connection: Connection,
  programId: PublicKey,
  callback: (newAuthority: PublicKey | null, slot: number) => void
): number {
  const programDataAddress = getProgramDataAddress(programId)

  return connection.onAccountChange(
    programDataAddress,
    (accountInfo, context) => {
      const data = accountInfo.data
      const hasAuthority = data[9] === 1

      let newAuthority: PublicKey | null = null
      if (hasAuthority) {
        newAuthority = new PublicKey(data.slice(10, 42))
      }

      callback(newAuthority, context.slot)
    },
    'confirmed'
  )
}

/**
 * Validate that authority transfer is safe
 */
export async function validateAuthorityTransfer(
  connection: Connection,
  programId: PublicKey,
  expectedCurrentAuthority: PublicKey,
  newAuthority: PublicKey
): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []

  // Check current authority matches expected
  const info = await fetchUpgradeAuthorityInfo(connection, programId)

  if (!info) {
    errors.push('Could not fetch program data account')
    return { valid: false, errors, warnings }
  }

  if (info.isImmutable) {
    errors.push('Program is immutable - cannot transfer authority')
    return { valid: false, errors, warnings }
  }

  if (!info.upgradeAuthority) {
    errors.push('Program has no upgrade authority')
    return { valid: false, errors, warnings }
  }

  if (!info.upgradeAuthority.equals(expectedCurrentAuthority)) {
    errors.push(
      `Current authority mismatch. Expected: ${expectedCurrentAuthority.toBase58()}, ` +
        `Actual: ${info.upgradeAuthority.toBase58()}`
    )
    return { valid: false, errors, warnings }
  }

  // Check if new authority is a valid account
  const newAuthorityInfo = await connection.getAccountInfo(newAuthority)
  if (!newAuthorityInfo) {
    warnings.push(
      'New authority account does not exist yet - this may be intentional for PDA-based authority'
    )
  }

  // Check if transferring to a known safe address (Squads)
  const isMultisig = await isSquadsMultisig(connection, newAuthority)
  if (!isMultisig) {
    warnings.push(
      'New authority is not a recognized Squads multisig - ensure this is intentional'
    )
  }

  // Warn if same as current
  if (info.upgradeAuthority.equals(newAuthority)) {
    warnings.push('New authority is the same as current authority')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Authority change event for audit logging
 */
export interface AuthorityChangeEvent {
  programId: PublicKey
  programName: GhostSpeakProgram | 'unknown'
  previousAuthority: PublicKey | null
  newAuthority: PublicKey | null
  slot: number
  timestamp: number
  transactionSignature?: string
  isImmutable: boolean
}

/**
 * Create authority change audit event
 */
export function createAuthorityChangeEvent(
  programId: PublicKey,
  previousAuthority: PublicKey | null,
  newAuthority: PublicKey | null,
  slot: number,
  signature?: string
): AuthorityChangeEvent {
  // Find program name
  let programName: GhostSpeakProgram | 'unknown' = 'unknown'
  for (const [name, addr] of Object.entries(GHOSTSPEAK_PROGRAMS)) {
    if (addr.equals(programId)) {
      programName = name as GhostSpeakProgram
      break
    }
  }

  return {
    programId,
    programName,
    previousAuthority,
    newAuthority,
    slot,
    timestamp: Date.now(),
    transactionSignature: signature,
    isImmutable: newAuthority === null,
  }
}

/**
 * Format authority info for display
 */
export function formatAuthorityInfo(info: UpgradeAuthorityInfo): string {
  if (info.isImmutable) {
    return `Program ${info.programId.toBase58()} is IMMUTABLE (deployed at slot ${info.slot})`
  }

  return (
    `Program: ${info.programId.toBase58()}\n` +
    `  Data Account: ${info.programDataAddress.toBase58()}\n` +
    `  Upgrade Authority: ${info.upgradeAuthority?.toBase58() ?? 'None'}\n` +
    `  Last Deployed Slot: ${info.slot}`
  )
}

