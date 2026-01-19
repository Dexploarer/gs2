# x402 Facilitator Registry

Complete guide to all x402 payment facilitators supporting Solana and multi-chain networks.

---

## Overview

As of January 2026, there are **12+ active x402 facilitators** supporting Solana. This document provides a comprehensive comparison to help you choose the right facilitator for your application.

---

## Market Leaders (Solana)

### 1. PayAI Network ⭐ **#1 on Solana**

- **Website**: https://facilitator.payai.network
- **GitHub**: https://github.com/PayAINetwork/x402-solana
- **Market Share**: 69.4% (Solana-dominant)
- **Status**: Active, Production-ready

**Networks Supported**:
- Solana Mainnet & Devnet
- Base Mainnet
- Avalanche, Polygon, Sei, IoTeX, Peaq, XLayer, SKALE

**Performance**:
- Uptime: 99.9%
- Avg Response Time: 398ms
- Daily Volume: $18.5K
- Daily Transactions: 616K+
- Success Rate: 99.1%

**Features**:
- ✅ Gasless payments
- ✅ Free (no fees)
- ✅ < 1 minute setup
- ✅ Multi-chain (8+ networks)
- ✅ Works with all Solana wallets

**SDK**:
```bash
bun add x402-solana @payai/x402-solana-react
```

**Use Case**: Best for **high-volume Solana applications**, fastest time-to-market, and developers who want the most battle-tested facilitator.

---

### 2. Coinbase CDP

- **Website**: https://docs.cdp.coinbase.com/x402
- **GitHub**: https://github.com/coinbase/x402
- **Market Share**: 30.6%
- **Status**: Active, Enterprise-grade

**Networks Supported**:
- Solana Mainnet & Devnet
- Base Mainnet & Sepolia

**Performance**:
- Uptime: 99.8%
- Avg Response Time: 2000ms
- Daily Volume: $12K
- Daily Transactions: 400K
- Success Rate: 98.2%

**Features**:
- ✅ Fee-free USDC settlement
- ✅ Enterprise reliability
- ✅ CDP platform integration
- ✅ Official Coinbase support

**SDK**:
```bash
bun add @coinbase/x402
```

**Authentication**:
Requires CDP API key (set `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`)

**Use Case**: Best for **Base-first applications**, enterprises requiring SLAs, and teams already using Coinbase infrastructure.

---

## Production Facilitators

### 3. Rapid402

- **Website**: https://rapid402.com
- **GitHub**: https://github.com/rapid402/rapid402-sdk
- **Status**: Active, Production-ready

**Networks Supported**:
- Solana Mainnet & Devnet
- Base, BNB, Bitcoin

**Performance**:
- Uptime: 99.7%
- Avg Response Time: 450ms
- Daily Volume: $4.1K
- Daily Transactions: 136K
- Success Rate: 98.9%

**Features**:
- ✅ TypeScript-first SDK
- ✅ Developer-focused
- ✅ Production-ready
- ✅ Multi-token support

**Pricing**: 0.5% fee

**Use Case**: Best for **developer experience**, TypeScript projects, and teams wanting comprehensive SDK documentation.

---

### 4. OpenX402.ai

- **Website**: https://openx402.ai
- **Status**: Active, Production

**Networks Supported**:
- Solana, Base, Avalanche, Polygon, Sei, IoTeX, Peaq (Omnichain)

**Performance**:
- Uptime: 99.5%
- Avg Response Time: 850ms
- Daily Volume: $3.2K
- Daily Transactions: 106K
- Success Rate: 97.8%

**Features**:
- ✅ Permissionless
- ✅ Gasless
- ✅ Omnichain (7+ networks)
- ✅ No registration required

**Pricing**: Free

**Use Case**: Best for **multi-chain applications**, projects requiring widest network coverage, and permissionless deployments.

---

### 5. Corbits

- **Website**: (Contact for access)
- **Status**: Active, Enterprise

**Networks Supported**:
- Solana, Base, Avalanche, Polygon

**Performance**:
- Uptime: 99.6%
- Avg Response Time: 620ms
- Daily Volume: $2.8K
- Daily Transactions: 93K
- Success Rate: 98.5%

**Features**:
- ✅ Multi-token support
- ✅ Multi-payment schemes
- ✅ Enterprise-focused
- ✅ Custom SLAs available

**Pricing**: 0.3% fee

**Use Case**: Best for **enterprise deployments** requiring custom configurations and SLAs.

---

### 6. Dexter

- **Website**: (Contact for access)
- **Status**: Active, Production

**Networks Supported**:
- Solana, Base

**Performance**:
- Uptime: 99.4%
- Avg Response Time: 720ms
- Daily Volume: $2.1K
- Daily Transactions: 70K
- Success Rate: 98.1%

**Features**:
- ✅ Integrated marketplace
- ✅ Cross-chain bridge
- ✅ Agent discovery
- ✅ Facilitator + marketplace combo

**Pricing**: 0.4% fee

**Use Case**: Best for **applications wanting marketplace integration** alongside payment facilitation.

---

### 7. Hydra Protocol

- **Website**: (Decentralized network)
- **Status**: Active, Beta

**Networks Supported**:
- Solana, Base

**Performance**:
- Uptime: 99.3%
- Avg Response Time: 980ms
- Daily Volume: $1.8K
- Daily Transactions: 60K
- Success Rate: 97.6%

**Features**:
- ✅ Decentralized node network
- ✅ Permissionless
- ✅ No single point of failure
- ✅ Run your own node

**Pricing**: 0.2% fee

**Use Case**: Best for **applications prioritizing decentralization** and censorship resistance.

---

## Development & Testing

### 8. Kora RPC (Backend Infrastructure)

- **Website**: https://solana.com/developers/guides/getstarted/build-a-x402-facilitator
- **Type**: Signer node / Backend service

**Features**:
- ✅ Gasless transaction signing
- ✅ Backend for facilitators
- ✅ Fee abstraction
- ✅ Solana-native

**Use Case**: Building your own facilitator or need backend signing infrastructure.

---

### 9. x402.rs (Open Source)

- **GitHub**: Community-driven
- **Status**: Active, Open-source

**Features**:
- ✅ Written in Rust
- ✅ Independent implementation
- ✅ Open-source
- ✅ Self-hostable

**Use Case**: Developers wanting to **self-host** or contribute to open-source facilitator infrastructure.

---

### 10. AutoIncentive

- **Status**: Free, Public

**Features**:
- ✅ Free for community
- ✅ Full verify + settle flow
- ✅ On-chain USDC transfers
- ✅ Development-focused

**Use Case**: **Testing** and **development** before moving to production facilitator.

---

### 11. Kobaru

- **Networks**: Solana, Solana-devnet
- **Status**: Active

**Use Case**: Alternative Solana-native facilitator option.

---

### 12. x402.org (Testnet Default)

- **Website**: https://x402.org
- **Networks**: Solana-devnet, Base-Sepolia
- **Status**: Testnet only

**Use Case**: Default facilitator for **testing and development** on devnet.

---

## Quick Comparison Matrix

| Facilitator | Solana | Base | Free | Market Share | Best For |
|-------------|--------|------|------|--------------|----------|
| **PayAI** | ✅ | ✅ | ✅ | 69.4% | High volume, Solana-first |
| **Coinbase CDP** | ✅ | ✅ | ✅* | 30.6% | Enterprise, Base-first |
| **Rapid402** | ✅ | ✅ | ❌ (0.5%) | - | Developer experience |
| **OpenX402.ai** | ✅ | ✅ | ✅ | - | Multi-chain, permissionless |
| **Corbits** | ✅ | ✅ | ❌ (0.3%) | - | Enterprise custom |
| **Dexter** | ✅ | ✅ | ❌ (0.4%) | - | Marketplace integration |
| **Hydra** | ✅ | ✅ | ❌ (0.2%) | - | Decentralization |

*Fee-free USDC only

---

## Selection Guide

### Choose **PayAI** if you want:
- ✅ Highest Solana transaction volume
- ✅ Fastest setup (< 1 minute)
- ✅ Best uptime (99.9%)
- ✅ Lowest latency (398ms)
- ✅ Most battle-tested on Solana
- ✅ Free forever

### Choose **Coinbase CDP** if you want:
- ✅ Enterprise SLAs
- ✅ Fee-free USDC on Base
- ✅ Official Coinbase support
- ✅ Existing CDP integration

### Choose **Rapid402** if you want:
- ✅ Best TypeScript SDK
- ✅ Production-ready documentation
- ✅ Developer-first experience

### Choose **OpenX402.ai** if you want:
- ✅ Maximum network coverage (7+ chains)
- ✅ Permissionless setup
- ✅ No registration

### Choose **Hydra Protocol** if you want:
- ✅ Decentralized architecture
- ✅ Censorship resistance
- ✅ Run your own node

---

## Integration Example (PayAI on Solana)

```typescript
// 1. Install
bun add x402-solana @payai/x402-solana-react

// 2. Client-side payment
import { createX402Client } from 'x402-solana/client'

const client = createX402Client({
  wallet: {
    address: wallet.publicKey.toString(),
    signTransaction: wallet.signTransaction,
  },
  network: 'solana-devnet',
  amount: BigInt(10_000_000), // 0.01 USDC
})

const response = await client.fetch('/api/protected')

// 3. Server-side verification
import { withX402Payment } from '@/lib/x402/server'

export const POST = withX402Payment(
  async (request) => {
    return NextResponse.json({ data: 'Protected content' })
  },
  {
    amount: '0.01',
    recipient: process.env.TREASURY_WALLET_ADDRESS!,
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    description: 'Premium data access',
  }
)
```

---

## Market Statistics (January 2026)

- **Total Facilitators**: 12+
- **Active Production**: 7
- **Solana-Supporting**: 12
- **Multi-Chain**: 8
- **Free Options**: 4
- **Enterprise-Grade**: 3

**Daily Network Statistics**:
- Combined Volume: $44.5K+
- Combined Transactions: 1.28M+
- Average Uptime: 99.56%
- Average Success Rate: 98.4%

**Solana Dominance**:
- 51% of all x402 protocol volume (flipped Base in Dec 2025)
- PayAI processes 69.4% of Solana x402 traffic
- 398ms average finality vs 2000ms on Base

---

## Resources

- **x402 Protocol**: https://www.x402.org
- **Solana x402 Guide**: https://solana.com/developers/guides/getstarted/intro-to-x402
- **GhostSpeak Integration**: See `X402_INTEGRATION.md`
- **Observatory**: `/observatory/facilitators` for live stats

---

## Observatory Integration

All facilitators are tracked in real-time via GhostSpeak Observatory:

```bash
# View facilitator registry
http://localhost:3333/observatory/facilitators

# Public API
GET /api/observatory/facilitators
GET /api/observatory/facilitators?network=solana
GET /api/observatory/facilitators?status=active
```

**Convex Schema**:
```typescript
// Query facilitators
const facilitators = await ctx.db
  .query('facilitators')
  .withIndex('by_status', q => q.eq('status', 'active'))
  .collect()

// Filter by network
const solanaFacilitators = facilitators.filter(f =>
  f.networks.includes('solana')
)
```

---

**Last Updated**: 2026-01-17
**Data Source**: Live Observatory + Public Research
**Status**: Production ✅
