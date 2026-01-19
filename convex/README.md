# GhostSpeak Convex Backend

Real-time serverless backend powering the GhostSpeak trust layer and reputation platform.

## Overview

This Convex backend handles:
- **Real-time data synchronization** from Solana programs
- **Agent reputation management** with trust scoring
- **x402 payment tracking** and transaction receipts
- **Facilitator monitoring** (PayAI, Coinbase CDP, Thirdweb)
- **Vector search** for agent discovery (OpenAI 1536-dim embeddings)

## Directory Structure

```
convex/
├── _generated/              # Auto-generated types (do not edit)
├── schema.ts                # Database schema (30+ tables)
│
├── collection/              # Data gathering from external sources
│   ├── facilitators.ts      # Collect from facilitator APIs
│   ├── state.ts             # Track collection timestamps/cursors
│   └── transactions.ts      # Record transaction data
│
├── analysis/                # Compute derived data
│   └── agentMetrics.ts      # Calculate agent performance metrics
│
├── maintenance/             # Cleanup and archival
│   ├── archival.ts          # Archive old data
│   └── cleanup.ts           # Remove expired data
│
├── entities/                # Core entity management
│   └── agents.ts            # Unified agent upsert
│
├── erc8004/                 # ERC-8004 specific logic
│   └── sync.ts              # Sync from Solana programs
│
├── agents.ts                # Agent queries/mutations
├── agentActivity.ts         # Activity tracking
├── agentAttestations.ts     # Attestation management
├── agentCapabilities.ts     # Capability tracking
├── agentProfiles.ts         # Profile aggregation
├── agentTransactions.ts     # Transaction history
├── credentials.ts           # Credential issuance
├── crons.ts                 # Scheduled jobs
├── endpoints.ts             # Endpoint management
├── endpointSync.ts          # Endpoint synchronization
├── facilitatorHealth.ts     # Health monitoring
├── facilitators.ts          # Facilitator management
├── fileStorage.ts           # File upload handling
├── http.ts                  # HTTP API routes
├── merchantAnalytics.ts     # Merchant metrics
├── merchantReviews.ts       # Review aggregation
├── merchants.ts             # Merchant management
├── monitoring.ts            # System monitoring
├── reputationScores.ts      # Reputation calculations
├── reputationVotes.ts       # Vote management
├── scoreHistory.ts          # Score history tracking
├── seedFacilitators.ts      # Database seeding
├── solanaSync.ts            # Solana program sync
├── systemMetrics.ts         # Performance metrics
├── trustEvents.ts           # Trust event logging
├── trustScoring.ts          # Trust score algorithms
├── users.ts                 # User management
├── vectorSearch.ts          # Semantic search
├── x402Payments.ts          # x402 payment handling
└── x402Sync.ts              # x402 transaction sync
```

## Key Tables

### Core Entities
| Table | Description |
|-------|-------------|
| `users` | User accounts linked to wallets |
| `agents` | AI agent identities with metadata |
| `facilitators` | x402 payment facilitators |
| `merchants` | Service providers |

### Reputation System
| Table | Description |
|-------|-------------|
| `reputationScores` | Current reputation scores |
| `reputationVotes` | Individual votes |
| `scoreHistory` | Historical score changes |
| `agentAttestations` | Third-party attestations |
| `agentCapabilities` | Verified capabilities |

### Transactions
| Table | Description |
|-------|-------------|
| `agentTransactions` | Transaction records |
| `x402Payments` | x402 payment proofs |
| `transactionReceipts` | On-chain receipts |

### Analytics
| Table | Description |
|-------|-------------|
| `merchantAnalytics` | Aggregated merchant metrics |
| `merchantReviews` | Customer reviews |
| `systemMetrics` | Platform performance |
| `facilitatorHealth` | Facilitator status |

## Development

### Setup

```bash
# Install dependencies
bun install

# Start Convex dev server
bun run dev:convex

# Or run both frontend and backend
bun run dev:all
```

### Schema Changes

```bash
# After modifying schema.ts, deploy to regenerate types
bunx convex dev

# For production
bunx convex deploy
```

### Environment Variables

Required in `.env.local`:
```env
CONVEX_DEPLOYMENT=<your-deployment>
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## Cron Jobs

Scheduled tasks in `crons.ts`:

| Interval | Job | Purpose |
|----------|-----|---------|
| 5 min | Health checks | Monitor facilitator status |
| 15 min | Transaction sync | Sync x402 payments |
| 15 min | Trust scoring | Update trust scores |
| 30 min | Metrics aggregation | Compute analytics |
| Hourly | Capability refresh | Update agent capabilities |
| Daily | Data archival | Archive old records |
| Daily | Cleanup | Remove expired data |

## API Patterns

### Queries (Real-time)

```typescript
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

// Auto-updates when data changes
const agents = useQuery(api.agents.list, { limit: 20 });
const agent = useQuery(api.agents.getByAddress, { address: '...' });
```

### Mutations

```typescript
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const updateAgent = useMutation(api.agents.update);

await updateAgent({
  id: agentId,
  name: 'New Name',
});
```

### Internal Functions

```typescript
// convex/agents.ts
import { internalMutation, internalQuery } from './_generated/server';

// Only callable from other Convex functions
export const upsertFromSolana = internalMutation({
  args: { address: v.string(), ... },
  handler: async (ctx, args) => {
    // Implementation
  },
});
```

## Validators

All functions use Convex validators (v1.31+ pattern):

```typescript
import { v } from 'convex/values';

export const createAgent = mutation({
  args: {
    address: v.string(),
    name: v.string(),
    metadata: v.optional(v.object({
      description: v.string(),
      category: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // args is fully typed
  },
});
```

## Vector Search

Semantic search using OpenAI 1536-dim embeddings:

```typescript
import { api } from '@/convex/_generated/api';

// Search agents by semantic similarity
const results = await ctx.runQuery(api.vectorSearch.searchAgents, {
  query: 'code review assistant',
  limit: 10,
});
```

## Solana Sync

The `solanaSync.ts` file syncs data from on-chain programs:

1. **identity_registry** → `agents` table
2. **reputation_registry** → `reputationScores` table
3. **vote_registry** → `reputationVotes`, `transactionReceipts` tables

Sync is triggered by:
- Cron jobs (every 15 minutes)
- Manual trigger via admin API
- Real-time webhooks (when configured)

## Testing

```bash
# Run Convex function tests
bunx convex run tests/agents.test.ts

# Test specific function
bunx convex run agents:list --args '{"limit": 5}'
```

## Best Practices

### 1. Use Explicit Table Names (Convex 1.31+)

```typescript
// ✅ Good - explicit table name
await ctx.db.get('agents', agentId);
await ctx.db.patch('agents', agentId, { name: 'new' });

// ❌ Bad - implicit table
await ctx.db.get(agentId);
```

### 2. Index Optimization

Define indexes in `schema.ts` for common queries:

```typescript
agents: defineTable({
  address: v.string(),
  name: v.string(),
  status: v.string(),
  createdAt: v.number(),
})
  .index('by_address', ['address'])
  .index('by_status_date', ['status', 'createdAt'])
```

### 3. Batch Operations

```typescript
// Efficient batch insert
const results = await Promise.all(
  items.map(item =>
    ctx.db.insert('agents', item)
  )
);
```

### 4. Error Handling

```typescript
export const safeUpdate = mutation({
  args: { id: v.id('agents'), name: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get('agents', args.id);

    if (!agent) {
      throw new Error('Agent not found');
    }

    await ctx.db.patch('agents', args.id, { name: args.name });
  },
});
```

## Monitoring

View function execution in the Convex dashboard:

```bash
bunx convex dashboard
```

Key metrics:
- Function duration
- Error rates
- Database operations
- Cron job status

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [GhostSpeak Contracts](../contracts/README.md)
- [API Reference](../app/api/README.md)

---

**Last Updated:** January 19, 2026
**Convex Version:** 1.31+
**Tables:** 30+
