# GhostSpeak v2 - Master TODO

Extracted from documentation review (January 2026).

---

## Phase 2: Post-Devnet Enhancements ✅ COMPLETE

### Smart Contract Features
- [x] **Agent Staking Mechanism** - Added `staked_amount` to AgentIdentity, implemented `stake_collateral()`, `unstake_collateral()`, `slash_agent()` with quadratic slashing curve (SIMD-0212 pattern)
- [x] **Multi-Sig Reputation Authority** - Implemented in `reputation_registry` with proposal/approval workflow, configurable threshold (2-of-3, 3-of-5)
- [x] **Time-Weighted Reputation Decay** - Added decay mechanics with 90-day half-life, 30-day grace period, configurable decay rate
- [x] **Attestation Timestamps** - Already present in `vote_registry` state files (PeerVote.timestamp, TransactionReceipt.timestamp, AgentEndorsement.timestamp)

### Testing
- [x] **30-Day Voting Window Tests** - Added comprehensive tests in `contracts/tests/vote-registry/voting-window.test.ts`
- [x] **Integer Arithmetic Review** - All arithmetic uses checked/saturating operations, overflow-checks enabled in Cargo.toml

### Infrastructure
- [x] **Emergency Pause Mechanism** - Added `ProgramConfig` with pause/unpause instructions
- [x] **Rate Limiting** - Added per-user rate limiting with `UserRateLimit` accounts
- [x] **Convex README** - Created comprehensive `convex/README.md` documentation
- [x] **Real-time Updates (SSE)** - Added `app/api/observatory/stream/route.ts` for external clients

---

## Phase 3: Production Preparation

### Smart Contract Features
- [x] **Reputation Graph/Endorsements** - Full web-of-trust with PageRank (`convex/trustGraph.ts`, `trustRelationships`/`trustGraphMetrics`/`trustPaths` tables)
- [x] **Upgrade Authority Management** - Complete with `lib/solana/upgrade-authority.ts`, `multisig-client.ts`, `convex/programGovernance.ts`

### Testing & Security
- [ ] **Comprehensive Security Audit** - External audit before mainnet
- [ ] **Bug Bounty Program** - Setup and launch

### Infrastructure
- [x] **MCP Server npm Package** - `@ghostspeak/mcp-server` ready for publishing (exports, types, LICENSE)

---

## Phase 4: Advanced Features (1-2 Months)

### x402 Protocol
- [x] **x402 `upto` Scheme Support** - Variable pricing with pre-authorized maximum (`lib/x402/schemes.ts`, `convex/x402Schemes.ts`)
- [x] **x402 `subscription` Scheme Support** - Recurring payments with billing periods (`convex/schema.ts` tables, full CRUD)
- [x] **x402 `batch` Scheme Support** - Multiple payments in single transaction (atomic/best-effort modes)

### Advanced Trust
- [ ] **TEE-based Reputation Aggregation** - Intel TDX / AMD SEV attestation
- [ ] **Cross-chain Receipt Verification** - Verify payments from other chains
- [ ] **ZK-Proof of Inference** - Cryptographically prove AI model outputs (research phase)

### Monitoring & Analytics
- [ ] **Advanced Analytics** - Reputation trends, quality heatmaps

---

## Completed Implementations (January 19, 2026)

### Identity Registry (`contracts/programs/identity_registry/`)
- `state.rs` - Enhanced with staking fields, ProgramConfig, UserRateLimit
- `instructions/stake.rs` - Complete staking implementation (stake/unstake/slash/pause)
- `instructions/admin.rs` - Program pause and rate limiting
- `lib.rs` - All new instruction entrypoints

### Reputation Registry (`contracts/programs/reputation_registry/`)
- `state/mod.rs` - Added MultisigAuthority, MultisigProposal, decay fields on AgentReputation
- `instructions/multisig.rs` - Complete multi-sig workflow (propose/approve/execute)
- `instructions/decay.rs` - Time-weighted decay instructions
- `lib.rs` - All new instruction entrypoints

### Vote Registry (`contracts/programs/vote_registry/`)
- `instructions/cast_peer_vote.rs` - Fixed arithmetic to use saturating operations

### Configuration
- `contracts/Cargo.toml` - Added overflow-checks for dev profile

### Tests
- `contracts/tests/vote-registry/voting-window.test.ts` - 30-day window tests

### Documentation
- `convex/README.md` - Comprehensive backend documentation

### API
- `app/api/observatory/stream/route.ts` - SSE endpoint for real-time updates

### Phase 3 Implementations (January 19, 2026)

#### Trust Graph / Web-of-Trust
- `convex/schema.ts` - Added `trustRelationships`, `trustGraphMetrics`, `trustPaths` tables
- `convex/trustGraph.ts` - PageRank algorithm, BFS path finding, Sybil resistance
- `convex/crons.ts` - Hourly PageRank, daily path recalculation, expired path cleanup

#### Upgrade Authority Management
- `lib/solana/upgrade-authority.ts` - Program authority utilities (fetch, transfer, monitor)
- `lib/solana/multisig-client.ts` - Multi-sig governance client for reputation registry
- `lib/solana/index.ts` - Unified exports for Solana utilities
- `convex/schema.ts` - Added `programAuthorities`, `authorityChangeEvents`, `multisigProposals` tables
- `convex/programGovernance.ts` - Authority monitoring, alerts, proposal sync
- `convex/crons.ts` - 6-hourly authority monitoring

#### MCP Server Package
- `contracts/mcp-server/package.json` - npm publishing configuration
- `contracts/mcp-server/src/tools.ts` - Exported tool definitions and types
- `contracts/mcp-server/LICENSE` - MIT license
- `contracts/mcp-server/tsconfig.json` - TypeScript declarations enabled

### Phase 4 Implementations (January 19, 2026)

#### x402 Extended Payment Schemes
- `lib/x402/schemes.ts` - Type definitions and utilities for upto/subscription/batch schemes
- `lib/x402/index.ts` - Unified exports for all x402 modules
- `convex/schema.ts` - Added 6 new tables:
  - `x402Subscriptions` - Recurring payment subscriptions
  - `x402SubscriptionPayments` - Individual subscription payments
  - `x402UptoAuthorizations` - Variable pricing authorizations
  - `x402UptoCharges` - Charges against upto authorizations
  - `x402BatchPayments` - Batch payment tracking
  - `x402BatchPaymentItems` - Individual items within batches
- `convex/x402Schemes.ts` - Complete Convex functions:
  - Upto: `createUptoAuthorization`, `chargeUptoAuthorization`, `revokeUptoAuthorization`
  - Subscription: `createSubscription`, `recordSubscriptionPayment`, `cancelSubscription`, `getDueSubscriptions`
  - Batch: `createBatchPayment`, `updateBatchPaymentItem`, `getBatchPayment`
  - Internal: `expireUptoAuthorizations`, `expireSubscriptions` (for crons)

---

## Source References

- `contracts/COMPETITIVE_ANALYSIS_2026.md` - Enhancement roadmap and security checklist
- `contracts/DEVNET_DEPLOYMENT.md` - Phase definitions
- `contracts/sdk/README.md` - x402 SDK documentation
- `contracts/tests/README.md` - Testing guide

---

**Last Updated**: January 19, 2026
**Phase 2 Status**: COMPLETE ✅
**Phase 3 Status**: Core features COMPLETE ✅ (Security audit & bug bounty pending)
**Phase 4 Status**: x402 Protocol COMPLETE ✅ (Advanced Trust & Analytics pending)
