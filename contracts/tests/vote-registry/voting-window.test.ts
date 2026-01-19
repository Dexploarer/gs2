/**
 * 30-Day Voting Window Tests
 * Tests for time-based voting restrictions on transaction receipts
 *
 * The voting window ensures:
 * 1. Votes can only be cast within 30 days of the transaction
 * 2. Expired receipts cannot be used for voting
 * 3. Receipts near expiry boundary are handled correctly
 */

import { describe, test, beforeAll, beforeEach, expect } from '@jest/globals';
import { startAnchor, ProgramTestContext, Clock } from 'solana-bankrun';
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

// Constants matching the on-chain program
const VOTING_WINDOW_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds
const SECONDS_PER_SLOT = 0.4; // Solana ~400ms per slot

describe('30-Day Voting Window', () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let voteProgram: Program<Idl>;
  let voter: Keypair;
  let votedAgent: Keypair;

  // Mock program IDs
  const IDENTITY_PROGRAM_ID = new PublicKey('IdentMockMockMockMockMockMockMockMockMock');
  const REPUTATION_PROGRAM_ID = new PublicKey('ReputMockMockMockMockMockMockMockMockMock');

  // Helper to airdrop SOL
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

  // Helper to create receipt with specific timestamp
  async function createReceiptWithTimestamp(
    signature: string,
    timestamp?: number
  ): Promise<{ receiptPda: PublicKey; signatureHash: number[] }> {
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    const [receiptPda] = PublicKey.findProgramAddressSync(
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

    return { receiptPda, signatureHash };
  }

  // Helper to advance time by warping slots
  async function advanceTime(seconds: number): Promise<void> {
    const slotsToWarp = Math.ceil(seconds / SECONDS_PER_SLOT);
    const currentClock = await context.banksClient.getClock();
    const newSlot = currentClock.slot + BigInt(slotsToWarp);

    // Warp to new slot
    context.warpToSlot(newSlot);

    // Update blockhash
    context.lastBlockhash = (await context.banksClient.getLatestBlockhash())[0];
  }

  // Helper to derive vote accounts
  function deriveVoteAccounts(receiptPda: PublicKey) {
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

    return { votePda, voterIdentity, voterReputation, votedAgentIdentity };
  }

  beforeAll(async () => {
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

    voteProgram = new Program(idl, provider);

    voter = Keypair.generate();
    votedAgent = Keypair.generate();

    await airdrop(voter.publicKey, 100_000_000_000); // 100 SOL for tests
  });

  describe('Within Voting Window', () => {
    test('allows vote immediately after transaction', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_immediate_${Date.now()}`
      );
      const accounts = deriveVoteAccounts(receiptPda);

      const tx = await voteProgram.methods
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
          peerVote: accounts.votePda,
          transactionReceipt: receiptPda,
          voterIdentity: accounts.voterIdentity,
          voterReputation: accounts.voterReputation,
          votedAgentIdentity: accounts.votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      expect(tx).toBeDefined();

      const vote = await (voteProgram.account as any)['peerVote'].fetch(
        accounts.votePda
      );
      expect(vote.voter.toBase58()).toBe(voter.publicKey.toBase58());
    });

    test('allows vote 15 days after transaction (within window)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_15days_${Date.now()}`
      );

      // Advance 15 days
      const fifteenDays = 15 * 24 * 60 * 60;
      await advanceTime(fifteenDays);

      const accounts = deriveVoteAccounts(receiptPda);

      const tx = await voteProgram.methods
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
          peerVote: accounts.votePda,
          transactionReceipt: receiptPda,
          voterIdentity: accounts.voterIdentity,
          voterReputation: accounts.voterReputation,
          votedAgentIdentity: accounts.votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      expect(tx).toBeDefined();
    });

    test('allows vote at exactly 29 days (boundary condition)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_29days_${Date.now()}`
      );

      // Advance 29 days
      const twentyNineDays = 29 * 24 * 60 * 60;
      await advanceTime(twentyNineDays);

      const accounts = deriveVoteAccounts(receiptPda);

      const tx = await voteProgram.methods
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
          peerVote: accounts.votePda,
          transactionReceipt: receiptPda,
          voterIdentity: accounts.voterIdentity,
          voterReputation: accounts.voterReputation,
          votedAgentIdentity: accounts.votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      expect(tx).toBeDefined();
    });
  });

  describe('Outside Voting Window (Expired)', () => {
    test('rejects vote at exactly 31 days (expired)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_31days_${Date.now()}`
      );

      // Advance 31 days
      const thirtyOneDays = 31 * 24 * 60 * 60;
      await advanceTime(thirtyOneDays);

      const accounts = deriveVoteAccounts(receiptPda);

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
            peerVote: accounts.votePda,
            transactionReceipt: receiptPda,
            voterIdentity: accounts.voterIdentity,
            voterReputation: accounts.voterReputation,
            votedAgentIdentity: accounts.votedAgentIdentity,
            voter: voter.publicKey,
            identityRegistryProgram: IDENTITY_PROGRAM_ID,
            reputationRegistryProgram: REPUTATION_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc()
      ).rejects.toThrow(/VotingWindowExpired/);
    });

    test('rejects vote at 60 days (well past expiry)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_60days_${Date.now()}`
      );

      // Advance 60 days
      const sixtyDays = 60 * 24 * 60 * 60;
      await advanceTime(sixtyDays);

      const accounts = deriveVoteAccounts(receiptPda);

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
            peerVote: accounts.votePda,
            transactionReceipt: receiptPda,
            voterIdentity: accounts.voterIdentity,
            voterReputation: accounts.voterReputation,
            votedAgentIdentity: accounts.votedAgentIdentity,
            voter: voter.publicKey,
            identityRegistryProgram: IDENTITY_PROGRAM_ID,
            reputationRegistryProgram: REPUTATION_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc()
      ).rejects.toThrow(/VotingWindowExpired/);
    });

    test('rejects vote at 365 days (far past expiry)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_365days_${Date.now()}`
      );

      // Advance 1 year
      const oneYear = 365 * 24 * 60 * 60;
      await advanceTime(oneYear);

      const accounts = deriveVoteAccounts(receiptPda);

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
            peerVote: accounts.votePda,
            transactionReceipt: receiptPda,
            voterIdentity: accounts.voterIdentity,
            voterReputation: accounts.voterReputation,
            votedAgentIdentity: accounts.votedAgentIdentity,
            voter: voter.publicKey,
            identityRegistryProgram: IDENTITY_PROGRAM_ID,
            reputationRegistryProgram: REPUTATION_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc()
      ).rejects.toThrow(/VotingWindowExpired/);
    });
  });

  describe('Boundary Conditions', () => {
    test('exact 30-day boundary (last valid moment)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_exact30_${Date.now()}`
      );

      // Advance exactly 30 days (should still be valid)
      const exactlyThirtyDays = 30 * 24 * 60 * 60;
      await advanceTime(exactlyThirtyDays);

      const accounts = deriveVoteAccounts(receiptPda);

      // This should succeed (30 days is the last valid day)
      const tx = await voteProgram.methods
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
          peerVote: accounts.votePda,
          transactionReceipt: receiptPda,
          voterIdentity: accounts.voterIdentity,
          voterReputation: accounts.voterReputation,
          votedAgentIdentity: accounts.votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      expect(tx).toBeDefined();
    });

    test('30 days + 1 second (first invalid moment)', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_30plus1sec_${Date.now()}`
      );

      // Advance 30 days + 1 second
      const thirtyDaysPlusOne = 30 * 24 * 60 * 60 + 1;
      await advanceTime(thirtyDaysPlusOne);

      const accounts = deriveVoteAccounts(receiptPda);

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
            peerVote: accounts.votePda,
            transactionReceipt: receiptPda,
            voterIdentity: accounts.voterIdentity,
            voterReputation: accounts.voterReputation,
            votedAgentIdentity: accounts.votedAgentIdentity,
            voter: voter.publicKey,
            identityRegistryProgram: IDENTITY_PROGRAM_ID,
            reputationRegistryProgram: REPUTATION_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc()
      ).rejects.toThrow(/VotingWindowExpired/);
    });
  });

  describe('Receipt Timestamp Validation', () => {
    test('receipt contains correct timestamp', async () => {
      const beforeClock = await context.banksClient.getClock();
      const beforeTimestamp = Number(beforeClock.unixTimestamp);

      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_timestamp_check_${Date.now()}`
      );

      const afterClock = await context.banksClient.getClock();
      const afterTimestamp = Number(afterClock.unixTimestamp);

      const receipt = await (voteProgram.account as any)['transactionReceipt'].fetch(
        receiptPda
      );

      // Receipt timestamp should be between before and after
      expect(receipt.timestamp.toNumber()).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(receipt.timestamp.toNumber()).toBeLessThanOrEqual(afterTimestamp + 10);
    });

    test('voting window calculated correctly from receipt timestamp', async () => {
      const { receiptPda } = await createReceiptWithTimestamp(
        `sig_window_calc_${Date.now()}`
      );

      const receipt = await (voteProgram.account as any)['transactionReceipt'].fetch(
        receiptPda
      );
      const receiptTimestamp = receipt.timestamp.toNumber();

      // Window should be receipt timestamp + 30 days
      const expectedWindowEnd = receiptTimestamp + VOTING_WINDOW_SECONDS;

      // Advance to just before window end
      const justBefore = expectedWindowEnd - receiptTimestamp - 60; // 1 minute before
      await advanceTime(justBefore);

      const accounts = deriveVoteAccounts(receiptPda);

      // Should succeed (still within window)
      const tx = await voteProgram.methods
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
          peerVote: accounts.votePda,
          transactionReceipt: receiptPda,
          voterIdentity: accounts.voterIdentity,
          voterReputation: accounts.voterReputation,
          votedAgentIdentity: accounts.votedAgentIdentity,
          voter: voter.publicKey,
          identityRegistryProgram: IDENTITY_PROGRAM_ID,
          reputationRegistryProgram: REPUTATION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      expect(tx).toBeDefined();
    });
  });
});
