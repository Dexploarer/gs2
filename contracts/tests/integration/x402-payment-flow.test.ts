/**
 * x402 Payment Flow Integration Test
 *
 * Tests complete end-to-end flow:
 * 1. Generate mock x402 payment
 * 2. Parse transaction
 * 3. Create receipt on-chain
 * 4. Cast vote using receipt
 * 5. Verify vote is linked to receipt
 *
 * This validates the entire transaction-gated voting system.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { BankrunProvider } from 'anchor-bankrun';
import { Program, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import {
  generateMockX402Payment,
  parseMockX402Transaction,
  deriveReceiptPDA,
  generateRealisticX402Amount,
  isValidSolanaSignature,
  MockX402Payment,
} from '../helpers/mock-x402-payment';
import { startAnchor } from 'solana-bankrun';
import { createHash } from 'crypto';

const VOTE_REGISTRY_PROGRAM_ID = 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6';
const IDENTITY_REGISTRY_PROGRAM_ID = '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e';
const REPUTATION_REGISTRY_PROGRAM_ID = 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp';

describe('x402 Payment Flow Integration', () => {
  let provider: BankrunProvider;
  let voteRegistryProgram: Program;
  let identityRegistryProgram: Program;
  let reputationRegistryProgram: Program;

  let payer: Keypair;
  let recipient: Keypair;
  let voter: Keypair;
  let votedAgent: Keypair;

  beforeAll(async () => {
    // Start bankrun with all programs
    const context = await startAnchor(
      './',
      [
        {
          name: 'vote_registry',
          programId: new PublicKey(VOTE_REGISTRY_PROGRAM_ID),
        },
        {
          name: 'identity_registry',
          programId: new PublicKey(IDENTITY_REGISTRY_PROGRAM_ID),
        },
        {
          name: 'reputation_registry',
          programId: new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID),
        },
      ],
      []
    );

    provider = new BankrunProvider(context);

    // Load programs
    const voteRegistryIDL = await Program.fetchIdl(
      new PublicKey(VOTE_REGISTRY_PROGRAM_ID),
      provider
    );
    voteRegistryProgram = new Program(
      voteRegistryIDL!,
      provider
    );

    const identityRegistryIDL = await Program.fetchIdl(
      new PublicKey(IDENTITY_REGISTRY_PROGRAM_ID),
      provider
    );
    identityRegistryProgram = new Program(
      identityRegistryIDL!,
      provider
    );

    const reputationRegistryIDL = await Program.fetchIdl(
      new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID),
      provider
    );
    reputationRegistryProgram = new Program(
      reputationRegistryIDL!,
      provider
    );

    // Generate keypairs
    payer = Keypair.generate();
    recipient = Keypair.generate();
    voter = Keypair.generate();
    votedAgent = Keypair.generate();

    // Airdrop SOL for testing
    await provider.connection.requestAirdrop(payer.publicKey, 10 * 1e9);
    await provider.connection.requestAirdrop(voter.publicKey, 10 * 1e9);
  });

  test('generates valid mock x402 payment', async () => {
    const amount = generateRealisticX402Amount();
    const payment = await generateMockX402Payment(
      payer,
      recipient.publicKey,
      amount
    );

    expect(payment.transaction).toBeTruthy();
    expect(isValidSolanaSignature(payment.signature)).toBe(true);
    expect(payment.signatureHash).toHaveLength(32);
    expect(payment.payer.toString()).toBe(payer.publicKey.toString());
    expect(payment.recipient.toString()).toBe(recipient.publicKey.toString());
    expect(payment.amount).toBe(amount);
  });

  test('parses mock x402 transaction correctly', async () => {
    const amount = 78_000; // Average x402 payment
    const payment = await generateMockX402Payment(
      payer,
      recipient.publicKey,
      amount
    );

    const parsed = await parseMockX402Transaction(payment.transaction);

    expect(parsed.signature).toBe(payment.signature);
    expect(parsed.signatureHash).toEqual(payment.signatureHash);
    expect(parsed.payer.toString()).toBe(payer.publicKey.toString());
    expect(parsed.recipient.toString()).toBe(recipient.publicKey.toString());
    expect(parsed.amount).toBe(amount);
  });

  test('creates transaction receipt from x402 payment', async () => {
    const amount = 78_000;
    const payment = await generateMockX402Payment(
      payer,
      recipient.publicKey,
      amount
    );

    // Derive receipt PDA
    const [receiptPda] = deriveReceiptPDA(
      payer.publicKey,
      recipient.publicKey,
      payment.signatureHash,
      voteRegistryProgram.programId
    );

    // Create receipt
    const contentType = { chat: {} };

    await voteRegistryProgram.methods
      .createTransactionReceipt(
        payment.signature,
        payment.signatureHash,
        amount,
        contentType
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: payer.publicKey,
        recipientPubkey: recipient.publicKey,
        creator: recipient.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([recipient])
      .rpc();

    // Fetch and verify receipt
    const receiptAccount = await (voteRegistryProgram.account as any)['transactionReceipt'].fetch(
      receiptPda
    );

    expect(receiptAccount.signature).toBe(payment.signature);
    expect(receiptAccount.payer.toString()).toBe(payer.publicKey.toString());
    expect(receiptAccount.recipient.toString()).toBe(recipient.publicKey.toString());
    expect(receiptAccount.amount.toNumber()).toBe(amount);
    expect(receiptAccount.voteCast).toBe(false);
  });

  test('END-TO-END: payment → receipt → vote flow', async () => {
    // Step 1: Generate x402 payment
    const amount = generateRealisticX402Amount();
    const payment = await generateMockX402Payment(
      voter,
      recipient.publicKey,
      amount
    );

    console.log('\n--- x402 Payment Generated ---');
    console.log('Amount:', amount, 'lamports (~$' + (amount / 1_000_000).toFixed(3) + ')');
    console.log('Signature:', payment.signature.slice(0, 20) + '...');

    // Step 2: Create receipt
    const [receiptPda] = deriveReceiptPDA(
      voter.publicKey,
      recipient.publicKey,
      payment.signatureHash,
      voteRegistryProgram.programId
    );

    await voteRegistryProgram.methods
      .createTransactionReceipt(
        payment.signature,
        payment.signatureHash,
        amount,
        { chat: {} }
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: voter.publicKey,
        recipientPubkey: recipient.publicKey,
        creator: recipient.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([recipient])
      .rpc();

    console.log('Receipt created:', receiptPda.toString().slice(0, 20) + '...');

    // Step 3: Setup identities and reputation accounts
    const [voterIdentityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent_identity'), voter.publicKey.toBuffer()],
      identityRegistryProgram.programId
    );

    const [votedAgentIdentityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent_identity'), votedAgent.publicKey.toBuffer()],
      identityRegistryProgram.programId
    );

    const [voterReputationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.publicKey.toBuffer()],
      reputationRegistryProgram.programId
    );

    // Register voter identity
    await identityRegistryProgram.methods
      .registerAgent(
        voter.publicKey,
        'https://example.com/voter-metadata.json'
      )
      .accounts({
        agentIdentity: voterIdentityPda,
        agent: voter.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([voter])
      .rpc();

    // Register voted agent identity
    await identityRegistryProgram.methods
      .registerAgent(
        votedAgent.publicKey,
        'https://example.com/agent-metadata.json'
      )
      .accounts({
        agentIdentity: votedAgentIdentityPda,
        agent: votedAgent.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([votedAgent])
      .rpc();

    // Initialize reputation authority
    const [authorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority')],
      reputationRegistryProgram.programId
    );

    await reputationRegistryProgram.methods
      .initializeAuthority()
      .accounts({
        authority: authorityPda,
        admin: voter.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([voter])
      .rpc();

    // Initialize voter reputation
    await reputationRegistryProgram.methods
      .initializeReputation()
      .accounts({
        reputation: voterReputationPda,
        agent: voter.publicKey,
        authority: authorityPda,
        payer: voter.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([voter])
      .rpc();

    console.log('Identities and reputation initialized');

    // Step 4: Cast vote
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      voteRegistryProgram.programId
    );

    const qualityScores = {
      responseQuality: 95,
      responseSpeed: 88,
      accuracy: 92,
      professionalism: 90,
    };

    const commentHash = Array.from(
      createHash('sha256').update('Great service!').digest()
    );

    await voteRegistryProgram.methods
      .castPeerVote(
        votedAgent.publicKey,
        { upvote: {} },
        qualityScores,
        commentHash
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity: voterIdentityPda,
        voterReputation: voterReputationPda,
        votedAgentIdentity: votedAgentIdentityPda,
        voter: voter.publicKey,
        identityRegistryProgram: identityRegistryProgram.programId,
        reputationRegistryProgram: reputationRegistryProgram.programId,
        systemProgram: PublicKey.default,
      })
      .signers([voter])
      .rpc();

    console.log('Vote cast:', votePda.toString().slice(0, 20) + '...');

    // Step 5: Verify vote
    const voteAccount = await (voteRegistryProgram.account as any)['peerVote'].fetch(votePda);

    expect(voteAccount.votedAgent.toString()).toBe(votedAgent.publicKey.toString());
    expect(voteAccount.voter.toString()).toBe(voter.publicKey.toString());
    expect(voteAccount.voteType).toHaveProperty('upvote');
    expect(voteAccount.qualityScores.responseQuality).toBe(95);
    expect(voteAccount.qualityScores.responseSpeed).toBe(88);
    expect(voteAccount.qualityScores.accuracy).toBe(92);
    expect(voteAccount.qualityScores.professionalism).toBe(90);

    // Verify receipt is marked as voted
    const updatedReceipt = await (voteRegistryProgram.account as any)['transactionReceipt'].fetch(
      receiptPda
    );
    expect(updatedReceipt.voteCast).toBe(true);

    console.log('\n✅ END-TO-END TEST PASSED');
    console.log('Payment → Receipt → Vote flow working correctly!');
  });

  test('enforces one vote per receipt', async () => {
    // Generate payment and create receipt
    const payment = await generateMockX402Payment(
      payer,
      recipient.publicKey,
      78_000
    );

    const [receiptPda] = deriveReceiptPDA(
      payer.publicKey,
      recipient.publicKey,
      payment.signatureHash,
      voteRegistryProgram.programId
    );

    await voteRegistryProgram.methods
      .createTransactionReceipt(
        payment.signature,
        payment.signatureHash,
        78_000,
        { chat: {} }
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: payer.publicKey,
        recipientPubkey: recipient.publicKey,
        creator: recipient.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([recipient])
      .rpc();

    // Setup accounts (abbreviated)
    const [payerIdentityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent_identity'), payer.publicKey.toBuffer()],
      identityRegistryProgram.programId
    );

    const [payerReputationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), payer.publicKey.toBuffer()],
      reputationRegistryProgram.programId
    );

    const [agentIdentityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent_identity'), votedAgent.publicKey.toBuffer()],
      identityRegistryProgram.programId
    );

    // Cast first vote (should succeed)
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      voteRegistryProgram.programId
    );

    await voteRegistryProgram.methods
      .castPeerVote(
        votedAgent.publicKey,
        { upvote: {} },
        { responseQuality: 90, responseSpeed: 85, accuracy: 88, professionalism: 92 },
        Array.from(createHash('sha256').update('comment').digest())
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity: payerIdentityPda,
        voterReputation: payerReputationPda,
        votedAgentIdentity: agentIdentityPda,
        voter: payer.publicKey,
        identityRegistryProgram: identityRegistryProgram.programId,
        reputationRegistryProgram: reputationRegistryProgram.programId,
        systemProgram: PublicKey.default,
      })
      .signers([payer])
      .rpc();

    // Try to cast second vote with same receipt (should fail)
    await expect(
      voteRegistryProgram.methods
        .castPeerVote(
          votedAgent.publicKey,
          { downvote: {} },
          { responseQuality: 50, responseSpeed: 50, accuracy: 50, professionalism: 50 },
          Array.from(createHash('sha256').update('different comment').digest())
        )
        .accounts({
          peerVote: votePda,
          transactionReceipt: receiptPda,
          voterIdentity: payerIdentityPda,
          voterReputation: payerReputationPda,
          votedAgentIdentity: agentIdentityPda,
          voter: payer.publicKey,
          identityRegistryProgram: identityRegistryProgram.programId,
          reputationRegistryProgram: reputationRegistryProgram.programId,
          systemProgram: PublicKey.default,
        })
        .signers([payer])
        .rpc()
    ).rejects.toThrow(/VoteAlreadyCast/);

    console.log('✅ One-vote-per-receipt constraint enforced');
  });

  test('supports micropayments ($0.001+)', async () => {
    const micropaymentAmounts = [
      1_000, // $0.001
      5_000, // $0.005
      10_000, // $0.01
    ];

    for (const amount of micropaymentAmounts) {
      const payment = await generateMockX402Payment(
        payer,
        recipient.publicKey,
        amount
      );

      const [receiptPda] = deriveReceiptPDA(
        payer.publicKey,
        recipient.publicKey,
        payment.signatureHash,
        voteRegistryProgram.programId
      );

      await voteRegistryProgram.methods
        .createTransactionReceipt(
          payment.signature,
          payment.signatureHash,
          amount,
          { chat: {} }
        )
        .accounts({
          receipt: receiptPda,
          payerPubkey: payer.publicKey,
          recipientPubkey: recipient.publicKey,
          creator: recipient.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([recipient])
        .rpc();

      const receiptAccount = await (voteRegistryProgram.account as any)['transactionReceipt'].fetch(
        receiptPda
      );

      expect(receiptAccount.amount.toNumber()).toBe(amount);
      console.log(`✅ Micropayment ${amount} lamports ($${(amount / 1_000_000).toFixed(3)}) supported`);
    }
  });
});
