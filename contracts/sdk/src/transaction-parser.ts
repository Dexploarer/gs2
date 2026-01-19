/**
 * x402 Transaction Parser
 * Extracts signature, payer, recipient, and amount from base64-encoded Solana transactions
 */

import {
  VersionedTransaction,
  PublicKey,
  TransactionInstruction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import type { ParsedX402Transaction, ExactSvmPayload } from './x402-types';

/**
 * Token Program IDs (for identifying TransferChecked instructions)
 */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * TransferChecked instruction discriminator (first byte of instruction data)
 */
const TRANSFER_CHECKED_DISCRIMINATOR = 12;

/**
 * Parse base64-encoded transaction from x402 PaymentPayload
 *
 * @param payload - ExactSvmPayload containing base64-encoded transaction
 * @param addressLookupTables - Optional address lookup tables for versioned transactions
 * @returns Parsed transaction data ready for receipt creation
 */
export async function parseX402Transaction(
  payload: ExactSvmPayload,
  addressLookupTables?: AddressLookupTableAccount[]
): Promise<ParsedX402Transaction> {
  // 1. Decode base64 transaction
  const transactionBuffer = Buffer.from(payload.transaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuffer);

  // 2. Extract transaction signature
  const signature = transaction.signatures[0];
  if (!signature) {
    throw new Error('Transaction missing signature');
  }
  const signatureBase58 = Buffer.from(signature).toString('base58');

  // 3. Hash signature for PDA seed (SHA256)
  const signatureHash = Array.from(
    createHash('sha256').update(signatureBase58).digest()
  );

  // 4. Get message and account keys
  const message = transaction.message;
  let accountKeys: PublicKey[];

  if ('compiledInstructions' in message) {
    // Versioned transaction
    accountKeys = message.staticAccountKeys;

    // Add lookup table accounts if provided
    if (addressLookupTables && message.addressTableLookups.length > 0) {
      for (const lookup of message.addressTableLookups) {
        const table = addressLookupTables.find(
          t => t.key.equals(lookup.accountKey)
        );
        if (table) {
          accountKeys = [
            ...accountKeys,
            ...lookup.writableIndexes.map(i => table.state.addresses[i]),
            ...lookup.readonlyIndexes.map(i => table.state.addresses[i]),
          ];
        }
      }
    }
  } else {
    // Legacy transaction
    accountKeys = message.accountKeys;
  }

  // 5. Extract fee payer (first account)
  const payer = accountKeys[0];

  // 6. Find TransferChecked instruction and extract recipient + amount
  const { recipient, amount } = await extractTransferDetails(
    transaction,
    accountKeys
  );

  return {
    signature: signatureBase58,
    signatureHash,
    payer,
    recipient,
    amount,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Extract recipient and amount from TransferChecked instruction
 */
async function extractTransferDetails(
  transaction: VersionedTransaction,
  accountKeys: PublicKey[]
): Promise<{ recipient: PublicKey; amount: bigint }> {
  const message = transaction.message;
  const instructions =
    'compiledInstructions' in message
      ? message.compiledInstructions
      : message.instructions;

  for (const instruction of instructions) {
    const programIdIndex =
      'programIdIndex' in instruction
        ? instruction.programIdIndex
        : accountKeys.indexOf(instruction.programId);

    const programId = accountKeys[programIdIndex];

    // Check if this is a Token or Token-2022 program instruction
    if (
      !programId.equals(TOKEN_PROGRAM_ID) &&
      !programId.equals(TOKEN_2022_PROGRAM_ID)
    ) {
      continue;
    }

    // Check if this is a TransferChecked instruction (discriminator = 12)
    const data =
      'data' in instruction
        ? instruction.data
        : Buffer.from(instruction.data);

    if (data[0] !== TRANSFER_CHECKED_DISCRIMINATOR) {
      continue;
    }

    // TransferChecked instruction account layout:
    // 0: source (token account)
    // 1: mint
    // 2: destination (token account) <- This is what we want
    // 3: owner/authority
    const accountIndexes =
      'accountKeyIndexes' in instruction
        ? instruction.accountKeyIndexes
        : instruction.accounts;

    if (accountIndexes.length < 3) {
      throw new Error('Invalid TransferChecked instruction: missing accounts');
    }

    const destinationIndex = accountIndexes[2];
    const recipient = accountKeys[destinationIndex];

    // Extract amount from instruction data
    // Data layout: [discriminator(1), amount(8), decimals(1)]
    const amount = data.readBigUInt64LE(1);

    return { recipient, amount };
  }

  throw new Error('No TransferChecked instruction found in transaction');
}

/**
 * Create signature hash for PDA derivation
 *
 * @param signature - Transaction signature (base58 string)
 * @returns SHA256 hash as byte array
 */
export function hashSignature(signature: string): number[] {
  return Array.from(createHash('sha256').update(signature).digest());
}

/**
 * Validate that a public key is a valid Solana address
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
