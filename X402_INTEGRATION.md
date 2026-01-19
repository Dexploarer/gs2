# x402 Payment Integration Guide

Complete guide for integrating x402 payment protocol into GhostSpeak v2.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Client-Side Integration](#client-side-integration)
6. [Server-Side Integration](#server-side-integration)
7. [Facilitators](#facilitators)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Overview

x402 is an internet-native payment protocol built on HTTP 402 (Payment Required). GhostSpeak v2 supports:

- **Multiple Facilitators**: PayAI, Coinbase CDP, Rapid402, OpenX402, and more
- **Multi-Chain**: Solana (primary), Base, and other EVM networks
- **Real-Time Tracking**: Observatory integration for payment analytics
- **TypeScript SDK**: Full type safety with x402-solana

---

## Prerequisites

### Required

- **Bun** 1.3.4+ (package manager)
- **Next.js** 15.4+ (app router)
- **Solana Wallet** (Phantom, Solflare, etc.)
- **Convex** account for backend
- **Treasury Wallet** address for receiving payments

### Optional

- **Coinbase CDP** account (for CDP facilitator)
- **PayAI** account (free, no setup required)

---

## Installation

### 1. Install Dependencies

```bash
# Core x402 packages
bun add x402-solana @payai/x402-solana-react

# Facilitator clients
bun add @coinbase/x402 x402-next

# Already included in package.json
```

### 2. Environment Variables

Create or update `.env.local`:

```bash
# Network Configuration
NEXT_PUBLIC_NETWORK=solana-devnet  # or solana-mainnet
NEXT_PUBLIC_SOLANA_RPC_DEVNET=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://api.mainnet-beta.solana.com

# Treasury Wallet (where payments are received)
TREASURY_WALLET_ADDRESS=YourSolanaWalletAddressHere

# Facilitator Configuration (choose one)
NEXT_PUBLIC_FACILITATOR=payai  # payai, coinbase-cdp, rapid402, openx402

# Coinbase CDP (if using CDP facilitator)
CDP_API_KEY_ID=your_cdp_api_key_id
CDP_API_KEY_SECRET=your_cdp_api_key_secret

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your_deploy_key
```

---

## Configuration

### x402 Configuration

Location: `lib/x402/config.ts`

```typescript
import { getDefaultConfig, FACILITATORS, X402_NETWORKS } from '@/lib/x402/config'

// Get default configuration
const config = getDefaultConfig('devnet') // or 'mainnet'

// Use specific facilitator
const payaiConfig = {
  facilitator: 'PAYAI',
  network: X402_NETWORKS.SOLANA_DEVNET,
  environment: 'devnet',
}

const cdpConfig = {
  facilitator: 'COINBASE_CDP',
  network: X402_NETWORKS.BASE_MAINNET,
  environment: 'mainnet',
}
```

### Supported Networks

```typescript
// Solana Networks
X402_NETWORKS.SOLANA_MAINNET // solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
X402_NETWORKS.SOLANA_DEVNET  // solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1

// Base Networks
X402_NETWORKS.BASE_MAINNET   // eip155:8453
X402_NETWORKS.BASE_SEPOLIA   // eip155:84532
```

### USDC Token Addresses

```typescript
// Solana Mainnet USDC
USDC_ADDRESSES.SOLANA_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// Solana Devnet USDC
USDC_ADDRESSES.SOLANA_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

// Base Mainnet USDC
USDC_ADDRESSES.BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
```

---

## Client-Side Integration

### React Component with PayAI

```typescript
'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { createX402Client } from 'x402-solana/client'
import { getDefaultConfig } from '@/lib/x402/config'

export function PaymentButton() {
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)

  const handlePaidRequest = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert('Please connect your wallet')
      return
    }

    setLoading(true)

    try {
      // Create x402 client
      const client = createX402Client({
        wallet: {
          address: wallet.publicKey.toString(),
          signTransaction: wallet.signTransaction,
        },
        network: 'solana-devnet',
        amount: BigInt(10_000_000), // 0.01 USDC (6 decimals)
      })

      // Make paid request
      const response = await client.fetch('/api/protected-endpoint', {
        method: 'POST',
        body: JSON.stringify({ query: 'my request' }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Success!', data)
      }
    } catch (error) {
      console.error('Payment failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handlePaidRequest} disabled={loading || !wallet.connected}>
      {loading ? 'Processing...' : 'Pay $0.01 to Access'}
    </button>
  )
}
```

### Automatic Payment Handling

```typescript
import { createX402Fetch } from 'x402-solana/client'

// Create a fetch wrapper that automatically handles 402 responses
const x402fetch = createX402Fetch({
  wallet: {
    address: walletAddress,
    signTransaction: walletSignTransaction,
  },
  network: 'solana-devnet',
})

// Use like normal fetch - automatically pays when encountering 402
const response = await x402fetch('/api/premium-data')
const data = await response.json()
```

---

## Server-Side Integration

### Protect API Routes

Location: `app/api/protected/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withX402Payment } from '@/lib/x402/server'

// Define payment requirement
const paymentRequirement = {
  amount: '0.01', // $0.01 USDC
  recipient: process.env.TREASURY_WALLET_ADDRESS!,
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', // Solana Devnet
  description: 'Access to premium AI agent data',
}

// Your protected handler
async function handler(request: NextRequest) {
  // This only runs if payment is verified
  const data = await fetchPremiumData()

  return NextResponse.json({
    success: true,
    data,
  })
}

// Export with payment protection
export const POST = withX402Payment(handler, paymentRequirement)
```

### Manual Payment Verification

```typescript
import { verifyPaymentFromRequest, createPaymentRequiredResponse } from '@/lib/x402/server'

export async function POST(request: NextRequest) {
  // Check for payment
  const verification = await verifyPaymentFromRequest(request)

  if (!verification.verified) {
    // Return 402 Payment Required
    return createPaymentRequiredResponse({
      amount: '0.01',
      recipient: process.env.TREASURY_WALLET_ADDRESS!,
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      description: 'Access required',
    })
  }

  // Payment verified, proceed
  return NextResponse.json({
    success: true,
    txSignature: verification.txSignature,
  })
}
```

### Track Payments in Convex

```typescript
import { api } from '@/convex/_generated/api'
import { fetchMutation } from 'convex/nextjs'

// After successful payment
await fetchMutation(api.x402Payments.record, {
  txSignature: verification.txSignature,
  agentId: agentId,
  endpoint: request.url,
  amount: 0.01,
  currency: 'USDC',
  status: 'completed',
  facilitator: 'PayAI',
  network: 'solana',
  responseTime: Date.now() - startTime,
  timestamp: Date.now(),
})
```

---

## Facilitators

### PayAI (Recommended for Solana)

**Best for**: High-volume Solana applications, fastest setup

```typescript
const config = {
  facilitator: 'PAYAI',
  network: X402_NETWORKS.SOLANA_DEVNET,
  environment: 'devnet',
}

// Features:
// - Free (no fees)
// - < 1 minute setup
// - 99.9% uptime
// - 398ms avg response time
// - Works with all Solana wallets
// - Multi-chain support (Solana, Base, Avalanche, etc.)

// Documentation:
// https://facilitator.payai.network
// https://github.com/PayAINetwork/x402-solana
```

### Coinbase CDP

**Best for**: Enterprise applications, Base network priority

```typescript
import { createFacilitatorConfig } from '@coinbase/x402'

const facilitator = createFacilitatorConfig(
  process.env.CDP_API_KEY_ID!,
  process.env.CDP_API_KEY_SECRET!
)

// Features:
// - Fee-free USDC on Base
// - Enterprise-grade reliability
// - 99.8% uptime
// - Requires CDP API key

// Documentation:
// https://docs.cdp.coinbase.com/x402
```

### Rapid402

**Best for**: Developer experience, TypeScript projects

```bash
bun add @rapid402/sdk

# Features:
# - TypeScript-first SDK
# - Production-ready
# - 0.5% fee
# - Multi-network support
# - Excellent documentation

# Documentation:
# https://rapid402.com
# https://github.com/rapid402/rapid402-sdk
```

### OpenX402.ai

**Best for**: Multi-chain applications, permissionless setup

```typescript
// Features:
// - Permissionless
// - Gasless
// - Omnichain (8+ networks)
// - Free
// - No registration required

// Documentation:
// https://openx402.ai
```

---

## Testing

### Local Development

```bash
# Terminal 1: Start Convex
bunx convex dev

# Terminal 2: Start Next.js
bun run dev

# Visit http://localhost:3333
```

### Test with Devnet USDC

1. **Get Devnet SOL**:
   ```bash
   solana airdrop 2
   ```

2. **Get Devnet USDC**:
   - Visit https://faucet.circle.com
   - Request devnet USDC to your wallet
   - Token: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

3. **Test Payment**:
   ```typescript
   // Connect wallet (Phantom, Solflare, etc.)
   // Click payment button
   // Sign transaction
   // Access protected content
   ```

### Observatory Testing

```bash
# Visit Observatory to see payment tracked
http://localhost:3333/observatory/payments

# Check facilitator stats
http://localhost:3333/observatory/facilitators

# View real-time activity
http://localhost:3333/observatory
```

---

## Production Deployment

### 1. Update Environment Variables

```bash
# Switch to mainnet
NEXT_PUBLIC_NETWORK=solana-mainnet
NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://api.mainnet-beta.solana.com

# Production facilitator
NEXT_PUBLIC_FACILITATOR=payai  # or coinbase-cdp

# Real treasury wallet
TREASURY_WALLET_ADDRESS=YourProductionWalletAddress
```

### 2. Update x402 Config

```typescript
// lib/x402/config.ts - use mainnet defaults
export const getDefaultConfig = (environment = 'mainnet'): X402Config => ({
  facilitator: 'PAYAI',
  network: environment === 'mainnet'
    ? X402_NETWORKS.SOLANA_MAINNET
    : X402_NETWORKS.SOLANA_DEVNET,
  environment,
})
```

### 3. Deploy

```bash
# Deploy Convex
bunx convex deploy --prod

# Deploy Next.js (Vercel)
vercel --prod
```

### 4. Monitor Payments

```bash
# Real-time dashboard
https://your-domain.com/observatory/payments

# Public API
https://your-domain.com/api/observatory/payments

# Facilitator performance
https://your-domain.com/observatory/facilitators
```

---

## Troubleshooting

### Payment Fails with "Insufficient Funds"

**Solution**: Ensure wallet has both:
- USDC for payment amount
- SOL for transaction fees (~0.00025 SOL)

```bash
# Check balances
solana balance
spl-token balance <USDC_MINT_ADDRESS>
```

### 402 Response But No Payment Prompt

**Solution**: Check client-side x402 client configuration

```typescript
// Verify wallet is connected
console.log('Wallet:', wallet.publicKey?.toString())
console.log('Connected:', wallet.connected)

// Check network matches
console.log('Network:', config.network)
```

### Facilitator Verification Failed

**Solution**: Check facilitator URL and network

```typescript
// Verify facilitator is reachable
const facilitatorUrl = getFacilitatorUrl('PAYAI')
const response = await fetch(`${facilitatorUrl}/health`)
console.log('Facilitator status:', response.status)
```

### Payment Not Appearing in Observatory

**Solution**: Check Convex function is being called

```typescript
// Add logging to payment recording
console.log('Recording payment:', {
  txSignature,
  agentId,
  amount,
  facilitator,
})

await ctx.db.insert('x402Payments', {
  // ... payment data
})
```

### CORS Errors

**Solution**: Configure Next.js API routes

```typescript
// app/api/protected/route.ts
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT',
    },
  })
}
```

---

## Additional Resources

### Official Documentation

- **x402 Protocol**: https://www.x402.org
- **PayAI Facilitator**: https://facilitator.payai.network
- **Coinbase CDP x402**: https://docs.cdp.coinbase.com/x402
- **Solana x402 Guide**: https://solana.com/developers/guides/getstarted/intro-to-x402

### GitHub Repositories

- **x402-solana**: https://github.com/PayAINetwork/x402-solana
- **Coinbase x402**: https://github.com/coinbase/x402
- **Rapid402**: https://github.com/rapid402/rapid402-sdk
- **x402 Spec**: https://github.com/coinbase/x402

### Observatory APIs

```bash
# Public APIs for monitoring
GET /api/observatory/payments
GET /api/observatory/facilitators
GET /api/observatory/agents
GET /api/observatory/health
```

---

## Support

For issues specific to:
- **GhostSpeak**: Open issue at your repository
- **PayAI**: https://twitter.com/PayAINetwork
- **Coinbase CDP**: https://docs.cdp.coinbase.com/support
- **x402 Protocol**: https://x402.org/discord

---

**Last Updated**: 2026-01-17
**Version**: 2.0.0
**Status**: Production-ready ✅
