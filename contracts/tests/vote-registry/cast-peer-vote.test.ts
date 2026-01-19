/**
 * Cast Peer Vote Tests
 * Tests for transaction-gated voting with receipts
 */

import { describe, test, beforeAll, beforeEach, expect } from '@jest/globals';
import { startAnchor, ProgramTestContext } from 'solana-bankrun';
import { BankrunProvider } from 'anchor-bankrun';
import { Program, BN, type Idl } from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import * as fs from 'fs';

describe('Cast Peer Vote', () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let voteProgram: Program<Idl>;
  let voter: Keypair;
  let votedAgent: Keypair;
  let receiptPda: PublicKey;

  // Mock identity and reputation program IDs
  const IDENTITY_PROGRAM_ID = new PublicKey('IdentMockMockMockMockMockMockMockMockMock');
  const REPUTATION_PROGRAM_ID = new PublicKey('ReputMockMockMockMockMockMockMockMockMock');

  // Helper to create and process a transfer transaction
  async function airdrop(to: PublicKey, lamports: number): Promise<void> {
    const tx = new Transaction();
    tx.recentBlockhash = context.lastBlockhash;
    tx.feePayer = context.payer.publicKey;
    tx.add(
      SystemProgram.transfer({
        fromPubkey: context.payer.publicKey,
        toPubkey: to,
        lamports,
      })
    );
    tx.sign(context.payer);
    await context.banksClient.processTransaction(tx);
  }

  beforeAll(async () => {
    // Start Bankrun with vote_registry program
    context = await startAnchor(
      '',
      [
        {
          name: 'vote_registry',
          programId: new PublicKey('6yqgRTrKwgdK73EHfw8oXaQvhDqyzbjQKS5pDUncMZrN'),
        },
      ],
      []
    );

    provider = new BankrunProvider(context);

    const idl = JSON.parse(
      fs.readFileSync('./target/idl/vote_registry.json', 'utf-8')
    ) as Idl;

    voteProgram = new Program(
      idl,
      provider
    );

    voter = Keypair.generate();
    votedAgent = Keypair.generate();

    // Airdrop SOL to voter
    await airdrop(voter.publicKey, 10_000_000_000);
  });

  beforeEach(async () => {
    // Create a fresh transaction receipt for each test
    const signature = `5oDkVACdJHLXvphAYEiXzs6wMvZRjFUu8XyHi6BPq${Date.now()}`;
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    [receiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        voter.publicKey.toBuffer(),
        votedAgent.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      voteProgram.programId
    );

    // Create receipt (voter paid votedAgent)
    await voteProgram.methods
      .createTransactionReceipt(
        signature,
        signatureHash,
        new BN(100_000_000), // 0.1 SOL
        { chat: {} }
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: voter.publicKey,
        recipientPubkey: votedAgent.publicKey,
        creator: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();
  });

  test('casts vote successfully with valid receipt', async () => {
    // Derive vote PDA from receipt
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      voteProgram.programId
    );

    // Derive mock identity and reputation PDAs
    const [voterIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), voter.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [voterReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), votedAgent.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    // Quality scores
    const qualityScores = {
      responseQuality: 85,
      responseSpeed: 90,
      accuracy: 88,
      professionalism: 92,
    };

    const commentHash = Array.from(createHash('sha256').update('Great service!').digest());

    // Cast vote
    const tx = await voteProgram.methods
      .castPeerVote(
        votedAgent.publicKey,
        { upvote: {} },
        qualityScores,
        commentHash
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity,
        voterReputation,
        votedAgentIdentity,
        voter: voter.publicKey,
        identityRegistryProgram: IDENTITY_PROGRAM_ID,
        reputationRegistryProgram: REPUTATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    console.log('Vote cast:', tx);

    // Fetch and verify vote
    const vote = await (voteProgram.account as any)['peerVote'].fetch(votePda);

    expect(vote.voter.toBase58()).toBe(voter.publicKey.toBase58());
    expect(vote.votedAgent.toBase58()).toBe(votedAgent.publicKey.toBase58());
    expect(Object.keys(vote.voteType)[0]).toBe('upvote');
    expect(vote.qualityScores.responseQuality).toBe(85);
    expect(vote.qualityScores.responseSpeed).toBe(90);
    expect(vote.qualityScores.accuracy).toBe(88);
    expect(vote.qualityScores.professionalism).toBe(92);
    expect(vote.transactionReceipt.toBase58()).toBe(receiptPda.toBase58());

    // Verify vote weight calculation (0.1 SOL should be ~200 = 2.0x)
    expect(vote.voteWeight).toBeGreaterThanOrEqual(190);
    expect(vote.voteWeight).toBeLessThanOrEqual(210);

    // Verify receipt is marked as used
    const receipt = await (voteProgram.account as any)['transactionReceipt'].fetch(receiptPda);
    expect(receipt.voteCast).toBe(true);
  });

  test('fails when trying to vote twice with same receipt', async () => {
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      voteProgram.programId
    );

    const [voterIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), voter.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [voterReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), votedAgent.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const qualityScores = {
      responseQuality: 85,
      responseSpeed: 90,
      accuracy: 88,
      professionalism: 92,
    };

    const commentHash = new Array(32).fill(0);

    // Cast first vote
    await voteProgram.methods
      .castPeerVote(
        votedAgent.publicKey,
        { upvote: {} },
        qualityScores,
        commentHash
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity,
        voterReputation,
        votedAgentIdentity,
        voter: voter.publicKey,
        identityRegistryProgram: IDENTITY_PROGRAM_ID,
        reputationRegistryProgram: REPUTATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    // Try to cast second vote - should fail
    await expect(
      voteProgram.methods
        .castPeerVote(
          votedAgent.publicKey,
          { downvote: {} }, // Different vote type
          qualityScores,
          commentHash
        )
        .accounts({
          peerVote: votePda,
          transactionReceipt: receiptPda,
          voterIdentity,
          voterReputation,
          votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc()
    ).rejects.toThrow(/VoteAlreadyCast/);
  });

  test('fails when transaction amount is too small', async () => {
    // Create receipt with amount below minimum (0.01 SOL)
    const signature = `5oDkSmallAmount${Date.now()}`;
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    const [smallReceiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        voter.publicKey.toBuffer(),
        votedAgent.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      voteProgram.programId
    );

    await voteProgram.methods
      .createTransactionReceipt(
        signature,
        signatureHash,
        new BN(5_000_000), // 0.005 SOL - below 0.01 minimum!
        { chat: {} }
      )
      .accounts({
        receipt: smallReceiptPda,
        payerPubkey: voter.publicKey,
        recipientPubkey: votedAgent.publicKey,
        creator: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), smallReceiptPda.toBuffer()],
      voteProgram.programId
    );

    const [voterIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), voter.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [voterReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), votedAgent.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    await expect(
      voteProgram.methods
        .castPeerVote(
          votedAgent.publicKey,
          { upvote: {} },
          {
            responseQuality: 85,
            responseSpeed: 90,
            accuracy: 88,
            professionalism: 92,
          },
          new Array(32).fill(0)
        )
        .accounts({
          peerVote: votePda,
          transactionReceipt: smallReceiptPda,
          voterIdentity,
          voterReputation,
          votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc()
    ).rejects.toThrow(/InsufficientTransactionAmount/);
  });

  test('fails when quality score exceeds 100', async () => {
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      voteProgram.programId
    );

    const [voterIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), voter.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [voterReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), votedAgent.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    await expect(
      voteProgram.methods
        .castPeerVote(
          votedAgent.publicKey,
          { upvote: {} },
          {
            responseQuality: 101, // Invalid!
            responseSpeed: 90,
            accuracy: 88,
            professionalism: 92,
          },
          new Array(32).fill(0)
        )
        .accounts({
          peerVote: votePda,
          transactionReceipt: receiptPda,
          voterIdentity,
          voterReputation,
          votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc()
    ).rejects.toThrow(/InvalidQualityScore/);
  });

  test('fails when voted agent is not the counterparty', async () => {
    const wrongAgent = Keypair.generate();

    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      voteProgram.programId
    );

    const [voterIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), voter.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [voterReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), voter.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [wrongAgentIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), wrongAgent.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    await expect(
      voteProgram.methods
        .castPeerVote(
          wrongAgent.publicKey, // Wrong agent!
          { upvote: {} },
          {
            responseQuality: 85,
            responseSpeed: 90,
            accuracy: 88,
            professionalism: 92,
          },
          new Array(32).fill(0)
        )
        .accounts({
          peerVote: votePda,
          transactionReceipt: receiptPda,
          voterIdentity,
          voterReputation,
          votedAgentIdentity: wrongAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc()
    ).rejects.toThrow(/VotedAgentNotCounterparty/);
  });

  test('calculates vote weight correctly for different amounts', async () => {
    const amounts = [
      { lamports: 10_000_000, expectedWeight: 100 }, // 0.01 SOL = 1.0x
      { lamports: 100_000_000, expectedWeight: 200 }, // 0.1 SOL = 2.0x
      { lamports: 1_000_000_000, expectedWeight: 300 }, // 1.0 SOL = 3.0x
      { lamports: 10_000_000_000, expectedWeight: 400 }, // 10.0 SOL = 4.0x
    ];

    for (const { lamports, expectedWeight } of amounts) {
      const signature = `5oDkAmount${lamports}${Date.now()}`;
      const signatureHash = Array.from(
        createHash('sha256').update(signature).digest()
      );

      const [testReceiptPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('tx_receipt'),
          voter.publicKey.toBuffer(),
          votedAgent.publicKey.toBuffer(),
          Buffer.from(signatureHash),
        ],
        voteProgram.programId
      );

      await voteProgram.methods
        .createTransactionReceipt(
          signature,
          signatureHash,
          new BN(lamports),
          { chat: {} }
        )
        .accounts({
          receipt: testReceiptPda,
          payerPubkey: voter.publicKey,
          recipientPubkey: votedAgent.publicKey,
          creator: voter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      const [votePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('peer_vote'), testReceiptPda.toBuffer()],
        voteProgram.programId
      );

      const [voterIdentity] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent'), voter.publicKey.toBuffer()],
        IDENTITY_PROGRAM_ID
      );

      const [voterReputation] = PublicKey.findProgramAddressSync(
        [Buffer.from('reputation'), voter.publicKey.toBuffer()],
        REPUTATION_PROGRAM_ID
      );

      const [votedAgentIdentity] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent'), votedAgent.publicKey.toBuffer()],
        IDENTITY_PROGRAM_ID
      );

      await voteProgram.methods
        .castPeerVote(
          votedAgent.publicKey,
          { upvote: {} },
          {
            responseQuality: 85,
            responseSpeed: 90,
            accuracy: 88,
            professionalism: 92,
          },
          new Array(32).fill(0)
        )
        .accounts({
          peerVote: votePda,
          transactionReceipt: testReceiptPda,
          voterIdentity,
          voterReputation,
          votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      const vote = await (voteProgram.account as any)['peerVote'].fetch(votePda);

      // Allow 10% variance due to logarithmic calculation
      expect(vote.voteWeight).toBeGreaterThanOrEqual(expectedWeight * 0.9);
      expect(vote.voteWeight).toBeLessThanOrEqual(expectedWeight * 1.1);

      console.log(
        `Amount: ${lamports} lamports, Weight: ${vote.voteWeight}, Expected: ~${expectedWeight}`
      );
    }
  });
});
