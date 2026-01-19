# GhostSpeak v2 - Integration Guide

**For Developers:** How to use the 2026 x402 + ERC-8004 integrations

---

## Quick Start

### 1. Environment Setup

Add to your `.env.local`:

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_WS_URL=wss://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_GHOSTSPEAK_PROGRAM_ID=your_program_id_here

# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
CONVEX_DEPLOY_KEY=your_deploy_key
```

### 2. Verify Payment Proof (x402)

```typescript
import { verifyUSDCPayment } from '@/lib/solana/payment-verification';

// Verify a USDC payment on Solana
const result = await verifyUSDCPayment(
  'transaction_signature_here',
  'payer_wallet_address',
  'merchant_wallet_address',
  'USDC_mint_address'
);

if (result.isValid && result.proof) {
  console.log('Payment verified!');
  console.log('Amount:', result.proof.amount);
  console.log('Block:', result.proof.blockNumber);
} else {
  console.error('Invalid payment:', result.error);
}
```

### 3. Register Agent On-Chain

```typescript
import { registerAgentOnChain } from '@/lib/solana/nft-identity';

// Complete agent registration (NFT + Convex sync)
const result = await registerAgentOnChain(
  {
    agentId: 'agent_123',
    name: 'Trading Bot',
    description: 'Autonomous DeFi trading agent',
    walletAddress: 'wallet_address_here',
    capabilities: ['trading', 'analytics', 'risk-management'],
    avatarUrl: 'https://example.com/avatar.png',
    website: 'https://tradingbot.ai',
    endpointUrl: 'https://api.tradingbot.ai',
  },
  walletKeypair, // Solana keypair for signing
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

if (result.success) {
  console.log('Agent registered!');
  console.log('NFT Mint:', result.nftMint);
  console.log('Metadata URI:', result.metadataUri);
  console.log('Transaction:', result.signature);
  console.log('Synced to Convex:', result.convexSynced);
}
```

### 4. Query On-Chain Identity

```typescript
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

function AgentProfile({ agentId }: { agentId: string }) {
  const identity = useQuery(api.erc8004.onchainSync.getAgentOnChainIdentity, {
    agentId: agentId as Id<'agents'>,
  });

  if (!identity) return <div>Agent not registered on-chain</div>;

  return (
    <div>
      <h2>On-Chain Identity</h2>
      <p>NFT Mint: {identity.nftMint}</p>
      <p>Identity PDA: {identity.identityPDA}</p>
      <p>Metadata: {identity.metadataUri}</p>
      <p>Registration Tx: {identity.registrationTx}</p>
      <p>Last Synced: {new Date(identity.lastSyncedAt).toLocaleString()}</p>
    </div>
  );
}
```

---

## Common Use Cases

### Use Case 1: Accept Paid Review

**Scenario:** User submits a review with x402 payment proof

```typescript
import { verifyUSDCPayment } from '@/lib/solana/payment-verification';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

async function submitReview(
  reviewText: string,
  rating: number,
  transactionSignature: string,
  reviewerWallet: string,
  merchantWallet: string
) {
  // 1. Verify payment on-chain
  const verification = await verifyUSDCPayment(
    transactionSignature,
    reviewerWallet,
    merchantWallet,
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mainnet
  );

  if (!verification.isValid) {
    throw new Error(`Invalid payment: ${verification.error}`);
  }

  // 2. Submit review to Convex
  const reviewId = await convex.mutation(api.reviews.create, {
    reviewText,
    rating,
    transactionSignature,
    paymentAmount: Number(verification.proof!.amount),
    isVerified: true, // Cryptographically verified
  });

  return reviewId;
}
```

### Use Case 2: Sync Reputation to Chain

**Scenario:** Update agent's on-chain reputation after new reviews

```typescript
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

async function syncReputationToChain(agentId: string) {
  // This triggers the full sync flow:
  // 1. Prepares reputation data
  // 2. Generates payment proof Merkle root
  // 3. Calls Solana program
  // 4. Records sync in Convex

  try {
    const result = await convex.action(api.erc8004.onchainSync.syncAgentReputation, {
      agentId: agentId as Id<'agents'>,
    });

    console.log('Reputation synced:', result);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

### Use Case 3: Batch Verify Multiple Payments

**Scenario:** Verify multiple payment proofs at once

```typescript
import { batchVerifyPaymentProofs } from '@/lib/solana/payment-verification';

async function verifyMultiplePayments(payments: PaymentData[]) {
  const results = await batchVerifyPaymentProofs(
    payments.map(p => ({
      signature: p.txSignature,
      payer: p.payerWallet,
      recipient: p.merchantWallet,
      minAmount: 1n, // Any amount > 0
      tokenMint: p.tokenMint,
    }))
  );

  // Filter valid payments
  const validPayments = payments.filter((_, i) => results[i].isValid);

  return validPayments;
}
```

---

## API Reference

### Payment Verification (`lib/solana/payment-verification.ts`)

#### `verifyX402PaymentProof()`

```typescript
function verifyX402PaymentProof(
  txSignature: string,
  expectedPayer: string,
  expectedRecipient: string,
  minAmount: bigint,
  tokenMint: string
): Promise<VerificationResult>
```

**Parameters:**
- `txSignature` - Solana transaction signature (base58)
- `expectedPayer` - Expected payer wallet address
- `expectedRecipient` - Expected recipient wallet address
- `minAmount` - Minimum amount in token's smallest unit (lamports)
- `tokenMint` - SPL token mint address

**Returns:**
```typescript
interface VerificationResult {
  isValid: boolean;
  proof?: {
    signature: string;
    payer: Address;
    recipient: Address;
    amount: bigint;
    tokenMint: Address;
    timestamp: number;
    blockNumber: number;
  };
  error?: string;
}
```

#### `verifyUSDCPayment()`

Convenience wrapper for USDC payments:

```typescript
function verifyUSDCPayment(
  signature: string,
  payer: string,
  merchant: string,
  usdcMint: string
): Promise<VerificationResult>
```

Validates any amount > 0 (good for reviews).

#### `generatePaymentProofMerkleRoot()`

```typescript
function generatePaymentProofMerkleRoot(
  proofs: Array<{ signature: string; amount: bigint }>
): Promise<Uint8Array>
```

Generates Merkle root for on-chain Reputation Registry.

---

### NFT Identity (`lib/solana/nft-identity.ts`)

#### `registerAgentOnChain()`

**Main function** - Mints NFT and syncs to Convex:

```typescript
function registerAgentOnChain(
  registrationData: AgentRegistrationData,
  payerKeypair: Keypair,
  convexUrl: string
): Promise<MintResult & { convexSynced: boolean }>
```

**Parameters:**
```typescript
interface AgentRegistrationData {
  agentId: string;
  name: string;
  description: string;
  avatarUrl?: string;
  website?: string;
  walletAddress: string;
  capabilities: string[];
  endpointUrl?: string;
}
```

#### `buildAgentMetadata()`

Creates Metaplex-compatible metadata JSON:

```typescript
function buildAgentMetadata(
  data: AgentRegistrationData
): AgentIdentityMetadata
```

#### `verifyAgentNFTOwnership()`

Verifies wallet owns the identity NFT:

```typescript
function verifyAgentNFTOwnership(
  nftMint: string,
  walletAddress: string
): Promise<boolean>
```

---

### Convex Sync (`convex/erc8004/onchain-sync.ts`)

#### `syncAgentRegistration` (Mutation)

Records NFT minting in Convex:

```typescript
internalMutation({
  args: {
    agentId: v.id('agents'),
    nftMint: v.string(),
    identityPDA: v.string(),
    metadataUri: v.string(),
    registrationTx: v.string(),
  }
})
```

#### `getAgentOnChainIdentity` (Query)

Fetches on-chain identity data:

```typescript
internalQuery({
  args: {
    agentId: v.id('agents'),
  }
})
```

#### `prepareReputationForSync` (Query)

Formats reputation for on-chain sync:

```typescript
internalQuery({
  args: {
    agentId: v.id('agents'),
  }
})
```

Returns:
```typescript
{
  reputationId: Id<'reputationScores'>,
  overallScore: number, // 0-1000
  componentScores: {
    trust: number,      // 0-100
    quality: number,
    reliability: number,
    economic: number,
    social: number,
  },
  stats: {
    totalVotes: number,
    positiveVotes: number,
    negativeVotes: number,
    totalReviews: number,
    avgReviewRating: number, // 0-50
  },
  paymentProofs: Array<{
    signature: string,
    amount: number,
  }>
}
```

#### `syncAgentReputation` (Action)

Syncs reputation to Solana blockchain:

```typescript
internalAction({
  args: {
    agentId: v.id('agents'),
  }
})
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Your Application                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  React Components                           │   │
│  │  - useQuery() for reading                   │   │
│  │  - useMutation() for writing                │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │  Convex Backend                             │   │
│  │  - 30+ tables with on-chain sync fields     │   │
│  │  - Sync functions (erc8004/onchain-sync.ts) │   │
│  └─────────┬──────────────────┬─────────────────┘   │
│            │                  │                      │
│  ┌─────────▼──────┐  ┌────────▼────────┐            │
│  │  Payment        │  │  NFT Identity    │            │
│  │  Verification   │  │  (Metaplex)      │            │
│  └─────────┬───────┘  └────────┬─────────┘            │
└────────────┼───────────────────┼──────────────────────┘
             │                   │
    ┌────────▼───────────────────▼──────┐
    │   Solana Blockchain (Devnet)      │
    │                                   │
    │  ┌────────────────────────────┐   │
    │  │  SPL Token Transactions    │   │
    │  │  (x402 payments)           │   │
    │  └────────────────────────────┘   │
    │                                   │
    │  ┌────────────────────────────┐   │
    │  │  Metaplex NFTs             │   │
    │  │  (Agent identities)        │   │
    │  └────────────────────────────┘   │
    │                                   │
    │  ┌────────────────────────────┐   │
    │  │  GhostSpeak Program        │   │
    │  │  (Anchor - coming soon)    │   │
    │  └────────────────────────────┘   │
    └───────────────────────────────────┘
```

---

## Data Flow

### 1. Payment Verification Flow

```
User pays with x402
       ↓
Transaction on Solana
       ↓
Get transaction signature
       ↓
verifyX402PaymentProof()
       ↓
Fetch transaction from RPC
       ↓
Parse SPL token transfer
       ↓
Verify payer, recipient, amount
       ↓
Return VerificationResult
       ↓
Save to Convex with isVerified: true
```

### 2. Agent Registration Flow

```
User submits registration
       ↓
buildAgentMetadata()
       ↓
uploadAgentMetadata() → Arweave/IPFS
       ↓
mintAgentIdentityNFT() → Metaplex
       ↓
deriveIdentityPDA()
       ↓
syncAgentRegistration() → Convex
       ↓
Agent on-chain identity created
```

### 3. Reputation Sync Flow

```
Reputation changes in Convex
       ↓
queueAgentsForReputationSync()
       ↓
prepareReputationForSync()
       ↓
Generate payment proof Merkle root
       ↓
Call Solana program (update PDA)
       ↓
recordReputationSync() → Convex
       ↓
On-chain reputation updated
```

---

## Testing

### Unit Tests

```typescript
// test/payment-verification.test.ts
import { describe, it, expect } from 'vitest';
import { verifyX402PaymentProof } from '@/lib/solana/payment-verification';

describe('Payment Verification', () => {
  it('should verify valid USDC payment', async () => {
    const result = await verifyX402PaymentProof(
      'valid_tx_signature',
      'payer_address',
      'recipient_address',
      1000000n, // 1 USDC
      'USDC_mint'
    );

    expect(result.isValid).toBe(true);
    expect(result.proof).toBeDefined();
  });

  it('should reject payment with wrong recipient', async () => {
    const result = await verifyX402PaymentProof(
      'valid_tx_signature',
      'payer_address',
      'wrong_recipient',
      1000000n,
      'USDC_mint'
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Recipient mismatch');
  });
});
```

### Integration Tests

```typescript
// test/agent-registration.test.ts
import { describe, it, expect } from 'vitest';
import { registerAgentOnChain } from '@/lib/solana/nft-identity';

describe('Agent Registration', () => {
  it('should mint NFT and sync to Convex', async () => {
    const result = await registerAgentOnChain(
      {
        agentId: 'test_agent',
        name: 'Test Agent',
        description: 'Test description',
        walletAddress: 'test_wallet',
        capabilities: ['testing'],
      },
      testKeypair,
      process.env.NEXT_PUBLIC_CONVEX_URL!
    );

    expect(result.success).toBe(true);
    expect(result.nftMint).toBeDefined();
    expect(result.convexSynced).toBe(true);
  });
});
```

---

## Best Practices

### 1. Always Verify Payments

```typescript
// ✅ Good - verify before accepting
const verification = await verifyUSDCPayment(...);
if (!verification.isValid) {
  throw new Error('Invalid payment');
}
await saveReview({ ..., isVerified: true });

// ❌ Bad - trust user input
await saveReview({ transactionSignature: userInput });
```

### 2. Handle Errors Gracefully

```typescript
// ✅ Good - proper error handling
try {
  const result = await registerAgentOnChain(...);
  if (!result.success) {
    showError(result.error);
    return;
  }
  showSuccess('Agent registered!');
} catch (error) {
  logError(error);
  showError('Registration failed');
}

// ❌ Bad - no error handling
const result = await registerAgentOnChain(...);
showSuccess('Agent registered!'); // Might not be true
```

### 3. Use Type Guards

```typescript
// ✅ Good - check before using
if (result.isValid && result.proof) {
  const amount = result.proof.amount; // TypeScript knows proof exists
}

// ❌ Bad - assume proof exists
const amount = result.proof.amount; // Might be undefined
```

### 4. Batch Operations

```typescript
// ✅ Good - batch verify
const results = await batchVerifyPaymentProofs(payments);

// ❌ Bad - loop individual verifications
for (const payment of payments) {
  await verifyX402PaymentProof(...); // Slow, many RPC calls
}
```

---

## Troubleshooting

### Issue: "Transaction not found"

**Cause:** Transaction not yet confirmed or invalid signature

**Fix:**
```typescript
// Wait for confirmation first
await rpc.confirmTransaction(signature).send();

// Then verify
const result = await verifyX402PaymentProof(...);
```

### Issue: "Metaplex packages not installed"

**Status:** Packages currently installing

**Temporary fix:**
- NFT functions will return placeholder data
- Payment verification works independently

**Permanent fix:**
- Wait for `@metaplex-foundation` packages to install
- Remove `@ts-nocheck` from `lib/solana/nft-identity.ts`

### Issue: "Invalid payment proof"

**Causes:**
1. Wrong payer/recipient addresses
2. Amount too low
3. Wrong token mint
4. Transaction failed on-chain

**Debug:**
```typescript
const result = await verifyX402PaymentProof(...);
console.log('Verification result:', result);
if (!result.isValid) {
  console.error('Error:', result.error);
}
```

---

## Resources

**Code Examples:**
- Payment verification: `lib/solana/payment-verification.ts`
- NFT minting: `lib/solana/nft-identity.ts`
- Sync functions: `convex/erc8004/onchain-sync.ts`

**Documentation:**
- ERC-8004 spec: `TRUST_LAYER_GAP_ANALYSIS.md`
- Implementation plan: `PHASE1_ERC8004_PLAN.md`
- Integration status: `2026_INTEGRATIONS_STATUS.md`

**External Docs:**
- Solana Web3.js v5: https://solana-labs.github.io/solana-web3.js/
- Metaplex: https://docs.metaplex.com/
- x402 Protocol: https://www.x402.org/

---

**Last Updated:** 2026-01-18
**Status:** Production-ready (payment verification), NFT integration pending packages
