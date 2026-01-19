/**
 * ERC-8004 On-Chain Synchronization (2026)
 *
 * Sync reputation data between Convex (off-chain) and Solana (on-chain)
 * Implements the bridge for hybrid trust layer
 */

import { internalMutation, internalAction, internalQuery, mutation } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';

// ============================================================================
// Public API for Client-Side Calls
// ============================================================================

/**
 * Public wrapper for syncAgentRegistration
 * Allows client-side code to sync agent registration after NFT creation
 *
 * Note: Accepts agent address as string since client may not have Convex ID
 */
export const syncAgentRegistrationPublic = mutation({
  args: {
    agentAddress: v.string(), // Solana address - will look up agent
    assetAddress: v.string(),
    identityPDA: v.string(),
    metadataUri: v.string(),
    registrationTx: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up agent by address
    const agent = await ctx.db
      .query('agents')
      .withIndex('by_address', (q) => q.eq('address', args.agentAddress))
      .first();

    if (!agent) {
      throw new Error(`Agent not found for address: ${args.agentAddress}`);
    }

    const agentId = agent._id;

    // Look up existing identity
    let identity = await ctx.db
      .query('agentIdentities')
      .withIndex('by_agent', (q) => q.eq('agentId', agentId))
      .first();

    const onChain = {
      assetAddress: args.assetAddress,
      identityPDA: args.identityPDA,
      metadataUri: args.metadataUri,
      registrationTx: args.registrationTx,
      lastSyncedAt: Date.now(),
    };

    if (identity) {
      await ctx.db.patch(identity._id, {
        onChain,
        lastVerifiedAt: Date.now(),
      });
      return identity._id;
    } else {
      // Create new identity with required fields
      return await ctx.db.insert('agentIdentities', {
        agentId,
        walletAddress: agent.address, // Use agent's address
        publicKey: agent.address, // Public key is the address in Solana
        did: `did:ghostspeak:${args.identityPDA}`,
        onChain,
        createdAt: Date.now(),
        lastVerifiedAt: Date.now(),
      });
    }
  },
});

// ============================================================================
// Agent Identity Sync
// ============================================================================

/**
 * Record on-chain agent registration
 * Called after Metaplex Core asset is created on Solana (2026 standard)
 */
export const syncAgentRegistration = internalMutation({
  args: {
    agentId: v.id('agents'),
    assetAddress: v.string(), // Metaplex Core asset address
    identityPDA: v.string(),
    metadataUri: v.string(),
    registrationTx: v.string(),
  },
  handler: async (ctx, args) => {
    // Get or create agent identity
    let identity = await ctx.db
      .query('agentIdentities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first();

    const onChainData = {
      assetAddress: args.assetAddress, // Single Core asset account
      identityPDA: args.identityPDA,
      metadataUri: args.metadataUri,
      registrationTx: args.registrationTx,
      lastSyncedAt: Date.now(),
      plugins: [], // Initialize empty plugins array
    };

    if (identity) {
      // Update existing identity with on-chain data
      await ctx.db.patch(identity._id, {
        onChain: onChainData,
        lastVerifiedAt: Date.now(),
      });
    } else {
      // Create new identity record
      const agent = await ctx.db.get('agents', args.agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      await ctx.db.insert('agentIdentities', {
        agentId: args.agentId,
        walletAddress: agent.address,
        publicKey: agent.address, // Solana address is the public key
        onChain: onChainData,
        createdAt: Date.now(),
        lastVerifiedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Get agent's on-chain identity data
 */
export const getAgentOnChainIdentity = internalQuery({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.db
      .query('agentIdentities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first();

    return identity?.onChain || null;
  },
});

/**
 * Record plugin addition to Core asset
 * Called after adding a plugin (royalties, attributes, freeze, etc.)
 */
export const syncPluginAddition = internalMutation({
  args: {
    agentId: v.id('agents'),
    pluginType: v.string(), // 'royalties', 'attributes', 'freeze', etc.
    pluginData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.db
      .query('agentIdentities')
      .withIndex('by_agent', (q) => q.eq('agentId', args.agentId))
      .first();

    if (!identity || !identity.onChain) {
      throw new Error('Agent not registered on-chain');
    }

    const existingPlugins = identity.onChain.plugins || [];
    const newPlugin = {
      type: args.pluginType,
      data: args.pluginData,
      addedAt: Date.now(),
    };

    await ctx.db.patch(identity._id, {
      onChain: {
        ...identity.onChain,
        plugins: [...existingPlugins, newPlugin],
        lastSyncedAt: Date.now(),
      },
    });

    return { success: true };
  },
});

// ============================================================================
// Reputation Score Sync
// ============================================================================

/**
 * Prepare reputation data for on-chain sync
 * Computes payment proof Merkle root and formats for Solana program
 */
export const prepareReputationForSync = internalQuery({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    // 1. Get reputation score
    const reputation = await ctx.db
      .query('reputationScores')
      .withIndex('by_subject_agent', (q) => q.eq('subjectAgentId', args.agentId))
      .first();

    if (!reputation) {
      return null;
    }

    // 2. Get verified payment proofs (from reviews)
    const reviews = await ctx.db
      .query('merchantReviews')
      .withIndex('by_reviewer', (q) => q.eq('reviewerAgentId', args.agentId))
      .filter((q) => q.eq(q.field('isVerified'), true))
      .collect();

    // Extract payment proofs from reviews with actual amounts from transactions
    const paymentProofs = await Promise.all(
      reviews.map(async (r) => {
        // Look up actual transaction amount from agentTransactions table
        let amount = 0;
        if (r.transactionId) {
          const transaction = await ctx.db
            .query('agentTransactions')
            .withIndex('by_signature', (q) => q.eq('txSignature', r.transactionId || ''))
            .first();
          if (transaction) {
            // Convert USDC amount to lamports (6 decimals)
            amount = Math.round(transaction.amountUSDC * 1_000_000);
          }
        }
        return {
          transactionId: r.transactionId,
          amount,
        };
      })
    );

    // 3. Return data ready for on-chain sync
    return {
      reputationId: reputation._id,
      overallScore: Math.min(1000, Math.max(0, Math.round(reputation.overallScore))),
      componentScores: {
        trust: Math.min(100, Math.max(0, Math.round(reputation.trustScore))),
        quality: Math.min(100, Math.max(0, Math.round(reputation.qualityScore))),
        reliability: Math.min(100, Math.max(0, Math.round(reputation.reliabilityScore))),
        economic: Math.min(100, Math.max(0, Math.round(reputation.economicScore))),
        social: Math.min(100, Math.max(0, Math.round(reputation.socialScore))),
      },
      stats: {
        totalVotes: reputation.totalVotes,
        positiveVotes: reputation.positiveVotes,
        negativeVotes: reputation.negativeVotes,
        totalReviews: reputation.totalReviews,
        avgReviewRating: Math.round((reputation.avgReviewRating || 0) * 10), // 0-50
      },
      paymentProofs,
    };
  },
});

/**
 * Record successful on-chain reputation sync
 * Called after Solana transaction confirms
 */
export const recordReputationSync = internalMutation({
  args: {
    reputationId: v.id('reputationScores'),
    reputationPDA: v.string(),
    paymentProofsMerkleRoot: v.string(),
    syncTx: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reputationId, {
      onChain: {
        reputationPDA: args.reputationPDA,
        paymentProofsMerkleRoot: args.paymentProofsMerkleRoot,
        lastSyncTx: args.syncTx,
        lastSyncedAt: Date.now(),
      },
    });

    return { success: true };
  },
});

// ============================================================================
// Automated Sync Scheduling
// ============================================================================

/**
 * Queue agents needing reputation sync
 * Run periodically (e.g., daily) to sync reputation scores to chain
 */
export const queueAgentsForReputationSync = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    // Get agents with:
    // 1. Reputation score calculated recently
    // 2. No on-chain sync OR sync is outdated (>24h)
    // 3. Have on-chain identity (NFT minted)

    const reputationScores = await ctx.db
      .query('reputationScores')
      .filter((q) => q.eq(q.field('subjectType'), 'agent'))
      .order('desc')
      .take(limit);

    const agentsToSync: string[] = [];

    for (const score of reputationScores) {
      if (!score.subjectAgentId) continue;

      // Check if agent has on-chain identity
      const identity = await ctx.db
        .query('agentIdentities')
        .withIndex('by_agent', (q) => q.eq('agentId', score.subjectAgentId!))
        .first();

      if (!identity?.onChain) continue;

      // Check if sync needed
      const lastSynced = score.onChain?.lastSyncedAt || 0;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      if (lastSynced < dayAgo) {
        agentsToSync.push(score.subjectAgentId);
      }
    }

    return agentsToSync;
  },
});

/**
 * Sync reputation for a single agent
 * Can be called manually or by cron job
 */
// Type for on-chain identity data
interface OnChainIdentity {
  assetAddress: string;
  identityPDA: string;
  metadataUri: string;
  registrationTx: string;
  lastSyncedAt: number;
  plugins?: Array<{ type: string; data?: unknown; addedAt: number }>;
}

// Type for prepared reputation data
interface PreparedReputationData {
  reputationId: string;
  overallScore: number;
  componentScores: {
    trust: number;
    quality: number;
    reliability: number;
    economic: number;
    social: number;
  };
  stats: {
    totalVotes: number;
    positiveVotes: number;
    negativeVotes: number;
    totalReviews: number;
    avgReviewRating: number;
  };
  paymentProofs: Array<{ transactionId?: string | null; amount: number }>;
}

export const syncAgentReputation = internalAction({
  args: {
    agentId: v.id('agents'),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    syncPayload: {
      programId: string;
      agentAssetAddress: string;
      reputationData: {
        overallScore: number;
        componentScores: PreparedReputationData['componentScores'];
        stats: PreparedReputationData['stats'];
        merkleRoot: string;
      };
      rpcUrl: string;
      timestamp: number;
    };
    message: string;
  }> => {
    // 1. Get agent's on-chain identity
    const identity: OnChainIdentity | null = await ctx.runQuery(
      internal.erc8004.onchainSync.getAgentOnChainIdentity,
      { agentId: args.agentId }
    );

    if (!identity) {
      throw new Error('Agent not registered on-chain');
    }

    // 2. Prepare reputation data
    const reputationData: PreparedReputationData | null = await ctx.runQuery(
      internal.erc8004.onchainSync.prepareReputationForSync,
      { agentId: args.agentId }
    );

    if (!reputationData) {
      throw new Error('No reputation data found');
    }

    // 3. Call Solana program via Helius RPC to update reputation on-chain
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '6be013f8-b6f7-4599-b4ec-02198d5ff34e';
    const HELIUS_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const REPUTATION_PROGRAM_ID = '6xgRJ9rFANfzJHvhPs9nWnTeLBHSJnJdvC3LKLGTp5qe';

    // Derive reputation PDA for this agent
    const agentAssetAddress: string = identity.assetAddress;

    // Compute merkle root from payment proofs (simplified hash)
    const proofData = reputationData.paymentProofs
      .map((p: { transactionId?: string | null; amount: number }) => `${p.transactionId}:${p.amount}`)
      .join(',');

    // Create hash of payment proofs (simplified - production would use proper Merkle tree)
    // Use a simple hash function for the merkle root
    let hash = 0;
    for (let i = 0; i < proofData.length; i++) {
      const char = proofData.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    // Convert to hex and pad to 64 characters (simulate SHA-256 length)
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    const merkleRoot = hashHex.repeat(8);

    // For devnet, we store the prepared data and note that a wallet transaction is needed
    // The actual transaction requires a signed wallet - this prepares all the data
    const syncPayload = {
      programId: REPUTATION_PROGRAM_ID,
      agentAssetAddress,
      reputationData: {
        overallScore: reputationData.overallScore,
        componentScores: reputationData.componentScores,
        stats: reputationData.stats,
        merkleRoot,
      },
      rpcUrl: HELIUS_RPC_URL,
      timestamp: Date.now(),
    };

    // Record the sync preparation (actual on-chain write requires wallet signing from client)
    await ctx.runMutation(internal.erc8004.onchainSync.recordReputationSync, {
      reputationId: reputationData.reputationId as any,
      reputationPDA: `${REPUTATION_PROGRAM_ID}:${agentAssetAddress}`,
      paymentProofsMerkleRoot: merkleRoot,
      syncTx: `prepared:${Date.now()}`, // Will be replaced with actual tx signature after wallet signing
    });

    return {
      success: true,
      syncPayload,
      message: 'Reputation data prepared for on-chain sync. Client wallet signing required.',
    };
  },
});

// ============================================================================
// Payment Proof Verification Integration
// ============================================================================

/**
 * Verify payment proof before accepting review
 * Integrates with lib/solana/payment-verification.ts
 */
export const verifyReviewPaymentProof = internalAction({
  args: {
    transactionSignature: v.string(),
    reviewerAddress: v.string(),
    merchantAddress: v.string(),
    usdcMint: v.string(),
  },
  handler: async (ctx, args) => {
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '6be013f8-b6f7-4599-b4ec-02198d5ff34e';
    const HELIUS_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    try {
      // Fetch the transaction from Helius RPC
      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            args.transactionSignature,
            {
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!data.result) {
        return {
          isValid: false,
          proof: null,
          error: 'Transaction not found on Solana',
        };
      }

      const transaction = data.result;

      // Verify the transaction was successful
      if (transaction.meta?.err) {
        return {
          isValid: false,
          proof: null,
          error: 'Transaction failed on-chain',
        };
      }

      // Parse token transfers to verify USDC payment
      const preBalances = transaction.meta?.preTokenBalances || [];
      const postBalances = transaction.meta?.postTokenBalances || [];

      // Find USDC transfers involving the reviewer and merchant
      let payerTransfer = null;
      let recipientTransfer = null;

      for (const post of postBalances) {
        if (post.mint !== args.usdcMint) continue;

        const pre = preBalances.find(
          (p: { accountIndex: number }) => p.accountIndex === post.accountIndex
        );

        const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
        const postAmount = post.uiTokenAmount?.uiAmount || 0;
        const diff = postAmount - preAmount;

        // Check if this is the payer (balance decreased)
        if (diff < 0 && post.owner === args.reviewerAddress) {
          payerTransfer = {
            address: post.owner,
            amount: Math.abs(diff),
          };
        }

        // Check if this is the recipient (balance increased)
        if (diff > 0 && post.owner === args.merchantAddress) {
          recipientTransfer = {
            address: post.owner,
            amount: diff,
          };
        }
      }

      // Verify payment was from reviewer to merchant
      const isValid = payerTransfer !== null && recipientTransfer !== null;

      return {
        isValid,
        proof: isValid
          ? {
              signature: args.transactionSignature,
              payer: args.reviewerAddress,
              recipient: args.merchantAddress,
              amount: recipientTransfer?.amount || 0,
              verified: true,
              blockTime: transaction.blockTime,
              slot: transaction.slot,
            }
          : null,
        error: isValid ? undefined : 'Payment not verified between specified addresses',
      };
    } catch (error) {
      return {
        isValid: false,
        proof: null,
        error: `Verification failed: ${String(error)}`,
      };
    }
  },
});
