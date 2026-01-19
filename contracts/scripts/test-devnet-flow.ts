/**
 * Devnet x402 Payment Flow Test Script
 *
 * Tests complete payment → receipt → vote flow on actual Solana devnet
 * with real transactions and on-chain verification.
 *
 * Usage:
 *   bun run scripts/test-devnet-flow.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Program IDs from devnet deployment
const VOTE_REGISTRY_PROGRAM_ID = new PublicKey('EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6');
const IDENTITY_REGISTRY_PROGRAM_ID = new PublicKey('2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e');
const REPUTATION_REGISTRY_PROGRAM_ID = new PublicKey('A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp');

// Solana devnet connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function main() {
  console.log('='.repeat(70));
  console.log('GhostSpeak x402 Payment Flow - Devnet Test');
  console.log('='.repeat(70));
  console.log();

  // Load or generate keypairs
  const payer = await loadOrGenerateKeypair('payer');
  const recipient = await loadOrGenerateKeypair('recipient');
  const voter = await loadOrGenerateKeypair('voter');
  const votedAgent = await loadOrGenerateKeypair('voted-agent');

  console.log('Keypairs loaded:');
  console.log('  Payer:', payer.publicKey.toBase58());
  console.log('  Recipient:', recipient.publicKey.toBase58());
  console.log('  Voter:', voter.publicKey.toBase58());
  console.log('  Voted Agent:', votedAgent.publicKey.toBase58());
  console.log();

  // Check balances and airdrop if needed
  await ensureSufficientBalance(payer.publicKey, 1 * LAMPORTS_PER_SOL);
  await ensureSufficientBalance(voter.publicKey, 1 * LAMPORTS_PER_SOL);
  await ensureSufficientBalance(votedAgent.publicKey, 0.5 * LAMPORTS_PER_SOL);
  console.log();

  // Load programs
  const voteRegistryIDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../target/idl/vote_registry.json'), 'utf-8')
  );

  const identityRegistryIDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../target/idl/identity_registry.json'), 'utf-8')
  );

  const reputationRegistryIDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../target/idl/reputation_registry.json'), 'utf-8')
  );

  const provider = new AnchorProvider(
    connection,
    new Wallet(voter),
    { commitment: 'confirmed' }
  );

  const voteRegistry = new Program(voteRegistryIDL, provider);
  const identityRegistry = new Program(identityRegistryIDL, provider);
  const reputationRegistry = new Program(reputationRegistryIDL, provider);

  console.log('Programs loaded successfully\n');

  // === STEP 1: Create real x402-like payment ===
  console.log('--- STEP 1: Create x402-like payment ---');

  const paymentAmount = 78_000; // $0.078 - average x402 payment

  const transferTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: voter.publicKey,
      toPubkey: recipient.publicKey,
      lamports: paymentAmount,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transferTx, [voter]);
  console.log('Payment sent:', signature);
  console.log('Amount:', paymentAmount, 'lamports (~$' + (paymentAmount / 1_000_000).toFixed(3) + ')');

  // Hash signature for PDA seed
  const signatureHash = Array.from(
    createHash('sha256').update(signature).digest()
  );

  console.log('Signature hash:', Buffer.from(signatureHash).toString('hex').slice(0, 20) + '...');
  console.log();

  // === STEP 2: Create transaction receipt ===
  console.log('--- STEP 2: Create transaction receipt ---');

  const [receiptPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('tx_receipt'),
      voter.publicKey.toBuffer(),
      recipient.publicKey.toBuffer(),
      Buffer.from(signatureHash),
    ],
    VOTE_REGISTRY_PROGRAM_ID
  );

  console.log('Receipt PDA:', receiptPda.toBase58());

  const createReceiptTx = await voteRegistry.methods
    .createTransactionReceipt(
      signature,
      signatureHash,
      paymentAmount,
      { chat: {} } // ContentType
    )
    .accounts({
      receipt: receiptPda,
      payerPubkey: voter.publicKey,
      recipientPubkey: recipient.publicKey,
      creator: recipient.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([recipient])
    .rpc();

  console.log('Receipt created:', createReceiptTx);

  // Verify receipt
  const receiptAccount = await (voteRegistry.account as any)['transactionReceipt'].fetch(receiptPda);
  console.log('Receipt verified:');
  console.log('  Signature:', receiptAccount.signature);
  console.log('  Payer:', receiptAccount.payer.toBase58());
  console.log('  Recipient:', receiptAccount.recipient.toBase58());
  console.log('  Amount:', receiptAccount.amount.toNumber());
  console.log('  Vote cast:', receiptAccount.voteCast);
  console.log();

  // === STEP 3: Setup identities ===
  console.log('--- STEP 3: Setup agent identities ---');

  const [voterIdentityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_identity'), voter.publicKey.toBuffer()],
    IDENTITY_REGISTRY_PROGRAM_ID
  );

  const [votedAgentIdentityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_identity'), votedAgent.publicKey.toBuffer()],
    IDENTITY_REGISTRY_PROGRAM_ID
  );

  // Check if identities already exist
  const voterIdentityExists = await connection.getAccountInfo(voterIdentityPda);
  const votedAgentIdentityExists = await connection.getAccountInfo(votedAgentIdentityPda);

  if (!voterIdentityExists) {
    console.log('Registering voter identity...');
    await identityRegistry.methods
      .registerAgent(
        voter.publicKey,
        'https://example.com/voter-metadata.json'
      )
      .accounts({
        agentIdentity: voterIdentityPda,
        agent: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();
    console.log('Voter identity registered:', voterIdentityPda.toBase58());
  } else {
    console.log('Voter identity already exists:', voterIdentityPda.toBase58());
  }

  if (!votedAgentIdentityExists) {
    console.log('Registering voted agent identity...');
    await identityRegistry.methods
      .registerAgent(
        votedAgent.publicKey,
        'https://example.com/agent-metadata.json'
      )
      .accounts({
        agentIdentity: votedAgentIdentityPda,
        agent: votedAgent.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([votedAgent])
      .rpc();
    console.log('Voted agent identity registered:', votedAgentIdentityPda.toBase58());
  } else {
    console.log('Voted agent identity already exists:', votedAgentIdentityPda.toBase58());
  }
  console.log();

  // === STEP 4: Setup reputation ===
  console.log('--- STEP 4: Setup reputation authority ---');

  const [authorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    REPUTATION_REGISTRY_PROGRAM_ID
  );

  const authorityExists = await connection.getAccountInfo(authorityPda);

  if (!authorityExists) {
    console.log('Initializing reputation authority...');
    await reputationRegistry.methods
      .initializeAuthority()
      .accounts({
        authority: authorityPda,
        admin: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();
    console.log('Authority initialized:', authorityPda.toBase58());
  } else {
    console.log('Authority already exists:', authorityPda.toBase58());
  }

  const [voterReputationPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), voter.publicKey.toBuffer()],
    REPUTATION_REGISTRY_PROGRAM_ID
  );

  const voterReputationExists = await connection.getAccountInfo(voterReputationPda);

  if (!voterReputationExists) {
    console.log('Initializing voter reputation...');
    await reputationRegistry.methods
      .initializeReputation()
      .accounts({
        reputation: voterReputationPda,
        agent: voter.publicKey,
        authority: authorityPda,
        payer: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();
    console.log('Voter reputation initialized:', voterReputationPda.toBase58());
  } else {
    console.log('Voter reputation already exists:', voterReputationPda.toBase58());
  }
  console.log();

  // === STEP 5: Cast vote ===
  console.log('--- STEP 5: Cast vote using receipt ---');

  const [votePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('peer_vote'), receiptPda.toBuffer()],
    VOTE_REGISTRY_PROGRAM_ID
  );

  console.log('Vote PDA:', votePda.toBase58());

  const qualityScores = {
    responseQuality: 95,
    responseSpeed: 88,
    accuracy: 92,
    professionalism: 90,
  };

  const commentHash = Array.from(
    createHash('sha256').update('Excellent service! Fast and accurate.').digest()
  );

  const castVoteTx = await voteRegistry.methods
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
      identityRegistryProgram: IDENTITY_REGISTRY_PROGRAM_ID,
      reputationRegistryProgram: REPUTATION_REGISTRY_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([voter])
    .rpc();

  console.log('Vote cast:', castVoteTx);
  console.log();

  // === STEP 6: Verify vote ===
  console.log('--- STEP 6: Verify vote on-chain ---');

  const voteAccount = await (voteRegistry.account as any)['peerVote'].fetch(votePda);

  console.log('Vote details:');
  console.log('  Voted Agent:', voteAccount.votedAgent.toBase58());
  console.log('  Voter:', voteAccount.voter.toBase58());
  console.log('  Vote Type:', voteAccount.voteType.upvote ? 'UPVOTE' : 'DOWNVOTE');
  console.log('  Quality Scores:');
  console.log('    Response Quality:', voteAccount.qualityScores.responseQuality);
  console.log('    Response Speed:', voteAccount.qualityScores.responseSpeed);
  console.log('    Accuracy:', voteAccount.qualityScores.accuracy);
  console.log('    Professionalism:', voteAccount.qualityScores.professionalism);
  console.log('  Vote Weight:', voteAccount.voteWeight);
  console.log('  Timestamp:', new Date(voteAccount.timestamp.toNumber() * 1000).toISOString());

  // Verify receipt is marked as voted
  const updatedReceipt = await (voteRegistry.account as any)['transactionReceipt'].fetch(receiptPda);
  console.log('  Receipt vote_cast:', updatedReceipt.voteCast);
  console.log();

  // === SUCCESS ===
  console.log('='.repeat(70));
  console.log('✅ END-TO-END TEST SUCCESSFUL!');
  console.log('='.repeat(70));
  console.log();
  console.log('Summary:');
  console.log('  1. ✅ Created x402-like payment:', signature);
  console.log('  2. ✅ Created receipt:', receiptPda.toBase58());
  console.log('  3. ✅ Registered identities');
  console.log('  4. ✅ Setup reputation');
  console.log('  5. ✅ Cast vote:', votePda.toBase58());
  console.log('  6. ✅ Verified on-chain data');
  console.log();
  console.log('Explorer links (devnet):');
  console.log('  Payment:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log('  Vote:', `https://explorer.solana.com/address/${votePda.toBase58()}?cluster=devnet`);
  console.log('  Receipt:', `https://explorer.solana.com/address/${receiptPda.toBase58()}?cluster=devnet`);
  console.log();
}

async function loadOrGenerateKeypair(name: string): Promise<Keypair> {
  const keyPath = path.join(__dirname, `../.keys/${name}.json`);

  if (fs.existsSync(keyPath)) {
    const secretKey = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  }

  // Generate new keypair
  const keypair = Keypair.generate();

  // Save for future use
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, JSON.stringify(Array.from(keypair.secretKey)));

  console.log(`Generated new keypair: ${name}`);
  return keypair;
}

async function ensureSufficientBalance(
  publicKey: PublicKey,
  minBalance: number
): Promise<void> {
  const balance = await connection.getBalance(publicKey);

  if (balance < minBalance) {
    console.log(`Airdropping ${minBalance / LAMPORTS_PER_SOL} SOL to ${publicKey.toBase58()}...`);
    const signature = await connection.requestAirdrop(publicKey, minBalance);
    await connection.confirmTransaction(signature);
    console.log(`Airdrop successful: ${signature}`);
  } else {
    console.log(`${publicKey.toBase58()}: ${balance / LAMPORTS_PER_SOL} SOL (sufficient)`);
  }
}

main().catch(console.error);
