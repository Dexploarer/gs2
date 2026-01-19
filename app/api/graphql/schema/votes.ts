/**
 * Vote GraphQL Schema and Resolvers
 *
 * Queries voting data from Solana
 */

import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { getConnection } from '@/lib/solana/client'
import { VOTE_REGISTRY_PROGRAM_ID } from '@/lib/solana/programs'

// Shared Solana connection singleton
const connection = getConnection();

// TypeDefs
export const voteTypeDefs = /* GraphQL */ `
  type Vote {
    id: String!
    voter: String!
    votedAgent: String!
    voteType: VoteType!
    qualityScores: QualityScores!
    transactionAmount: Int!
    timestamp: String!
    voteWeight: Int!
    commentHash: String
  }

  type QualityScores {
    responseQuality: Int!
    responseSpeed: Int!
    accuracy: Int!
    professionalism: Int!
    average: Float!
  }

  enum VoteType {
    UPVOTE
    DOWNVOTE
  }

  extend type Query {
    vote(id: String!): Vote
    votes(agentAddress: String!, limit: Int, offset: Int): [Vote!]!
    recentVotes(limit: Int): [Vote!]!
  }
`;

// Resolvers
export const voteResolvers = {
  Query: {
    vote: async (_parent: unknown, { id }: { id: string }) => {
      try {
        const votePubkey = new PublicKey(id);
        const accountInfo = await connection.getAccountInfo(votePubkey);

        if (!accountInfo) {
          return null;
        }

        const data = accountInfo.data;

        // Parse vote data
        const receiptPubkey = new PublicKey(data.slice(8, 40));
        const votedAgent = new PublicKey(data.slice(40, 72));
        const voter = new PublicKey(data.slice(72, 104));
        const voteType = data.readUInt8(104) === 0 ? 'UPVOTE' : 'DOWNVOTE';

        const qualityScores = {
          responseQuality: data.readUInt8(105),
          responseSpeed: data.readUInt8(106),
          accuracy: data.readUInt8(107),
          professionalism: data.readUInt8(108),
        };

        const average =
          (qualityScores.responseQuality +
            qualityScores.responseSpeed +
            qualityScores.accuracy +
            qualityScores.professionalism) /
          4;

        const commentHash = Buffer.from(data.slice(109, 141)).toString('hex');
        const timestamp = new BN(data.slice(141, 149), 'le').toNumber();
        const voteWeight = data.readUInt16LE(149);

        // Fetch transaction amount from receipt
        const receiptInfo = await connection.getAccountInfo(receiptPubkey);
        let transactionAmount = 0;
        if (receiptInfo) {
          transactionAmount = new BN(receiptInfo.data.slice(104, 112), 'le').toNumber();
        }

        return {
          id,
          voter: voter.toBase58(),
          votedAgent: votedAgent.toBase58(),
          voteType,
          qualityScores: { ...qualityScores, average },
          transactionAmount,
          timestamp: new Date(timestamp * 1000).toISOString(),
          voteWeight,
          commentHash,
        };
      } catch (error) {
        console.error('Error fetching vote:', error);
        throw new Error('Failed to fetch vote');
      }
    },

    votes: async (
      _parent: unknown,
      {
        agentAddress,
        limit = 20,
        offset = 0,
      }: { agentAddress: string; limit?: number; offset?: number }
    ) => {
      try {
        const agentPubkey = new PublicKey(agentAddress);

        // Fetch all vote accounts for this agent
        const voteAccounts = await connection.getProgramAccounts(
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

        const votes = [];

        for (const account of voteAccounts) {
          const data = account.account.data;

          // Parse vote data
          const receiptPubkey = new PublicKey(data.slice(8, 40));
          const votedAgent = new PublicKey(data.slice(40, 72));
          const voter = new PublicKey(data.slice(72, 104));
          const voteType = data.readUInt8(104) === 0 ? 'UPVOTE' : 'DOWNVOTE';

          const qualityScores = {
            responseQuality: data.readUInt8(105),
            responseSpeed: data.readUInt8(106),
            accuracy: data.readUInt8(107),
            professionalism: data.readUInt8(108),
          };

          const average =
            (qualityScores.responseQuality +
              qualityScores.responseSpeed +
              qualityScores.accuracy +
              qualityScores.professionalism) /
            4;

          const timestamp = new BN(data.slice(141, 149), 'le').toNumber();
          const voteWeight = data.readUInt16LE(149);

          // Fetch transaction amount
          const receiptInfo = await connection.getAccountInfo(receiptPubkey);
          let transactionAmount = 0;
          if (receiptInfo) {
            transactionAmount = new BN(receiptInfo.data.slice(104, 112), 'le').toNumber();
          }

          votes.push({
            id: account.pubkey.toBase58(),
            voter: voter.toBase58(),
            votedAgent: votedAgent.toBase58(),
            voteType,
            qualityScores: { ...qualityScores, average },
            transactionAmount,
            timestamp: new Date(timestamp * 1000).toISOString(),
            voteWeight,
            commentHash: null,
          });
        }

        // Sort by timestamp descending
        votes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Apply pagination
        return votes.slice(offset, offset + limit);
      } catch (error) {
        console.error('Error fetching votes:', error);
        throw new Error('Failed to fetch votes');
      }
    },

    recentVotes: async (_parent: unknown, { limit = 10 }: { limit?: number }) => {
      try {
        // Fetch all vote accounts
        const voteAccounts = await connection.getProgramAccounts(
          new PublicKey(VOTE_REGISTRY_PROGRAM_ID)
        );

        const votes = [];

        for (const account of voteAccounts) {
          const data = account.account.data;

          // Parse minimal vote data for recent list
          const votedAgent = new PublicKey(data.slice(40, 72));
          const voter = new PublicKey(data.slice(72, 104));
          const voteType = data.readUInt8(104) === 0 ? 'UPVOTE' : 'DOWNVOTE';

          const qualityScores = {
            responseQuality: data.readUInt8(105),
            responseSpeed: data.readUInt8(106),
            accuracy: data.readUInt8(107),
            professionalism: data.readUInt8(108),
          };

          const average =
            (qualityScores.responseQuality +
              qualityScores.responseSpeed +
              qualityScores.accuracy +
              qualityScores.professionalism) /
            4;

          const timestamp = new BN(data.slice(141, 149), 'le').toNumber();
          const voteWeight = data.readUInt16LE(149);

          votes.push({
            id: account.pubkey.toBase58(),
            voter: voter.toBase58(),
            votedAgent: votedAgent.toBase58(),
            voteType,
            qualityScores: { ...qualityScores, average },
            transactionAmount: 0, // Skip fetching receipt for performance
            timestamp: new Date(timestamp * 1000).toISOString(),
            voteWeight,
            commentHash: null,
          });
        }

        // Sort by timestamp descending and take limit
        votes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return votes.slice(0, limit);
      } catch (error) {
        console.error('Error fetching recent votes:', error);
        throw new Error('Failed to fetch recent votes');
      }
    },
  },
};
