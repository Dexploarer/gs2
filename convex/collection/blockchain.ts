/**
 * Blockchain Data Collection (Solana)
 *
 * Syncs agent reputation, votes, and identity data from Solana programs.
 * Uses Helius API for transaction parsing and RPC access.
 *
 * Architecture:
 * - Solana = Source of truth (blockchain programs)
 * - Helius = Enhanced transaction parsing and RPC
 * - Convex = Fast cache layer (queryable database)
 * - Sync = Periodic background updates
 */

import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet'

// Get network from environment (Convex uses process.env directly)
const SOLANA_NETWORK: SolanaNetwork =
  (process.env.SOLANA_CLUSTER as SolanaNetwork) || 'devnet'

const IS_MAINNET = SOLANA_NETWORK === 'mainnet-beta'

// Helius API Configuration (network-aware)
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '6be013f8-b6f7-4599-b4ec-02198d5ff34e'
const HELIUS_RPC_URL = IS_MAINNET
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const HELIUS_ENHANCED_API = IS_MAINNET
  ? `https://api-mainnet.helius-rpc.com/v0`
  : `https://api-devnet.helius-rpc.com/v0`

// Fallback RPC URL for standard Solana RPC
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || (IS_MAINNET
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com')

// ============================================================================
// PROGRAM IDS (Network-aware, must match lib/solana/programs.ts)
// ============================================================================

// Devnet Program IDs
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
const PROGRAM_IDS = IS_MAINNET ? MAINNET_PROGRAM_IDS : DEVNET_PROGRAM_IDS

const IDENTITY_REGISTRY_PROGRAM_ID = PROGRAM_IDS.identityRegistry
const REPUTATION_REGISTRY_PROGRAM_ID = PROGRAM_IDS.reputationRegistry
const VALIDATION_REGISTRY_PROGRAM_ID = PROGRAM_IDS.validationRegistry
const VOTE_REGISTRY_PROGRAM_ID = PROGRAM_IDS.voteRegistry
const TOKEN_STAKING_PROGRAM_ID = PROGRAM_IDS.tokenStaking

// Types for Helius Enhanced Transaction API
interface HeliusEnhancedTransaction {
  signature: string
  slot: number
  timestamp: number
  type: string
  source: string
  fee: number
  feePayer: string
  description?: string
  accountData?: Array<{
    account: string
    nativeBalanceChange: number
    tokenBalanceChanges: Array<{
      mint: string
      rawTokenAmount: {
        tokenAmount: string
        decimals: number
      }
      userAccount: string
    }>
  }>
  nativeTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
  tokenTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    fromTokenAccount: string
    toTokenAccount: string
    tokenAmount: number
    mint: string
  }>
  instructions?: Array<{
    programId: string
    data: string
    accounts: string[]
    innerInstructions?: Array<{
      programId: string
      data: string
      accounts: string[]
    }>
  }>
}

/**
 * Fetch enhanced transactions for an address from Helius
 */
async function fetchEnhancedTransactions(
  address: string,
  options: { limit?: number; beforeSignature?: string; afterTime?: number } = {}
): Promise<HeliusEnhancedTransaction[]> {
  const url = new URL(`${HELIUS_ENHANCED_API}/addresses/${address}/transactions`)
  url.searchParams.set('api-key', HELIUS_API_KEY)

  if (options.limit) {
    url.searchParams.set('limit', String(options.limit))
  }
  if (options.beforeSignature) {
    url.searchParams.set('before-signature', options.beforeSignature)
  }
  if (options.afterTime) {
    url.searchParams.set('gte-time', String(options.afterTime))
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Helius API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch program accounts from Solana via Helius RPC
 */
async function fetchProgramAccounts(
  programId: string,
  filters?: Array<{ memcmp?: { offset: number; bytes: string }; dataSize?: number }>
): Promise<Array<{ pubkey: string; account: { data: string; owner: string; lamports: number } }>> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getProgramAccounts',
      params: [
        programId,
        {
          encoding: 'base64',
          filters: filters || [],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Helius RPC error: ${data.error.message}`)
  }

  return data.result || []
}

/**
 * Parse reputation account data from base64 encoded buffer
 * Layout: [8 bytes discriminator][32 bytes authority][32 bytes agent][8 bytes score][8 bytes totalVotes][8 bytes upvotes][8 bytes downvotes][8 bytes lastUpdated]
 */
function parseReputationAccountData(base64Data: string): {
  authority: string
  agent: string
  score: number
  totalVotes: number
  upvotes: number
  downvotes: number
  lastUpdated: number
} | null {
  try {
    const buffer = Buffer.from(base64Data, 'base64')

    // Skip 8-byte discriminator
    let offset = 8

    // Read authority (32 bytes)
    const authorityBytes = buffer.slice(offset, offset + 32)
    const authority = encodeBase58(authorityBytes)
    offset += 32

    // Read agent (32 bytes)
    const agentBytes = buffer.slice(offset, offset + 32)
    const agent = encodeBase58(agentBytes)
    offset += 32

    // Read score (u64 - 8 bytes, little endian)
    const score = Number(buffer.readBigUInt64LE(offset))
    offset += 8

    // Read totalVotes (u64 - 8 bytes)
    const totalVotes = Number(buffer.readBigUInt64LE(offset))
    offset += 8

    // Read upvotes (u64 - 8 bytes)
    const upvotes = Number(buffer.readBigUInt64LE(offset))
    offset += 8

    // Read downvotes (u64 - 8 bytes)
    const downvotes = Number(buffer.readBigUInt64LE(offset))
    offset += 8

    // Read lastUpdated (i64 - 8 bytes)
    const lastUpdated = Number(buffer.readBigInt64LE(offset))

    return { authority, agent, score, totalVotes, upvotes, downvotes, lastUpdated }
  } catch (error) {
    console.error('[Blockchain] Failed to parse reputation account:', error)
    return null
  }
}

/**
 * Parse vote account data from base64 encoded buffer
 */
function parseVoteAccountData(base64Data: string): {
  voter: string
  subject: string
  voteType: 'upvote' | 'downvote'
  qualityScore: number
  timestamp: number
} | null {
  try {
    const buffer = Buffer.from(base64Data, 'base64')

    // Skip 8-byte discriminator
    let offset = 8

    // Read voter (32 bytes)
    const voterBytes = buffer.slice(offset, offset + 32)
    const voter = encodeBase58(voterBytes)
    offset += 32

    // Read subject (32 bytes)
    const subjectBytes = buffer.slice(offset, offset + 32)
    const subject = encodeBase58(subjectBytes)
    offset += 32

    // Read voteType (1 byte: 0 = upvote, 1 = downvote)
    const voteTypeValue = buffer.readUInt8(offset)
    const voteType = voteTypeValue === 0 ? 'upvote' : 'downvote'
    offset += 1

    // Read qualityScore (u8 - 1 byte, 0-100)
    const qualityScore = buffer.readUInt8(offset)
    offset += 1

    // Padding to align to 8 bytes
    offset += 6

    // Read timestamp (i64 - 8 bytes)
    const timestamp = Number(buffer.readBigInt64LE(offset))

    return { voter, subject, voteType, qualityScore, timestamp }
  } catch (error) {
    console.error('[Blockchain] Failed to parse vote account:', error)
    return null
  }
}

/**
 * Base58 encoding for Solana addresses
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function encodeBase58(bytes: Buffer): string {
  const digits = [0]

  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }

  // Handle leading zeros
  let result = ''
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += BASE58_ALPHABET[0]
  }

  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]]
  }

  return result
}

// ========================================
// AGENT SYNC
// ========================================

/**
 * Sync all agents from Solana Reputation Registry
 * Called by cron every 5 minutes
 *
 * Steps:
 * 1. Fetches all reputation PDAs from Solana via Helius RPC
 * 2. Parses on-chain data (reputation score, vote counts)
 * 3. Updates or creates agents using unified upsert
 * 4. Calculates Ghost Score from reputation
 */
export const syncAllAgents = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: boolean; reason?: string; synced?: number; created?: number; updated?: number; errors?: number }> => {
    const startTime = Date.now()

    // Check if collection is already running
    const isRunning = await ctx.runQuery(internal.collection.state.isRunning, {
      collectorName: 'blockchain',
    })

    if (isRunning) {
      console.log('[Blockchain] Agent sync already running, skipping')
      return { skipped: true, reason: 'already_running' }
    }

    // Start collection
    await ctx.runMutation(internal.collection.state.startCollection, {
      collectorName: 'blockchain',
    })

    console.log('[Blockchain] Starting Solana → Convex agent sync via Helius...')
    console.log(`[Blockchain] Program IDs:`)
    console.log(`  - Reputation: ${REPUTATION_REGISTRY_PROGRAM_ID}`)
    console.log(`  - Vote: ${VOTE_REGISTRY_PROGRAM_ID}`)
    console.log(`  - Identity: ${IDENTITY_REGISTRY_PROGRAM_ID}`)

    let synced = 0
    let created = 0
    let updated = 0
    let errors = 0

    try {
      // Fetch all reputation accounts from Solana via Helius RPC
      console.log('[Blockchain] Fetching reputation accounts from Solana...')
      const reputationAccounts = await fetchProgramAccounts(REPUTATION_REGISTRY_PROGRAM_ID)
      console.log(`[Blockchain] Found ${reputationAccounts.length} reputation accounts`)

      // Process each reputation account
      for (const { pubkey, account } of reputationAccounts) {
        try {
          // Parse the account data
          const reputationData = parseReputationAccountData(account.data)

          if (!reputationData) {
            console.warn(`[Blockchain] Failed to parse reputation account: ${pubkey}`)
            errors++
            continue
          }

          // Calculate average quality from upvotes/downvotes
          const averageQuality =
            reputationData.totalVotes > 0
              ? (reputationData.upvotes / reputationData.totalVotes) * 100
              : 50

          // Upsert agent using the mutation
          const result = await ctx.runMutation(internal.collection.blockchain.upsertAgentFromSolana, {
            address: reputationData.agent,
            reputation: reputationData.score,
            totalVotes: reputationData.totalVotes,
            upvotes: reputationData.upvotes,
            downvotes: reputationData.downvotes,
            averageQuality,
            lastUpdatedOnChain: reputationData.lastUpdated,
          })

          synced++
          if (result.created) created++
          if (result.updated) updated++

          // Log progress every 100 agents
          if (synced % 100 === 0) {
            console.log(`[Blockchain] Progress: ${synced} agents synced (${created} created, ${updated} updated)`)
          }
        } catch (error) {
          console.error(`[Blockchain] Error processing reputation account ${pubkey}:`, error)
          errors++
        }
      }

      // Also sync agents from recent transactions if no program accounts found
      // (useful for discovering new agents that have transacted)
      if (reputationAccounts.length === 0) {
        console.log('[Blockchain] No program accounts found, trying alternative discovery...')
        await syncAgentsFromRecentTransactions(ctx)
      }

      console.log(`[Blockchain] Agent sync complete: ${synced} synced, ${created} created, ${updated} updated, ${errors} errors`)

      // Complete collection
      const durationMs = Date.now() - startTime
      await ctx.runMutation(internal.collection.state.completeCollection, {
        collectorName: 'blockchain',
        itemsCollected: synced,
        itemsSkipped: errors,
        durationMs,
      })
    } catch (error) {
      console.error('[Blockchain] Agent sync failed:', error)
      await ctx.runMutation(internal.collection.state.failCollection, {
        collectorName: 'blockchain',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      errors++
    }

    return { synced, created, updated, errors }
  },
})

/**
 * Alternative agent discovery from recent transactions
 * Used when program accounts are empty (e.g., devnet testing)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncAgentsFromRecentTransactions(ctx: any) {
  // Get existing agents from database
  const existingAgents = (await ctx.runQuery(internal.collection.blockchain.getAllAgents, {})) as Array<{
    address: string
    _id: string
  }>

  console.log(`[Blockchain] Checking ${existingAgents.length} existing agents for recent activity...`)

  for (const agent of existingAgents.slice(0, 50)) {
    // Limit to 50 to avoid rate limits
    try {
      // Fetch recent transactions for this agent
      const transactions = await fetchEnhancedTransactions(agent.address, { limit: 10 })

      if (transactions.length > 0) {
        // Calculate activity-based reputation
        const successfulTxns = transactions.filter((tx) => tx.type !== 'FAILED')
        const failedTxns = transactions.length - successfulTxns.length

        const reputation = Math.min(500 + successfulTxns.length * 10 - failedTxns * 20, 1000)
        const totalVotes = transactions.length
        const upvotes = successfulTxns.length
        const downvotes = failedTxns
        const averageQuality = totalVotes > 0 ? (upvotes / totalVotes) * 100 : 50

        await ctx.runMutation(internal.collection.blockchain.upsertAgentFromSolana, {
          address: agent.address,
          reputation,
          totalVotes,
          upvotes,
          downvotes,
          averageQuality,
          lastUpdatedOnChain: transactions[0]?.timestamp || Date.now(),
        })

        console.log(`[Blockchain] Updated agent ${agent.address.slice(0, 8)}... from ${transactions.length} transactions`)
      }
    } catch (error) {
      console.error(`[Blockchain] Failed to fetch transactions for ${agent.address}:`, error)
    }
  }
}

/**
 * Upsert agent from Solana reputation data
 * Uses the unified agent upsert function
 */
export const upsertAgentFromSolana = internalMutation({
  args: {
    address: v.string(),
    reputation: v.number(),
    totalVotes: v.number(),
    upvotes: v.number(),
    downvotes: v.number(),
    averageQuality: v.number(),
    lastUpdatedOnChain: v.number(),
  },
  handler: async (ctx, args): Promise<{ agentId: unknown; created: boolean; updated: boolean }> => {
    // Calculate Ghost Score (0-1000 scale)
    const ghostScore = calculateGhostScore(args.reputation, args.totalVotes, args.averageQuality)
    const tier = getScoreTier(ghostScore)

    // Use unified agent upsert
    const result = await ctx.runMutation(internal.entities.agents.upsert, {
      address: args.address,
      name: `Agent ${args.address.slice(0, 8)}...`,
      description: 'Discovered via Solana sync',
      source: 'solana',
      ghostScore,
      tier,
      skipScoreUpdate: false, // Allow score update from Solana
    })

    // Record sync event in score history if this is an update
    if (!result.created && result.updated) {
      const agentId = result.agentId as import('../_generated/dataModel').Id<'agents'>
      await ctx.db.insert('scoreHistory', {
        agentId,
        score: ghostScore,
        tier,
        reason: 'Solana reputation sync',
        timestamp: Date.now(),
      })
    }

    return result
  },
})

// ========================================
// VOTE SYNC
// ========================================

/**
 * Sync recent votes from Solana Vote Registry
 * Called by cron every 5 minutes
 *
 * Steps:
 * 1. Fetches vote accounts from Solana via Helius RPC
 * 2. Parses on-chain vote data
 * 3. Creates reputation votes in Convex
 */
export const syncRecentVotes = internalAction({
  args: {},
  handler: async (ctx): Promise<{ synced: number; since: number; errors: number }> => {
    console.log('[Blockchain] Starting Solana → Convex vote sync via Helius...')

    const lastSync = await ctx.runQuery(internal.collection.state.getLastCollectionTime, {
      collectorName: 'blockchain',
    })

    // Only sync votes from the last sync time (or last 24 hours if first run)
    const since = lastSync || Date.now() - 24 * 60 * 60 * 1000
    console.log(`[Blockchain] Syncing votes since: ${new Date(since).toISOString()}`)

    let synced = 0
    let errors = 0

    try {
      // Fetch vote accounts from Vote Registry program
      console.log('[Blockchain] Fetching vote accounts from Solana...')
      const voteAccounts = await fetchProgramAccounts(VOTE_REGISTRY_PROGRAM_ID)
      console.log(`[Blockchain] Found ${voteAccounts.length} vote accounts`)

      // Process each vote account
      for (const { pubkey, account } of voteAccounts) {
        try {
          // Parse the vote account data
          const voteData = parseVoteAccountData(account.data)

          if (!voteData) {
            console.warn(`[Blockchain] Failed to parse vote account: ${pubkey}`)
            errors++
            continue
          }

          // Skip votes older than our sync window
          if (voteData.timestamp < since) {
            continue
          }

          // Check if vote already exists (by looking up the subject agent and voter combo)
          const existingVote = await ctx.runQuery(internal.collection.blockchain.checkVoteExists, {
            voterAddress: voteData.voter,
            subjectAddress: voteData.subject,
            timestamp: voteData.timestamp,
          })

          if (existingVote) {
            console.log(`[Blockchain] Vote already exists, skipping: ${pubkey}`)
            continue
          }

          // Get or create the subject agent
          let subjectAgentId: import('../_generated/dataModel').Id<'agents'>
          const existingSubject = await ctx.runQuery(internal.collection.blockchain.getAgentByAddress, {
            address: voteData.subject,
          })

          if (!existingSubject) {
            // Create the subject agent if it doesn't exist
            const result = await ctx.runMutation(internal.collection.blockchain.upsertAgentFromSolana, {
              address: voteData.subject,
              reputation: 500,
              totalVotes: 0,
              upvotes: 0,
              downvotes: 0,
              averageQuality: 50,
              lastUpdatedOnChain: Date.now(),
            })
            subjectAgentId = result.agentId as import('../_generated/dataModel').Id<'agents'>
          } else {
            subjectAgentId = existingSubject._id
          }

          // Create the vote
          await ctx.runMutation(internal.collection.blockchain.createVoteFromSolana, {
            voterAddress: voteData.voter,
            agentId: subjectAgentId,
            voteType: voteData.voteType,
            qualityScores: {
              responseQuality: voteData.qualityScore,
              responseSpeed: voteData.qualityScore,
              accuracy: voteData.qualityScore,
              professionalism: voteData.qualityScore,
              average: voteData.qualityScore,
            },
            timestamp: voteData.timestamp,
            signature: pubkey,
          })

          synced++

          // Log progress every 50 votes
          if (synced % 50 === 0) {
            console.log(`[Blockchain] Progress: ${synced} votes synced`)
          }
        } catch (error) {
          console.error(`[Blockchain] Error processing vote account ${pubkey}:`, error)
          errors++
        }
      }

      // If no program accounts, try to extract votes from transaction history
      if (voteAccounts.length === 0) {
        console.log('[Blockchain] No vote accounts found, trying transaction-based discovery...')
        const txnVotes = await syncVotesFromTransactions(ctx, since)
        synced += txnVotes.synced
        errors += txnVotes.errors
      }

      console.log(`[Blockchain] Vote sync complete: ${synced} synced, ${errors} errors`)
    } catch (error) {
      console.error('[Blockchain] Vote sync failed:', error)
      errors++
    }

    return { synced, since, errors }
  },
})

/**
 * Check if a vote already exists
 */
export const checkVoteExists = internalQuery({
  args: {
    voterAddress: v.string(),
    subjectAddress: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Get voter agent
    const voter = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.voterAddress))
      .first()

    if (!voter) return false

    // Get subject agent
    const subject = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.subjectAddress))
      .first()

    if (!subject) return false

    // Check for existing vote with same voter, subject, and approximate timestamp
    const existingVotes = await ctx.db
      .query('reputationVotes')
      .withIndex('by_voter', (q) => q.eq('voterAgentId', voter._id))
      .filter((q) =>
        q.and(
          q.eq(q.field('subjectAgentId'), subject._id),
          q.gte(q.field('timestamp'), args.timestamp - 60000), // Within 1 minute
          q.lte(q.field('timestamp'), args.timestamp + 60000)
        )
      )
      .first()

    return existingVotes !== null
  },
})

/**
 * Discover votes from transaction history
 * Parses x402 payment transactions to infer vote-like behavior
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncVotesFromTransactions(ctx: any, since: number): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  // Get existing agents to check their transaction history
  const agents = (await ctx.runQuery(internal.collection.blockchain.getAllAgents, {})) as Array<{
    address: string
    _id: string
  }>

  console.log(`[Blockchain] Scanning transactions for ${Math.min(agents.length, 20)} agents...`)

  for (const agent of agents.slice(0, 20)) {
    // Limit to avoid rate limits
    try {
      // Fetch transactions that might indicate voting behavior
      const transactions = await fetchEnhancedTransactions(agent.address, {
        limit: 50,
        afterTime: since,
      })

      // Look for transactions that match voting patterns
      // (transfers to specific program addresses, specific instruction patterns)
      for (const tx of transactions) {
        if (!tx.instructions) continue

        // Check if any instruction is to the Vote Registry
        const voteInstruction = tx.instructions.find((ix) => ix.programId === VOTE_REGISTRY_PROGRAM_ID)

        if (voteInstruction && voteInstruction.accounts.length >= 2) {
          // This looks like a vote transaction
          const voterAddress = voteInstruction.accounts[0]
          const subjectAddress = voteInstruction.accounts[1]

          // Skip if voter is not the current agent
          if (voterAddress !== agent.address) continue

          // Get or create subject agent
          let subjectAgentId: import('../_generated/dataModel').Id<'agents'>
          const existingSubject = (await ctx.runQuery(internal.collection.blockchain.getAgentByAddress, {
            address: subjectAddress,
          })) as { _id: import('../_generated/dataModel').Id<'agents'>; address: string } | null

          if (!existingSubject) {
            const result = (await ctx.runMutation(internal.collection.blockchain.upsertAgentFromSolana, {
              address: subjectAddress,
              reputation: 500,
              totalVotes: 0,
              upvotes: 0,
              downvotes: 0,
              averageQuality: 50,
              lastUpdatedOnChain: tx.timestamp,
            })) as { agentId: import('../_generated/dataModel').Id<'agents'> }
            subjectAgentId = result.agentId
          } else {
            subjectAgentId = existingSubject._id
          }

          // Determine vote type from instruction data (first byte after discriminator)
          // This is a simplified heuristic - actual implementation depends on program design
          const voteType: 'upvote' | 'downvote' =
            tx.type === 'TRANSFER' && (tx.nativeTransfers?.length ?? 0) > 0 ? 'upvote' : 'downvote'

          await ctx.runMutation(internal.collection.blockchain.createVoteFromSolana, {
            voterAddress,
            agentId: subjectAgentId,
            voteType,
            qualityScores: {
              responseQuality: 75,
              responseSpeed: 75,
              accuracy: 75,
              professionalism: 75,
              average: 75,
            },
            timestamp: tx.timestamp,
            signature: tx.signature,
          })

          synced++
        }
      }
    } catch (error) {
      console.error(`[Blockchain] Failed to scan transactions for ${agent.address}:`, error)
      errors++
    }
  }

  return { synced, errors }
}

/**
 * Create vote from Solana data
 */
export const createVoteFromSolana = internalMutation({
  args: {
    voterAddress: v.string(),
    agentId: v.id('agents'),
    voteType: v.union(v.literal('upvote'), v.literal('downvote')),
    qualityScores: v.object({
      responseQuality: v.number(),
      responseSpeed: v.number(),
      accuracy: v.number(),
      professionalism: v.number(),
      average: v.number(),
    }),
    timestamp: v.number(),
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    // Use unified agent upsert for voter
    const voterResult = await ctx.runMutation(internal.entities.agents.upsert, {
      address: args.voterAddress,
      name: `Voter ${args.voterAddress.slice(0, 8)}...`,
      description: 'Voter discovered via Solana sync',
      source: 'solana',
    })

    // Get voter's Ghost Score for weight calculation
    const voterAgentId = voterResult.agentId as import('../_generated/dataModel').Id<'agents'>
    const voter = await ctx.db.get(voterAgentId)
    const voterGhostScore = voter?.ghostScore ?? 500

    // Map vote type to reputation vote type
    const mappedVoteType = args.voteType === 'upvote' ? 'trustworthy' : 'untrustworthy'

    // Create reputation vote
    return await ctx.db.insert('reputationVotes', {
      voterAgentId,
      voterGhostScore,
      subjectType: 'agent',
      subjectAgentId: args.agentId,
      voteType: mappedVoteType,
      weight: calculateVoteWeight(voterGhostScore),
      isActive: true,
      timestamp: args.timestamp,
    })
  },
})

// ========================================
// STATISTICS UPDATE
// ========================================

/**
 * Update agent statistics from vote data
 * Called periodically to keep stats in sync
 */
export const updateAgentStatistics = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    console.log('[Blockchain] Updating agent statistics...')

    // Use a combined mutation to avoid recursive type issues
    const result = await ctx.runMutation(internal.collection.blockchain.computeAndUpdateStatistics, {})

    console.log(`[Blockchain] Updated statistics for ${result.updated} agents`)
    return { updated: result.updated }
  },
})

/**
 * Combined mutation to compute and update statistics
 * This avoids the recursive type issue from action -> query -> mutation chains
 */
export const computeAndUpdateStatistics = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    const agents = await ctx.db.query('agents').collect()
    let updated = 0

    for (const agent of agents) {
      const votes = await ctx.db
        .query('reputationVotes')
        .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', agent._id))
        .collect()

      if (votes.length > 0) {
        const upvotes = votes.filter((v) => v.voteType === 'trustworthy').length
        const downvotes = votes.length - upvotes

        const profile = await ctx.db
          .query('agentProfiles')
          .withIndex('by_agent', (q) => q.eq('agentId', agent._id))
          .first()

        if (profile) {
          await ctx.db.patch(profile._id, {
            totalRequests: profile.totalRequests + votes.length,
            successfulRequests: profile.successfulRequests + upvotes,
            failedRequests: profile.failedRequests + downvotes,
            profileUpdatedAt: Date.now(),
          })
          updated++
        }
      }
    }

    return { updated }
  },
})

// ========================================
// QUERY HELPERS
// ========================================

/**
 * Get all agents
 */
export const getAllAgents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('agents').collect()
  },
})

/**
 * Get agent by address
 */
export const getAgentByAddress = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.address))
      .first()
  },
})

/**
 * Get votes for an agent
 */
export const getAgentVotes = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('reputationVotes')
      .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.agentId))
      .collect()
  },
})

/**
 * Get agent profile
 */
export const getAgentProfile = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentProfiles')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first()
  },
})

/**
 * Update agent profile stats
 */
export const updateAgentProfileStats = internalMutation({
  args: {
    profileId: v.id('agentProfiles'),
    totalRequests: v.number(),
    successfulRequests: v.number(),
    failedRequests: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      totalRequests: args.totalRequests,
      successfulRequests: args.successfulRequests,
      failedRequests: args.failedRequests,
      profileUpdatedAt: Date.now(),
    })
  },
})

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate Ghost Score from reputation data
 */
function calculateGhostScore(reputation: number, totalVotes: number, averageQuality: number): number {
  // Base score from reputation (0-1000)
  const baseScore = Math.min(reputation, 1000)

  // Adjust based on vote count (more votes = more trustworthy)
  const voteBonus = Math.min(totalVotes * 5, 100)

  // Adjust based on quality (0-100 scale)
  const qualityFactor = averageQuality / 100

  const finalScore = Math.min((baseScore + voteBonus) * qualityFactor, 1000)

  return Math.round(finalScore)
}

/**
 * Get score tier based on Ghost Score
 */
function getScoreTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (score >= 900) return 'platinum'
  if (score >= 750) return 'gold'
  if (score >= 500) return 'silver'
  return 'bronze'
}

/**
 * Calculate vote weight based on voter's Ghost Score
 */
function calculateVoteWeight(ghostScore: number): number {
  // Higher Ghost Score = more weight
  // Bronze (0-499): 1x
  // Silver (500-749): 1.5x
  // Gold (750-899): 2x
  // Platinum (900-1000): 3x
  if (ghostScore >= 900) return 3
  if (ghostScore >= 750) return 2
  if (ghostScore >= 500) return 1.5
  return 1
}
