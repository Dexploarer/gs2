/**
 * End-to-End Integration Test
 * Tests complete flow: x402 payment → receipt → vote
 */

import { describe, test, beforeAll, expect } from '@jest/globals';
import { startAnchor, ProgramTestContext } from 'solana-bankrun';
import { BankrunProvider } from 'anchor-bankrun';
import { Program, BN, type Idl } from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import bs58 from 'bs58';
// Type declarations for spl-token-bankrun are in types/spl-token-bankrun.d.ts

import {
  createMint,
  createAccount,
  mintTo,
  transfer,
} from 'spl-token-bankrun';

describe('End-to-End: x402 Payment to Vote', () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: Program<Idl>;
  let seller: Keypair;
  let buyer: Keypair;
  let mint: PublicKey;

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

    program = new Program(idl, provider);

    seller = Keypair.generate();
    buyer = Keypair.generate();

    // Airdrop SOL to both parties
    await airdrop(seller.publicKey, 10_000_000_000);
    await airdrop(buyer.publicKey, 10_000_000_000);

    // Create USDC-like token for testing
    mint = await createMint(
      context.banksClient,
      context.payer,
      context.payer.publicKey,
      null,
      6 // 6 decimals like USDC
    );
  });

  test('complete flow: payment -> receipt -> vote', async () => {
    console.log('\n=== STEP 1: Simulate x402 Payment ===');

    // Create token accounts
    const buyerTokenAccount = await createAccount(
      context.banksClient,
      context.payer,
      mint,
      buyer.publicKey
    );

    const sellerTokenAccount = await createAccount(
      context.banksClient,
      context.payer,
      mint,
      seller.publicKey
    );

    // Mint tokens to buyer (simulate buyer has 100 USDC)
    await mintTo(
      context.banksClient,
      context.payer,
      mint,
      buyerTokenAccount,
      context.payer,
      100_000_000 // 100 USDC (6 decimals)
    );

    // Buyer pays seller 0.1 USDC for AI service
    const transferAmount = 100_000; // 0.1 USDC
    const transferIx = await transfer(
      context.banksClient,
      buyer,
      buyerTokenAccount,
      sellerTokenAccount,
      buyer,
      transferAmount
    );

    // Create transaction (simulating x402 payment)
    const recentBlockhash = context.lastBlockhash;
    const message = new TransactionMessage({
      payerKey: buyer.publicKey,
      recentBlockhash,
      instructions: [transferIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    transaction.sign([buyer]);

    // Process transaction
    await context.banksClient.processTransaction(transaction);

    // Get transaction signature
    const signature = bs58.encode(transaction.signatures[0]);
    console.log('Payment transaction signature:', signature);

    console.log('\n=== STEP 2: Create Transaction Receipt ===');

    // Create receipt (seller receives payment confirmation)
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    const [receiptPda, receiptBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        buyer.publicKey.toBuffer(),
        seller.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    const receiptTx = await program.methods
      .createTransactionReceipt(
        signature,
        signatureHash,
        new BN(transferAmount),
        { chat: {} }
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: buyer.publicKey,
        recipientPubkey: seller.publicKey,
        creator: seller.publicKey, // Seller creates receipt
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    console.log('Receipt created:', receiptTx);
    console.log('Receipt PDA:', receiptPda.toBase58());

    // Verify receipt
    const receipt = await (program.account as any)['transactionReceipt'].fetch(receiptPda);
    expect(receipt.signature).toBe(signature);
    expect((receipt.payer as PublicKey).toBase58()).toBe(buyer.publicKey.toBase58());
    expect((receipt.recipient as PublicKey).toBase58()).toBe(seller.publicKey.toBase58());
    expect((receipt.amount as BN).toNumber()).toBe(transferAmount);
    expect(receipt.voteCast).toBe(false);

    console.log('\n=== STEP 3: Buyer Votes on Seller ===');

    // Buyer votes on seller's service quality
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      program.programId
    );

    const [buyerIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), buyer.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [buyerReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), buyer.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [sellerIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), seller.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const qualityScores = {
      responseQuality: 95,
      responseSpeed: 88,
      accuracy: 92,
      professionalism: 90,
    };

    const commentHash = Array.from(
      createHash('sha256').update('Excellent service! Very helpful AI agent.').digest()
    );

    const voteTx = await program.methods
      .castPeerVote(
        seller.publicKey, // Voting on seller
        { upvote: {} },
        qualityScores,
        commentHash
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity: buyerIdentity,
        voterReputation: buyerReputation,
        votedAgentIdentity: sellerIdentity,
        voter: buyer.publicKey,
        identityRegistryProgram: IDENTITY_PROGRAM_ID,
        reputationRegistryProgram: REPUTATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    console.log('Vote cast:', voteTx);
    console.log('Vote PDA:', votePda.toBase58());

    // Verify vote
    const vote = await (program.account as any)['peerVote'].fetch(votePda);
    expect((vote.voter as PublicKey).toBase58()).toBe(buyer.publicKey.toBase58());
    expect((vote.votedAgent as PublicKey).toBase58()).toBe(seller.publicKey.toBase58());
    expect(Object.keys(vote.voteType as object)[0]).toBe('upvote');
    expect((vote.qualityScores as typeof qualityScores).responseQuality).toBe(95);
    expect((vote.qualityScores as typeof qualityScores).responseSpeed).toBe(88);
    expect((vote.qualityScores as typeof qualityScores).accuracy).toBe(92);
    expect((vote.qualityScores as typeof qualityScores).professionalism).toBe(90);
    expect((vote.transactionReceipt as PublicKey).toBase58()).toBe(receiptPda.toBase58());

    // Verify receipt is marked as used
    const updatedReceipt = await (program.account as any)['transactionReceipt'].fetch(
      receiptPda
    );
    expect(updatedReceipt.voteCast).toBe(true);

    console.log('\n=== SUCCESS: Complete Flow Verified ===');
    console.log('Payment Amount:', transferAmount, 'lamports');
    console.log('Vote Weight:', vote.voteWeight, '(100 = 1.0x)');
    console.log('Average Quality Score:',
      (qualityScores.responseQuality +
        qualityScores.responseSpeed +
        qualityScores.accuracy +
        qualityScores.professionalism) / 4
    );
    console.log('Receipt can no longer be used for voting:', updatedReceipt.voteCast);
  });

  test('seller can also vote on buyer (bidirectional)', async () => {
    // Create a new payment (seller pays buyer for some service)
    const buyerTokenAccount = await createAccount(
      context.banksClient,
      context.payer,
      mint,
      buyer.publicKey
    );

    const sellerTokenAccount = await createAccount(
      context.banksClient,
      context.payer,
      mint,
      seller.publicKey
    );

    await mintTo(
      context.banksClient,
      context.payer,
      mint,
      sellerTokenAccount,
      context.payer,
      100_000_000
    );

    const transferAmount = 50_000; // 0.05 USDC
    const transferIx = await transfer(
      context.banksClient,
      seller,
      sellerTokenAccount,
      buyerTokenAccount,
      seller,
      transferAmount
    );

    const recentBlockhash = context.lastBlockhash;
    const message = new TransactionMessage({
      payerKey: seller.publicKey,
      recentBlockhash,
      instructions: [transferIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);
    transaction.sign([seller]);

    await context.banksClient.processTransaction(transaction);

    const signature = bs58.encode(transaction.signatures[0]);
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    // Seller pays buyer, so payer=seller, recipient=buyer
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        seller.publicKey.toBuffer(), // payer
        buyer.publicKey.toBuffer(), // recipient
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    await program.methods
      .createTransactionReceipt(
        signature,
        signatureHash,
        new BN(transferAmount),
        { data: {} }
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: seller.publicKey,
        recipientPubkey: buyer.publicKey,
        creator: seller.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    // Seller votes on buyer
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('peer_vote'), receiptPda.toBuffer()],
      program.programId
    );

    const [sellerIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), seller.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    const [sellerReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), seller.publicKey.toBuffer()],
      REPUTATION_PROGRAM_ID
    );

    const [buyerIdentity] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), buyer.publicKey.toBuffer()],
      IDENTITY_PROGRAM_ID
    );

    await program.methods
      .castPeerVote(
        buyer.publicKey, // Voting on buyer
        { upvote: {} },
        {
          responseQuality: 80,
          responseSpeed: 85,
          accuracy: 78,
          professionalism: 82,
        },
        new Array(32).fill(0)
      )
      .accounts({
        peerVote: votePda,
        transactionReceipt: receiptPda,
        voterIdentity: sellerIdentity,
        voterReputation: sellerReputation,
        votedAgentIdentity: buyerIdentity,
        voter: seller.publicKey,
        identityRegistryProgram: IDENTITY_PROGRAM_ID,
        reputationRegistryProgram: REPUTATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const vote = await (program.account as any)['peerVote'].fetch(votePda);
    expect((vote.voter as PublicKey).toBase58()).toBe(seller.publicKey.toBase58());
    expect((vote.votedAgent as PublicKey).toBase58()).toBe(buyer.publicKey.toBase58());

    console.log('✅ Bidirectional voting verified: both parties can vote on each other');
  });
});
