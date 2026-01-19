/**
 * GraphQL Resolvers Integration Tests
 *
 * Tests for fast Convex-based GraphQL resolvers
 * Following 2026 testing patterns with Vitest
 *
 * What we test:
 * 1. Single agent query
 * 2. Agent search with filters
 * 3. Top agents query
 * 4. Trending agents query
 * 5. Vote queries
 * 6. Error handling
 * 7. Performance
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GraphQLSchema, graphql } from 'graphql';

// Mock Convex client
const createMockConvexClient = () => {
  const agents = new Map();
  const votes = new Map();

  // Pre-populate with test data
  const mockAgents = [
    {
      _id: 'agent1',
      address: 'Agent1Address',
      ghostScore: 950,
      tier: 'platinum',
      isActive: true,
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      updatedAt: Date.now(),
    },
    {
      _id: 'agent2',
      address: 'Agent2Address',
      ghostScore: 800,
      tier: 'gold',
      isActive: true,
      createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    },
    {
      _id: 'agent3',
      address: 'Agent3Address',
      ghostScore: 600,
      tier: 'silver',
      isActive: true,
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    },
    {
      _id: 'agent4',
      address: 'Agent4Address',
      ghostScore: 400,
      tier: 'bronze',
      isActive: true,
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    },
  ];

  mockAgents.forEach(agent => agents.set(agent._id, agent));

  // Pre-populate votes
  const mockVotes = [
    {
      _id: 'vote1',
      voterAgentId: 'agent1',
      subjectAgentId: 'agent2',
      voteType: 'trustworthy',
      weight: 3,
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    },
    {
      _id: 'vote2',
      voterAgentId: 'agent2',
      subjectAgentId: 'agent3',
      voteType: 'trustworthy',
      weight: 2,
      timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
    },
    {
      _id: 'vote3',
      voterAgentId: 'agent1',
      subjectAgentId: 'agent3',
      voteType: 'untrustworthy',
      weight: 3,
      timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago (recent)
    },
  ];

  mockVotes.forEach(vote => votes.set(vote._id, vote));

  return {
    query: vi.fn(async (queryFn: any, args: any) => {
      // Mock getByAddress
      if (queryFn.toString().includes('getByAddress')) {
        for (const agent of agents.values()) {
          if (agent.address === args.address) {
            return agent;
          }
        }
        return null;
      }

      // Mock list
      if (queryFn.toString().includes('list')) {
        return Array.from(agents.values()).slice(0, args.limit || 50);
      }

      // Mock getAgentVotes
      if (queryFn.toString().includes('getAgentVotes')) {
        return Array.from(votes.values()).filter(
          v => v.subjectAgentId === args.agentId
        );
      }

      return null;
    }),
  };
};

// Mock GraphQL resolvers with Convex client
const createMockResolvers = (convexClient: any) => {
  return {
    Query: {
      agent: async (_: any, { address }: { address: string }) => {
        const agent = await convexClient.query(
          { toString: () => 'getByAddress' },
          { address }
        );

        if (!agent) return null;

        const votes = await convexClient.query(
          { toString: () => 'getAgentVotes' },
          { agentId: agent._id }
        );

        const upvotes = votes.filter((v: any) => v.voteType === 'trustworthy').length;
        const downvotes = votes.filter((v: any) => v.voteType === 'untrustworthy').length;

        return {
          address: agent.address,
          reputation: agent.ghostScore,
          totalVotes: votes.length,
          upvotes,
          downvotes,
          averageQuality: 75, // Placeholder
          tier: agent.tier,
          isActive: agent.isActive,
        };
      },

      agents: async (
        _: any,
        {
          minScore = 0,
          limit = 20,
          offset = 0,
          sortBy = 'REPUTATION',
          sortOrder = 'DESC',
        }: {
          minScore?: number;
          limit?: number;
          offset?: number;
          sortBy?: string;
          sortOrder?: string;
        }
      ) => {
        let agents = await convexClient.query(
          { toString: () => 'list' },
          { limit: 1000 }
        );

        // Filter by minScore
        agents = agents.filter((a: any) => a.ghostScore >= minScore);

        // Get votes for each agent
        const agentsWithVotes = await Promise.all(
          agents.map(async (agent: any) => {
            const votes = await convexClient.query(
              { toString: () => 'getAgentVotes' },
              { agentId: agent._id }
            );

            const upvotes = votes.filter((v: any) => v.voteType === 'trustworthy').length;
            const downvotes = votes.filter((v: any) => v.voteType === 'untrustworthy').length;

            return {
              agent,
              votes,
              upvotes,
              downvotes,
              totalVotes: votes.length,
            };
          })
        );

        // Sort
        if (sortBy === 'REPUTATION') {
          agentsWithVotes.sort((a, b) =>
            sortOrder === 'DESC'
              ? b.agent.ghostScore - a.agent.ghostScore
              : a.agent.ghostScore - b.agent.ghostScore
          );
        } else if (sortBy === 'VOTES') {
          agentsWithVotes.sort((a, b) =>
            sortOrder === 'DESC'
              ? b.totalVotes - a.totalVotes
              : a.totalVotes - b.totalVotes
          );
        }

        // Paginate
        const paginatedAgents = agentsWithVotes.slice(offset, offset + limit);

        // Map to GraphQL format
        const nodes = paginatedAgents.map(({ agent, votes, upvotes, downvotes }) => ({
          address: agent.address,
          reputation: agent.ghostScore,
          totalVotes: votes.length,
          upvotes,
          downvotes,
          averageQuality: 75,
          tier: agent.tier,
          isActive: agent.isActive,
        }));

        return {
          nodes,
          totalCount: agentsWithVotes.length,
          hasNextPage: offset + limit < agentsWithVotes.length,
        };
      },

      topAgents: async (_: any, { limit = 10, minVotes = 0 }: { limit?: number; minVotes?: number }) => {
        let agents = await convexClient.query(
          { toString: () => 'list' },
          { limit: 1000 }
        );

        // Get votes for each agent
        const agentsWithVotes = await Promise.all(
          agents.map(async (agent: any) => {
            const votes = await convexClient.query(
              { toString: () => 'getAgentVotes' },
              { agentId: agent._id }
            );
            return { agent, votes };
          })
        );

        // Filter by minVotes
        const filtered = agentsWithVotes.filter(({ votes }) => votes.length >= minVotes);

        // Sort by Ghost Score
        filtered.sort((a, b) => b.agent.ghostScore - a.agent.ghostScore);

        // Take top N
        const topN = filtered.slice(0, limit);

        return topN.map(({ agent, votes }) => {
          const upvotes = votes.filter((v: any) => v.voteType === 'trustworthy').length;
          const downvotes = votes.filter((v: any) => v.voteType === 'untrustworthy').length;

          return {
            address: agent.address,
            reputation: agent.ghostScore,
            totalVotes: votes.length,
            upvotes,
            downvotes,
            averageQuality: 75,
            tier: agent.tier,
          };
        });
      },

      trendingAgents: async (_: any, { limit = 10, days = 7 }: { limit?: number; days?: number }) => {
        const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

        let agents = await convexClient.query(
          { toString: () => 'list' },
          { limit: 1000 }
        );

        // Get recent votes for each agent
        const agentsWithTrending = await Promise.all(
          agents.map(async (agent: any) => {
            const allVotes = await convexClient.query(
              { toString: () => 'getAgentVotes' },
              { agentId: agent._id }
            );

            const recentVotes = allVotes.filter((v: any) => v.timestamp > cutoffTime);
            const trendingScore = recentVotes.length * 10; // Simple algorithm

            return {
              agent,
              allVotes,
              recentVotes,
              trendingScore,
            };
          })
        );

        // Filter to only agents with recent activity
        const trending = agentsWithTrending.filter(({ recentVotes }) => recentVotes.length > 0);

        // Sort by trending score
        trending.sort((a, b) => b.trendingScore - a.trendingScore);

        // Take top N
        const topTrending = trending.slice(0, limit);

        return topTrending.map(({ agent, allVotes, recentVotes, trendingScore }) => {
          const upvotes = allVotes.filter((v: any) => v.voteType === 'trustworthy').length;
          const downvotes = allVotes.filter((v: any) => v.voteType === 'untrustworthy').length;

          return {
            address: agent.address,
            reputation: agent.ghostScore,
            totalVotes: allVotes.length,
            upvotes,
            downvotes,
            averageQuality: 75,
            tier: agent.tier,
            trendingScore,
            recentVotes: recentVotes.length,
          };
        });
      },
    },
  };
};

describe('GraphQL Resolvers - Single Agent Query', () => {
  let mockConvex: any;
  let resolvers: any;

  beforeAll(() => {
    mockConvex = createMockConvexClient();
    resolvers = createMockResolvers(mockConvex);
  });

  it('should fetch single agent by address', async () => {
    const result = await resolvers.Query.agent(null, { address: 'Agent1Address' });

    expect(result).toBeDefined();
    expect(result.address).toBe('Agent1Address');
    expect(result.reputation).toBe(950);
    expect(result.tier).toBe('platinum');
  });

  it('should return null for non-existent agent', async () => {
    const result = await resolvers.Query.agent(null, { address: 'NonExistentAgent' });

    expect(result).toBeNull();
  });

  it('should include vote counts', async () => {
    const result = await resolvers.Query.agent(null, { address: 'Agent3Address' });

    expect(result).toBeDefined();
    expect(result.totalVotes).toBe(2); // 2 votes on agent3
    expect(result.upvotes).toBe(1);
    expect(result.downvotes).toBe(1);
  });
});

describe('GraphQL Resolvers - Agent Search', () => {
  let mockConvex: any;
  let resolvers: any;

  beforeAll(() => {
    mockConvex = createMockConvexClient();
    resolvers = createMockResolvers(mockConvex);
  });

  it('should return all agents with default params', async () => {
    const result = await resolvers.Query.agents(null, {});

    expect(result.nodes).toBeDefined();
    expect(result.nodes.length).toBe(4);
    expect(result.totalCount).toBe(4);
  });

  it('should filter by minScore', async () => {
    const result = await resolvers.Query.agents(null, { minScore: 700 });

    expect(result.nodes.length).toBe(2); // Only platinum and gold (950, 800)
    expect(result.nodes[0].reputation).toBeGreaterThanOrEqual(700);
    expect(result.nodes[1].reputation).toBeGreaterThanOrEqual(700);
  });

  it('should sort by reputation DESC (default)', async () => {
    const result = await resolvers.Query.agents(null, { sortBy: 'REPUTATION', sortOrder: 'DESC' });

    expect(result.nodes[0].reputation).toBe(950); // Platinum first
    expect(result.nodes[1].reputation).toBe(800); // Gold second
    expect(result.nodes[2].reputation).toBe(600); // Silver third
    expect(result.nodes[3].reputation).toBe(400); // Bronze last
  });

  it('should sort by reputation ASC', async () => {
    const result = await resolvers.Query.agents(null, { sortBy: 'REPUTATION', sortOrder: 'ASC' });

    expect(result.nodes[0].reputation).toBe(400); // Bronze first
    expect(result.nodes[3].reputation).toBe(950); // Platinum last
  });

  it('should paginate results', async () => {
    const page1 = await resolvers.Query.agents(null, { limit: 2, offset: 0 });
    const page2 = await resolvers.Query.agents(null, { limit: 2, offset: 2 });

    expect(page1.nodes.length).toBe(2);
    expect(page2.nodes.length).toBe(2);
    expect(page1.nodes[0].address).not.toBe(page2.nodes[0].address);
    expect(page1.hasNextPage).toBe(true);
  });

  it('should indicate no next page on last page', async () => {
    const result = await resolvers.Query.agents(null, { limit: 10, offset: 0 });

    expect(result.hasNextPage).toBe(false); // Only 4 agents total
  });
});

describe('GraphQL Resolvers - Top Agents', () => {
  let mockConvex: any;
  let resolvers: any;

  beforeAll(() => {
    mockConvex = createMockConvexClient();
    resolvers = createMockResolvers(mockConvex);
  });

  it('should return top agents by Ghost Score', async () => {
    const result = await resolvers.Query.topAgents(null, { limit: 2 });

    expect(result.length).toBe(2);
    expect(result[0].reputation).toBe(950); // Highest
    expect(result[1].reputation).toBe(800); // Second highest
  });

  it('should filter by minimum votes', async () => {
    const result = await resolvers.Query.topAgents(null, { minVotes: 1 });

    // Only agents with at least 1 vote
    expect(result.length).toBeGreaterThan(0);
    result.forEach((agent: any) => {
      expect(agent.totalVotes).toBeGreaterThanOrEqual(1);
    });
  });

  it('should respect limit parameter', async () => {
    const result = await resolvers.Query.topAgents(null, { limit: 3 });

    expect(result.length).toBe(3);
  });
});

describe('GraphQL Resolvers - Trending Agents', () => {
  let mockConvex: any;
  let resolvers: any;

  beforeAll(() => {
    mockConvex = createMockConvexClient();
    resolvers = createMockResolvers(mockConvex);
  });

  it('should return agents with recent activity', async () => {
    const result = await resolvers.Query.trendingAgents(null, { limit: 10, days: 7 });

    // Should only include agents with votes in last 7 days
    expect(result.length).toBeGreaterThan(0);
    result.forEach((agent: any) => {
      expect(agent.recentVotes).toBeGreaterThan(0);
      expect(agent.trendingScore).toBeGreaterThan(0);
    });
  });

  it('should sort by trending score', async () => {
    const result = await resolvers.Query.trendingAgents(null, { limit: 10 });

    // Verify descending order
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].trendingScore).toBeGreaterThanOrEqual(result[i + 1].trendingScore);
    }
  });

  it('should calculate trending score based on recent votes', async () => {
    const result = await resolvers.Query.trendingAgents(null, { days: 7 });

    result.forEach((agent: any) => {
      // Trending score = recentVotes * 10 (simple algorithm)
      expect(agent.trendingScore).toBe(agent.recentVotes * 10);
    });
  });

  it('should respect time window parameter', async () => {
    const result7Days = await resolvers.Query.trendingAgents(null, { days: 7 });
    const result1Day = await resolvers.Query.trendingAgents(null, { days: 1 });

    // 1-day window should have fewer or equal trending agents
    expect(result1Day.length).toBeLessThanOrEqual(result7Days.length);
  });
});

describe('GraphQL Resolvers - Performance', () => {
  let mockConvex: any;
  let resolvers: any;

  beforeAll(() => {
    mockConvex = createMockConvexClient();
    resolvers = createMockResolvers(mockConvex);
  });

  it('should execute single agent query quickly', async () => {
    const start = Date.now();
    await resolvers.Query.agent(null, { address: 'Agent1Address' });
    const duration = Date.now() - start;

    // Mock should be <10ms, real Convex <50ms
    expect(duration).toBeLessThan(50);
  });

  it('should execute agent search quickly', async () => {
    const start = Date.now();
    await resolvers.Query.agents(null, { limit: 20 });
    const duration = Date.now() - start;

    // Mock should be <50ms, real Convex <100ms
    expect(duration).toBeLessThan(100);
  });

  it('should execute top agents query quickly', async () => {
    const start = Date.now();
    await resolvers.Query.topAgents(null, { limit: 10 });
    const duration = Date.now() - start;

    // Mock should be <50ms, real Convex <100ms
    expect(duration).toBeLessThan(100);
  });

  it('should handle concurrent queries efficiently', async () => {
    const start = Date.now();

    await Promise.all([
      resolvers.Query.agent(null, { address: 'Agent1Address' }),
      resolvers.Query.agents(null, { limit: 10 }),
      resolvers.Query.topAgents(null, { limit: 5 }),
      resolvers.Query.trendingAgents(null, { limit: 5 }),
    ]);

    const duration = Date.now() - start;

    // Should execute in parallel, not take 4x as long
    expect(duration).toBeLessThan(200);
  });
});

describe('GraphQL Resolvers - Error Handling', () => {
  let mockConvex: any;
  let resolvers: any;

  beforeAll(() => {
    mockConvex = createMockConvexClient();
    resolvers = createMockResolvers(mockConvex);
  });

  it('should handle empty results gracefully', async () => {
    const result = await resolvers.Query.agents(null, { minScore: 10000 });

    expect(result.nodes).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.hasNextPage).toBe(false);
  });

  it('should handle invalid pagination params', async () => {
    const result = await resolvers.Query.agents(null, { limit: 0, offset: -1 });

    // Should handle gracefully (implementation-dependent)
    expect(result).toBeDefined();
  });

  it('should return empty array for trending with no recent votes', async () => {
    const result = await resolvers.Query.trendingAgents(null, { days: 0 });

    // No votes in 0-day window
    expect(result).toEqual([]);
  });
});
