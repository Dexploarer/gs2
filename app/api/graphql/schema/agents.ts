/**
 * Agent GraphQL Schema and Resolvers
 *
 * Queries agent reputation data from Solana via Convex cache
 */

import { PublicKey } from '@solana/web3.js';
import { fetchQuery, fetchAction } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getConnection } from '@/lib/solana/client';
import {
  REPUTATION_REGISTRY_PROGRAM_ID,
  VOTE_REGISTRY_PROGRAM_ID,
} from '@/lib/solana/programs';

// Shared Solana connection singleton
const connection = getConnection();

// OpenAI embeddings helper for vector search
async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// TypeDefs
export const agentTypeDefs = /* GraphQL */ `
  type Agent {
    address: String!
    name: String
    category: String
    reputationScore: Int!
    totalVotes: Int!
    upvotes: Int!
    downvotes: Int!
    averageQuality: Float!
    upvoteRatio: Float!
    isActive: Boolean!
    metadata: AgentMetadata
    createdAt: String
  }

  type AgentMetadata {
    description: String
    website: String
    twitter: String
    tags: [String!]!
    nftAddress: String
  }

  input AgentFilters {
    category: String
    minScore: Int
    tags: [String!]
    isActive: Boolean
  }

  extend type Query {
    agent(address: String!): Agent
    agents(
      filters: AgentFilters
      limit: Int
      offset: Int
    ): [Agent!]!
    searchAgents(query: String!, limit: Int): [Agent!]!
  }
`;

// Helper: Get vote statistics from Solana
async function getVoteStatistics(agentPubkey: PublicKey) {
  try {
    // Fetch all vote accounts for this agent
    const votes = await connection.getProgramAccounts(
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

      // Parse vote type (offset 104)
      const voteType = data.readUInt8(104);
      if (voteType === 0) upvotes++;
      else downvotes++;

      // Parse quality scores
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
      upvoteRatio: votes.length > 0 ? upvotes / votes.length : 0,
    };
  } catch (error) {
    console.error('Error fetching vote statistics:', error);
    return {
      total: 0,
      upvotes: 0,
      downvotes: 0,
      avgQuality: 0,
      upvoteRatio: 0,
    };
  }
}

// Resolvers
export const agentResolvers = {
  Query: {
    agent: async (_parent: unknown, { address }: { address: string }) => {
      try {
        const agentPubkey = new PublicKey(address);

        // Derive reputation PDA
        const [reputationPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('reputation'), agentPubkey.toBuffer()],
          new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
        );

        // Fetch reputation account
        const accountInfo = await connection.getAccountInfo(reputationPda);

        if (!accountInfo) {
          return null; // Agent not found
        }

        // Parse reputation score
        const data = accountInfo.data;
        const reputationScore = data.readUInt16LE(40); // After discriminator + agent pubkey

        // Fetch vote statistics
        const voteStats = await getVoteStatistics(agentPubkey);

        // Fetch metadata from Convex
        let metadata = null;
        try {
          const convexMetadata = await fetchQuery(api.agents.getAgentMetadata, { address });
          if (convexMetadata) {
            metadata = {
              description: convexMetadata.description,
              website: convexMetadata.website,
              twitter: convexMetadata.twitter,
              tags: convexMetadata.tags,
              nftAddress: convexMetadata.nftAddress,
            };
          }
        } catch {
          // Metadata fetch failed, continue without it
        }

        // Extract name and category from full metadata
        const fullMetadata = await fetchQuery(api.agents.getAgentMetadata, { address }).catch(() => null);

        return {
          address,
          name: fullMetadata?.name ?? null,
          category: fullMetadata?.category ?? null,
          reputationScore,
          totalVotes: voteStats.total,
          upvotes: voteStats.upvotes,
          downvotes: voteStats.downvotes,
          averageQuality: voteStats.avgQuality,
          upvoteRatio: voteStats.upvoteRatio,
          isActive: true,
          metadata,
        };
      } catch (error) {
        console.error('Error fetching agent:', error);
        throw new Error('Failed to fetch agent data');
      }
    },

    agents: async (
      _parent: unknown,
      {
        filters,
        limit = 20,
        offset = 0,
      }: {
        filters?: {
          category?: string;
          minScore?: number;
          tags?: string[];
          isActive?: boolean;
        };
        limit?: number;
        offset?: number;
      }
    ) => {
      try {
        // Fetch all reputation accounts
        const reputationAccounts = await connection.getProgramAccounts(
          new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
        );

        const agents = [];

        for (const account of reputationAccounts) {
          const data = account.account.data;

          // Parse agent pubkey and reputation score
          const agentPubkey = new PublicKey(data.slice(8, 40));
          const reputationScore = data.readUInt16LE(40);

          // Apply filters
          if (filters?.minScore && reputationScore < filters.minScore) {
            continue;
          }

          // Fetch vote statistics
          const voteStats = await getVoteStatistics(agentPubkey);
          const address = agentPubkey.toBase58();

          // Fetch metadata from Convex
          const convexMetadata = await fetchQuery(api.agents.getAgentMetadata, { address }).catch(() => null);

          // Apply category filter if specified
          if (filters?.category && convexMetadata?.category !== filters.category) {
            continue;
          }

          // Apply tags filter if specified
          if (filters?.tags && filters.tags.length > 0) {
            const agentTags = convexMetadata?.tags ?? [];
            const hasMatchingTag = filters.tags.some(tag => agentTags.includes(tag));
            if (!hasMatchingTag) {
              continue;
            }
          }

          const metadata = convexMetadata ? {
            description: convexMetadata.description,
            website: convexMetadata.website,
            twitter: convexMetadata.twitter,
            tags: convexMetadata.tags,
            nftAddress: convexMetadata.nftAddress,
          } : null;

          agents.push({
            address,
            name: convexMetadata?.name ?? null,
            category: convexMetadata?.category ?? null,
            reputationScore,
            totalVotes: voteStats.total,
            upvotes: voteStats.upvotes,
            downvotes: voteStats.downvotes,
            averageQuality: voteStats.avgQuality,
            upvoteRatio: voteStats.upvoteRatio,
            isActive: true,
            metadata,
          });
        }

        // Sort by reputation score descending
        agents.sort((a, b) => b.reputationScore - a.reputationScore);

        // Apply pagination
        return agents.slice(offset, offset + limit);
      } catch (error) {
        console.error('Error fetching agents:', error);
        throw new Error('Failed to fetch agents');
      }
    },

    searchAgents: async (
      _parent: unknown,
      { query, limit = 10 }: { query: string; limit?: number }
    ) => {
      try {
        // First try vector search if OpenAI API key is available
        if (process.env.OPENAI_API_KEY) {
          try {
            const embedding = await getEmbedding(query);
            const vectorResults = await fetchAction(api.agents.vectorSearchAgents, {
              embedding,
              limit,
              filterActive: true,
            });

            // Map vector results to GraphQL agent type
            return vectorResults.map((agent) => ({
              address: agent.address,
              name: agent.name,
              category: agent.category ?? null,
              reputationScore: agent.ghostScore,
              totalVotes: 0, // Would need vote aggregation
              upvotes: 0,
              downvotes: 0,
              averageQuality: 0,
              upvoteRatio: 0,
              isActive: agent.isActive,
              metadata: {
                description: agent.description,
                website: null,
                twitter: null,
                tags: agent.capabilities,
                nftAddress: null,
              },
            }));
          } catch (vectorError) {
            console.error('Vector search failed, falling back to text search:', vectorError);
          }
        }

        // Fallback to text-based search
        const textResults = await fetchQuery(api.agents.searchAgents, {
          searchTerm: query,
          limit,
        });

        return textResults.map((agent) => ({
          address: agent.address,
          name: agent.name,
          category: agent.category ?? null,
          reputationScore: agent.ghostScore,
          totalVotes: 0,
          upvotes: 0,
          downvotes: 0,
          averageQuality: 0,
          upvoteRatio: 0,
          isActive: agent.isActive,
          metadata: {
            description: agent.description,
            website: null,
            twitter: null,
            tags: agent.capabilities,
            nftAddress: null,
          },
        }));
      } catch (error) {
        console.error('Error searching agents:', error);
        return [];
      }
    },
  },
};
