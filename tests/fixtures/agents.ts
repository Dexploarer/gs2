/**
 * Test Fixtures: Agents
 *
 * Provides consistent test data for agent-related tests
 */

export const mockAgent = {
  _id: 'agents_1_1234567890',
  address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  name: 'Test Agent',
  description: 'A test agent for unit tests',
  ghostScore: 750,
  tier: 'gold' as const,
  status: 'active' as const,
  isActive: true,
  isVerified: true,
  category: 'ai',
  capabilities: ['text-generation', 'data-analysis'],
  model: 'gpt-4',
  transactionCount: 100,
  successfulPayments: 95,
  failedPayments: 5,
  totalVolumeUSDC: 250.50,
  createdAt: Date.now() - 86400000, // 1 day ago
  updatedAt: Date.now(),
}

export const mockAgentBronze = {
  ...mockAgent,
  _id: 'agents_2_1234567891',
  address: 'BronzeAgt2CW87d97TXJSDpbD5jBkheTqA83TZRuJoAsU',
  name: 'Bronze Agent',
  ghostScore: 450,
  tier: 'bronze' as const,
  status: 'active' as const,
}

export const mockAgentSilver = {
  ...mockAgent,
  _id: 'agents_3_1234567892',
  address: 'SilverAgt3CW87d97TXJSDpbD5jBkheTqA83TZRuJoAsU',
  name: 'Silver Agent',
  ghostScore: 650,
  tier: 'silver' as const,
  status: 'active' as const,
}

export const mockAgentPlatinum = {
  ...mockAgent,
  _id: 'agents_4_1234567893',
  address: 'PlatinumA4CW87d97TXJSDpbD5jBkheTqA83TZRuJoAsU',
  name: 'Platinum Agent',
  ghostScore: 950,
  tier: 'platinum' as const,
  status: 'active' as const,
}

export const mockAgentInactive = {
  ...mockAgent,
  _id: 'agents_5_1234567894',
  address: 'InactiveA5CW87d97TXJSDpbD5jBkheTqA83TZRuJoAsU',
  name: 'Inactive Agent',
  status: 'inactive' as const,
  isActive: false,
}

export const mockAgentList = [
  mockAgent,
  mockAgentBronze,
  mockAgentSilver,
  mockAgentPlatinum,
]

export const mockAgentProfile = {
  _id: 'profiles_1_1234567890',
  agentId: mockAgent._id,
  model: 'gpt-4',
  modelVersion: '4.0',
  provider: 'openai',
  avgResponseTime: 150,
  totalRequests: 1000,
  successfulRequests: 980,
  failedRequests: 20,
  uptime: 99.5,
  totalEarningsUSDC: 500.00,
  totalSpendingUSDC: 50.00,
  avgPricePerRequest: 0.05,
  primaryCategory: 'ai' as const,
  tags: ['fast', 'reliable'],
  errorRate: 2.0,
  avgLatency: 150,
  p95Latency: 300,
  p99Latency: 500,
  endorsements: 25,
  attestations: 10,
  firstSeenAt: Date.now() - 86400000 * 30,
  lastActiveAt: Date.now() - 3600000,
  profileUpdatedAt: Date.now(),
}

export const mockAgentCapability = {
  _id: 'capabilities_1_1234567890',
  agentId: mockAgent._id,
  capability: 'text-generation',
  level: 'advanced' as const,
  confidence: 95,
  usageCount: 500,
  successRate: 98,
  avgResponseTime: 120,
  priceUSDC: 0.01,
  demonstratedAt: Date.now() - 86400000 * 7,
  lastUsedAt: Date.now() - 3600000,
  isVerified: true,
  verifiedBy: 'ghostspeak-system',
  verifiedAt: Date.now() - 86400000,
}

export const mockCredential = {
  _id: 'credentials_1_1234567890',
  credentialId: 'vc-123-456',
  agentId: mockAgent._id,
  type: 'GhostSpeakTrust',
  issuedBy: 'ghostspeak-issuer',
  issuedAt: Date.now() - 86400000,
  expiresAt: Date.now() + 86400000 * 365,
  isRevoked: false,
  claims: {
    name: 'Test Agent',
    capabilities: ['text-generation'],
    score: 750,
  },
}

export const mockReputationScore = {
  _id: 'reputation_1_1234567890',
  subjectType: 'agent' as const,
  subjectAgentId: mockAgent._id,
  overallScore: 750,
  trustScore: 85,
  qualityScore: 90,
  reliabilityScore: 95,
  economicScore: 70,
  socialScore: 80,
  totalVotes: 100,
  positiveVotes: 85,
  negativeVotes: 15,
  totalAttestations: 10,
  totalReviews: 50,
  avgReviewRating: 4.5,
  scoreChange7d: 15,
  scoreChange30d: 50,
  trend: 'rising' as const,
  rank: 42,
  lastCalculatedAt: Date.now(),
  nextCalculationAt: Date.now() + 3600000,
}

// Helper to create agent with custom properties
export function createMockAgent(overrides: Partial<typeof mockAgent> = {}) {
  return {
    ...mockAgent,
    _id: `agents_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}

// Calculate tier from score
export function calculateTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (score >= 900) return 'platinum'
  if (score >= 700) return 'gold'
  if (score >= 400) return 'silver'
  return 'bronze'
}
