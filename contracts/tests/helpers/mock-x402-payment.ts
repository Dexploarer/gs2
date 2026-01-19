/**
 * Mock x402 Payment Generator
 *
 * Creates realistic Solana transactions matching x402 PaymentPayload structure
 * for testing receipt creation and vote casting.
 *
 * Reference: https://github.com/coinbase/x402
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import bs58 from 'bs58';

export interface MockX402Payment {
  transaction: string; // Base64-encoded transaction
  signature: string; // Transaction signature (base58)
  signatureHash: number[]; // SHA256 hash of signature
  payer: PublicKey;
  recipient: PublicKey;
  amount: number; // Lamports
  timestamp: number; // Unix timestamp
}

export interface ExactSvmPayload {
  chain: 'solana';
  transaction: string; // Base64-encoded VersionedTransaction
}

export interface PaymentPayload {
  scheme: 'exact';
  payload: ExactSvmPayload;
}

/**
 * Generate a mock x402 payment transaction
 *
 * Creates a real Solana transaction with TransferChecked-like structure
 * matching what x402 facilitators produce.
 *
 * @param payer - Transaction fee payer
 * @param recipient - Payment recipient
 * @param amount - Payment amount in lamports
 * @param connection - Optional Solana connection for blockhash
 * @returns Mock x402 payment with transaction and metadata
 */
export async function generateMockX402Payment(
  payer: Keypair,
  recipient: PublicKey,
  amount: number,
  connection?: Connection
): Promise<MockX402Payment> {
  // Get recent blockhash (or use placeholder for testing)
  let blockhash: string;
  let lastValidBlockHeight: number;

  if (connection) {
    const { blockhash: hash, lastValidBlockHeight: height } =
      await connection.getLatestBlockhash();
    blockhash = hash;
    lastValidBlockHeight = height;
  } else {
    // Placeholder for offline testing
    blockhash = 'placeholder_blockhash_for_testing';
    lastValidBlockHeight = 1000000;
  }

  // Create SOL transfer instruction (mimics x402 USDC transfer structure)
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: recipient,
    lamports: amount,
  });

  // Create transaction message
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [transferInstruction],
  }).compileToV0Message();

  // Create versioned transaction
  const transaction = new VersionedTransaction(message);

  // Sign transaction
  transaction.sign([payer]);

  // Extract signature
  const signature = bs58.encode(transaction.signatures[0]);

  // Hash signature for PDA seed
  const signatureHash = Array.from(
    createHash('sha256').update(signature).digest()
  );

  // Serialize transaction to base64
  const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

  return {
    transaction: serializedTx,
    signature,
    signatureHash,
    payer: payer.publicKey,
    recipient,
    amount,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Create x402 PaymentPayload from mock payment
 *
 * Wraps serialized transaction in x402 PaymentPayload structure
 * exactly as facilitators send in X-PAYMENT header.
 *
 * @param payment - Mock payment from generateMockX402Payment
 * @returns PaymentPayload ready for receipt creation
 */
export function createPaymentPayload(
  payment: MockX402Payment
): PaymentPayload {
  return {
    scheme: 'exact',
    payload: {
      chain: 'solana',
      transaction: payment.transaction,
    },
  };
}

/**
 * Generate X-PAYMENT header value
 *
 * Creates base64-encoded PaymentPayload as sent by x402 facilitators
 *
 * @param payment - Mock payment
 * @returns Base64-encoded X-PAYMENT header value
 */
export function generateXPaymentHeader(payment: MockX402Payment): string {
  const payload = createPaymentPayload(payment);
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Parse mock x402 transaction (same logic as production parser)
 *
 * Extracts payer, recipient, amount from serialized transaction
 *
 * @param serializedTx - Base64-encoded transaction
 * @returns Parsed transaction details
 */
export async function parseMockX402Transaction(
  serializedTx: string
): Promise<{
  signature: string;
  signatureHash: number[];
  payer: PublicKey;
  recipient: PublicKey;
  amount: number;
}> {
  // Deserialize transaction
  const txBuffer = Buffer.from(serializedTx, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuffer);

  // Extract signature
  const signature = bs58.encode(transaction.signatures[0]);

  // Hash signature
  const signatureHash = Array.from(
    createHash('sha256').update(signature).digest()
  );

  // Get account keys from message
  const accountKeys = transaction.message.staticAccountKeys;

  // Payer is first account
  const payer = accountKeys[0];

  // For SystemProgram.transfer:
  // - Account 0: payer (signer)
  // - Account 1: recipient
  // - Account 2: system program
  const recipient = accountKeys[1];

  // Parse amount from instruction data
  // SystemProgram.transfer data layout: [instruction_index(u32), lamports(u64)]
  const instruction = transaction.message.compiledInstructions[0];
  const data = instruction.data;

  // Skip first 4 bytes (instruction index), read next 8 bytes (lamports)
  const amount = Number(
    new BN(data.slice(4, 12), 'le')
  );

  return {
    signature,
    signatureHash,
    payer,
    recipient,
    amount,
  };
}

/**
 * Generate realistic micropayment amounts matching x402 usage
 *
 * @returns Amount in lamports
 */
export function generateRealisticX402Amount(): number {
  // Average x402 payment: $0.078 (78,000 lamports)
  // Range: $0.001 - $1.00 (1,000 - 1,000,000 lamports)

  const amounts = [
    1_000, // $0.001 - Minimum micropayment
    5_000, // $0.005 - Very cheap API call
    10_000, // $0.01 - Single query
    50_000, // $0.05 - Multiple queries
    78_000, // $0.078 - Average x402 payment
    100_000, // $0.10 - Extended service
    500_000, // $0.50 - High-value service
    1_000_000, // $1.00 - Premium service
  ];

  // Weighted towards average (78,000)
  const weights = [5, 10, 15, 20, 30, 15, 3, 2];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < amounts.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return amounts[i];
    }
  }

  return 78_000; // Default to average
}

/**
 * Create a batch of mock x402 payments for load testing
 *
 * @param count - Number of payments to generate
 * @param connection - Optional Solana connection
 * @returns Array of mock payments
 */
export async function generateMockPaymentBatch(
  count: number,
  connection?: Connection
): Promise<MockX402Payment[]> {
  const payments: MockX402Payment[] = [];

  for (let i = 0; i < count; i++) {
    const payer = Keypair.generate();
    const recipient = Keypair.generate().publicKey;
    const amount = generateRealisticX402Amount();

    const payment = await generateMockX402Payment(
      payer,
      recipient,
      amount,
      connection
    );

    payments.push(payment);
  }

  return payments;
}

/**
 * Helper: Verify payment signature matches expected format
 *
 * @param signature - Transaction signature
 * @returns True if valid base58 Solana signature
 */
export function isValidSolanaSignature(signature: string): boolean {
  // Solana signatures are 64-byte ed25519 signatures, base58 encoded
  // Typical length: 87-88 characters
  return signature.length >= 87 && signature.length <= 88;
}

/**
 * Helper: Calculate expected receipt PDA
 *
 * @param payer - Payment payer
 * @param recipient - Payment recipient
 * @param signatureHash - SHA256 hash of signature
 * @param programId - Vote registry program ID
 * @returns Receipt PDA public key and bump
 */
export function deriveReceiptPDA(
  payer: PublicKey,
  recipient: PublicKey,
  signatureHash: number[],
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('tx_receipt'),
      payer.toBuffer(),
      recipient.toBuffer(),
      Buffer.from(signatureHash),
    ],
    programId
  );
}

// Export types
export { Keypair, PublicKey };
