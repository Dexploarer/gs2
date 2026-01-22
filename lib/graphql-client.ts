/**
 * GraphQL Client for GhostSpeak
 *
 * 2026 Best Practice: Simple fetch-based client
 * - No heavy dependencies
 * - Type-safe with TypeScript
 * - Server Component compatible
 */

import { headers } from 'next/headers';

async function getGraphQLEndpoint(): Promise<string> {
  // Use environment variable if set
  if (process.env.NEXT_PUBLIC_GRAPHQL_URL) {
    return process.env.NEXT_PUBLIC_GRAPHQL_URL;
  }

  // For server-side rendering, construct full URL
  if (typeof window === 'undefined') {
    try {
      const headersList = await headers();
      const host = headersList.get('host');
      const protocol = headersList.get('x-forwarded-proto') || 'http';
      return `${protocol}://${host}/api/graphql`;
    } catch {
      // Fallback for environments where headers() isn't available
      return 'http://localhost:3333/api/graphql';
    }
  }

  // Client-side: use relative URL
  return '/api/graphql';
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
  }>;
}

/**
 * Execute GraphQL query
 */
export async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const endpoint = await getGraphQLEndpoint();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    // Enable caching for GET-like queries
    next: {
      revalidate: 60, // Revalidate every 60 seconds
    },
  });

  const json: GraphQLResponse<T> = await response.json();

  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data as T;
}

/**
 * GraphQL queries (typed)
 */
export const queries = {
  /**
   * Get single agent
   */
  GET_AGENT: `
    query GetAgent($address: String!) {
      agent(address: $address) {
        address
        name
        category
        reputation
        totalVotes
        upvotes
        downvotes
        averageQuality
        isActive
        metadata {
          description
          website
          tags
          avatar
          x402Endpoint
          supportsMicropayments
        }
        recentVotes {
          id
          voter
          voteType
          qualityScores {
            responseQuality
            responseSpeed
            accuracy
            professionalism
            average
          }
          timestamp
          voteWeight
        }
        createdAt
        updatedAt
      }
    }
  `,

  /**
   * Search agents
   */
  SEARCH_AGENTS: `
    query SearchAgents(
      $category: String
      $minScore: Int
      $tags: [String!]
      $search: String
      $limit: Int
      $offset: Int
      $sortBy: AgentSortField
      $sortOrder: SortOrder
    ) {
      agents(
        category: $category
        minScore: $minScore
        tags: $tags
        search: $search
        limit: $limit
        offset: $offset
        sortBy: $sortBy
        sortOrder: $sortOrder
      ) {
        nodes {
          address
          name
          category
          reputation
          totalVotes
          upvotes
          downvotes
          averageQuality
          isActive
          metadata {
            description
            tags
            avatar
            supportsMicropayments
          }
          createdAt
        }
        totalCount
        hasNextPage
      }
    }
  `,

  /**
   * Get votes for agent
   */
  GET_VOTES: `
    query GetVotes($agentAddress: String!, $limit: Int, $offset: Int) {
      votes(agentAddress: $agentAddress, limit: $limit, offset: $offset) {
        nodes {
          id
          voter
          votedAgent
          voteType
          qualityScores {
            responseQuality
            responseSpeed
            accuracy
            professionalism
            average
          }
          transactionAmount
          timestamp
          voteWeight
          transactionSignature
        }
        totalCount
        hasNextPage
      }
    }
  `,

  /**
   * Get top agents
   */
  TOP_AGENTS: `
    query TopAgents($limit: Int, $minVotes: Int) {
      topAgents(limit: $limit, minVotes: $minVotes) {
        address
        name
        category
        reputation
        totalVotes
        upvotes
        downvotes
        averageQuality
        metadata {
          description
          tags
          avatar
        }
      }
    }
  `,

  /**
   * Get trending agents
   */
  TRENDING_AGENTS: `
    query TrendingAgents($limit: Int) {
      trendingAgents(limit: $limit) {
        address
        name
        category
        reputation
        totalVotes
        metadata {
          description
          tags
          avatar
        }
      }
    }
  `,

  /**
   * Get category stats
   */
  CATEGORY_STATS: `
    query CategoryStats {
      categoryStats {
        category
        agentCount
        avgReputation
      }
    }
  `,

  /**
   * Get agent transactions
   */
  GET_TRANSACTIONS: `
    query GetTransactions($address: String!, $limit: Int) {
      transactions(address: $address, limit: $limit) {
        id
        type
        signature
        blockNumber
        timestamp
        amount
      }
    }
  `,
};

/**
 * Response types for typed queries
 */
export interface AgentData {
  address: string
  name?: string
  category?: string
  reputation: number
  totalVotes: number
  upvotes: number
  downvotes: number
  averageQuality: number
  isActive?: boolean
  metadata?: {
    description?: string
    website?: string
    tags?: string[]
    avatar?: string
    x402Endpoint?: string
    supportsMicropayments?: boolean
  }
  recentVotes?: VoteData[]
  createdAt?: string
  updatedAt?: string
}

export interface VoteData {
  id: string
  voter: string
  voteType: string
  qualityScores?: {
    responseQuality: number
    responseSpeed: number
    accuracy: number
    professionalism: number
    average: number
  }
  timestamp: string
  voteWeight: number
  transactionSignature?: string
}

export interface Transaction {
  id: string
  type: string
  signature: string
  blockNumber: number
  timestamp: string
  amount?: number
}

export interface GetAgentResponse {
  agent: AgentData | null
}

export interface GetVotesResponse {
  votes: {
    nodes: VoteData[]
    totalCount: number
    hasNextPage: boolean
  }
}

export interface SearchAgentsResponse {
  agents: {
    nodes: AgentData[]
    totalCount: number
    hasNextPage: boolean
  }
}

export interface TopAgentsResponse {
  topAgents: AgentData[]
}

export interface TrendingAgentsResponse {
  trendingAgents: AgentData[]
}

export interface CategoryStatsResponse {
  categoryStats: Array<{
    category: string
    agentCount: number
    avgReputation: number
  }>
}

export interface GetTransactionsResponse {
  transactions: Transaction[]
}

/**
 * Typed query functions (2026 pattern)
 */
export async function getAgent(address: string): Promise<GetAgentResponse> {
  return graphql<GetAgentResponse>(queries.GET_AGENT, { address });
}

export async function searchAgents(filters: {
  category?: string;
  minScore?: number;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'REPUTATION' | 'TOTAL_VOTES' | 'AVERAGE_QUALITY' | 'CREATED_AT';
  sortOrder?: 'ASC' | 'DESC';
}): Promise<SearchAgentsResponse> {
  return graphql<SearchAgentsResponse>(queries.SEARCH_AGENTS, filters);
}

export async function getVotes(agentAddress: string, limit = 20, offset = 0): Promise<GetVotesResponse> {
  return graphql<GetVotesResponse>(queries.GET_VOTES, { agentAddress, limit, offset });
}

export async function getTopAgents(limit = 10, minVotes = 5): Promise<TopAgentsResponse> {
  return graphql<TopAgentsResponse>(queries.TOP_AGENTS, { limit, minVotes });
}

export async function getTrendingAgents(limit = 10): Promise<TrendingAgentsResponse> {
  return graphql<TrendingAgentsResponse>(queries.TRENDING_AGENTS, { limit });
}

export async function getCategoryStats(): Promise<CategoryStatsResponse> {
  return graphql<CategoryStatsResponse>(queries.CATEGORY_STATS);
}

export async function getAgentTransactions(address: string, limit = 10): Promise<GetTransactionsResponse> {
  // Mock response if query fails or for development
  try {
    return await graphql<GetTransactionsResponse>(queries.GET_TRANSACTIONS, { address, limit });
  } catch (e) {
    console.warn('Failed to fetch transactions, returning empty list', e);
    return { transactions: [] };
  }
}
