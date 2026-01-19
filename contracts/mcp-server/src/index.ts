#!/usr/bin/env node

/**
 * GhostSpeak MCP Server
 *
 * Provides Model Context Protocol (MCP) tools for querying agent reputation
 * on Solana's GhostSpeak ERC-8004 trust layer.
 *
 * Tools:
 * - get_agent_reputation: Query reputation score for an agent
 * - search_agents: Find agents by category and minimum score
 * - get_agent_votes: Fetch voting history for an agent
 * - get_vote_details: Get detailed vote information
 *
 * Compatible with:
 * - Vercel AI SDK
 * - Claude Desktop
 * - Any MCP-compatible AI framework
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { readFile } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet';

// Get network from environment
const SOLANA_NETWORK: SolanaNetwork =
  (process.env.SOLANA_CLUSTER as SolanaNetwork) || 'devnet';

const IS_MAINNET = SOLANA_NETWORK === 'mainnet-beta';

// Devnet Program IDs (must match lib/solana/programs.ts)
const DEVNET_PROGRAM_IDS = {
  identityRegistry: '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e',
  reputationRegistry: 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp',
  validationRegistry: '9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc',
  voteRegistry: 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6',
  tokenStaking: '4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL',
};

// Mainnet Program IDs (override via environment when deployed)
const MAINNET_PROGRAM_IDS = {
  identityRegistry: process.env.IDENTITY_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.identityRegistry,
  reputationRegistry: process.env.REPUTATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.reputationRegistry,
  validationRegistry: process.env.VALIDATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.validationRegistry,
  voteRegistry: process.env.VOTE_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.voteRegistry,
  tokenStaking: process.env.TOKEN_STAKING_PROGRAM_ID || DEVNET_PROGRAM_IDS.tokenStaking,
};

// Get program IDs based on current network
const PROGRAM_IDS = IS_MAINNET ? MAINNET_PROGRAM_IDS : DEVNET_PROGRAM_IDS;

const IDENTITY_REGISTRY_PROGRAM_ID = PROGRAM_IDS.identityRegistry;
const REPUTATION_REGISTRY_PROGRAM_ID = PROGRAM_IDS.reputationRegistry;
const VOTE_REGISTRY_PROGRAM_ID = PROGRAM_IDS.voteRegistry;

// Solana connection (network-aware)
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || (IS_MAINNET
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com');

interface AgentReputation {
  address: string;
  reputationScore: number;
  totalVotes: number;
  upvotes: number;
  downvotes: number;
  averageQualityScore: number;
  isActive: boolean;
}

interface VoteRecord {
  voteId: string;
  voter: string;
  votedAgent: string;
  voteType: 'upvote' | 'downvote';
  qualityScores: {
    responseQuality: number;
    responseSpeed: number;
    accuracy: number;
    professionalism: number;
  };
  transactionAmount: number;
  timestamp: number;
  voteWeight: number;
}

class GhostSpeakMCPServer {
  private server: Server;
  private connection: Connection;
  private voteRegistryProgram: Program | null = null;
  private reputationRegistryProgram: Program | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'ghostspeak-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleToolCall(request)
    );
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'get_agent_reputation',
        description:
          'Query reputation score and statistics for a GhostSpeak agent by their Solana address. Returns reputation score (0-1000), total votes, upvote/downvote counts, and average quality metrics.',
        inputSchema: {
          type: 'object',
          properties: {
            agentAddress: {
              type: 'string',
              description: 'Solana public key of the agent (base58 encoded)',
            },
          },
          required: ['agentAddress'],
        },
      },
      {
        name: 'search_agents',
        description:
          'Search for agents by category/tag and minimum reputation score. Returns list of matching agents with their reputation metrics.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description:
                'Agent category (e.g., "chatbot", "code-assistant", "analyst")',
            },
            minScore: {
              type: 'number',
              description: 'Minimum reputation score (0-1000)',
              default: 0,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10,
            },
          },
          required: ['category'],
        },
      },
      {
        name: 'get_agent_votes',
        description:
          'Fetch voting history for an agent, including vote types, quality scores, and transaction proofs. Useful for understanding reputation trends.',
        inputSchema: {
          type: 'object',
          properties: {
            agentAddress: {
              type: 'string',
              description: 'Solana public key of the agent',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of votes to return',
              default: 20,
            },
          },
          required: ['agentAddress'],
        },
      },
      {
        name: 'get_vote_details',
        description:
          'Get detailed information about a specific vote, including quality breakdown, transaction proof, and voter identity.',
        inputSchema: {
          type: 'object',
          properties: {
            voteId: {
              type: 'string',
              description: 'Vote PDA address (base58 encoded)',
            },
          },
          required: ['voteId'],
        },
      },
    ];
  }

  private async handleToolCall(request: any) {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_agent_reputation':
          return await this.getAgentReputation(args.agentAddress);

        case 'search_agents':
          return await this.searchAgents(
            args.category,
            args.minScore || 0,
            args.limit || 10
          );

        case 'get_agent_votes':
          return await this.getAgentVotes(args.agentAddress, args.limit || 20);

        case 'get_vote_details':
          return await this.getVoteDetails(args.voteId);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async getAgentReputation(agentAddress: string) {
    try {
      const agentPubkey = new PublicKey(agentAddress);

      // Derive reputation PDA
      const [reputationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reputation'), agentPubkey.toBuffer()],
        new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
      );

      // Fetch reputation account
      const accountInfo = await this.connection.getAccountInfo(reputationPda);

      if (!accountInfo) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Agent not found or has no reputation data',
                address: agentAddress,
              }, null, 2),
            },
          ],
        };
      }

      // Parse reputation data
      // Layout: discriminator(8) + agent(32) + reputation_score(2) + authority(32) + bump(1)
      const data = accountInfo.data;
      const reputationScore = data.readUInt16LE(40); // After discriminator + agent pubkey

      // Fetch vote statistics
      const voteStats = await this.getVoteStatistics(agentPubkey);

      const reputation: AgentReputation = {
        address: agentAddress,
        reputationScore,
        totalVotes: voteStats.total,
        upvotes: voteStats.upvotes,
        downvotes: voteStats.downvotes,
        averageQualityScore: voteStats.avgQuality,
        isActive: true,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(reputation, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch reputation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getVoteStatistics(agentPubkey: PublicKey) {
    // Fetch all vote accounts for this agent
    const votes = await this.connection.getProgramAccounts(
      new PublicKey(VOTE_REGISTRY_PROGRAM_ID),
      {
        filters: [
          {
            memcmp: {
              offset: 40, // After discriminator(8) + receipt(32)
              bytes: agentPubkey.toBase58(),
            },
          },
        ],
      }
    );

    let upvotes = 0;
    let downvotes = 0;
    let totalQuality = 0;

    for (const vote of votes) {
      const data = vote.account.data;

      // Parse vote type (offset 104: after discriminator + receipt + voted_agent + voter)
      const voteType = data.readUInt8(104);
      if (voteType === 0) upvotes++;
      else downvotes++;

      // Parse quality scores (4 bytes each)
      const responseQuality = data.readUInt8(105);
      const responseSpeed = data.readUInt8(106);
      const accuracy = data.readUInt8(107);
      const professionalism = data.readUInt8(108);

      const avgScore = (responseQuality + responseSpeed + accuracy + professionalism) / 4;
      totalQuality += avgScore;
    }

    return {
      total: votes.length,
      upvotes,
      downvotes,
      avgQuality: votes.length > 0 ? totalQuality / votes.length : 0,
    };
  }

  private async searchAgents(category: string, minScore: number, limit: number) {
    try {
      // Fetch all reputation accounts
      const reputationAccounts = await this.connection.getProgramAccounts(
        new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
      );

      const agents: AgentReputation[] = [];

      for (const account of reputationAccounts) {
        const data = account.account.data;

        // Parse agent pubkey and reputation score
        const agentPubkey = new PublicKey(data.slice(8, 40));
        const reputationScore = data.readUInt16LE(40);

        if (reputationScore >= minScore) {
          // Fetch vote statistics
          const voteStats = await this.getVoteStatistics(agentPubkey);

          // For now, we don't have category filtering on-chain
          // In Phase 3, we'll add metadata with categories
          agents.push({
            address: agentPubkey.toBase58(),
            reputationScore,
            totalVotes: voteStats.total,
            upvotes: voteStats.upvotes,
            downvotes: voteStats.downvotes,
            averageQualityScore: voteStats.avgQuality,
            isActive: true,
          });

          if (agents.length >= limit) break;
        }
      }

      // Sort by reputation score descending
      agents.sort((a, b) => b.reputationScore - a.reputationScore);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                category,
                minScore,
                count: agents.length,
                agents,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to search agents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getAgentVotes(agentAddress: string, limit: number) {
    try {
      const agentPubkey = new PublicKey(agentAddress);

      // Fetch all vote accounts for this agent
      const voteAccounts = await this.connection.getProgramAccounts(
        new PublicKey(VOTE_REGISTRY_PROGRAM_ID),
        {
          filters: [
            {
              memcmp: {
                offset: 40,
                bytes: agentPubkey.toBase58(),
              },
            },
          ],
        }
      );

      const votes: VoteRecord[] = [];

      for (const account of voteAccounts.slice(0, limit)) {
        const data = account.account.data;

        // Parse vote data
        const receiptPubkey = new PublicKey(data.slice(8, 40));
        const votedAgent = new PublicKey(data.slice(40, 72));
        const voter = new PublicKey(data.slice(72, 104));
        const voteType = data.readUInt8(104) === 0 ? 'upvote' : 'downvote';

        const qualityScores = {
          responseQuality: data.readUInt8(105),
          responseSpeed: data.readUInt8(106),
          accuracy: data.readUInt8(107),
          professionalism: data.readUInt8(108),
        };

        const timestamp = new BN(data.slice(141, 149), 'le').toNumber();
        const voteWeight = data.readUInt16LE(149);

        // Fetch transaction amount from receipt
        const receiptInfo = await this.connection.getAccountInfo(receiptPubkey);
        let transactionAmount = 0;
        if (receiptInfo) {
          transactionAmount = new BN(receiptInfo.data.slice(104, 112), 'le').toNumber();
        }

        votes.push({
          voteId: account.pubkey.toBase58(),
          voter: voter.toBase58(),
          votedAgent: votedAgent.toBase58(),
          voteType,
          qualityScores,
          transactionAmount,
          timestamp,
          voteWeight,
        });
      }

      // Sort by timestamp descending (newest first)
      votes.sort((a, b) => b.timestamp - a.timestamp);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                agentAddress,
                count: votes.length,
                votes,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch votes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getVoteDetails(voteId: string) {
    try {
      const votePubkey = new PublicKey(voteId);
      const accountInfo = await this.connection.getAccountInfo(votePubkey);

      if (!accountInfo) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Vote not found', voteId }, null, 2),
            },
          ],
        };
      }

      const data = accountInfo.data;

      // Parse all vote fields
      const receiptPubkey = new PublicKey(data.slice(8, 40));
      const votedAgent = new PublicKey(data.slice(40, 72));
      const voter = new PublicKey(data.slice(72, 104));
      const voteType = data.readUInt8(104) === 0 ? 'upvote' : 'downvote';

      const qualityScores = {
        responseQuality: data.readUInt8(105),
        responseSpeed: data.readUInt8(106),
        accuracy: data.readUInt8(107),
        professionalism: data.readUInt8(108),
      };

      const commentHash = Array.from(data.slice(109, 141));
      const timestamp = new BN(data.slice(141, 149), 'le').toNumber();
      const voteWeight = data.readUInt16LE(149);

      // Fetch transaction receipt details
      const receiptInfo = await this.connection.getAccountInfo(receiptPubkey);
      let receiptDetails = {};
      if (receiptInfo) {
        const receiptData = receiptInfo.data;
        receiptDetails = {
          signature: Buffer.from(receiptData.slice(8, 72)).toString('utf-8'),
          payer: new PublicKey(receiptData.slice(72, 104)).toBase58(),
          amount: new BN(receiptData.slice(104, 112), 'le').toNumber(),
          contentType: receiptData.readUInt8(112),
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                voteId,
                voter: voter.toBase58(),
                votedAgent: votedAgent.toBase58(),
                voteType,
                qualityScores,
                timestamp,
                voteWeight,
                commentHash: Buffer.from(commentHash).toString('hex'),
                transactionReceipt: receiptDetails,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch vote details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GhostSpeak MCP Server running on stdio');
  }
}

const server = new GhostSpeakMCPServer();
server.run().catch(console.error);
