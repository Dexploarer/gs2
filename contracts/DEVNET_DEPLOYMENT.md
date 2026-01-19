# GhostSpeak Devnet Deployment
## January 18, 2026

**Status**: ✅ ALL 4 PROGRAMS DEPLOYED
**Network**: Solana Devnet
**Cluster**: https://api.devnet.solana.com

---

## Deployed Programs

### 1. Identity Registry
**Program ID**: `2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e`
**Deployment Signature**: `2ofzuxYfWZ25anew1atwAo22AokiYk6DEx9JePNTk6PffTXnWgpHqGLLW8CKLY1nBhQMRCf9GmdSnf9F4PcPeYfF`
**ProgramData**: `GPdxdzMu3kAzXHeMtUxEgD4UzkbGJ31kPRkSyTpAYpxA`
**Solana Explorer**: https://explorer.solana.com/address/2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e?cluster=devnet

**Purpose**: Registers AI agents with on-chain identity linked to Metaplex Core NFTs

**Instructions**:
- `register_agent` - Register new agent identity
- `update_identity` - Update agent metadata URI
- `verify_identity` - Verify agent exists and is active
- `deactivate_agent` - Emergency deactivation

---

### 2. Reputation Registry
**Program ID**: `A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp`
**Deployment Signature**: `CgynpaiAQKcs2qhn2UdaY6XHNUfFLgK1yhGrcebTXj2bzTkjDqtL9XzVVZjMPZbtdoz5hYaazvg6wPb6cexfNwJ`
**ProgramData**: `BsNiKhbPxTZW4R1nwePEc7ETFJqX1EW7q5ZfvTmgiZLo`
**Solana Explorer**: https://explorer.solana.com/address/A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp?cluster=devnet

**Purpose**: Stores agent reputation scores (0-1000 scale)

**Instructions**:
- `initialize_authority` - Initialize reputation authority
- `initialize_reputation` - Initialize agent reputation account
- `update_reputation` - Update agent's reputation score
- `get_reputation` - Query agent reputation

---

### 3. Validation Registry
**Program ID**: `9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc`
**Deployment Signature**: `5faW1uKDBCMHV9Vf6qoWHpWmiX26fpyxTEMxiYsz8XGHL5nMaaEKinfaq7z7vvxMDSmwtbk3tN77HGjRRsJMtph9`
**ProgramData**: `2VdsQsMu9yCx2hn6m8TDxAWDupMmDj18fBZJs8wAkyJg`
**Solana Explorer**: https://explorer.solana.com/address/9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc?cluster=devnet

**Purpose**: Stake-based validation system for agent claims

**Instructions**:
- `initialize_authority` - Initialize validation authority
- `register_validator` - Register new validator
- `issue_validation_stamp` - Issue validation stamp for agent claim
- `slash_validator` - Slash validator for false validation

---

### 4. Vote Registry (Transaction-Gated Voting)
**Program ID**: `EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6`
**Deployment Signature**: `4uMswDG49s4mD85CwdUXyJJ7AFv2MnureqWVm51jGYKC5TH2m7JfTDRSGbTNAR9aUoZzJBzMDDWLTiAekFUZWJn8`
**ProgramData**: `F2wJ8f9KGj99kwQqVcNmdYXLunFDGEiiPgCsfd6oCcNf`
**Solana Explorer**: https://explorer.solana.com/address/EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6?cluster=devnet

**Purpose**: x402 transaction-gated voting and reputation system

**Instructions**:
- `create_transaction_receipt` - Create receipt from x402 payment
- `cast_peer_vote` - Vote on agent quality (requires receipt)
- `rate_content` - Rate content quality from x402 transaction
- `endorse_agent` - Endorse agent with stake

**Key Features**:
- ✅ Supports micropayments ($0.001+)
- ✅ Transaction-proof required for voting
- ✅ One vote per receipt
- ✅ 30-day voting window
- ✅ Equal vote weights (quality over amount)

---

## Deployment Details

### Network
- **RPC**: https://api.devnet.solana.com
- **WebSocket**: wss://api.devnet.solana.com/
- **Commitment**: confirmed

### Upgrade Authority
**Pubkey**: `JQ4xZgWno1tmWkKFgER5XSrXpWzwmsU9ov7Vf8CsBkk`

### Deployment Date
**January 18, 2026** - 9:45 AM PST

### Program Sizes
- identity_registry: ~150 KB
- reputation_registry: ~120 KB
- validation_registry: ~130 KB
- vote_registry: ~180 KB

---

## Integration Guide

### TypeScript SDK Setup

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const provider = new AnchorProvider(connection, wallet, {});

// Load IDLs
const voteRegistryIDL = await import('./target/idl/vote_registry.json');

// Initialize program
const voteRegistry = new Program(
  voteRegistryIDL,
  new PublicKey('EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6'),
  provider
);
```

### Creating a Transaction Receipt

```typescript
import { createHash } from 'crypto';

// After x402 payment is made
const signature = 'YOUR_TRANSACTION_SIGNATURE';
const signatureHash = Array.from(
  createHash('sha256').update(signature).digest()
);

// Derive receipt PDA
const [receiptPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from('tx_receipt'),
    payerPubkey.toBuffer(),
    recipientPubkey.toBuffer(),
    Buffer.from(signatureHash),
  ],
  voteRegistry.programId
);

// Create receipt
await voteRegistry.methods
  .createTransactionReceipt(
    signature,
    signatureHash,
    78_000, // $0.078 in lamports (average x402 payment)
    { chat: {} } // Content type
  )
  .accounts({
    receipt: receiptPda,
    payerPubkey,
    recipientPubkey,
    creator: recipientPubkey, // Seller creates receipt
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Casting a Vote

```typescript
// Derive vote PDA from receipt
const [votePda] = PublicKey.findProgramAddressSync(
  [Buffer.from('peer_vote'), receiptPda.toBuffer()],
  voteRegistry.programId
);

// Cast vote
await voteRegistry.methods
  .castPeerVote(
    votedAgentPubkey,
    { upvote: {} }, // Vote type
    {
      responseQuality: 95,
      responseSpeed: 88,
      accuracy: 92,
      professionalism: 90,
    },
    commentHash // SHA256 hash of comment (stored off-chain)
  )
  .accounts({
    peerVote: votePda,
    transactionReceipt: receiptPda,
    voterIdentity,
    voterReputation,
    votedAgentIdentity,
    voter: voterPubkey,
    identityRegistryProgram: new PublicKey('2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e'),
    reputationRegistryProgram: new PublicKey('A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp'),
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

---

## Testing

### Test x402 Payment Flow

```bash
# 1. Create mock x402 payment transaction
# 2. Create receipt
npm run test:devnet:receipt

# 3. Cast vote using receipt
npm run test:devnet:vote

# 4. Verify vote was recorded
npm run test:devnet:verify
```

### Run Bankrun Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:receipt
npm run test:voting
npm run test:integration
```

---

## Next Steps

### Phase 2: MCP Integration ✅ COMPLETE

**MCP Server Built**: `mcp-server/`

**Exposed Tools**:
- ✅ `get_agent_reputation(agentAddress)` - Query reputation and vote statistics
- ✅ `search_agents(category, minScore)` - Find agents by criteria
- ✅ `get_agent_votes(agentAddress, limit)` - Fetch voting history
- ✅ `get_vote_details(voteId)` - Detailed vote information with transaction proof

**Usage**:
```bash
# Install dependencies
cd mcp-server
bun install

# Build
npm run build

# Test connection
bun run test-server.ts
```

**Integration Examples**:
- Vercel AI SDK: `mcp-server/examples/vercel-ai-sdk-integration.ts`
- Claude Desktop: `mcp-server/examples/claude-desktop-config.json`

**Documentation**: `mcp-server/README.md`

**Next**: Publish to npm as `@ghostspeak/mcp-server`

---

### Phase 3: Discovery Layer (2 WEEKS)

**Build GraphQL API**:
```graphql
type Agent {
  address: String!
  reputation: Int!
  totalVotes: Int!
  averageQuality: Float!
  upvoteRatio: Float!
}

type Query {
  agents(category: String, minScore: Int): [Agent!]!
  agent(address: String!): Agent
}
```

**Frontend**:
- Agent profile pages at `agents.ghostspeak.io`
- Search/filter by category and reputation
- Vote history and quality metrics
- Real-time updates via WebSocket

---

### Phase 4: Monitoring & Analytics

**Monitor**:
- x402-mcp developments (Vercel GitHub)
- MCP ecosystem updates (Anthropic, Linux Foundation)
- x402 protocol changes (Coinbase GitHub)
- ERC-8004 v2 spec updates

**Metrics to Track**:
- Transaction receipts created/day
- Votes cast/day
- Active agents
- Average quality scores
- Network uptime

---

## Security

### Program Upgrades
- Upgrade authority: Single keypair (should migrate to multisig)
- Upgrades require rebuild + `solana program deploy`

### Recommended: Upgrade to Multisig
```bash
# Create 2-of-3 multisig
squads-cli multisig create \
  --members $KEY1,$KEY2,$KEY3 \
  --threshold 2

# Transfer upgrade authority
solana program set-upgrade-authority \
  EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6 \
  --new-upgrade-authority $MULTISIG_ADDRESS
```

---

## Support

### Documentation
- SDK: `./sdk/README.md`
- API Reference: `./programs/vote_registry/API_REFERENCE.md`
- Integration Guide: `./X402_INTEGRATION_GUIDE.md`
- Landscape Analysis: `./2026_LANDSCAPE_ANALYSIS.md`

### Explorer Links
- Identity Registry: https://explorer.solana.com/address/2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e?cluster=devnet
- Reputation Registry: https://explorer.solana.com/address/A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp?cluster=devnet
- Validation Registry: https://explorer.solana.com/address/9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc?cluster=devnet
- Vote Registry: https://explorer.solana.com/address/EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6?cluster=devnet

---

## Changelog

### January 18, 2026 - Initial Deployment
- ✅ Deployed all 4 programs to devnet
- ✅ Fixed micropayment support (removed minimums)
- ✅ Simplified vote weighting (equal weights)
- ✅ Updated program IDs in all configurations
- ✅ Verified all programs on explorer

---

**Status**: ✅ PHASE 1 & 2 COMPLETE
**Completed**:
- ✅ All 4 programs deployed to devnet
- ✅ MCP server built with 4 tools
- ✅ Integration examples for Vercel AI SDK & Claude Desktop
- ✅ x402-MCP monitoring guide created

**Next**: Create x402 payment test, then GraphQL API
**Timeline**: Payment tests this week, GraphQL API in 2 weeks
