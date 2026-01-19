# GhostSpeak v2 🎃

**The Complete Trust Layer for Autonomous AI Agents**

> **Verify. Validate. Trust.**

Comprehensive trust infrastructure for the x402 ecosystem combining active endpoint verification, ERC-8004 compliant on-chain reputation, and deep observability across 12+ facilitators. From endpoint testing to cryptographic proof verification - we ensure agents transact with confidence.

**Status**: ✅ Backend Complete | 🔄 Phases 1-3 In Roadmap (ERC-8004, Verification, Dashboard)

## 🚀 Tech Stack

### Core Framework
- **Next.js 15.4** - App Router with React Server Components
- **React 19.2** - With new hooks (useActionState, useOptimistic, use())
- **TypeScript 5.9+** - Full type safety
- **Bun** - Package manager and runtime

### Backend
- **Convex 1.31+** - Serverless backend with real-time sync
  - Explicit table names (security)
  - Validators for type safety
  - Modular schema organization

### Blockchain
- **Solana Web3.js v5** - Modern modular SDK
- **@solana/kit** - Utilities for Solana development
- **Solana Devnet** - For development and testing

### Styling
- **TailwindCSS 4** - Utility-first CSS with PostCSS
- **Radix UI** - Accessible component primitives
- **CVA** - Class variance authority for component variants

### 3D & Animations
- **Three.js 0.182** - WebGPU-ready 3D engine
- **React Three Fiber 9.4** - React renderer for Three.js
- **@react-three/drei** - Helpers for R3F
- **GSAP 3.14** - Animation library
- **Framer Motion 12** - React animation library

### AI & Agents
- **Vercel AI SDK 6** - Streaming AI responses
- **ElizaOS 1.7** - AI agent framework
- **MCP SDK** - Model Context Protocol

### x402 Payment Protocol
- **x402-solana 2.0** - Core Solana x402 SDK
- **@payai/x402-solana-react** - PayAI React components
- **@coinbase/x402** - Coinbase CDP facilitator
- **x402-next** - Next.js middleware
- **12+ Facilitators** - PayAI, Coinbase CDP, Rapid402, OpenX402, and more

### State Management
- **Zustand 5** - Lightweight state management
- **TanStack Query v5** - Server state management

### Developer Tools
- **Vitest 4** - Unit testing
- **Playwright 1.57** - E2E testing
- **ESLint 9** - Linting (flat config)
- **Prettier 3.6** - Code formatting

## 📦 Project Structure

```
gs2/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   ├── providers.tsx        # Client providers
│   └── globals.css          # Global styles (Tailwind)
├── components/
│   ├── ui/                  # Reusable UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── badge.tsx
│   └── ghost-score-badge.tsx  # GhostSpeak-specific components
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── users.ts             # User queries/mutations
│   ├── agents.ts            # Agent queries/mutations
│   └── convex.config.ts
├── lib/
│   └── utils.ts             # Utility functions
├── public/                  # Static assets
├── .env.local.example       # Environment variables template
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs       # Tailwind PostCSS config
└── README.md
```

## 🛠️ Getting Started

### Prerequisites

- **Bun 1.3.4+** or Node.js 20+
- **Solana wallet** (for testing)

### Installation

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your Convex URL
```

### Development

```bash
# Run Next.js dev server (http://localhost:3333)
bun run dev

# Run Convex dev server (separate terminal)
bun run dev:convex

# Or run both concurrently
bun run dev:all
```

### Building

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## 🎯 What We Have ✅

### Backend Infrastructure (COMPLETE)
- ✅ **15/15 Seance API Routes** - Complete REST API
- ✅ **Real-time Data Collection** - From 12+ facilitators (PayAI, Coinbase, Dexter, etc.)
- ✅ **Comprehensive Schema** - 30+ tables, 930 lines, ERC-8004 ready
- ✅ **Merchant Analytics** - Time-series snapshots with smart fallback
- ✅ **Agent Reputation** - Multi-component scoring (trust, quality, reliability, economic, social)
- ✅ **Vector Search** - Semantic agent/merchant discovery
- ✅ **W3C Credentials** - Full verifiable credentials support
- ✅ **Observatory** - Real-time facilitator monitoring
- ✅ **Network Metrics** - Multi-chain performance tracking

### Tech Stack (2026-Ready)
- ✅ Next.js 15.4 + React 19.1
- ✅ Convex 1.31+ (secure, type-safe)
- ✅ Solana Web3.js v5
- ✅ TailwindCSS 4
- ✅ Vercel AI SDK 6
- ✅ ElizaOS 1.7

## 🚀 Roadmap to Market Leadership

### Phase 1: ERC-8004 Compliance (4-5 weeks) 🔄
**Goal:** First Solana-native ERC-8004 implementation

- [ ] Solana smart contracts (Identity, Reputation, Validation registries)
- [ ] Agent NFTs using Metaplex
- [ ] On-chain reputation updates
- [ ] Cryptographic payment proof verification
- [ ] Web3.js v5 integration

**Strategic Value:** First-mover on Solana, NFT marketplace compatibility

### Phase 2: Endpoint Verification (2-3 weeks) 🔄
**Goal:** Active verification (match zauthx402.com)

- [ ] Agentic testing framework (multi-LLM)
- [ ] Automated endpoint pentesting
- [ ] GitHub RepoScan integration
- [ ] GHOST Score for endpoints
- [ ] Real-time verification API

**Strategic Value:** Prevent agents from wasting credits on broken endpoints

### Phase 3: Web Dashboard (3-4 weeks) 🔄
**Goal:** Make data visible and actionable

- [ ] Agent discovery dashboard
- [ ] Endpoint explorer with verification badges
- [ ] Reputation visualization (charts, trends)
- [ ] Observatory real-time metrics
- [ ] Mobile responsive UI

**Strategic Value:** Developer experience, data accessibility

**Total Timeline:** 9-12 weeks to complete trust layer

## 🏆 Competitive Position

**vs zauthx402.com:**
- **Their Strength:** Endpoint verification (we're adding this in Phase 2)
- **Our Strength:** Facilitator monitoring, merchant analytics, comprehensive data
- **Combined:** Most complete trust platform when we finish all phases

**Differentiation:**
- ✅ **Breadth:** Covers MORE of trust stack (observation + verification + reputation)
- ✅ **Depth:** Time-series analytics, vector search, W3C credentials
- ✅ **Solana-First:** ERC-8004 on Solana (not just Ethereum)
- ✅ **Open Data:** Public API + web dashboard

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

### Convex Setup

```bash
# Initialize Convex (first time)
bunx convex dev

# This will:
# 1. Create a Convex account (if needed)
# 2. Create a deployment
# 3. Generate _generated files
# 4. Start the dev server
```

## 🎨 React 19.2 Modernizations

This project uses React 19.2 with modern patterns:

### useActionState (Forms)
```typescript
const [state, submitAction, isPending] = useActionState(async (prev, formData) => {
  // Handle form submission
}, initialState)
```

### useOptimistic (Optimistic UI)
```typescript
const [optimisticData, addOptimistic] = useOptimistic(data, (state, newItem) => {
  return [...state, newItem]
})
```

### Refs as Props (No forwardRef)
```typescript
// Old way (React 18)
const Input = forwardRef((props, ref) => <input ref={ref} {...props} />)

// New way (React 19)
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />
}
```

## 📚 Learn More

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [Convex Documentation](https://docs.convex.dev)
- [Solana Web3.js v5](https://solana-labs.github.io/solana-web3.js/)
- [TailwindCSS 4](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/primitives)

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines first.

---

Built with ❤️ using the latest 2026 web technologies
