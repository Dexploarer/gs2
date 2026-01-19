/**
 * Type declarations for spl-token-bankrun
 * This module provides SPL Token helper functions for solana-bankrun testing
 */
declare module 'spl-token-bankrun' {
  import { PublicKey } from '@solana/web3.js';

  export function createMint(
    banksClient: any,
    payer: any,
    mintAuthority: any,
    freezeAuthority: any,
    decimals: number
  ): Promise<PublicKey>;

  export function createAccount(
    banksClient: any,
    payer: any,
    mint: any,
    owner: any
  ): Promise<PublicKey>;

  export function mintTo(
    banksClient: any,
    payer: any,
    mint: any,
    destination: any,
    authority: any,
    amount: number
  ): Promise<void>;

  export function transfer(
    banksClient: any,
    owner: any,
    source: any,
    destination: any,
    authority: any,
    amount: number
  ): Promise<any>;

  export function getAccount(
    banksClient: any,
    address: any
  ): Promise<{
    mint: PublicKey;
    owner: PublicKey;
    amount: bigint;
    delegate: PublicKey | null;
    delegatedAmount: bigint;
    isInitialized: boolean;
    isFrozen: boolean;
    isNative: boolean;
  }>;

  export const TOKEN_PROGRAM_ID: PublicKey;
}
