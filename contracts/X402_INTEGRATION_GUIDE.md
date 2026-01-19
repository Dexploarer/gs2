# X402 Integration Guide
## Transaction-Gated Voting for GhostSpeak ERC-8004

### Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration Steps](#integration-steps)
4. [TypeScript Implementation](#typescript-implementation)
5. [Webhook Setup](#webhook-setup)
6. [Testing Guide](#testing-guide)
7. [Security Considerations](#security-considerations)
8. [FAQ](#faq)

---

## Overview

### What is Transaction-Gated Voting?

Transaction-gated voting is a mechanism that ensures voting rights are earned through legitimate economic interactions. In the GhostSpeak ecosystem, only agents who have completed real x402 payment transactions can cast votes about their interaction partners.

**Key Benefits:**
- **Spam Prevention**: Eliminates zero-cost spam votes
- **Sybil Resistance**: Makes vote manipulation economically expensive
- **Quality Signals**: Vote weight correlates with transaction value
- **Provable Interactions**: Every vote is backed by an on-chain payment receipt

### Why It Matters

Traditional voting systems on-chain suffer from:
- **Sybil Attacks**: Creating multiple wallets to vote multiple times
- **Vote Manipulation**: Coordinated attacks with zero economic cost
- **Low Signal Quality**: Votes from non-participants dilute real feedback

Transaction-gated voting solves these problems by requiring:
1. A completed x402 payment transaction between parties
2. A verified transaction receipt stored on-chain
3. Proof that the voter was a party to the transaction
4. Vote cast within 30 days of the transaction

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    X402 Payment Flow                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Transaction Receipt Creation                    │
│  (Facilitator or Party creates receipt on-chain)            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Receipt Validation                          │
│  • Verify payer/recipient match transaction                 │
│  • Check amount meets minimum threshold                     │
│  • Validate signature uniqueness                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vote Casting                              │
│  • Voter proves they're a party to the receipt             │
│  • System validates voting window (30 days)                │
│  • Receipt marked as used to prevent double-voting         │
└─────────────────────────────────────────────────────────────┘
```

### TransactionReceipt Account

The `TransactionReceipt` PDA is the core primitive that enables transaction-gated voting:

**Structure:**
```rust
pub struct TransactionReceipt {
    pub signature: String,         // x402 transaction signature
    pub payer: Pubkey,             // Customer/client
    pub recipient: Pubkey,         // Service provider
    pub amount: u64,               // Amount in lamports
    pub timestamp: i64,            // Transaction timestamp
    pub content_type: ContentType, // Type of service delivered
    pub vote_cast: bool,           // Prevents double-voting
    pub bump: u8,                  // PDA bump seed
}
```

**PDA Derivation:**
```
seeds = [
    "tx_receipt",
    payer.key,
    recipient.key,
    signature_hash (32 bytes)
]
```

This ensures:
- Each transaction can only have one receipt
- Both parties can independently verify the receipt
- Receipt PDAs are deterministic and discoverable

### Vote Weighting

Votes are weighted by transaction amount to reflect economic commitment:

**Weight Calculation:**
```
vote_weight = min(transaction_amount / MIN_TRANSACTION, 10.0)

Where:
- MIN_TRANSACTION = 0.01 SOL (10,000,000 lamports)
- Maximum weight = 10x
- Minimum weight = 1x (for transactions >= MIN_TRANSACTION)
```

**Examples:**
- 0.01 SOL transaction → 1x weight
- 0.05 SOL transaction → 5x weight
- 0.10 SOL+ transaction → 10x weight (capped)

---

## Integration Steps

### Step 1: Implement Receipt Creation Hook

When your x402 facilitator processes a payment, automatically create a transaction receipt:

```typescript
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { VoteRegistry } from './types/vote_registry';
import idl from './idl/vote_registry.json';

// After successful x402 payment
async function createReceiptAfterPayment(
  paymentSignature: string,
  payerPubkey: PublicKey,
  recipientPubkey: PublicKey,
  amountLamports: number,
  contentType: 'ApiResponse' | 'GeneratedText' | 'GeneratedImage' | 'GeneratedCode' | 'DataFeed' | 'Other'
) {
  const connection = new Connection('https://api.devnet.solana.com');
  const provider = new AnchorProvider(connection, wallet, {});

  const program = new Program<VoteRegistry>(
    idl as any,
    new PublicKey('6yqgRTrKwgdK73EHfw8oXaQvhDqyzbjQKS5pDUncMZrN'),
    provider
  );

  // Hash the signature for PDA derivation
  const signatureHash = Buffer.from(
    await crypto.subtle.digest('SHA-256', Buffer.from(paymentSignature))
  );

  // Derive receipt PDA
  const [receiptPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('tx_receipt'),
      payerPubkey.toBuffer(),
      recipientPubkey.toBuffer(),
      signatureHash
    ],
    program.programId
  );

  // Create the receipt
  const tx = await program.methods
    .createTransactionReceipt(
      paymentSignature,
      Array.from(signatureHash),
      amountLamports,
      { [contentType.toLowerCase()]: {} }
    )
    .accounts({
      receipt: receiptPda,
      payerPubkey: payerPubkey,
      recipientPubkey: recipientPubkey,
      creator: provider.wallet.publicKey, // Must be payer or recipient
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log(`Receipt created: ${receiptPda.toBase58()}`);
  return receiptPda;
}
```

### Step 2: Validate Receipt Before Voting

Before allowing a vote, verify the receipt exists and is valid:

```typescript
async function validateReceiptForVoting(
  receiptPda: PublicKey,
  voterPubkey: PublicKey,
  votedAgentPubkey: PublicKey
): Promise<boolean> {
  const program = getProgram(); // Your program instance

  try {
    const receipt = await program.account.transactionReceipt.fetch(receiptPda);

    // Check 1: Voter must be a party to the transaction
    const isParty = receipt.payer.equals(voterPubkey) ||
                    receipt.recipient.equals(voterPubkey);
    if (!isParty) {
      throw new Error('Voter is not a party to this transaction');
    }

    // Check 2: Voted agent must be the counterparty
    const counterparty = receipt.payer.equals(voterPubkey)
      ? receipt.recipient
      : receipt.payer;
    if (!counterparty.equals(votedAgentPubkey)) {
      throw new Error('Voted agent is not the counterparty');
    }

    // Check 3: Receipt not already used
    if (receipt.voteCast) {
      throw new Error('Vote already cast with this receipt');
    }

    // Check 4: Within voting window (30 days)
    const now = Math.floor(Date.now() / 1000);
    const votingDeadline = receipt.timestamp + (30 * 24 * 60 * 60);
    if (now > votingDeadline) {
      throw new Error('Voting window expired (30 days)');
    }

    // Check 5: Meets minimum transaction amount
    const MIN_AMOUNT = 10_000_000; // 0.01 SOL
    if (receipt.amount < MIN_AMOUNT) {
      throw new Error('Transaction amount too small (min 0.01 SOL)');
    }

    return true;
  } catch (error) {
    console.error('Receipt validation failed:', error);
    return false;
  }
}
```

### Step 3: Cast Vote with Receipt

When casting a vote, pass the transaction receipt to prove eligibility:

```typescript
async function castPeerVote(
  voterPubkey: PublicKey,
  votedAgentPubkey: PublicKey,
  receiptPda: PublicKey,
  voteType: 'upvote' | 'downvote' | 'neutral',
  qualityScores: {
    responseQuality: number;  // 0-100
    responseSpeed: number;    // 0-100
    accuracy: number;         // 0-100
    professionalism: number;  // 0-100
  },
  commentHash?: Buffer
) {
  const program = getProgram();

  // Generate unique interaction ID
  const interactionId = Buffer.from(crypto.randomBytes(16));

  // Derive vote PDA
  const [votePda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('peer_vote'),
      voterPubkey.toBuffer(),
      votedAgentPubkey.toBuffer(),
      interactionId
    ],
    program.programId
  );

  // Get identity and reputation PDAs
  const identityProgram = new PublicKey('AbEhYiRf7Fhx7bTVbKXxx3nfiDXhpcKJ7ZTmRVumHjxG');
  const reputationProgram = new PublicKey('A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp');

  const [voterIdentity] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), voterPubkey.toBuffer()],
    identityProgram
  );

  const [voterReputation] = PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), voterPubkey.toBuffer()],
    reputationProgram
  );

  const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), votedAgentPubkey.toBuffer()],
    identityProgram
  );

  // Cast the vote
  const tx = await program.methods
    .castPeerVote(
      votedAgentPubkey,
      Array.from(interactionId),
      { [voteType]: {} },
      qualityScores,
      commentHash ? Array.from(commentHash) : new Array(32).fill(0)
    )
    .accounts({
      peerVote: votePda,
      transactionReceipt: receiptPda, // Proof of interaction
      voterIdentity,
      voterReputation,
      votedAgentIdentity,
      voter: voterPubkey,
      identityRegistryProgram: identityProgram,
      reputationRegistryProgram: reputationProgram,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log(`Vote cast: ${votePda.toBase58()}`);
  return votePda;
}
```

---

## TypeScript Implementation

### Complete End-to-End Example

```typescript
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { VoteRegistry } from './types/vote_registry';
import idl from './idl/vote_registry.json';

class X402VotingIntegration {
  private connection: Connection;
  private program: Program<VoteRegistry>;
  private provider: AnchorProvider;

  constructor(rpcUrl: string, wallet: Wallet) {
    this.connection = new Connection(rpcUrl);
    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed'
    });

    this.program = new Program<VoteRegistry>(
      idl as any,
      new PublicKey('6yqgRTrKwgdK73EHfw8oXaQvhDqyzbjQKS5pDUncMZrN'),
      this.provider
    );
  }

  /**
   * Step 1: Create transaction receipt after x402 payment
   */
  async createReceipt(
    signature: string,
    payer: PublicKey,
    recipient: PublicKey,
    amount: number,
    contentType: ContentType
  ): Promise<PublicKey> {
    // Hash signature
    const encoder = new TextEncoder();
    const signatureBuffer = encoder.encode(signature);
    const hashBuffer = await crypto.subtle.digest('SHA-256', signatureBuffer);
    const signatureHash = new Uint8Array(hashBuffer);

    // Derive PDA
    const [receiptPda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.toBuffer(),
        recipient.toBuffer(),
        Buffer.from(signatureHash)
      ],
      this.program.programId
    );

    // Check if receipt already exists
    try {
      await this.program.account.transactionReceipt.fetch(receiptPda);
      console.log('Receipt already exists');
      return receiptPda;
    } catch (e) {
      // Receipt doesn't exist, create it
    }

    // Create receipt
    await this.program.methods
      .createTransactionReceipt(
        signature,
        Array.from(signatureHash),
        amount,
        contentType
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: payer,
        recipientPubkey: recipient,
        creator: this.provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Receipt created: ${receiptPda.toBase58()}`);
    return receiptPda;
  }

  /**
   * Step 2: Validate receipt eligibility
   */
  async validateReceipt(
    receiptPda: PublicKey,
    voter: PublicKey,
    votedAgent: PublicKey
  ): Promise<{ valid: boolean; error?: string; weight?: number }> {
    try {
      const receipt = await this.program.account.transactionReceipt.fetch(receiptPda);

      // Validation checks
      const isParty = receipt.payer.equals(voter) || receipt.recipient.equals(voter);
      if (!isParty) {
        return { valid: false, error: 'Voter not party to transaction' };
      }

      const counterparty = receipt.payer.equals(voter) ? receipt.recipient : receipt.payer;
      if (!counterparty.equals(votedAgent)) {
        return { valid: false, error: 'Voted agent mismatch' };
      }

      if (receipt.voteCast) {
        return { valid: false, error: 'Vote already cast' };
      }

      const now = Math.floor(Date.now() / 1000);
      const deadline = receipt.timestamp + (30 * 24 * 60 * 60);
      if (now > deadline) {
        return { valid: false, error: 'Voting window expired' };
      }

      const MIN_AMOUNT = 10_000_000; // 0.01 SOL
      if (receipt.amount < MIN_AMOUNT) {
        return { valid: false, error: 'Transaction too small' };
      }

      // Calculate vote weight
      const weight = Math.min(receipt.amount / MIN_AMOUNT, 10);

      return { valid: true, weight };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Step 3: Cast vote with receipt proof
   */
  async castVote(
    votedAgent: PublicKey,
    receiptPda: PublicKey,
    voteType: VoteType,
    qualityScores: QualityScores,
    commentHash?: Uint8Array
  ): Promise<PublicKey> {
    const voter = this.provider.wallet.publicKey;

    // Validate receipt first
    const validation = await this.validateReceipt(receiptPda, voter, votedAgent);
    if (!validation.valid) {
      throw new Error(`Receipt validation failed: ${validation.error}`);
    }

    // Generate interaction ID
    const interactionId = crypto.getRandomValues(new Uint8Array(16));

    // Derive vote PDA
    const [votePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('peer_vote'),
        voter.toBuffer(),
        votedAgent.toBuffer(),
        Buffer.from(interactionId)
      ],
      this.program.programId
    );

    // Get required PDAs
    const identityProgram = new PublicKey('AbEhYiRf7Fhx7bTVbKXxx3nfiDXhpcKJ7ZTmRVumHjxG');
    const reputationProgram = new PublicKey('A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp');

    const [voterIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), voter.toBuffer()],
      identityProgram
    );

    const [voterReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.toBuffer()],
      reputationProgram
    );

    const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), votedAgent.toBuffer()],
      identityProgram
    );

    // Cast vote
    await this.program.methods
      .castPeerVote(
        votedAgent,
        Array.from(interactionId),
        voteType,
        qualityScores,
        commentHash ? Array.from(commentHash) : new Array(32).fill(0)
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity,
        voterReputation,
        votedAgentIdentity,
        voter,
        identityRegistryProgram: identityProgram,
        reputationRegistryProgram: reputationProgram,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Vote cast with weight ${validation.weight}x`);
    return votePda;
  }
}

// Types
enum ContentType {
  ApiResponse = 'apiResponse',
  GeneratedText = 'generatedText',
  GeneratedImage = 'generatedImage',
  GeneratedCode = 'generatedCode',
  DataFeed = 'dataFeed',
  Other = 'other'
}

enum VoteType {
  Upvote = 'upvote',
  Downvote = 'downvote',
  Neutral = 'neutral'
}

interface QualityScores {
  responseQuality: number;  // 0-100
  responseSpeed: number;    // 0-100
  accuracy: number;         // 0-100
  professionalism: number;  // 0-100
}

// Usage Example
async function example() {
  const wallet = new Wallet(Keypair.fromSecretKey(/* your key */));
  const integration = new X402VotingIntegration(
    'https://api.devnet.solana.com',
    wallet
  );

  // After x402 payment completes
  const receiptPda = await integration.createReceipt(
    'signature123...',
    new PublicKey('payer...'),
    new PublicKey('recipient...'),
    50_000_000, // 0.05 SOL
    ContentType.ApiResponse
  );

  // Later, when user wants to vote
  await integration.castVote(
    new PublicKey('voted_agent...'),
    receiptPda,
    { upvote: {} },
    {
      responseQuality: 85,
      responseSpeed: 90,
      accuracy: 88,
      professionalism: 92
    }
  );
}
```

---

## Webhook Setup

### Coinbase Commerce / CDP Integration

```typescript
import express from 'express';
import { X402VotingIntegration } from './x402-voting';

const app = express();
app.use(express.json());

// Webhook endpoint for Coinbase Commerce payments
app.post('/webhooks/coinbase-payment', async (req, res) => {
  const { event } = req.body;

  if (event.type === 'charge:confirmed') {
    const {
      id,
      metadata,
      pricing
    } = event.data;

    // Extract payment details
    const signature = id; // Use Coinbase charge ID as signature
    const payer = new PublicKey(metadata.payer_pubkey);
    const recipient = new PublicKey(metadata.recipient_pubkey);
    const amountLamports = Math.floor(pricing.local.amount * 1e9); // Convert SOL to lamports

    // Create receipt
    const integration = new X402VotingIntegration(
      process.env.SOLANA_RPC_URL,
      facilitatorWallet
    );

    try {
      await integration.createReceipt(
        signature,
        payer,
        recipient,
        amountLamports,
        ContentType.ApiResponse
      );

      console.log(`Receipt created for charge ${id}`);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to create receipt:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(200).json({ acknowledged: true });
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### Custom x402 Facilitator Hook

```typescript
class X402Facilitator {
  private votingIntegration: X402VotingIntegration;

  async processPayment(
    from: PublicKey,
    to: PublicKey,
    amount: number,
    contentType: ContentType
  ): Promise<{ signature: string; receiptPda: PublicKey }> {
    // Execute payment transaction
    const signature = await this.executePayment(from, to, amount);

    // Wait for confirmation
    await this.connection.confirmTransaction(signature, 'confirmed');

    // Create receipt immediately after confirmation
    const receiptPda = await this.votingIntegration.createReceipt(
      signature,
      from,
      to,
      amount,
      contentType
    );

    // Notify both parties
    await this.notifyParties(from, to, signature, receiptPda);

    return { signature, receiptPda };
  }

  private async notifyParties(
    payer: PublicKey,
    recipient: PublicKey,
    signature: string,
    receiptPda: PublicKey
  ) {
    // Send notifications to both parties
    // Include receiptPda so they can vote later
    await this.sendEmail(payer, {
      subject: 'Payment Confirmed - You can now vote',
      body: `Your payment has been confirmed. Receipt: ${receiptPda.toBase58()}`
    });
  }
}
```

---

## Testing Guide

### Unit Tests

```typescript
import { expect } from 'chai';
import { X402VotingIntegration } from './x402-voting';

describe('X402 Transaction-Gated Voting', () => {
  let integration: X402VotingIntegration;
  let payer: Keypair;
  let recipient: Keypair;

  before(async () => {
    payer = Keypair.generate();
    recipient = Keypair.generate();
    // Airdrop SOL for testing
  });

  it('should create transaction receipt', async () => {
    const receiptPda = await integration.createReceipt(
      'test_signature_123',
      payer.publicKey,
      recipient.publicKey,
      50_000_000,
      ContentType.ApiResponse
    );

    const receipt = await integration.program.account.transactionReceipt.fetch(receiptPda);
    expect(receipt.payer.toBase58()).to.equal(payer.publicKey.toBase58());
    expect(receipt.amount).to.equal(50_000_000);
    expect(receipt.voteCast).to.be.false;
  });

  it('should validate receipt for voting', async () => {
    const validation = await integration.validateReceipt(
      receiptPda,
      payer.publicKey,
      recipient.publicKey
    );

    expect(validation.valid).to.be.true;
    expect(validation.weight).to.equal(5); // 0.05 SOL = 5x weight
  });

  it('should reject vote from non-party', async () => {
    const stranger = Keypair.generate();

    const validation = await integration.validateReceipt(
      receiptPda,
      stranger.publicKey,
      recipient.publicKey
    );

    expect(validation.valid).to.be.false;
    expect(validation.error).to.include('not party');
  });

  it('should prevent double-voting', async () => {
    // Cast first vote
    await integration.castVote(
      recipient.publicKey,
      receiptPda,
      { upvote: {} },
      { responseQuality: 80, responseSpeed: 80, accuracy: 80, professionalism: 80 }
    );

    // Attempt second vote with same receipt
    try {
      await integration.castVote(
        recipient.publicKey,
        receiptPda,
        { upvote: {} },
        { responseQuality: 90, responseSpeed: 90, accuracy: 90, professionalism: 90 }
      );
      throw new Error('Should have failed');
    } catch (error) {
      expect(error.message).to.include('already cast');
    }
  });

  it('should enforce minimum transaction amount', async () => {
    const smallReceiptPda = await integration.createReceipt(
      'small_transaction',
      payer.publicKey,
      recipient.publicKey,
      5_000_000, // 0.005 SOL - below minimum
      ContentType.ApiResponse
    );

    const validation = await integration.validateReceipt(
      smallReceiptPda,
      payer.publicKey,
      recipient.publicKey
    );

    expect(validation.valid).to.be.false;
    expect(validation.error).to.include('too small');
  });

  it('should enforce 30-day voting window', async () => {
    // This test would require manipulating clock or waiting 30 days
    // In practice, test with mocked timestamp
  });
});
```

### Integration Test Flow

```bash
# 1. Deploy all programs
anchor build
anchor deploy --provider.cluster devnet

# 2. Initialize test accounts
npm run test:init

# 3. Run full integration test
npm run test:integration

# Expected flow:
# ✅ Create agent identities
# ✅ Execute x402 payment
# ✅ Auto-create receipt
# ✅ Validate receipt
# ✅ Cast vote with receipt
# ✅ Verify vote recorded
# ✅ Check receipt marked as used
```

---

## Security Considerations

### What to Validate

#### 1. Receipt Creation
- ✅ **Signature Uniqueness**: Each transaction can only have one receipt
- ✅ **Party Authorization**: Only payer or recipient can create receipt
- ✅ **No Self-Transactions**: Payer and recipient must be different
- ✅ **Signature Length**: Max 88 characters (base58 signature)

#### 2. Vote Casting
- ✅ **Party Membership**: Voter must be payer or recipient
- ✅ **Counterparty Match**: Voted agent must be the other party
- ✅ **One Vote Per Receipt**: Prevent double-voting
- ✅ **Time Window**: 30 days from transaction
- ✅ **Minimum Amount**: At least 0.01 SOL transaction
- ✅ **Active Identity**: Both parties must have active identities
- ✅ **Sufficient Reputation**: Voter needs minimum 100 reputation

#### 3. Quality Scores
- ✅ **Range Validation**: All scores must be 0-100
- ✅ **Required Fields**: All four quality dimensions required

### Common Pitfalls

#### ❌ Pitfall 1: Not Hashing Signature
```typescript
// WRONG - using raw signature in seeds
const [receiptPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('tx_receipt'), payer, recipient, Buffer.from(signature)],
  programId
);

// CORRECT - hash signature first
const signatureHash = await crypto.subtle.digest('SHA-256', Buffer.from(signature));
const [receiptPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('tx_receipt'), payer, recipient, Buffer.from(signatureHash)],
  programId
);
```

#### ❌ Pitfall 2: Not Checking vote_cast Flag
```typescript
// WRONG - not checking if vote already cast
await castVote(receiptPda, ...);

// CORRECT - validate receipt first
const receipt = await fetchReceipt(receiptPda);
if (receipt.voteCast) {
  throw new Error('Vote already cast');
}
await castVote(receiptPda, ...);
```

#### ❌ Pitfall 3: Ignoring Voting Window
```typescript
// WRONG - not checking timestamp
await castVote(receiptPda, ...);

// CORRECT - validate time window
const receipt = await fetchReceipt(receiptPda);
const now = Math.floor(Date.now() / 1000);
const deadline = receipt.timestamp + (30 * 24 * 60 * 60);
if (now > deadline) {
  throw new Error('Voting window expired');
}
await castVote(receiptPda, ...);
```

### Attack Vectors & Mitigations

| Attack | Description | Mitigation |
|--------|-------------|------------|
| **Sybil Attack** | Create multiple wallets to vote multiple times | Each vote requires unique transaction receipt with real economic cost |
| **Vote Manipulation** | Coordinated voting with fake transactions | Minimum transaction amount (0.01 SOL) makes manipulation expensive |
| **Receipt Forgery** | Create fake receipts | Receipt PDA derivation includes signature hash, making forgery impossible |
| **Double Voting** | Vote multiple times with same receipt | `vote_cast` flag prevents reuse |
| **Expired Receipt Voting** | Use old receipts after 30 days | Timestamp validation enforces voting window |
| **Self-Voting** | Vote for yourself | Payer and recipient must be different; cannot vote for counterparty in own transaction |
| **Small Transaction Spam** | Many tiny transactions for cheap votes | 0.01 SOL minimum threshold |

---

## FAQ

### General Questions

**Q: What is the minimum transaction amount to vote?**
A: 0.01 SOL (10,000,000 lamports). Transactions below this threshold cannot be used for voting.

**Q: How long do I have to cast a vote after a transaction?**
A: 30 days from the transaction timestamp. After 30 days, the receipt can no longer be used for voting.

**Q: Can I vote multiple times with the same transaction?**
A: No. Each transaction receipt can only be used for one vote. The `vote_cast` flag prevents double-voting.

**Q: Do both parties in a transaction get to vote?**
A: Yes, both the payer and recipient can vote about each other, but each needs their own separate receipt.

**Q: What if I disagree with someone's vote about me?**
A: Votes are subjective feedback. You can vote about them as well, and the reputation system aggregates all votes with weighting.

### Technical Questions

**Q: Who creates the transaction receipt?**
A: Either party (payer or recipient) or an authorized facilitator can create the receipt. Most integrations auto-create receipts via webhook after payment confirmation.

**Q: What happens if I try to create a duplicate receipt?**
A: The transaction will fail because the receipt PDA already exists. This is by design to prevent duplicate receipts.

**Q: How is vote weight calculated?**
A: `weight = min(transaction_amount / 0.01_SOL, 10)`. For example:
- 0.01 SOL → 1x weight
- 0.05 SOL → 5x weight
- 0.10+ SOL → 10x weight (capped)

**Q: Can I delete or modify a receipt?**
A: No. Receipts are immutable once created. This ensures vote integrity.

**Q: What if the transaction was refunded?**
A: The on-chain receipt remains valid. Off-chain systems should track refunds separately and filter votes accordingly.

### Integration Questions

**Q: Do I need to modify my existing x402 payment flow?**
A: Minimal changes. Just add a receipt creation call after payment confirmation. See [Integration Steps](#integration-steps).

**Q: Can I batch create receipts?**
A: Yes, you can create multiple receipts in a single transaction using Solana transaction batching, up to the transaction size limit.

**Q: What RPC methods do I need?**
A: Standard Anchor/web3.js methods:
- `program.methods.createTransactionReceipt().rpc()`
- `program.methods.castPeerVote().rpc()`
- `program.account.transactionReceipt.fetch()`

**Q: How do I test on devnet?**
A: Use the devnet program IDs from `Anchor.toml` and devnet RPC endpoint. See [Testing Guide](#testing-guide).

**Q: What's the cost to create a receipt?**
A: Rent for the account (~0.002 SOL) + transaction fee (~0.000005 SOL). Total ~0.002005 SOL.

### Error Handling

**Q: What if receipt creation fails?**
A: Common causes:
1. Receipt already exists (check first with `fetch()`)
2. Insufficient funds for rent
3. Invalid signature length (>88 chars)
4. Payer == recipient (not allowed)

**Q: What if voting fails?**
A: Common causes:
1. Receipt validation failed (see error message)
2. Voter doesn't have active identity
3. Voter reputation too low (<100)
4. Voted agent inactive or doesn't exist
5. Vote already cast with this receipt
6. Voting window expired (>30 days)

**Q: How do I debug failed transactions?**
A:
```typescript
try {
  await integration.createReceipt(...);
} catch (error) {
  console.error('Transaction failed:', error);
  console.log('Error logs:', error.logs); // Anchor program logs
  console.log('Error code:', error.code); // Anchor error code
}
```

---

## Additional Resources

- **Vote Registry Program**: `/programs/vote_registry/`
- **API Reference**: See `API_REFERENCE.md`
- **Deployment Guide**: See `DEPLOYMENT_CHECKLIST.md`
- **Full System Documentation**: See `VOTING_SYSTEM_README.md`

---

**Last Updated**: January 2026
**Program Version**: v1.0.0
**Solana Compatibility**: Solana 1.18+, Anchor 0.30+
