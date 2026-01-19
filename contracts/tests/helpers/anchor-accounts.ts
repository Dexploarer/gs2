/**
 * Helper utilities for accessing accounts from dynamically loaded Anchor IDLs
 *
 * When using `Program<Idl>` with dynamically loaded IDL files,
 * TypeScript doesn't know the account names at compile time.
 * This helper provides type-safe access patterns.
 */
import type { Program, Idl } from '@coral-xyz/anchor';
import type { PublicKey } from '@solana/web3.js';

/**
 * Fetch an account from a program with dynamically loaded IDL
 *
 * @param program - The Anchor program instance
 * @param accountName - The name of the account type
 * @param address - The account's public key
 * @returns The deserialized account data
 *
 * @example
 * const receipt = await fetchAccount(program, 'transactionReceipt', receiptPda);
 * const vote = await fetchAccount(voteProgram, 'peerVote', votePda);
 */
export async function fetchAccount<T = any>(
  program: Program<Idl>,
  accountName: string,
  address: PublicKey
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (program.account as any)[accountName].fetch(address);
}

/**
 * Fetch an account that may not exist
 *
 * @param program - The Anchor program instance
 * @param accountName - The name of the account type
 * @param address - The account's public key
 * @returns The deserialized account data or null if not found
 */
export async function fetchAccountNullable<T = any>(
  program: Program<Idl>,
  accountName: string,
  address: PublicKey
): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (program.account as any)[accountName].fetchNullable(address);
}
