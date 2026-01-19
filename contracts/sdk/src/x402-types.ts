/**
 * x402 Payment Protocol Types
 * Based on Coinbase x402 v2 specification
 */

import { PublicKey } from '@solana/web3.js';

/**
 * x402 v2 PaymentPayload structure
 */
export interface PaymentPayload {
  x402Version: number;
  payload: ExactSvmPayload;
  accepted: PaymentRequirements;
  resource?: ResourceInfo;
  extensions?: Record<string, any>;
}

/**
 * Solana (SVM) payment payload for "exact" scheme
 */
export interface ExactSvmPayload {
  transaction: string; // Base64-encoded, partially-signed Solana transaction
}

/**
 * Payment requirements accepted by the client
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string; // Recipient public key
}

/**
 * Optional resource information
 */
export interface ResourceInfo {
  uri: string;
  method: string;
}

/**
 * Parsed transaction data extracted from x402 payment
 */
export interface ParsedX402Transaction {
  signature: string; // Transaction signature (base58)
  signatureHash: number[]; // SHA256 hash of signature for PDA seed
  payer: PublicKey; // Transaction fee payer
  recipient: PublicKey; // Token recipient from TransferChecked instruction
  amount: bigint; // Payment amount in lamports or token base units
  timestamp: number; // Current timestamp (seconds since epoch)
}

/**
 * Content type enum matching on-chain ContentType
 */
export enum ContentType {
  Chat = 0,
  Audio = 1,
  Video = 2,
  Image = 3,
  Data = 4,
  Compute = 5,
  Other = 6,
}

/**
 * Transaction receipt creation parameters
 */
export interface CreateReceiptParams {
  signature: string;
  signatureHash: number[];
  payer: PublicKey;
  recipient: PublicKey;
  amount: bigint;
  contentType: ContentType;
  creatorKeypair: any; // Keypair for signing (must be payer or recipient)
}
