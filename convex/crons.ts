/**
 * Convex Cron Jobs
 *
 * Tiered scheduled tasks for GhostSpeak v2 data collection, analysis, and maintenance.
 *
 * Schedule Tiers:
 * - 5 min:  Critical monitoring (health checks, anomaly detection)
 * - 15 min: Data collection (transactions, activity, trust scores)
 * - 30 min: Data aggregation (merchant discovery, reputation, network stats)
 * - Hourly: Analysis & reporting (trending, rankings, performance reports)
 * - Daily:  Maintenance (archival, cleanup, credentials, validation)
 */

import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// ==========================================
// EVERY 5 MINUTES - Critical Monitoring (2 jobs)
// ==========================================
// Reduced from 8 jobs to 2 for efficiency

// Monitor facilitator health
crons.interval(
  'monitor facilitator health',
  { minutes: 5 },
  internal.monitoring.monitorAllFacilitators
)

// Detect anomalies (success rate drops, health failures, volume spikes)
crons.interval(
  'detect anomalies',
  { minutes: 5 },
  internal.analysis.anomalies.detectAll
)

// ==========================================
// EVERY 15 MINUTES - Data Collection (3 jobs)
// ==========================================

// Collect transactions from all facilitators
crons.interval(
  'collect transactions',
  { minutes: 15 },
  internal.collection.facilitators.collectAllTransactions
)

// Collect agent activity from facilitators
crons.interval(
  'collect agent activity',
  { minutes: 15 },
  internal.collection.facilitators.collectAllActivity
)

// Recalculate trust scores for active endpoints
crons.interval(
  'recalculate trust scores',
  { minutes: 15 },
  internal.trustScoring.recalculateAllScores
)

// Sync token staking vaults from on-chain data
crons.interval(
  'sync staking vaults',
  { minutes: 15 },
  internal.tokenStaking.syncAllVaults
)

// Sync stake positions from on-chain staking program
crons.interval(
  'sync staking program',
  { minutes: 15 },
  internal.tokenStaking.syncAllFromProgram
)

// ==========================================
// EVERY 30 MINUTES - Data Aggregation (3 jobs)
// ==========================================

// Sync agents from Solana blockchain
crons.interval(
  'sync blockchain agents',
  { minutes: 30 },
  internal.collection.blockchain.syncAllAgents
)

// Discover merchants from facilitators
crons.interval(
  'discover merchants',
  { minutes: 30 },
  internal.collection.facilitators.discoverAllMerchants
)

// Update network-wide statistics
crons.interval(
  'update network stats',
  { minutes: 30 },
  internal.analysis.metrics.updateNetworkStats
)

// ==========================================
// EVERY HOUR - Analysis & Reporting (4 jobs)
// ==========================================

// Update agent performance metrics
crons.hourly(
  'update agent metrics',
  { minuteUTC: 5 },
  internal.analysis.metrics.updateAgentMetrics
)

// Calculate trending agents
crons.hourly(
  'calculate trending agents',
  { minuteUTC: 15 },
  internal.analysis.metrics.calculateTrending
)

// Update facilitator rankings
crons.hourly(
  'update facilitator rankings',
  { minuteUTC: 30 },
  internal.analysis.metrics.updateFacilitatorRankings
)

// Snapshot merchant analytics
crons.hourly(
  'snapshot merchant analytics',
  { minuteUTC: 45 },
  internal.analysis.metrics.snapshotMerchantAnalytics
)

// Calculate PageRank for trust graph (web-of-trust)
crons.hourly(
  'calculate trust graph pagerank',
  { minuteUTC: 50 },
  internal.trustGraph.calculatePageRank
)

// ==========================================
// EVERY 6 HOURS - Program Governance (1 job)
// ==========================================

// Monitor program upgrade authorities
crons.interval(
  'monitor program authorities',
  { hours: 6 },
  internal.programGovernance.monitorAllAuthorities
)

// ==========================================
// DAILY TASKS - Maintenance (7 jobs)
// ==========================================

// Archive historical data (keep last 90 days detailed)
crons.daily(
  'archive historical data',
  { hourUTC: 1, minuteUTC: 0 },
  internal.maintenance.archival.archiveAll
)

// Cleanup old health records
crons.daily(
  'cleanup old health records',
  { hourUTC: 2, minuteUTC: 0 },
  internal.monitoring.cleanupOldHealthRecords
)

// Auto-issue credentials for qualifying agents
crons.daily(
  'auto-issue credentials',
  { hourUTC: 3, minuteUTC: 0 },
  internal.credentials.autoIssue,
  {}
)

// Run data cleanup (expired credentials, stale incidents, inactive agents)
crons.daily(
  'cleanup expired data',
  { hourUTC: 8, minuteUTC: 0 },
  internal.maintenance.cleanup.cleanupAll
)

// Validate agent identities and data integrity
crons.daily(
  'validate agent identities',
  { hourUTC: 9, minuteUTC: 0 },
  internal.maintenance.cleanup.validateAgentIdentities
)

// Recalculate all trust paths (web-of-trust graph traversal)
crons.daily(
  'recalculate trust paths',
  { hourUTC: 4, minuteUTC: 0 },
  internal.trustGraph.recalculateAllPaths
)

// Cleanup expired trust paths
crons.daily(
  'cleanup expired trust paths',
  { hourUTC: 5, minuteUTC: 0 },
  internal.trustGraph.cleanupExpiredPaths
)

// Verify staking vault balances match recorded stakes
crons.daily(
  'verify vault balances',
  { hourUTC: 6, minuteUTC: 0 },
  internal.tokenStaking.verifyVaultBalances
)

// Update unlocking stakes (past lock period)
crons.daily(
  'update unlocking stakes',
  { hourUTC: 7, minuteUTC: 0 },
  internal.tokenStaking.updateUnlockingStakes
)

export default crons

/*
 * SCHEDULE SUMMARY:
 *
 * | Interval | Jobs | Purpose                                         |
 * |----------|------|------------------------------------------------|
 * | 5 min    | 2    | Health checks, anomaly detection                |
 * | 15 min   | 5    | Transactions, activity, trust, vault + program sync |
 * | 30 min   | 3    | Blockchain sync, merchants, network stats       |
 * | Hourly   | 5    | Metrics, trending, rankings, analytics, pagerank|
 * | 6 hours  | 1    | Program governance monitoring                   |
 * | Daily    | 9    | Archival, cleanup, credentials, trust, staking  |
 *
 * Total: 25 jobs
 *
 * WEB-OF-TRUST JOBS:
 * - Hourly: PageRank calculation for trust graph authority
 * - Daily: Trust path recalculation and cleanup
 *
 * TOKEN STAKING JOBS:
 * - 15 min: Sync vault deposits + on-chain staking program accounts
 * - Daily: Verify vault balances, update unlocking stakes
 */
