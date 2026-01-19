/**
 * Token Staking Functions (BYOT - Bring Your Own Token)
 *
 * Allows agents/merchants to register their own SPL tokens for staking-based attestations.
 * Stakers can stake tokens on agents to signal trust with economic commitment.
 */

import { query, mutation, internalMutation, internalQuery, action, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// ==========================================
// STAKING TOKEN REGISTRATION
// ==========================================

/**
 * Register a new staking token for an agent or merchant
 */
export const registerToken = mutation({
  args: {
    agentId: v.optional(v.id('agents')),
    merchantId: v.optional(v.id('merchants')),
    tokenMint: v.string(),
    tokenSymbol: v.string(),
    tokenName: v.string(),
    tokenDecimals: v.number(),
    minStakeAmount: v.number(),
    lockPeriodSeconds: v.number(),
    weightMultiplier: v.optional(v.number()),
    vaultAddress: v.optional(v.string()),
    vaultType: v.union(
      v.literal('pda'),
      v.literal('token_account'),
      v.literal('external')
    ),
  },
  handler: async (ctx, args) => {
    // Must have either agentId or merchantId
    if (!args.agentId && !args.merchantId) {
      throw new Error('Must specify either agentId or merchantId')
    }

    // Check if token is already registered for this owner
    const existing = await ctx.db
      .query('stakingTokens')
      .withIndex('by_token_mint', (q) => q.eq('tokenMint', args.tokenMint))
      .filter((q) =>
        args.agentId
          ? q.eq(q.field('agentId'), args.agentId)
          : q.eq(q.field('merchantId'), args.merchantId)
      )
      .first()

    if (existing) {
      throw new Error('Token already registered for this owner')
    }

    const now = Date.now()

    const tokenId = await ctx.db.insert('stakingTokens', {
      agentId: args.agentId,
      merchantId: args.merchantId,
      tokenMint: args.tokenMint,
      tokenSymbol: args.tokenSymbol,
      tokenName: args.tokenName,
      tokenDecimals: args.tokenDecimals,
      minStakeAmount: args.minStakeAmount,
      lockPeriodSeconds: args.lockPeriodSeconds,
      weightMultiplier: args.weightMultiplier ?? 1,
      vaultAddress: args.vaultAddress,
      vaultType: args.vaultType,
      isActive: true,
      isVerified: false,
      totalStaked: 0,
      stakerCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    return tokenId
  },
})

/**
 * Get staking token by mint address
 */
export const getByMint = query({
  args: { tokenMint: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stakingTokens')
      .withIndex('by_token_mint', (q) => q.eq('tokenMint', args.tokenMint))
      .first()
  },
})

/**
 * Get staking tokens for an agent
 */
export const getForAgent = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stakingTokens')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()
  },
})

/**
 * List all active staking tokens
 */
export const listActive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query('stakingTokens')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .take(args.limit ?? 50)

    // Enrich with owner data
    return await Promise.all(
      tokens.map(async (token) => {
        let owner = null
        if (token.agentId) {
          const agent = await ctx.db.get('agents', token.agentId)
          owner = agent ? { type: 'agent', name: agent.name, address: agent.address } : null
        } else if (token.merchantId) {
          const merchant = await ctx.db.get('merchants', token.merchantId)
          owner = merchant ? { type: 'merchant', name: merchant.name } : null
        }
        return { ...token, owner }
      })
    )
  },
})

// ==========================================
// STAKE MANAGEMENT
// ==========================================

/**
 * Record a new stake (called after on-chain transaction)
 */
export const recordStake = mutation({
  args: {
    stakerAddress: v.string(),
    stakerAgentId: v.optional(v.id('agents')),
    targetAgentId: v.optional(v.id('agents')),
    targetMerchantId: v.optional(v.id('merchants')),
    stakingTokenId: v.id('stakingTokens'),
    amount: v.number(),
    amountRaw: v.string(),
    attestationType: v.union(
      v.literal('endorsement'),
      v.literal('quality'),
      v.literal('reliability'),
      v.literal('capability'),
      v.literal('security'),
      v.literal('general')
    ),
    txSignature: v.string(),
    stakeAccountAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the staking token config
    const stakingToken = await ctx.db.get('stakingTokens', args.stakingTokenId)
    if (!stakingToken) {
      throw new Error('Staking token not found')
    }

    if (!stakingToken.isActive) {
      throw new Error('Staking token is not active')
    }

    // Check minimum stake
    if (args.amount < stakingToken.minStakeAmount) {
      throw new Error(`Minimum stake is ${stakingToken.minStakeAmount} ${stakingToken.tokenSymbol}`)
    }

    const now = Date.now()
    const lockedUntil = now + stakingToken.lockPeriodSeconds * 1000

    // Calculate trust weight based on amount and multiplier
    // Weight = log2(amount + 1) * multiplier (diminishing returns)
    const trustWeight = Math.log2(args.amount + 1) * stakingToken.weightMultiplier

    // Create the stake record
    const stakeId = await ctx.db.insert('tokenStakes', {
      stakerAddress: args.stakerAddress,
      stakerAgentId: args.stakerAgentId,
      targetAgentId: args.targetAgentId,
      targetMerchantId: args.targetMerchantId,
      stakingTokenId: args.stakingTokenId,
      tokenMint: stakingToken.tokenMint,
      amount: args.amount,
      amountRaw: args.amountRaw,
      attestationType: args.attestationType,
      stakedAt: now,
      lockedUntil,
      txSignature: args.txSignature,
      stakeAccountAddress: args.stakeAccountAddress,
      trustWeight,
      status: 'active',
    })

    // Record the staking event
    await ctx.db.insert('stakingEvents', {
      stakeId,
      eventType: 'staked',
      amount: args.amount,
      txSignature: args.txSignature,
      timestamp: now,
    })

    // Update staking token totals
    const existingStakers = await ctx.db
      .query('tokenStakes')
      .withIndex('by_token', (q) => q.eq('stakingTokenId', args.stakingTokenId))
      .filter((q) => q.eq(q.field('stakerAddress'), args.stakerAddress))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect()

    const isNewStaker = existingStakers.length === 1 // Just this one

    await ctx.db.patch(args.stakingTokenId, {
      totalStaked: stakingToken.totalStaked + args.amount,
      stakerCount: isNewStaker ? stakingToken.stakerCount + 1 : stakingToken.stakerCount,
      updatedAt: now,
    })

    // Create trust relationship based on stake
    if (args.targetAgentId && args.stakerAgentId) {
      await ctx.runMutation(internal.trustGraph.upsertRelationshipInternal, {
        fromAgentId: args.stakerAgentId,
        toAgentId: args.targetAgentId,
        relationshipType: 'endorsement',
        directWeight: Math.min(100, trustWeight * 10), // Scale to 0-100
        categories: [args.attestationType],
        sourceEndorsementId: stakeId,
      })
    }

    return stakeId
  },
})

/**
 * Record an unstake (called after on-chain transaction)
 */
export const recordUnstake = mutation({
  args: {
    stakeId: v.id('tokenStakes'),
    txSignature: v.string(),
  },
  handler: async (ctx, args) => {
    const stake = await ctx.db.get('tokenStakes', args.stakeId)
    if (!stake) {
      throw new Error('Stake not found')
    }

    if (stake.status !== 'active' && stake.status !== 'unlocking') {
      throw new Error('Stake is not active')
    }

    const now = Date.now()

    // Check if still locked
    if (now < stake.lockedUntil) {
      throw new Error('Stake is still locked')
    }

    // Update stake status
    await ctx.db.patch(args.stakeId, {
      status: 'unstaked',
      unstakedAt: now,
    })

    // Record event
    await ctx.db.insert('stakingEvents', {
      stakeId: args.stakeId,
      eventType: 'unstaked',
      amount: stake.amount,
      txSignature: args.txSignature,
      timestamp: now,
    })

    // Update staking token totals
    const stakingToken = await ctx.db.get('stakingTokens', stake.stakingTokenId)
    if (stakingToken) {
      // Check if staker has other active stakes
      const otherStakes = await ctx.db
        .query('tokenStakes')
        .withIndex('by_token', (q) => q.eq('stakingTokenId', stake.stakingTokenId))
        .filter((q) => q.eq(q.field('stakerAddress'), stake.stakerAddress))
        .filter((q) => q.eq(q.field('status'), 'active'))
        .collect()

      await ctx.db.patch(stake.stakingTokenId, {
        totalStaked: Math.max(0, stakingToken.totalStaked - stake.amount),
        stakerCount: otherStakes.length === 0 ? Math.max(0, stakingToken.stakerCount - 1) : stakingToken.stakerCount,
        updatedAt: now,
      })
    }

    // Deactivate trust relationship
    if (stake.targetAgentId && stake.stakerAgentId) {
      await ctx.runMutation(internal.trustGraph.deactivateRelationshipInternal, {
        fromAgentId: stake.stakerAgentId,
        toAgentId: stake.targetAgentId,
        relationshipType: 'endorsement',
      })
    }

    return args.stakeId
  },
})

/**
 * Get stakes for a target agent
 */
export const getStakesForAgent = query({
  args: {
    targetAgentId: v.id('agents'),
    status: v.optional(v.union(
      v.literal('active'),
      v.literal('unlocking'),
      v.literal('unstaked'),
      v.literal('slashed')
    )),
  },
  handler: async (ctx, args) => {
    let stakes = await ctx.db
      .query('tokenStakes')
      .withIndex('by_target_agent', (q) => q.eq('targetAgentId', args.targetAgentId))
      .collect()

    if (args.status) {
      stakes = stakes.filter((s) => s.status === args.status)
    }

    // Enrich with staker info
    return await Promise.all(
      stakes.map(async (stake) => {
        const stakingToken = await ctx.db.get('stakingTokens', stake.stakingTokenId)
        let staker = null
        if (stake.stakerAgentId) {
          const agent = await ctx.db.get('agents', stake.stakerAgentId)
          staker = agent ? { name: agent.name, address: agent.address, ghostScore: agent.ghostScore } : null
        }
        return {
          ...stake,
          token: stakingToken ? {
            symbol: stakingToken.tokenSymbol,
            name: stakingToken.tokenName,
          } : null,
          staker,
        }
      })
    )
  },
})

/**
 * Get stakes made by a staker
 */
export const getStakesByStaker = query({
  args: {
    stakerAddress: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let stakes = await ctx.db
      .query('tokenStakes')
      .withIndex('by_staker', (q) => q.eq('stakerAddress', args.stakerAddress))
      .collect()

    if (args.status) {
      stakes = stakes.filter((s) => s.status === args.status)
    }

    // Enrich with target and token info
    return await Promise.all(
      stakes.map(async (stake) => {
        const stakingToken = await ctx.db.get('stakingTokens', stake.stakingTokenId)
        let target = null
        if (stake.targetAgentId) {
          const agent = await ctx.db.get('agents', stake.targetAgentId)
          target = agent ? { type: 'agent', name: agent.name, address: agent.address } : null
        } else if (stake.targetMerchantId) {
          const merchant = await ctx.db.get('merchants', stake.targetMerchantId)
          target = merchant ? { type: 'merchant', name: merchant.name } : null
        }
        return {
          ...stake,
          token: stakingToken ? {
            symbol: stakingToken.tokenSymbol,
            name: stakingToken.tokenName,
            mint: stakingToken.tokenMint,
            decimals: stakingToken.tokenDecimals,
          } : null,
          target,
        }
      })
    )
  },
})

/**
 * Get staking stats for an agent
 */
export const getStatsForAgent = query({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    // Get all active stakes for this agent
    const stakes = await ctx.db
      .query('tokenStakes')
      .withIndex('by_target_agent', (q) => q.eq('targetAgentId', args.agentId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect()

    // Get registered staking tokens for this agent
    const tokens = await ctx.db
      .query('stakingTokens')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    // Calculate totals
    const totalWeight = stakes.reduce((sum, s) => sum + s.trustWeight, 0)
    const uniqueStakers = new Set(stakes.map((s) => s.stakerAddress)).size
    const totalStakedValue = stakes.reduce((sum, s) => sum + s.amount, 0)

    // Group by attestation type
    const byType = stakes.reduce(
      (acc, s) => {
        acc[s.attestationType] = (acc[s.attestationType] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      totalStakes: stakes.length,
      uniqueStakers,
      totalWeight,
      totalStakedValue,
      registeredTokens: tokens.length,
      byAttestationType: byType,
    }
  },
})

// ==========================================
// INTERNAL FUNCTIONS
// ==========================================

/**
 * Update stakes that have passed their lock period
 */
export const updateUnlockingStakes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Find active stakes that are past their lock period
    const stakesToUnlock = await ctx.db
      .query('tokenStakes')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .filter((q) => q.lt(q.field('lockedUntil'), now))
      .take(100)

    let updated = 0
    for (const stake of stakesToUnlock) {
      await ctx.db.patch(stake._id, { status: 'unlocking' })
      updated++
    }

    return { updated }
  },
})

/**
 * Sync stake from on-chain data (internal - called by cron)
 */
export const syncStakeFromChain = internalMutation({
  args: {
    stakerAddress: v.string(),
    targetAgentAddress: v.string(),
    tokenMint: v.string(),
    amount: v.number(),
    amountRaw: v.string(),
    txSignature: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the staking token
    const stakingToken = await ctx.db
      .query('stakingTokens')
      .withIndex('by_token_mint', (q) => q.eq('tokenMint', args.tokenMint))
      .first()

    if (!stakingToken || !stakingToken.isActive) {
      return null // Token not registered for staking
    }

    // Find the target agent
    const targetAgent = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.targetAgentAddress))
      .first()

    if (!targetAgent) {
      return null // Target agent not found
    }

    // Check if this stake already exists
    const existing = await ctx.db
      .query('tokenStakes')
      .filter((q) => q.eq(q.field('txSignature'), args.txSignature))
      .first()

    if (existing) {
      return existing._id // Already recorded
    }

    // Find staker agent if registered
    const stakerAgent = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.stakerAddress))
      .first()

    const now = Date.now()
    const lockedUntil = now + stakingToken.lockPeriodSeconds * 1000
    const trustWeight = Math.log2(args.amount + 1) * stakingToken.weightMultiplier

    // Create the stake
    const stakeId = await ctx.db.insert('tokenStakes', {
      stakerAddress: args.stakerAddress,
      stakerAgentId: stakerAgent?._id,
      targetAgentId: targetAgent._id,
      targetMerchantId: undefined,
      stakingTokenId: stakingToken._id,
      tokenMint: args.tokenMint,
      amount: args.amount,
      amountRaw: args.amountRaw,
      attestationType: 'general',
      stakedAt: now,
      lockedUntil,
      txSignature: args.txSignature,
      trustWeight,
      status: 'active',
    })

    // Record event
    await ctx.db.insert('stakingEvents', {
      stakeId,
      eventType: 'staked',
      amount: args.amount,
      txSignature: args.txSignature,
      timestamp: now,
    })

    // Update token totals
    await ctx.db.patch(stakingToken._id, {
      totalStaked: stakingToken.totalStaked + args.amount,
      updatedAt: now,
    })

    // Create trust relationship if both parties are agents
    if (stakerAgent && targetAgent) {
      await ctx.runMutation(internal.trustGraph.upsertRelationshipInternal, {
        fromAgentId: stakerAgent._id,
        toAgentId: targetAgent._id,
        relationshipType: 'endorsement',
        directWeight: Math.min(100, trustWeight * 10),
        categories: ['general'],
        sourceEndorsementId: stakeId,
      })
    }

    return stakeId
  },
})

// ==========================================
// VAULT SYNC QUERIES
// ==========================================

/**
 * Get all active staking tokens with vault addresses (internal)
 */
export const getActiveVaults = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('stakingTokens')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .filter((q) => q.neq(q.field('vaultAddress'), undefined))
      .collect()
  },
})

/**
 * Get the last sync time for a vault
 */
export const getVaultLastSync = internalQuery({
  args: { vaultAddress: v.string() },
  handler: async (ctx, args) => {
    // Find the most recent staking event for this vault
    const stakingToken = await ctx.db
      .query('stakingTokens')
      .filter((q) => q.eq(q.field('vaultAddress'), args.vaultAddress))
      .first()

    if (!stakingToken) return null

    // Get the most recent stake for this token
    const lastStake = await ctx.db
      .query('tokenStakes')
      .withIndex('by_token', (q) => q.eq('stakingTokenId', stakingToken._id))
      .order('desc')
      .first()

    return lastStake?.stakedAt || stakingToken.createdAt
  },
})

// ==========================================
// VAULT MONITORING ACTIONS
// ==========================================

/**
 * Sync stakes from on-chain vault balances
 * This action fetches real data from Solana and records stakes
 */
export const syncVaultDeposits = internalAction({
  args: {
    vaultAddress: v.string(),
    tokenMint: v.string(),
    stakingTokenId: v.string(),
    sinceTimestamp: v.number(),
  },
  handler: async (ctx, args): Promise<{ synced: number; errors: number }> => {
    // Import vault monitor dynamically (action-only)
    const { monitorVaultDeposits } = await import('../lib/solana/vault-monitor')

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

    // Get deposits since last sync
    const deposits = await monitorVaultDeposits(
      args.vaultAddress,
      args.tokenMint,
      args.sinceTimestamp,
      rpcUrl
    )

    let synced = 0
    let errors = 0

    for (const deposit of deposits) {
      try {
        // Record the stake via internal mutation
        await ctx.runMutation(internal.tokenStaking.syncStakeFromChain, {
          stakerAddress: deposit.sender,
          targetAgentAddress: args.vaultAddress, // Vault owner is the target
          tokenMint: args.tokenMint,
          amount: deposit.amountUi,
          amountRaw: deposit.amount.toString(),
          txSignature: deposit.signature,
        })
        synced++
      } catch (error) {
        console.error(`Failed to sync deposit ${deposit.signature}:`, error)
        errors++
      }
    }

    return { synced, errors }
  },
})

/**
 * Sync all vaults - called by cron
 */
export const syncAllVaults = internalAction({
  args: {},
  handler: async (ctx): Promise<{ vaultsProcessed: number; totalSynced: number; totalErrors: number }> => {
    // Get all active vaults
    const vaults = await ctx.runQuery(internal.tokenStaking.getActiveVaults, {})

    let totalSynced = 0
    let totalErrors = 0
    let vaultsProcessed = 0

    for (const vault of vaults) {
      if (!vault.vaultAddress) continue

      // Get last sync time for this vault
      const lastSync = await ctx.runQuery(internal.tokenStaking.getVaultLastSync, {
        vaultAddress: vault.vaultAddress,
      })

      // Default to 24 hours ago if no previous sync
      const sinceTimestamp = lastSync || Date.now() - 24 * 60 * 60 * 1000

      try {
        const result = await ctx.runAction(internal.tokenStaking.syncVaultDeposits, {
          vaultAddress: vault.vaultAddress,
          tokenMint: vault.tokenMint,
          stakingTokenId: vault._id,
          sinceTimestamp,
        })

        totalSynced += result.synced
        totalErrors += result.errors
        vaultsProcessed++

        console.log(
          `Synced vault ${vault.vaultAddress}: ${result.synced} deposits, ${result.errors} errors`
        )
      } catch (error) {
        console.error(`Failed to sync vault ${vault.vaultAddress}:`, error)
        totalErrors++
      }
    }

    return { vaultsProcessed, totalSynced, totalErrors }
  },
})

/**
 * Verify vault balances match recorded stakes
 * This is a consistency check
 */
export const verifyVaultBalances = internalAction({
  args: {},
  handler: async (ctx): Promise<{ verified: number; mismatched: number; details: Array<{ vaultAddress: string; expected: number; actual: number }> }> => {
    const { getVaultBalance } = await import('../lib/solana/vault-monitor')

    const vaults = await ctx.runQuery(internal.tokenStaking.getActiveVaults, {})
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

    let verified = 0
    let mismatched = 0
    const details: Array<{ vaultAddress: string; expected: number; actual: number }> = []

    for (const vault of vaults) {
      if (!vault.vaultAddress) continue

      const balance = await getVaultBalance(vault.vaultAddress, rpcUrl)

      if (!balance) {
        mismatched++
        details.push({
          vaultAddress: vault.vaultAddress,
          expected: vault.totalStaked,
          actual: 0,
        })
        continue
      }

      // Compare with recorded total
      const difference = Math.abs(balance.balanceUi - vault.totalStaked)
      const tolerance = vault.totalStaked * 0.01 // 1% tolerance

      if (difference <= tolerance) {
        verified++
      } else {
        mismatched++
        details.push({
          vaultAddress: vault.vaultAddress,
          expected: vault.totalStaked,
          actual: balance.balanceUi,
        })
      }
    }

    return { verified, mismatched, details }
  },
})

// ==========================================
// ON-CHAIN PROGRAM SYNC
// ==========================================

/**
 * Sync stake positions from on-chain program accounts
 * This reads directly from the token_staking Solana program
 */
export const syncFromProgram = internalAction({
  args: {
    targetAgentAddress: v.string(),
  },
  handler: async (ctx, args): Promise<{ synced: number; errors: number }> => {
    const { Connection, PublicKey } = await import('@solana/web3.js')
    const { TokenStakingClient, getVaultPDA } = await import('../lib/solana/token-staking-client')

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')
    const client = new TokenStakingClient(connection)

    let synced = 0
    let errors = 0

    try {
      const targetAgent = new PublicKey(args.targetAgentAddress)

      // Get all vaults for this agent from on-chain
      const vaults = await client.getAgentVaults(targetAgent)

      for (const vault of vaults) {
        if (!vault.isActive) continue

        // Derive the vault PDA address
        const [vaultAddress] = getVaultPDA(vault.targetAgent, vault.tokenMint)

        // Get all stake positions for this vault
        const positions = await client.getVaultStakePositions(vaultAddress)

        for (const position of positions) {
          if (!position.isActive) continue

          try {
            // Record the stake from on-chain data
            await ctx.runMutation(internal.tokenStaking.syncStakeFromChain, {
              stakerAddress: position.staker.toBase58(),
              targetAgentAddress: args.targetAgentAddress,
              tokenMint: position.tokenMint.toBase58(),
              amount: Number(position.amount) / 1e6, // Assuming 6 decimals
              amountRaw: position.amount.toString(),
              txSignature: `program:${position.vault.toBase58()}:${position.staker.toBase58()}`,
            })
            synced++
          } catch (error) {
            console.error(`Failed to sync position for staker ${position.staker.toBase58()}:`, error)
            errors++
          }
        }
      }
    } catch (error) {
      console.error(`Failed to sync from program for ${args.targetAgentAddress}:`, error)
      errors++
    }

    return { synced, errors }
  },
})

/**
 * Sync all vaults and stake positions from on-chain program
 * Called by cron to discover and sync all registered vaults
 */
export const syncAllFromProgram = internalAction({
  args: {},
  handler: async (ctx): Promise<{ vaultsProcessed: number; positionsSynced: number; errors: number }> => {
    const { Connection } = await import('@solana/web3.js')
    const { TokenStakingClient, getVaultPDA } = await import('../lib/solana/token-staking-client')

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')
    const client = new TokenStakingClient(connection)

    let vaultsProcessed = 0
    let positionsSynced = 0
    let errors = 0

    try {
      // Get all active vaults from on-chain program
      const vaults = await client.getAllActiveVaults()

      for (const { address: vaultAddress, vault } of vaults) {
        if (!vault.isActive) continue

        vaultsProcessed++

        try {
          // Ensure the vault is registered in Convex
          const existingToken = await ctx.runQuery(internal.tokenStaking.getByMintInternal, {
            tokenMint: vault.tokenMint.toBase58(),
          })

          // Get all stake positions for this vault
          const positions = await client.getVaultStakePositions(vaultAddress)

          for (const position of positions) {
            if (!position.isActive) continue

            try {
              await ctx.runMutation(internal.tokenStaking.syncStakeFromChain, {
                stakerAddress: position.staker.toBase58(),
                targetAgentAddress: vault.targetAgent.toBase58(),
                tokenMint: vault.tokenMint.toBase58(),
                amount: Number(position.amount) / 1e6,
                amountRaw: position.amount.toString(),
                txSignature: `program:${vaultAddress.toBase58()}:${position.staker.toBase58()}`,
              })
              positionsSynced++
            } catch (error) {
              console.error(`Failed to sync position:`, error)
              errors++
            }
          }
        } catch (error) {
          console.error(`Failed to process vault ${vaultAddress.toBase58()}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error('Failed to sync all from program:', error)
      errors++
    }

    console.log(
      `Program sync complete: ${vaultsProcessed} vaults, ${positionsSynced} positions synced, ${errors} errors`
    )

    return { vaultsProcessed, positionsSynced, errors }
  },
})

/**
 * Internal query to get staking token by mint
 */
export const getByMintInternal = internalQuery({
  args: { tokenMint: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stakingTokens')
      .withIndex('by_token_mint', (q) => q.eq('tokenMint', args.tokenMint))
      .first()
  },
})

/**
 * Get staking stats for Ghost score calculation (internal)
 * Returns aggregated staking metrics that contribute to trust weight
 */
export const getStakingStatsForGhostScore = internalQuery({
  args: { agentId: v.id('agents') },
  handler: async (ctx, args) => {
    // Get all active stakes targeting this agent
    const stakes = await ctx.db
      .query('tokenStakes')
      .withIndex('by_target_agent', (q) => q.eq('targetAgentId', args.agentId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect()

    if (stakes.length === 0) {
      return {
        totalStakingWeight: 0,
        uniqueStakers: 0,
        totalStakedValue: 0,
        attestationCount: 0,
        avgStakerGhostScore: 0,
        stakingTrustBonus: 0,
      }
    }

    // Calculate aggregated metrics
    const totalStakingWeight = stakes.reduce((sum, s) => sum + s.trustWeight, 0)
    const uniqueStakerAddresses = new Set(stakes.map((s) => s.stakerAddress))
    const totalStakedValue = stakes.reduce((sum, s) => sum + s.amount, 0)

    // Get unique staker agent IDs for Ghost score lookup
    const stakerAgentIds = stakes
      .map((s) => s.stakerAgentId)
      .filter((id): id is NonNullable<typeof id> => id !== undefined)
    const uniqueStakerAgentIds = [...new Set(stakerAgentIds)]

    // Calculate average Ghost score of stakers
    let totalStakerGhostScore = 0
    let stakerCount = 0
    for (const stakerId of uniqueStakerAgentIds) {
      const staker = await ctx.db.get('agents', stakerId)
      if (staker) {
        totalStakerGhostScore += staker.ghostScore
        stakerCount++
      }
    }
    const avgStakerGhostScore = stakerCount > 0 ? totalStakerGhostScore / stakerCount : 0

    // Count unique attestation types
    const attestationTypes = new Set(stakes.map((s) => s.attestationType))

    // Calculate staking trust bonus (0-100)
    // Formula: log2(totalWeight + 1) * sqrt(uniqueStakers) * (avgStakerScore / 1000)
    // This rewards:
    // - Higher total staking weight (with diminishing returns)
    // - More diverse stakers (network effect)
    // - Higher quality stakers (weighted endorsement)
    const stakingTrustBonus = Math.min(
      100,
      Math.log2(totalStakingWeight + 1) *
        Math.sqrt(uniqueStakerAddresses.size) *
        (avgStakerGhostScore / 1000 + 0.5) // 0.5 baseline for anonymous stakers
    )

    return {
      totalStakingWeight,
      uniqueStakers: uniqueStakerAddresses.size,
      totalStakedValue,
      attestationCount: attestationTypes.size,
      avgStakerGhostScore,
      stakingTrustBonus: Math.round(stakingTrustBonus * 10) / 10, // Round to 1 decimal
    }
  },
})

/**
 * Sync a single vault from on-chain (by vault address)
 */
export const syncVaultFromProgram = internalAction({
  args: {
    vaultAddress: v.string(),
  },
  handler: async (ctx, args): Promise<{ synced: number; errors: number }> => {
    const { Connection, PublicKey } = await import('@solana/web3.js')
    const { TokenStakingClient } = await import('../lib/solana/token-staking-client')

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')
    const client = new TokenStakingClient(connection)

    let synced = 0
    let errors = 0

    try {
      const vaultPubkey = new PublicKey(args.vaultAddress)
      const vault = await client.getStakingVault(vaultPubkey)

      if (!vault) {
        console.log(`Vault ${args.vaultAddress} not found on-chain`)
        return { synced: 0, errors: 0 }
      }

      if (!vault.isActive) {
        console.log(`Vault ${args.vaultAddress} is not active`)
        return { synced: 0, errors: 0 }
      }

      // Get all stake positions for this vault
      const positions = await client.getVaultStakePositions(vaultPubkey)

      for (const position of positions) {
        if (!position.isActive) continue

        try {
          await ctx.runMutation(internal.tokenStaking.syncStakeFromChain, {
            stakerAddress: position.staker.toBase58(),
            targetAgentAddress: vault.targetAgent.toBase58(),
            tokenMint: vault.tokenMint.toBase58(),
            amount: Number(position.amount) / 1e6,
            amountRaw: position.amount.toString(),
            txSignature: `program:${args.vaultAddress}:${position.staker.toBase58()}`,
          })
          synced++
        } catch (error) {
          console.error(`Failed to sync position for staker ${position.staker.toBase58()}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error(`Failed to sync vault ${args.vaultAddress}:`, error)
      errors++
    }

    return { synced, errors }
  },
})
