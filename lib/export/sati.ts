/**
 * SATI Export Format
 *
 * Exports GhostSpeak agent data in SATI (Solana Agent Trust Infrastructure) format
 * for ERC-8004 compatible interoperability.
 *
 * SATI uses:
 * - Token-2022 for identity NFTs with metadata extensions
 * - Solana Attestation Service (SAS) for attestations
 * - ERC-8004 style identity/reputation/validation registries
 */

// ==========================================
// SATI TYPE DEFINITIONS
// ==========================================

/**
 * SATI Agent Identity - ERC-8004 Identity Registry format
 * Maps to Token-2022 metadata for on-chain identity
 */
export interface SATIAgentIdentity {
  // Core identity (maps to Token-2022 metadata)
  agentAddress: string // Solana public key
  name: string
  description: string
  imageUri?: string

  // Identity metadata (Token-2022 additional metadata)
  metadata: {
    // ERC-8004 required fields
    registryVersion: string // '8004-v1'
    registryType: 'identity'
    createdAt: number
    updatedAt: number

    // Agent capabilities
    capabilities: string[]
    modelId?: string

    // Endpoints (for discovery)
    endpoints?: Array<{
      type: 'mcp' | 'http' | 'ws'
      url: string
    }>

    // Cross-chain references
    crossChainIds?: Array<{
      chain: string // CAIP-2 chain ID
      address: string
    }>
  }
}

/**
 * SATI Reputation Record - ERC-8004 Reputation Registry format
 */
export interface SATIReputationRecord {
  agentAddress: string

  // Overall score (0-1000, matching GhostSpeak)
  overallScore: number

  // Component scores
  scores: {
    trust: number // 0-100
    quality: number // 0-100
    reliability: number // 0-100
    economic: number // 0-100
    social: number // 0-100
  }

  // Metadata
  metadata: {
    registryVersion: string // '8004-v1'
    registryType: 'reputation'
    lastUpdated: number
    totalVotes: number
    totalTransactions: number
    attestationCount: number

    // GhostSpeak-specific
    ghostScoreTier: 'bronze' | 'silver' | 'gold' | 'platinum'
    pageRankScore?: number // From trust graph
  }
}

/**
 * SATI Attestation - Solana Attestation Service format
 */
export interface SATIAttestation {
  // Attestation identity
  attestationId: string // Unique identifier
  schemaId: string // SAS schema identifier

  // Parties
  attestor: string // Solana address of attester
  subject: string // Solana address of subject

  // Attestation data
  attestationType: string
  data: Record<string, unknown>

  // Validity
  issuedAt: number
  expiresAt?: number
  isRevoked: boolean

  // Verification
  signature?: string
  transactionId?: string
}

/**
 * SATI Validation Receipt - ERC-8004 Validation Registry format
 */
export interface SATIValidationReceipt {
  // Receipt identity
  receiptId: string
  transactionSignature: string

  // Payment details
  payer: string // Agent who paid
  payee: string // Agent who received
  amount: string // In base units (e.g., USDC atomic units)
  currency: string // 'USDC'
  network: string // CAIP-2 chain ID

  // Validation
  validatedAt: number
  validatorAddress: string // Facilitator address
  status: 'valid' | 'invalid' | 'disputed'

  // Metadata
  metadata: {
    registryVersion: string // '8004-v1'
    registryType: 'validation'
    facilitator: string // Facilitator slug
    endpoint?: string // API endpoint called
  }
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

/**
 * GhostSpeak agent data structure (input)
 */
interface GhostSpeakAgent {
  address: string
  name: string
  description: string
  capabilities: string[]
  model?: string
  endpoints?: Array<{ type: string; url: string }>
  ghostScore: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  createdAt: number
  updatedAt: number
}

/**
 * GhostSpeak reputation score (input)
 */
interface GhostSpeakReputation {
  agentAddress: string
  overallScore: number
  trustScore: number
  qualityScore: number
  reliabilityScore: number
  economicScore: number
  socialScore: number
  totalVotes: number
  totalAttestations: number
  pageRankScore?: number
  lastUpdated: number
}

/**
 * GhostSpeak attestation (input)
 */
interface GhostSpeakAttestation {
  id: string
  attestorAddress: string
  subjectAddress: string
  attestationType: string
  claims: Record<string, unknown>
  attestedAt: number
  expiresAt?: number
  isActive: boolean
  transactionId?: string
}

/**
 * GhostSpeak transaction (input)
 */
interface GhostSpeakTransaction {
  txSignature: string
  fromAddress: string
  toAddress: string
  amountUSDC: number
  network: string
  facilitatorSlug: string
  endpointUrl?: string
  timestamp: number
  status: 'confirmed' | 'pending' | 'failed'
}

/**
 * Export a GhostSpeak agent to SATI Identity format
 */
export function exportAgentToSATI(agent: GhostSpeakAgent): SATIAgentIdentity {
  return {
    agentAddress: agent.address,
    name: agent.name,
    description: agent.description,
    metadata: {
      registryVersion: '8004-v1',
      registryType: 'identity',
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      capabilities: agent.capabilities,
      modelId: agent.model,
      endpoints: agent.endpoints?.map((e) => ({
        type: e.type as 'mcp' | 'http' | 'ws',
        url: e.url,
      })),
    },
  }
}

/**
 * Export a GhostSpeak reputation score to SATI Reputation format
 */
export function exportReputationToSATI(
  rep: GhostSpeakReputation,
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
): SATIReputationRecord {
  return {
    agentAddress: rep.agentAddress,
    overallScore: rep.overallScore,
    scores: {
      trust: rep.trustScore,
      quality: rep.qualityScore,
      reliability: rep.reliabilityScore,
      economic: rep.economicScore,
      social: rep.socialScore,
    },
    metadata: {
      registryVersion: '8004-v1',
      registryType: 'reputation',
      lastUpdated: rep.lastUpdated,
      totalVotes: rep.totalVotes,
      totalTransactions: 0, // Would need to be computed
      attestationCount: rep.totalAttestations,
      ghostScoreTier: tier,
      pageRankScore: rep.pageRankScore,
    },
  }
}

/**
 * Export a GhostSpeak attestation to SATI Attestation format
 */
export function exportAttestationToSATI(
  attestation: GhostSpeakAttestation
): SATIAttestation {
  // Map GhostSpeak attestation types to SAS schema IDs
  const schemaIdMap: Record<string, string> = {
    capability_verification: 'ghostspeak:capability:v1',
    quality_attestation: 'ghostspeak:quality:v1',
    endorsement: 'ghostspeak:endorsement:v1',
    performance_review: 'ghostspeak:performance:v1',
    trust_attestation: 'ghostspeak:trust:v1',
  }

  return {
    attestationId: attestation.id,
    schemaId: schemaIdMap[attestation.attestationType] || 'ghostspeak:generic:v1',
    attestor: attestation.attestorAddress,
    subject: attestation.subjectAddress,
    attestationType: attestation.attestationType,
    data: attestation.claims,
    issuedAt: attestation.attestedAt,
    expiresAt: attestation.expiresAt,
    isRevoked: !attestation.isActive,
    transactionId: attestation.transactionId,
  }
}

/**
 * Export a GhostSpeak transaction to SATI Validation Receipt format
 */
export function exportTransactionToSATI(
  tx: GhostSpeakTransaction
): SATIValidationReceipt {
  // Convert network to CAIP-2 format
  const networkToCAIP2: Record<string, string> = {
    solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    base: 'eip155:8453',
    'base-sepolia': 'eip155:84532',
  }

  return {
    receiptId: `gs:${tx.txSignature}`,
    transactionSignature: tx.txSignature,
    payer: tx.fromAddress,
    payee: tx.toAddress,
    amount: (tx.amountUSDC * 1_000_000).toString(), // Convert to atomic units (6 decimals)
    currency: 'USDC',
    network: networkToCAIP2[tx.network] || tx.network,
    validatedAt: tx.timestamp,
    validatorAddress: tx.facilitatorSlug, // Would need to resolve to actual address
    status: tx.status === 'confirmed' ? 'valid' : tx.status === 'failed' ? 'invalid' : 'valid',
    metadata: {
      registryVersion: '8004-v1',
      registryType: 'validation',
      facilitator: tx.facilitatorSlug,
      endpoint: tx.endpointUrl,
    },
  }
}

// ==========================================
// BATCH EXPORT
// ==========================================

/**
 * Full SATI export bundle
 */
export interface SATIExportBundle {
  version: '1.0'
  exportedAt: number
  source: 'ghostspeak'

  identities: SATIAgentIdentity[]
  reputations: SATIReputationRecord[]
  attestations: SATIAttestation[]
  validations: SATIValidationReceipt[]

  // Summary stats
  stats: {
    totalAgents: number
    totalAttestations: number
    totalValidations: number
    exportTimestamp: number
  }
}

/**
 * Create a full SATI export bundle
 */
export function createSATIExportBundle(data: {
  agents: GhostSpeakAgent[]
  reputations: GhostSpeakReputation[]
  attestations: GhostSpeakAttestation[]
  transactions: GhostSpeakTransaction[]
}): SATIExportBundle {
  const now = Date.now()

  // Create agent map for tier lookup
  const agentTierMap = new Map(
    data.agents.map((a) => [a.address, a.tier])
  )

  return {
    version: '1.0',
    exportedAt: now,
    source: 'ghostspeak',

    identities: data.agents.map(exportAgentToSATI),

    reputations: data.reputations.map((rep) =>
      exportReputationToSATI(rep, agentTierMap.get(rep.agentAddress) || 'bronze')
    ),

    attestations: data.attestations.map(exportAttestationToSATI),

    validations: data.transactions
      .filter((tx) => tx.status === 'confirmed')
      .map(exportTransactionToSATI),

    stats: {
      totalAgents: data.agents.length,
      totalAttestations: data.attestations.length,
      totalValidations: data.transactions.filter((tx) => tx.status === 'confirmed').length,
      exportTimestamp: now,
    },
  }
}

/**
 * Serialize SATI export to JSON
 */
export function serializeSATIExport(bundle: SATIExportBundle): string {
  return JSON.stringify(bundle, null, 2)
}
