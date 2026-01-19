/**
 * Solana utility functions (Web3.js v5)
 */

import { address, type Address } from '@solana/addresses'
import { generateKeyPairSigner, createSignerFromKeyPair as _createSignerFromKeyPair } from '@solana/signers'
import type { KeyPairSigner } from '@solana/signers'

/**
 * Validate Solana address
 */
export function isValidAddress(addr: string): boolean {
  try {
    address(addr as Address)
    return true
  } catch {
    return false
  }
}

/**
 * Create a new keypair signer (for testing)
 */
export async function createTestSigner(): Promise<KeyPairSigner> {
  return await generateKeyPairSigner()
}

/**
 * Lamports to SOL conversion
 */
export function lamportsToSol(lamports: bigint | number): number {
  const lamportsNum = typeof lamports === 'bigint' ? Number(lamports) : lamports
  return lamportsNum / 1_000_000_000
}

/**
 * SOL to lamports conversion
 */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000))
}
