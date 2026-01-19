# GhostSpeak x402 Integration SDK

Automatic transaction receipt creation for **transaction-gated voting** in the GhostSpeak ERC-8004 trust layer.

## What This Does

When agents make x402 payments to your service, this SDK:
1. **Parses the payment** - Extracts signature, payer, recipient, amount from x402 PaymentPayload
2. **Creates on-chain receipt** - Stores transaction proof in Solana vote_registry program
3. **Enables voting** - Allows payer/recipient to vote on each other within 30 days

This prevents fake reviews by requiring **proof of actual transaction** before voting.

## Installation

```bash
npm install @ghostspeak/x402-sdk
# or
yarn add @ghostspeak/x402-sdk
```

## Quick Start

### Express.js Middleware

```typescript
import express from 'express';
import { x402Middleware, ContentType } from '@ghostspeak/x402-sdk';

const app = express();

// Configure middleware
const x402Config = {
  program,        // Your vote_registry Anchor program
  provider,       // Anchor provider
  sellerKeypair,  // Your service's keypair (recipient)
  contentType: ContentType.Chat,
};

// Protected endpoint - automatically creates receipts
app.post('/api/chat', x402Middleware(x402Config), (req, res) => {
  const { payer, amount, receiptPda } = req.x402Payment;

  // Payment verified! Serve protected content
  res.json({
    response: 'Your AI response',
    receiptPda: receiptPda.toBase58(), // For future voting
  });
});
```

### Next.js API Route

```typescript
import { withX402, ContentType } from '@ghostspeak/x402-sdk';

const config = {
  program,
  provider,
  sellerKeypair,
  contentType: ContentType.Chat,
};

async function handler(req, res) {
  const { payer, receiptPda } = req.x402Payment;

  // Payment verified, receipt created!
  res.json({ data: 'Protected content' });
}

export default withX402(config)(handler);
```

### Manual Receipt Creation

```typescript
import {
  parseX402Transaction,
  ReceiptCreator,
  ContentType,
} from '@ghostspeak/x402-sdk';

// Parse x402 payment
const txData = await parseX402Transaction(paymentPayload.payload);

// Create receipt
const receiptCreator = new ReceiptCreator(program, provider);
const txSignature = await receiptCreator.createReceipt(
  txData,
  ContentType.Chat,
  sellerKeypair
);

console.log('Receipt created:', txSignature);
```

## API Reference

### Types

#### `ContentType` enum
```typescript
enum ContentType {
  Chat = 0,
  Audio = 1,
  Video = 2,
  Image = 3,
  Data = 4,
  Compute = 5,
  Other = 6,
}
```

#### `ParsedX402Transaction`
```typescript
interface ParsedX402Transaction {
  signature: string;      // Base58 transaction signature
  signatureHash: number[]; // SHA256 hash for PDA seed
  payer: PublicKey;       // Transaction fee payer
  recipient: PublicKey;   // Token transfer recipient
  amount: bigint;         // Payment amount (lamports)
  timestamp: number;      // Unix timestamp (seconds)
}
```

### Functions

#### `parseX402Transaction(payload: ExactSvmPayload): Promise<ParsedX402Transaction>`

Parses base64-encoded Solana transaction from x402 PaymentPayload.

**Example:**
```typescript
const txData = await parseX402Transaction({
  transaction: 'BASE64_ENCODED_TX_HERE',
});

console.log('Payer:', txData.payer.toBase58());
console.log('Amount:', txData.amount.toString());
```

#### `hashSignature(signature: string): number[]`

Creates SHA256 hash of transaction signature for PDA derivation.

**Example:**
```typescript
const hash = hashSignature('5oDk...Jx9P'); // Returns [123, 45, 67, ...]
```

### Classes

#### `ReceiptCreator`

Manages transaction receipt creation and retrieval.

**Methods:**

- `createReceipt(txData, contentType, creatorKeypair): Promise<string>`
  - Creates on-chain receipt
  - Returns transaction signature
  - Throws if creator is not payer or recipient

- `deriveReceiptPda(payer, recipient, signatureHash): [PublicKey, number]`
  - Derives receipt PDA address
  - Returns `[pda, bump]`

- `receiptExists(receiptPda): Promise<boolean>`
  - Checks if receipt already exists

- `getReceipt(receiptPda): Promise<TransactionReceipt>`
  - Fetches receipt account data

- `findReceiptBySignature(signature, payer, recipient): Promise<PublicKey | null>`
  - Finds receipt PDA by transaction signature

**Example:**
```typescript
const creator = new ReceiptCreator(program, provider);

// Create receipt
const sig = await creator.createReceipt(txData, ContentType.Chat, keypair);

// Check if exists
const [pda] = creator.deriveReceiptPda(payer, recipient, signatureHash);
const exists = await creator.receiptExists(pda);

// Fetch data
const receipt = await creator.getReceipt(pda);
console.log('Vote cast:', receipt.voteCast);
```

### Middleware

#### `x402Middleware(config: X402MiddlewareConfig)`

Express middleware that auto-creates receipts after x402 payments.

**Config:**
```typescript
interface X402MiddlewareConfig {
  program: Program<any>;           // Vote registry program
  provider: AnchorProvider;        // Solana provider
  sellerKeypair: Keypair;          // Your service's keypair
  contentType: ContentType;        // Default content type
  onReceiptCreated?: (pda, txData) => void; // Optional callback
  onError?: (error, req) => void;  // Optional error handler
}
```

**Behavior:**
- Returns `402 Payment Required` if no X-PAYMENT header
- Parses payment payload
- Validates recipient matches seller
- Creates receipt on-chain
- Attaches `req.x402Payment` with payment details
- Calls `next()` to continue to route handler

#### `withX402(config: X402MiddlewareConfig)`

Next.js API route wrapper with same functionality as Express middleware.

**Example:**
```typescript
export default withX402(config)(async (req, res) => {
  // Payment verified!
  const { payer, amount, receiptPda } = req.x402Payment;
  res.json({ success: true });
});
```

## How It Works

### 1. x402 Payment Flow

```
Client                   Server                 Blockchain
  |                        |                         |
  |--GET /api/chat-------->|                         |
  |<--402 Payment Required-|                         |
  |                        |                         |
  |--POST with X-PAYMENT-->|                         |
  |   (base64 tx)          |                         |
  |                        |--Parse transaction----->|
  |                        |                         |
  |                        |--Create receipt-------->|
  |                        |<--Receipt PDA-----------|
  |<--200 OK + content-----|                         |
  |   (includes receiptPda)|                         |
```

### 2. Receipt Creation

The SDK:
1. Decodes base64 transaction from `PaymentPayload.payload.transaction`
2. Extracts signature, payer, recipient using `VersionedTransaction.deserialize()`
3. Finds `TransferChecked` instruction to get payment amount
4. Hashes signature with SHA256 for PDA seed
5. Calls `createTransactionReceipt` instruction on vote_registry program

**PDA Derivation:**
```typescript
[receiptPda, bump] = PublicKey.findProgramAddressSync([
  Buffer.from('tx_receipt'),
  payer.toBuffer(),
  recipient.toBuffer(),
  Buffer.from(signatureHash),
], programId);
```

### 3. Voting Window

After receipt creation:
- **Both parties** (payer and recipient) can vote on each other
- **30-day window** from transaction timestamp
- **One vote per receipt** (enforced by `vote_cast` flag)
- **Vote weighting** based on transaction amount (0.01 SOL = 1.0x, 10 SOL = 4.0x)

## Environment Setup

### Required Environment Variables

```bash
# Solana RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com

# Your seller private key (base64)
SELLER_PRIVATE_KEY=<your-base64-private-key>

# Vote registry program ID (after deployment)
VOTE_REGISTRY_PROGRAM_ID=<your-program-id>
```

### Generating Seller Keypair

```bash
# Generate new keypair
solana-keygen new -o seller-keypair.json

# Convert to base64 for environment variable
cat seller-keypair.json | jq -c . | base64
```

## Examples

See `examples/x402-integration/` for complete examples:

- **express-server.ts** - Full Express.js server with x402 middleware
- **nextjs-api-route.ts** - Next.js API route with payment protection
- **manual-receipt-creation.ts** - Manual control over receipt creation

## Security Considerations

### Receipt Creation
- ✅ Only payer or recipient can create receipt (enforced on-chain)
- ✅ Cannot create receipt for self-transactions (enforced on-chain)
- ✅ Receipts are immutable once created

### Voting Protection
- ✅ One vote per receipt (enforced by `vote_cast` flag)
- ✅ Only transaction parties can vote (enforced on-chain)
- ✅ 30-day voting window (prevents stale votes)
- ✅ Minimum 0.01 SOL transaction (prevents spam)
- ✅ Vote weighting caps at 10.0x (prevents whale dominance)

## Testing

```bash
# Build SDK
cd sdk
npm install
npm run build

# Run example
cd ../examples/x402-integration
npx ts-node express-server.ts
```

## Troubleshooting

### "Transaction missing signature"
- Ensure `PaymentPayload.payload.transaction` is base64-encoded
- Verify transaction is partially signed by client

### "No TransferChecked instruction found"
- x402 payments must use Token or Token-2022 program
- Verify payment is not a raw SOL transfer

### "Creator must be either payer or recipient"
- `sellerKeypair` must match the recipient in the transaction
- Check that you're using the correct keypair

### "Receipt already exists"
- Receipts are idempotent - this is normal
- SDK skips creation if receipt already exists

## License

MIT

## Support

- GitHub Issues: https://github.com/ghostspeak/erc8004/issues
- Documentation: https://docs.ghostspeak.io
- Discord: https://discord.gg/ghostspeak
