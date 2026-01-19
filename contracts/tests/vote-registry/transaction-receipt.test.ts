/**
 * Transaction Receipt Tests
 * Tests for create_transaction_receipt instruction
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
} from '@solana/web3.js';
import { createHash } from 'crypto';
import * as fs from 'fs';

describe('Transaction Receipt Creation', () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let program: Program<Idl>;
  let payer: Keypair;
  let recipient: Keypair;

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
      '', // Use current directory
      [{ name: 'vote_registry', programId: new PublicKey('6yqgRTrKwgdK73EHfw8oXaQvhDqyzbjQKS5pDUncMZrN') }],
      []
    );

    provider = new BankrunProvider(context);

    // Load program IDL
    const idl = JSON.parse(
      fs.readFileSync('./target/idl/vote_registry.json', 'utf-8')
    ) as Idl;

    program = new Program(
      idl,
      provider
    );

    // Generate test keypairs
    payer = Keypair.generate();
    recipient = Keypair.generate();

    // Airdrop SOL to payer for transaction fees
    await airdrop(payer.publicKey, 10_000_000_000); // 10 SOL
  });

  test('creates transaction receipt successfully', async () => {
    // Prepare transaction data
    const signature = '5oDkVACdJHLXvphAYEiXzs6wMvZRjFUu8XyHi6BPq7Jx9P'; // Example signature
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );
    // Realistic x402 micropayment: ~$0.078 average (78,000 lamports ≈ 0.000078 SOL)
    const amount = new BN(78_000); // Average x402 payment in lamports
    const contentType = { chat: {} };

    // Derive receipt PDA
    const [receiptPda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    // Create receipt
    const tx = await program.methods
      .createTransactionReceipt(signature, signatureHash, amount, contentType)
      .accounts({
        receipt: receiptPda,
        payerPubkey: payer.publicKey,
        recipientPubkey: recipient.publicKey,
        creator: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    console.log('Receipt created:', tx);

    // Fetch and verify receipt
    const receipt = await (program.account as any)['transactionReceipt'].fetch(receiptPda);

    expect(receipt.signature).toBe(signature);
    expect(receipt.payer.toBase58()).toBe(payer.publicKey.toBase58());
    expect(receipt.recipient.toBase58()).toBe(recipient.publicKey.toBase58());
    expect(receipt.amount.toNumber()).toBe(amount.toNumber());
    expect(receipt.voteCast).toBe(false);
    expect(receipt.bump).toBe(bump);
  });

  test('fails when creator is not payer or recipient', async () => {
    const unauthorizedCreator = Keypair.generate();

    // Airdrop to unauthorized creator
    await airdrop(unauthorizedCreator.publicKey, 1_000_000_000);

    const signature = '5oDkVACdJHLXvphAYEiXzs6wMvZRjFUu8XyHi6BPq7Jx8P';
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    await expect(
      program.methods
        .createTransactionReceipt(
          signature,
          signatureHash,
          new BN(100_000_000),
          { chat: {} }
        )
        .accounts({
          receipt: receiptPda,
          payerPubkey: payer.publicKey,
          recipientPubkey: recipient.publicKey,
          creator: unauthorizedCreator.publicKey, // Wrong creator!
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedCreator])
        .rpc()
    ).rejects.toThrow(/UnauthorizedReceiptCreation/);
  });

  test('fails when payer and recipient are the same', async () => {
    const signature = '5oDkVACdJHLXvphAYEiXzs6wMvZRjFUu8XyHi6BPq7Jx7P';
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.publicKey.toBuffer(),
        payer.publicKey.toBuffer(), // Same as payer!
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    await expect(
      program.methods
        .createTransactionReceipt(
          signature,
          signatureHash,
          new BN(100_000_000),
          { chat: {} }
        )
        .accounts({
          receipt: receiptPda,
          payerPubkey: payer.publicKey,
          recipientPubkey: payer.publicKey, // Self-transaction!
          creator: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc()
    ).rejects.toThrow(/SelfTransactionNotAllowed/);
  });

  test('fails when signature exceeds 88 characters', async () => {
    const longSignature = 'a'.repeat(89); // Too long!
    const signatureHash = Array.from(
      createHash('sha256').update(longSignature).digest()
    );

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    await expect(
      program.methods
        .createTransactionReceipt(
          longSignature,
          signatureHash,
          new BN(100_000_000),
          { chat: {} }
        )
        .accounts({
          receipt: receiptPda,
          payerPubkey: payer.publicKey,
          recipientPubkey: recipient.publicKey,
          creator: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc()
    ).rejects.toThrow(/InvalidX402Signature/);
  });

  test('recipient can create receipt for payment they received', async () => {
    const signature = '5oDkVACdJHLXvphAYEiXzs6wMvZRjFUu8XyHi6BPq7Jx6P';
    const signatureHash = Array.from(
      createHash('sha256').update(signature).digest()
    );

    // Airdrop to recipient
    await airdrop(recipient.publicKey, 1_000_000_000);

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
        Buffer.from(signatureHash),
      ],
      program.programId
    );

    // Recipient creates receipt (not payer)
    const tx = await program.methods
      .createTransactionReceipt(
        signature,
        signatureHash,
        new BN(100_000_000),
        { audio: {} }
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: payer.publicKey,
        recipientPubkey: recipient.publicKey,
        creator: recipient.publicKey, // Recipient creates!
        systemProgram: SystemProgram.programId,
      })
      .signers([recipient])
      .rpc();

    const receipt = await (program.account as any)['transactionReceipt'].fetch(receiptPda);
    expect(receipt.signature).toBe(signature);
    expect(Object.keys(receipt.contentType)[0]).toBe('audio');
  });

  test('stores different content types correctly', async () => {
    const contentTypes = [
      { chat: {} },
      { audio: {} },
      { video: {} },
      { image: {} },
      { data: {} },
      { compute: {} },
      { other: {} },
    ];

    for (let i = 0; i < contentTypes.length; i++) {
      const signature = `5oDkVACdJHLXvphAYEiXzs6wMvZRjFUu8XyHi6BPq7J${i}P`;
      const signatureHash = Array.from(
        createHash('sha256').update(signature).digest()
      );

      const [receiptPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('tx_receipt'),
          payer.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
          Buffer.from(signatureHash),
        ],
        program.programId
      );

      await program.methods
        .createTransactionReceipt(
          signature,
          signatureHash,
          new BN(100_000_000),
          contentTypes[i]
        )
        .accounts({
          receipt: receiptPda,
          payerPubkey: payer.publicKey,
          recipientPubkey: recipient.publicKey,
          creator: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      const receipt = await (program.account as any)['transactionReceipt'].fetch(receiptPda);
      const expectedType = Object.keys(contentTypes[i])[0];
      const actualType = Object.keys(receipt.contentType)[0];

      expect(actualType).toBe(expectedType);
    }
  });
});
