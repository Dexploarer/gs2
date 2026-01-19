/**
 * GraphQL Schema for GhostSpeak Agent Discovery
 *
 * 2026 Best Practices:
 * - Type-safe with GraphQL Yoga v5
 * - Next.js 15.4 App Router integration
 * - Convex backend data source
 * - Real-time Solana sync
 */

export const typeDefs = /* GraphQL */ `
  """
  AI Agent with on-chain reputation
  """
  type Agent {
    """Solana wallet address"""
    address: String!

    """Agent display name"""
    name: String

    """Agent category (e.g. chatbot, code-assistant, analyst)"""
    category: String

    """Reputation score (0-1000)"""
    reputation: Int!

    """Total number of votes received"""
    totalVotes: Int!

    """Number of upvotes"""
    upvotes: Int!

    """Number of downvotes"""
    downvotes: Int!

    """Average quality score across all metrics (0-100)"""
    averageQuality: Float!

    """Whether agent is currently active"""
    isActive: Boolean!

    """Agent metadata"""
    metadata: AgentMetadata

    """Recent votes (limited to last 20)"""
    recentVotes: [Vote!]!

    """Timestamp when agent was registered"""
    createdAt: String!

    """Last time reputation was updated"""
    updatedAt: String!
  }

  """
  Agent metadata and profile information
  """
  type AgentMetadata {
    """Short description of agent capabilities"""
    description: String

    """Agent website or documentation URL"""
    website: String

    """Tags for discovery and filtering"""
    tags: [String!]!

    """Agent avatar/logo URL"""
    avatar: String

    """x402 endpoint URL (if available)"""
    x402Endpoint: String

    """Whether agent supports micropayments"""
    supportsMicropayments: Boolean!
  }

  """
  Vote record from x402 transaction
  """
  type Vote {
    """Vote PDA address on Solana"""
    id: String!

    """Voter's wallet address"""
    voter: String!

    """Agent being voted on"""
    votedAgent: String!

    """Vote type (upvote or downvote)"""
    voteType: VoteType!

    """Quality scores breakdown"""
    qualityScores: QualityScores!

    """Transaction amount in lamports"""
    transactionAmount: String!

    """Unix timestamp of vote"""
    timestamp: String!

    """Vote weight (equal for all = 100)"""
    voteWeight: Int!

    """Transaction signature proof"""
    transactionSignature: String!
  }

  """
  Quality score breakdown (0-100 scale)
  """
  type QualityScores {
    """Quality of agent's response"""
    responseQuality: Int!

    """Speed of agent's response"""
    responseSpeed: Int!

    """Accuracy of agent's output"""
    accuracy: Int!

    """Professionalism and clarity"""
    professionalism: Int!

    """Overall average"""
    average: Float!
  }

  """
  Vote type enum
  """
  enum VoteType {
    UPVOTE
    DOWNVOTE
  }

  """
  Category statistics
  """
  type CategoryStats {
    """Category name"""
    category: String!

    """Number of agents in category"""
    agentCount: Int!

    """Average reputation in category"""
    avgReputation: Float!
  }

  """
  Query root type
  """
  type Query {
    """
    Get single agent by Solana address
    """
    agent(address: String!): Agent

    """
    Search and filter agents
    """
    agents(
      """Filter by category"""
      category: String

      """Minimum reputation score"""
      minScore: Int

      """Filter by tags (matches any)"""
      tags: [String!]

      """Search query (matches name, description)"""
      search: String

      """Maximum number of results (default: 20, max: 100)"""
      limit: Int

      """Offset for pagination"""
      offset: Int

      """Sort by field"""
      sortBy: AgentSortField

      """Sort direction"""
      sortOrder: SortOrder
    ): AgentConnection!

    """
    Get votes for a specific agent
    """
    votes(
      """Agent address"""
      agentAddress: String!

      """Maximum number of votes to return"""
      limit: Int

      """Offset for pagination"""
      offset: Int
    ): VoteConnection!

    """
    Get detailed information about a single vote
    """
    vote(
      """Vote PDA address"""
      voteId: String!
    ): Vote

    """
    Get category statistics
    """
    categoryStats: [CategoryStats!]!

    """
    Get trending agents (most votes in last 7 days)
    """
    trendingAgents(
      """Number of results (default: 10)"""
      limit: Int
    ): [Agent!]!

    """
    Get top-rated agents (highest reputation)
    """
    topAgents(
      """Number of results (default: 10)"""
      limit: Int

      """Minimum number of votes required"""
      minVotes: Int
    ): [Agent!]!
  }

  """
  Agent sort fields
  """
  enum AgentSortField {
    REPUTATION
    TOTAL_VOTES
    AVERAGE_QUALITY
    CREATED_AT
    UPDATED_AT
  }

  """
  Sort order
  """
  enum SortOrder {
    ASC
    DESC
  }

  """
  Paginated agent results
  """
  type AgentConnection {
    """List of agents"""
    nodes: [Agent!]!

    """Total count (for pagination)"""
    totalCount: Int!

    """Whether there are more results"""
    hasNextPage: Boolean!
  }

  """
  Paginated vote results
  """
  type VoteConnection {
    """List of votes"""
    nodes: [Vote!]!

    """Total count"""
    totalCount: Int!

    """Whether there are more results"""
    hasNextPage: Boolean!
  }
`;
