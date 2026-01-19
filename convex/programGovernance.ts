/**
 * Program Governance Monitoring
 *
 * Convex functions for tracking Solana program upgrade authorities,
 * monitoring multi-sig proposals, and alerting on governance changes.
 */

import { v } from 'convex/values'
import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from './_generated/server'
import { internal } from './_generated/api'

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet'

// Get network from environment (Convex uses process.env directly)
const SOLANA_NETWORK: SolanaNetwork =
  (process.env.SOLANA_CLUSTER as SolanaNetwork) || 'devnet'

// Devnet Program IDs (must match lib/solana/programs.ts)
const DEVNET_PROGRAM_IDS = {
  identityRegistry: '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e',
  reputationRegistry: 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp',
  validationRegistry: '9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc',
  voteRegistry: 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6',
  tokenStaking: '4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL',
}

// Mainnet Program IDs (override via environment when deployed)
const MAINNET_PROGRAM_IDS = {
  identityRegistry: process.env.IDENTITY_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.identityRegistry,
  reputationRegistry: process.env.REPUTATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.reputationRegistry,
  validationRegistry: process.env.VALIDATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.validationRegistry,
  voteRegistry: process.env.VOTE_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.voteRegistry,
  tokenStaking: process.env.TOKEN_STAKING_PROGRAM_ID || DEVNET_PROGRAM_IDS.tokenStaking,
}

// Get program IDs based on current network
const CURRENT_PROGRAM_IDS = SOLANA_NETWORK === 'mainnet-beta' ? MAINNET_PROGRAM_IDS : DEVNET_PROGRAM_IDS

// GhostSpeak program addresses (network-aware)
const GHOSTSPEAK_PROGRAMS = {
  identityRegistry: {
    id: CURRENT_PROGRAM_IDS.identityRegistry,
    name: 'Identity Registry',
  },
  reputationRegistry: {
    id: CURRENT_PROGRAM_IDS.reputationRegistry,
    name: 'Reputation Registry',
  },
  voteRegistry: {
    id: CURRENT_PROGRAM_IDS.voteRegistry,
    name: 'Vote Registry',
  },
  validationRegistry: {
    id: CURRENT_PROGRAM_IDS.validationRegistry,
    name: 'Validation Registry',
  },
  tokenStaking: {
    id: CURRENT_PROGRAM_IDS.tokenStaking,
    name: 'Token Staking',
  },
} as const

// ==========================================
// PUBLIC QUERIES
// ==========================================

/**
 * Get all tracked program authorities
 */
export const getAllAuthorities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('programAuthorities').collect()
  },
})

/**
 * Get authority info for a specific program
 */
export const getAuthority = query({
  args: {
    programId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('programAuthorities')
      .withIndex('by_program', (q) => q.eq('programId', args.programId))
      .first()
  },
})

/**
 * Get recent authority change events
 */
export const getRecentEvents = query({
  args: {
    limit: v.optional(v.number()),
    programId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    const programId = args.programId

    if (programId) {
      return await ctx.db
        .query('authorityChangeEvents')
        .withIndex('by_program', (q) => q.eq('programId', programId))
        .order('desc')
        .take(limit)
    }

    return await ctx.db
      .query('authorityChangeEvents')
      .withIndex('by_timestamp')
      .order('desc')
      .take(limit)
  },
})

/**
 * Get unacknowledged alerts
 */
export const getUnacknowledgedAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('authorityChangeEvents')
      .withIndex('by_unalerted', (q) => q.eq('isAlerted', false))
      .collect()
  },
})

/**
 * Get pending multi-sig proposals
 */
export const getPendingProposals = query({
  args: {
    programId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const programId = args.programId

    if (programId) {
      return await ctx.db
        .query('multisigProposals')
        .withIndex('by_program', (q) => q.eq('programId', programId))
        .filter((q) =>
          q.and(q.eq(q.field('isExecuted'), false), q.gt(q.field('expiresAt'), now))
        )
        .collect()
    }

    return await ctx.db
      .query('multisigProposals')
      .withIndex('by_pending', (q) =>
        q.eq('isExecuted', false).gt('expiresAt', now)
      )
      .collect()
  },
})

/**
 * Get governance dashboard stats
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const authorities = await ctx.db.query('programAuthorities').collect()
    const pendingProposals = await ctx.db
      .query('multisigProposals')
      .filter((q) => q.eq(q.field('isExecuted'), false))
      .collect()
    const recentEvents = await ctx.db
      .query('authorityChangeEvents')
      .withIndex('by_timestamp')
      .order('desc')
      .take(10)

    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000

    const eventsLast24h = recentEvents.filter((e) => e.timestamp > dayAgo).length

    return {
      totalPrograms: authorities.length,
      immutablePrograms: authorities.filter((a) => a.isImmutable).length,
      multisigPrograms: authorities.filter((a) => a.isMultisig).length,
      pendingProposals: pendingProposals.filter((p) => p.expiresAt > now).length,
      eventsLast24h,
      programs: authorities.map((a) => ({
        programId: a.programId,
        programName: a.programName,
        isImmutable: a.isImmutable,
        isMultisig: a.isMultisig,
        upgradeAuthority: a.upgradeAuthority,
        lastCheckedAt: a.lastCheckedAt,
      })),
    }
  },
})

// ==========================================
// PUBLIC MUTATIONS
// ==========================================

/**
 * Acknowledge an alert
 */
export const acknowledgeAlert = mutation({
  args: {
    eventId: v.id('authorityChangeEvents'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('authorityChangeEvents', args.eventId, {
      acknowledgedBy: args.userId,
      acknowledgedAt: Date.now(),
    })
  },
})

// ==========================================
// INTERNAL FUNCTIONS (Cron Jobs)
// ==========================================

/**
 * Monitor all GhostSpeak program authorities (called by cron)
 */
export const monitorAllAuthorities = internalAction({
  args: {},
  handler: async (ctx) => {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

    console.log('Monitoring program authorities...')

    for (const [key, program] of Object.entries(GHOSTSPEAK_PROGRAMS)) {
      try {
        const authorityInfo = await fetchProgramAuthority(rpcUrl, program.id)

        if (authorityInfo) {
          await ctx.runMutation(internal.programGovernance.upsertAuthority, {
            programId: program.id,
            programName: program.name,
            programDataAddress: authorityInfo.programDataAddress,
            upgradeAuthority: authorityInfo.upgradeAuthority,
            isImmutable: authorityInfo.isImmutable,
            lastDeployedSlot: authorityInfo.slot,
          })
        }
      } catch (error) {
        console.error(`Error monitoring ${program.name}:`, error)
      }
    }

    console.log('Program authority monitoring complete')
  },
})

/**
 * Fetch program authority from Solana RPC
 */
async function fetchProgramAuthority(
  rpcUrl: string,
  programId: string
): Promise<{
  programDataAddress: string
  upgradeAuthority: string | null
  isImmutable: boolean
  slot: number
} | null> {
  try {
    // Derive program data address
    const programDataAddress = await deriveProgramDataAddress(programId)

    // Fetch account info
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          programDataAddress,
          { encoding: 'base64', commitment: 'confirmed' },
        ],
      }),
    })

    const result = await response.json()

    if (!result.result?.value) {
      return null
    }

    const data = Buffer.from(result.result.value.data[0], 'base64')

    // Parse program data account
    // Offset 0: 1 byte - account type (3 = ProgramData)
    // Offset 1: 8 bytes - slot when last deployed
    // Offset 9: 1 byte - option flag (1 = Some authority, 0 = None)
    // Offset 10: 32 bytes - upgrade authority (if present)

    if (data[0] !== 3) {
      return null
    }

    const slot = Number(data.readBigUInt64LE(1))
    const hasAuthority = data[9] === 1

    let upgradeAuthority: string | null = null
    if (hasAuthority) {
      // Convert bytes to base58
      upgradeAuthority = bytesToBase58(data.slice(10, 42))
    }

    return {
      programDataAddress,
      upgradeAuthority,
      isImmutable: !hasAuthority,
      slot,
    }
  } catch (error) {
    console.error('Error fetching program authority:', error)
    return null
  }
}

/**
 * Derive program data address (simplified - uses hardcoded seed derivation)
 * In production, this should use proper PDA derivation with BPF Loader
 */
async function deriveProgramDataAddress(programId: string): Promise<string> {
  // BPF Upgradeable Loader Program ID
  const BPF_LOADER = '11111111111111111111111111111111BPFLoaderUpgradeab1e'

  // For GhostSpeak programs, we can hardcode or compute PDAs
  // This is a simplified implementation
  // In production, use @solana/web3.js PublicKey.findProgramAddressSync

  // Placeholder: Return the program ID itself for now
  // Real implementation needs crypto-based PDA derivation
  return `${programId}-data`
}

/**
 * Convert bytes to Base58 (simplified)
 */
function bytesToBase58(bytes: Buffer): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const BASE = 58

  let num = BigInt('0x' + bytes.toString('hex'))
  let result = ''

  while (num > 0) {
    const remainder = Number(num % BigInt(BASE))
    num = num / BigInt(BASE)
    result = ALPHABET[remainder] + result
  }

  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result = '1' + result
    } else {
      break
    }
  }

  return result || '1'
}

/**
 * Upsert program authority (internal mutation)
 */
export const upsertAuthority = internalMutation({
  args: {
    programId: v.string(),
    programName: v.string(),
    programDataAddress: v.string(),
    upgradeAuthority: v.union(v.string(), v.null()),
    isImmutable: v.boolean(),
    lastDeployedSlot: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Check if program already exists
    const existing = await ctx.db
      .query('programAuthorities')
      .withIndex('by_program', (q) => q.eq('programId', args.programId))
      .first()

    if (existing) {
      // Check for authority change
      const authorityChanged =
        existing.upgradeAuthority !== args.upgradeAuthority ||
        existing.isImmutable !== args.isImmutable

      if (authorityChanged) {
        // Record the change event
        let eventType: 'authority_transferred' | 'made_immutable' | 'multisig_updated' =
          'authority_transferred'

        if (args.isImmutable && !existing.isImmutable) {
          eventType = 'made_immutable'
        }

        await ctx.db.insert('authorityChangeEvents', {
          programId: args.programId,
          programName: args.programName,
          eventType,
          previousAuthority: existing.upgradeAuthority,
          newAuthority: args.upgradeAuthority ?? undefined,
          slot: args.lastDeployedSlot,
          timestamp: now,
          isAlerted: false,
        })
      }

      // Update existing record
      await ctx.db.patch('programAuthorities', existing._id, {
        upgradeAuthority: args.upgradeAuthority ?? undefined,
        isImmutable: args.isImmutable,
        lastDeployedSlot: args.lastDeployedSlot,
        lastCheckedAt: now,
        updatedAt: now,
      })
    } else {
      // Create new record
      await ctx.db.insert('programAuthorities', {
        programId: args.programId,
        programName: args.programName,
        programDataAddress: args.programDataAddress,
        upgradeAuthority: args.upgradeAuthority ?? undefined,
        isImmutable: args.isImmutable,
        isMultisig: false, // Will be updated by multi-sig sync
        lastDeployedSlot: args.lastDeployedSlot,
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now,
      })

      // Record initial discovery
      await ctx.db.insert('authorityChangeEvents', {
        programId: args.programId,
        programName: args.programName,
        eventType: 'initial_discovery',
        newAuthority: args.upgradeAuthority ?? undefined,
        slot: args.lastDeployedSlot,
        timestamp: now,
        isAlerted: false,
      })
    }
  },
})

/**
 * Sync multi-sig proposals from chain (called by cron)
 */
export const syncMultisigProposals = internalAction({
  args: {},
  handler: async (ctx) => {
    // This would fetch multi-sig proposal state from the reputation registry
    // For now, we'll implement the structure for future integration

    console.log('Syncing multi-sig proposals...')

    // TODO: Implement actual Solana RPC calls to fetch proposal state
    // This requires:
    // 1. Fetch MultisigAuthority PDA
    // 2. Read proposal_count
    // 3. Fetch each proposal PDA
    // 4. Update Convex state

    console.log('Multi-sig proposal sync complete')
  },
})

/**
 * Update multi-sig proposal (internal mutation)
 */
export const upsertProposal = internalMutation({
  args: {
    programId: v.string(),
    proposalId: v.number(),
    proposalType: v.string(),
    proposer: v.string(),
    data: v.optional(v.string()),
    approvalCount: v.number(),
    threshold: v.number(),
    approvers: v.array(v.string()),
    isExecuted: v.boolean(),
    createdAt: v.number(),
    expiresAt: v.number(),
    executedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('multisigProposals')
      .withIndex('by_proposal', (q) =>
        q.eq('programId', args.programId).eq('proposalId', args.proposalId)
      )
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch('multisigProposals', existing._id, {
        ...args,
        lastSyncedAt: now,
      })
    } else {
      await ctx.db.insert('multisigProposals', {
        ...args,
        lastSyncedAt: now,
      })
    }
  },
})

/**
 * Get internal authority record
 */
export const getAuthorityInternal = internalQuery({
  args: {
    programId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('programAuthorities')
      .withIndex('by_program', (q) => q.eq('programId', args.programId))
      .first()
  },
})
