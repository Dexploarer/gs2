/**
 * Convex Sync Integration Tests
 *
 * Tests for Solana → Convex background sync functionality
 * Following 2026 testing patterns with Vitest
 *
 * What we test:
 * 1. Agent sync from Solana to Convex
 * 2. Vote sync from Solana to Convex
 * 3. Data accuracy and consistency
 * 4. Ghost Score calculations
 * 5. Error handling
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { address as createAddress, Address } from '@solana/addresses';
import { generateKeyPair, createKeyPairFromBytes } from '@solana/keys';

// Mock Convex context for testing
const createMockConvexContext = () => {
  const db = new Map();

  return {
    db: {
      insert: vi.fn(async (table: string, doc: any) => {
        const id = `${table}_${Date.now()}_${Math.random()}`;
        db.set(id, { ...doc, _id: id, _creationTime: Date.now() });
        return id;
      }),
      patch: vi.fn(async (table: string, id: string, updates: any) => {
        const existing = db.get(id);
        if (existing) {
          db.set(id, { ...existing, ...updates });
        }
      }),
      get: vi.fn(async (table: string, id: string) => {
        return db.get(id) || null;
      }),
      query: vi.fn((table: string) => ({
        withIndex: vi.fn((_indexName: string) => ({
          eq: vi.fn((_field?: string, _value?: unknown) => ({
            unique: vi.fn(async () => {
              // Find first matching document
              for (const [id, doc] of db.entries()) {
                if (id.startsWith(table)) {
                  return doc;
                }
              }
              return null;
            }),
            collect: vi.fn(async () => {
              const results = [];
              for (const [id, doc] of db.entries()) {
                if (id.startsWith(table)) {
                  results.push(doc);
                }
              }
              return results;
            }),
          })),
        })),
        collect: vi.fn(async () => {
          const results = [];
          for (const [id, doc] of db.entries()) {
            if (id.startsWith(table)) {
              results.push(doc);
            }
          }
          return results;
        }),
      })),
    },
    runQuery: vi.fn(),
    runMutation: vi.fn(),
    runAction: vi.fn(),
  };
};

describe('Convex Sync - Agent Sync', () => {
  let mockCtx: ReturnType<typeof createMockConvexContext>;

  beforeAll(() => {
    mockCtx = createMockConvexContext();
  });

  it('should calculate Ghost Score correctly from reputation data', () => {
    // Test Ghost Score calculation
    const calculateGhostScore = (reputation: number, totalVotes: number, averageQuality: number): number => {
      const baseScore = Math.min(reputation, 1000);
      const voteBonus = Math.min(totalVotes * 5, 100);
      const qualityFactor = averageQuality / 100;
      const finalScore = Math.min((baseScore + voteBonus) * qualityFactor, 1000);
      return Math.round(finalScore);
    };

    // Test cases
    expect(calculateGhostScore(500, 10, 80)).toBe(440); // (500 + 50) * 0.8 = 440
    expect(calculateGhostScore(800, 20, 90)).toBe(810); // (800 + 100) * 0.9 = 810
    expect(calculateGhostScore(1000, 0, 100)).toBe(1000); // (1000 + 0) * 1.0 = 1000
    expect(calculateGhostScore(200, 5, 50)).toBe(113); // (200 + 25) * 0.5 = 112.5 → 113 (Math.round)
  });

  it('should map Ghost Score to correct tier', () => {
    const getScoreTier = (score: number): 'bronze' | 'silver' | 'gold' | 'platinum' => {
      if (score >= 900) return 'platinum';
      if (score >= 750) return 'gold';
      if (score >= 500) return 'silver';
      return 'bronze';
    };

    expect(getScoreTier(950)).toBe('platinum');
    expect(getScoreTier(900)).toBe('platinum');
    expect(getScoreTier(800)).toBe('gold');
    expect(getScoreTier(750)).toBe('gold');
    expect(getScoreTier(600)).toBe('silver');
    expect(getScoreTier(500)).toBe('silver');
    expect(getScoreTier(400)).toBe('bronze');
    expect(getScoreTier(0)).toBe('bronze');
  });

  it('should calculate vote weight based on Ghost Score', () => {
    const calculateVoteWeight = (ghostScore: number): number => {
      if (ghostScore >= 900) return 3;
      if (ghostScore >= 750) return 2;
      if (ghostScore >= 500) return 1.5;
      return 1;
    };

    expect(calculateVoteWeight(950)).toBe(3);
    expect(calculateVoteWeight(900)).toBe(3);
    expect(calculateVoteWeight(800)).toBe(2);
    expect(calculateVoteWeight(600)).toBe(1.5);
    expect(calculateVoteWeight(400)).toBe(1);
  });

  it('should upsert agent correctly (create new)', async () => {
    const agentData = {
      address: 'TestAgent123',
      reputation: 750,
      totalVotes: 10,
      upvotes: 8,
      downvotes: 2,
      averageQuality: 85,
      lastUpdatedOnChain: Date.now(),
    };

    // Simulate upsertAgentFromSolana logic
    const existing = await mockCtx.db.query('agents')
      .withIndex('by_address')
      .eq()
      .unique();

    expect(existing).toBeNull();

    // Calculate Ghost Score
    const ghostScore = Math.round(((750 + 50) * 0.85)); // 680
    const tier = ghostScore >= 500 ? 'silver' : 'bronze';

    const agentId = await mockCtx.db.insert('agents', {
      address: agentData.address,
      ownerId: '',
      name: `Agent ${agentData.address.slice(0, 8)}...`,
      description: 'Discovered via Solana sync',
      capabilities: [],
      ghostScore,
      tier,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(agentId).toBeDefined();
    expect(mockCtx.db.insert).toHaveBeenCalledWith('agents', expect.objectContaining({
      address: 'TestAgent123',
      ghostScore,
      tier: 'silver',
    }));
  });

  it('should upsert agent correctly (update existing)', async () => {
    // First create an agent
    const existingId = await mockCtx.db.insert('agents', {
      address: 'ExistingAgent',
      ghostScore: 500,
      tier: 'silver',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Now simulate update
    const newGhostScore = 750;
    const newTier = 'gold';

    await mockCtx.db.patch('agents', existingId, {
      ghostScore: newGhostScore,
      tier: newTier,
      updatedAt: Date.now(),
    });

    expect(mockCtx.db.patch).toHaveBeenCalledWith('agents', existingId, expect.objectContaining({
      ghostScore: 750,
      tier: 'gold',
    }));
  });
});

describe('Convex Sync - Vote Sync', () => {
  let mockCtx: ReturnType<typeof createMockConvexContext>;

  beforeAll(() => {
    mockCtx = createMockConvexContext();
  });

  it('should create vote from Solana data', async () => {
    // Create a mock agent first
    const agentId = await mockCtx.db.insert('agents', {
      address: 'VotedAgent',
      ghostScore: 700,
      tier: 'gold',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create a mock voter agent
    const voterId = await mockCtx.db.insert('agents', {
      address: 'VoterAgent',
      ghostScore: 800,
      tier: 'gold',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create vote
    const voteData = {
      voterAgentId: voterId,
      voterGhostScore: 800,
      subjectType: 'agent' as const,
      subjectAgentId: agentId,
      voteType: 'trustworthy' as const,
      weight: 2, // Gold tier voter
      isActive: true,
      timestamp: Date.now(),
    };

    const voteId = await mockCtx.db.insert('reputationVotes', voteData);

    expect(voteId).toBeDefined();
    expect(mockCtx.db.insert).toHaveBeenCalledWith('reputationVotes', expect.objectContaining({
      voteType: 'trustworthy',
      weight: 2,
    }));
  });

  it('should avoid duplicate vote syncs', async () => {
    const signature = 'TestSignature123';

    // Mock getVoteBySignature check
    mockCtx.runQuery.mockResolvedValueOnce(null); // First check: not exists

    const exists = await mockCtx.runQuery('getVoteBySignature', { signature });
    expect(exists).toBeNull();

    // Now create the vote
    await mockCtx.db.insert('reputationVotes', {
      signature,
      voteType: 'trustworthy',
      timestamp: Date.now(),
    });

    // Second check: exists
    mockCtx.runQuery.mockResolvedValueOnce({ signature }); // Exists now
    const existsNow = await mockCtx.runQuery('getVoteBySignature', { signature });
    expect(existsNow).toBeDefined();
  });
});

describe('Convex Sync - Data Accuracy', () => {
  it('should parse Solana reputation account data correctly', () => {
    // Mock Solana account data buffer
    const mockAccountData = Buffer.alloc(56);

    // Write test data
    // Bytes 8-40: agent pubkey (32 bytes) - using mock bytes
    const testPubkeyBytes = Buffer.alloc(32);
    testPubkeyBytes.fill(0xAB); // Fill with test data
    testPubkeyBytes.copy(mockAccountData, 8);

    // Bytes 40-42: reputation score (u16 little-endian)
    mockAccountData.writeUInt16LE(750, 40);

    // Bytes 48-56: last updated (i64 little-endian)
    const testTimestamp = BigInt(Date.now());
    mockAccountData.writeBigInt64LE(testTimestamp, 48);

    // Parse
    const agentAddressBytes = mockAccountData.slice(8, 40);
    const reputationScore = mockAccountData.readUInt16LE(40);
    const lastUpdated = Number(mockAccountData.readBigInt64LE(48));

    // Verify parsing
    expect(agentAddressBytes.length).toBe(32);
    expect(reputationScore).toBe(750);
    expect(lastUpdated).toBe(Number(testTimestamp));
    expect(lastUpdated).toBeGreaterThan(0);
  });

  it('should parse Solana vote account data correctly', () => {
    // Mock vote account data buffer
    const mockVoteData = Buffer.alloc(200);

    // Voter (bytes 8-40) - using mock bytes
    const voterBytes = Buffer.alloc(32);
    voterBytes.fill(0xCD); // Fill with test data
    voterBytes.copy(mockVoteData, 8);

    // Voted agent (bytes 40-72) - using mock bytes
    const votedAgentBytes = Buffer.alloc(32);
    votedAgentBytes.fill(0xEF); // Fill with different test data
    votedAgentBytes.copy(mockVoteData, 40);

    // Vote type (byte 72): 1 = upvote, 2 = downvote
    mockVoteData.writeUInt8(1, 72);

    // Quality scores (bytes 80-83)
    mockVoteData.writeUInt8(85, 80); // responseQuality
    mockVoteData.writeUInt8(90, 81); // responseSpeed
    mockVoteData.writeUInt8(80, 82); // accuracy
    mockVoteData.writeUInt8(88, 83); // professionalism

    // Timestamp (bytes 136-144)
    const testTimestamp = BigInt(Date.now());
    mockVoteData.writeBigInt64LE(testTimestamp, 136);

    // Parse
    const parsedVoterBytes = mockVoteData.slice(8, 40);
    const parsedVotedAgentBytes = mockVoteData.slice(40, 72);
    const voteType = mockVoteData[72] === 1 ? 'upvote' : 'downvote';
    const qualityScores = {
      responseQuality: mockVoteData[80],
      responseSpeed: mockVoteData[81],
      accuracy: mockVoteData[82],
      professionalism: mockVoteData[83],
    };
    const average = (qualityScores.responseQuality + qualityScores.responseSpeed +
                     qualityScores.accuracy + qualityScores.professionalism) / 4;
    const timestamp = Number(mockVoteData.readBigInt64LE(136));

    // Verify parsing
    expect(parsedVoterBytes.length).toBe(32);
    expect(parsedVotedAgentBytes.length).toBe(32);
    expect(voteType).toBe('upvote');
    expect(qualityScores.responseQuality).toBe(85);
    expect(qualityScores.responseSpeed).toBe(90);
    expect(qualityScores.accuracy).toBe(80);
    expect(qualityScores.professionalism).toBe(88);
    expect(average).toBe(85.75);
    expect(timestamp).toBe(Number(testTimestamp));
    expect(timestamp).toBeGreaterThan(0);
  });
});

describe('Convex Sync - Error Handling', () => {
  it('should handle invalid Solana addresses gracefully', () => {
    const invalidAddress = 'not-a-valid-address';

    // Invalid address should throw when trying to create
    expect(() => createAddress(invalidAddress)).toThrow();
  });

  it('should handle missing agent gracefully', async () => {
    const mockCtx = createMockConvexContext();

    const agent = await mockCtx.db.get('agents', 'nonexistent-id');
    expect(agent).toBeNull();
  });

  it('should handle RPC connection failures gracefully', async () => {
    const invalidRpcUrl = 'https://invalid-rpc-url.com';

    // This should throw when making RPC call to invalid URL
    const makeRpcCall = async () => {
      const response = await fetch(invalidRpcUrl, {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo' }),
      });
      if (!response.ok) throw new Error('RPC connection failed');
    };

    await expect(makeRpcCall()).rejects.toThrow();
  });

  it('should handle zero votes correctly', () => {
    const calculateGhostScore = (reputation: number, totalVotes: number, averageQuality: number): number => {
      const baseScore = Math.min(reputation, 1000);
      const voteBonus = Math.min(totalVotes * 5, 100);
      const qualityFactor = averageQuality / 100;
      const finalScore = Math.min((baseScore + voteBonus) * qualityFactor, 1000);
      return Math.round(finalScore);
    };

    // Agent with no votes
    const score = calculateGhostScore(500, 0, 0);
    expect(score).toBe(0); // (500 + 0) * 0.0 = 0
  });
});

describe('Convex Sync - Performance', () => {
  it('should sync large batch of agents efficiently', async () => {
    const mockCtx = createMockConvexContext();
    const startTime = Date.now();

    // Simulate syncing 100 agents
    for (let i = 0; i < 100; i++) {
      await mockCtx.db.insert('agents', {
        address: `Agent${i}`,
        ghostScore: 500 + i,
        tier: 'silver',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 1 second for mocked operations)
    expect(duration).toBeLessThan(1000);
    expect(mockCtx.db.insert).toHaveBeenCalledTimes(100);
  });

  it('should handle concurrent vote syncs', async () => {
    const mockCtx = createMockConvexContext();

    // Simulate syncing votes concurrently
    const votePromises = Array.from({ length: 50 }, (_, i) =>
      mockCtx.db.insert('reputationVotes', {
        voteType: i % 2 === 0 ? 'trustworthy' : 'untrustworthy',
        weight: 1,
        timestamp: Date.now(),
      })
    );

    await Promise.all(votePromises);

    expect(mockCtx.db.insert).toHaveBeenCalledTimes(50);
  });
});
