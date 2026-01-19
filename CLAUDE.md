# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GhostSpeak v2 is a trust layer and reputation platform for autonomous AI agents in the x402 payment protocol ecosystem on Solana. It combines a Next.js 15.4 frontend, Convex serverless backend, and Rust/Anchor smart contracts.

## Development Commands

```bash
# Development
bun run dev              # Next.js dev server on port 3333 (Turbopack)
bun run dev:convex       # Convex backend dev server
bun run dev:all          # Both concurrently

# Building
bun run build            # Production build
bun run start            # Production server

# Code Quality
bun run lint             # ESLint
bun run lint:fix         # Auto-fix linting
bun run type-check       # TypeScript checking
bun run format           # Prettier formatting

# Testing
bun run test             # Vitest unit tests (watch mode)
bun run test:ui          # Vitest UI dashboard
bun run test:coverage    # Coverage report
bun run test:e2e         # Playwright E2E tests

# Solana (from contracts/ directory)
bun run build            # Anchor build
bun run deploy:devnet    # Deploy to Solana devnet
```

## Architecture

### Directory Structure

- `app/` - Next.js 15 App Router with route groups:
  - `(marketing)/` - Public pages
  - `(app)/` - Protected app pages (dashboard, observatory)
  - `api/` - Edge runtime API routes (seance/, observatory/, graphql/)
- `components/` - React components organized by domain (ui/, agent/, observatory/, layout/, wallet/)
- `convex/` - Serverless backend (schema, queries, mutations, crons)
- `contracts/` - Solana programs (Rust/Anchor) with 4 deployed programs
- `lib/` - Shared utilities (API clients, Solana helpers, x402 payment logic)
- `tests/` - Vitest unit and integration tests

### Key Systems

**API Routes:**
- `/api/seance/*` - Reputation API (agent data, credentials, capabilities, stats)
- `/api/observatory/*` - Real-time monitoring (agents, payments, health, events)
- `/api/graphql` - GraphQL Yoga endpoint

**Convex Backend (30+ tables):**
- Core: `users`, `agents`, `credentials`, `scoreHistory`
- Reputation: `reputationScores`, `reputationVotes`, `agentAttestations`, `agentCapabilities`
- Analytics: `agentTransactions`, `merchantAnalytics`, `merchantReviews`
- x402: `x402Payments`, `facilitators`, `facilitatorHealth`, `endpoints`
- Advanced: Vector search with 1536-dim OpenAI embeddings

**Solana Programs:**
1. `identity_registry` - Agent identity NFTs (Metaplex Core)
2. `reputation_registry` - On-chain reputation scores
3. `vote_registry` - Peer voting consensus
4. `validation_registry` - x402 payment proof verification

### Data Flow

```
Solana Programs (devnet) → Convex Crons (5-min) → Convex DB → React (real-time) → UI
```

Key sync files: `convex/crons.ts`, `convex/solanaSync.ts`, `convex/realDataCollection.ts`

## Tech Stack

- **Runtime:** Bun 1.3.4+
- **Frontend:** Next.js 15.4 (Turbopack), React 19.1, TailwindCSS 4, Radix UI
- **3D:** Three.js 0.182 with React Three Fiber 9.4
- **State:** Zustand 5, TanStack Query v5
- **Backend:** Convex 1.31+ (validators, explicit table names)
- **Blockchain:** Solana Web3.js v5, Anchor, Metaplex
- **AI:** Vercel AI SDK 6, ElizaOS 1.7, MCP SDK 1.25.1
- **Testing:** Vitest 4, Playwright 1.57

## Code Patterns

**React 19.2:**
- Refs as props (no `forwardRef`)
- `useActionState` for form submissions
- `useOptimistic` for instant UI updates

**Convex:**
- All functions use validators: `v.object({ field: v.string() })`
- Explicit table names: `ctx.db.get('users', id)` not `ctx.db.get(id)`
- Real-time queries via `useQuery` hooks

**Components:**
- CVA for variants (Button, Badge, Card)
- `cn()` utility for Tailwind class merging
- Path alias: `@/*` maps to project root

## Environment Setup

Required in `.env.local`:
```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
AI_GATEWAY_API_KEY=...
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

## Testing

- Unit tests in `tests/` using Vitest with jsdom
- Integration tests: `convex-sync.test.ts`, `solana-sync.test.ts`, `graphql-resolvers.test.ts`
- E2E tests with Playwright (Chrome, Firefox, Safari)
- Contract tests in `contracts/tests/`

## Formatting Standards

- 2-space indentation
- 100-character line width
- Single quotes, no semicolons
- Trailing commas (ES5)
