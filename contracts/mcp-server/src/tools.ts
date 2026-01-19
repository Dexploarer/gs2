/**
 * GhostSpeak MCP Tool Definitions
 *
 * Exported separately for use in other applications that want to
 * integrate GhostSpeak reputation queries without running the full MCP server.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'

/**
 * Tool definitions for GhostSpeak reputation queries
 */
export const GHOSTSPEAK_TOOLS: Tool[] = [
  {
    name: 'get_agent_reputation',
    description:
      'Get the reputation score and statistics for an AI agent on GhostSpeak. ' +
      'Returns reputation score (0-1000), total votes, upvotes/downvotes, and quality metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Solana address of the agent (base58 encoded)',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'search_agents',
    description:
      'Search for AI agents by category and minimum reputation score. ' +
      'Returns a list of matching agents with their reputation metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description:
            'Category to filter by (e.g., "data", "compute", "storage", "oracle")',
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
      required: [],
    },
  },
  {
    name: 'get_agent_votes',
    description:
      'Get the voting history for an agent, including who voted, vote type, ' +
      'quality scores, and transaction details.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Solana address of the agent (base58 encoded)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of votes to return',
          default: 20,
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_vote_details',
    description:
      'Get detailed information about a specific vote including the voter, ' +
      'vote type, quality assessment, and any attached comments.',
    inputSchema: {
      type: 'object',
      properties: {
        voteId: {
          type: 'string',
          description: 'The vote PDA address (base58 encoded)',
        },
      },
      required: ['voteId'],
    },
  },
]

/**
 * Tool name type for type-safe tool invocation
 */
export type GhostSpeakToolName =
  | 'get_agent_reputation'
  | 'search_agents'
  | 'get_agent_votes'
  | 'get_vote_details'

/**
 * Input types for each tool
 */
export interface GetAgentReputationInput {
  address: string
}

export interface SearchAgentsInput {
  category?: string
  minScore?: number
  limit?: number
}

export interface GetAgentVotesInput {
  address: string
  limit?: number
}

export interface GetVoteDetailsInput {
  voteId: string
}

/**
 * Response types for each tool
 */
export interface AgentReputation {
  address: string
  reputationScore: number
  totalVotes: number
  upvotes: number
  downvotes: number
  averageQualityScore: number
  isActive: boolean
}

export interface VoteInfo {
  voteId: string
  voter: string
  votedAgent: string
  voteType: 'upvote' | 'downvote'
  qualityScores: {
    accuracy: number
    reliability: number
    fairness: number
    speed: number
  }
  commentHash: string | null
  timestamp: number
  voteWeight: number
  transactionReceipt?: {
    amount: number
    currency: string
    facilitator: string
  }
}

export interface SearchResult {
  agents: AgentReputation[]
  total: number
  hasMore: boolean
}

/**
 * Configuration for the GhostSpeak MCP server
 */
export interface GhostSpeakConfig {
  /** Solana RPC URL (default: devnet) */
  solanaRpcUrl?: string
  /** Identity Registry program ID */
  identityRegistryProgramId?: string
  /** Reputation Registry program ID */
  reputationRegistryProgramId?: string
  /** Vote Registry program ID */
  voteRegistryProgramId?: string
}

// ============================================================================
// DEVNET PROGRAM IDS (must match lib/solana/programs.ts)
// ============================================================================

const DEVNET_PROGRAM_IDS = {
  identityRegistry: '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e',
  reputationRegistry: 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp',
  validationRegistry: '9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc',
  voteRegistry: 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6',
  tokenStaking: '4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL',
}

/**
 * Default configuration (devnet)
 */
export const DEFAULT_CONFIG: Required<GhostSpeakConfig> = {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  identityRegistryProgramId: DEVNET_PROGRAM_IDS.identityRegistry,
  reputationRegistryProgramId: DEVNET_PROGRAM_IDS.reputationRegistry,
  voteRegistryProgramId: DEVNET_PROGRAM_IDS.voteRegistry,
}

/**
 * Mainnet configuration
 * Override via environment variables when deploying to mainnet
 */
export const MAINNET_CONFIG: Required<GhostSpeakConfig> = {
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  // Use environment variables for mainnet program IDs, fallback to devnet for testing
  identityRegistryProgramId: process.env.IDENTITY_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.identityRegistry,
  reputationRegistryProgramId: process.env.REPUTATION_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.reputationRegistry,
  voteRegistryProgramId: process.env.VOTE_REGISTRY_PROGRAM_ID || DEVNET_PROGRAM_IDS.voteRegistry,
}

/**
 * Get config based on network
 */
export function getNetworkConfig(network: 'devnet' | 'mainnet-beta' = 'devnet'): Required<GhostSpeakConfig> {
  return network === 'mainnet-beta' ? MAINNET_CONFIG : DEFAULT_CONFIG
}
