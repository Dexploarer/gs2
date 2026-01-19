/**
 * Transaction Receipt Creator
 * Creates on-chain receipts after x402 payments to enable voting
 */

import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import type {
  ParsedX402Transaction,
  CreateReceiptParams,
  ContentType,
} from './x402-types';

/**
 * Vote Registry Program IDL type
 * (Generated from Anchor build)
 */
type VoteRegistry = any; // Replace with actual IDL type after anchor build

/**
 * Receipt Creator class
 * Handles creating transaction receipts on-chain
 */
export class ReceiptCreator {
  constructor(
    private program: Program<VoteRegistry>,
    private provider: AnchorProvider
  ) {}

  /**
   * Create a transaction receipt from parsed x402 payment data
   *
   * @param txData - Parsed transaction data
   * @param contentType - Type of content delivered
   * @param creatorKeypair - Keypair of creator (must be payer or recipient)
   * @returns Transaction signature
   */
  async createReceipt(
    txData: ParsedX402Transaction,
    contentType: ContentType,
    creatorKeypair: Keypair
  ): Promise<string> {
    // Validate creator is either payer or recipient
    const creatorPubkey = creatorKeypair.publicKey;
    if (
      !creatorPubkey.equals(txData.payer) &&
      !creatorPubkey.equals(txData.recipient)
    ) {
      throw new Error(
        'Creator must be either payer or recipient in the transaction'
      );
    }

    // Derive receipt PDA
    const [receiptPda, receiptBump] = this.deriveReceiptPda(
      txData.payer,
      txData.recipient,
      txData.signatureHash
    );

    // Check if receipt already exists
    const receiptExists = await this.receiptExists(receiptPda);
    if (receiptExists) {
      console.log('Receipt already exists at:', receiptPda.toBase58());
      return ''; // Skip creation
    }

    // Convert amount to u64 (Anchor expects BN or number)
    const amountU64 = Number(txData.amount);

    // Create receipt instruction
    const txSignature = await this.program.methods
      .createTransactionReceipt(
        txData.signature,
        Array.from(txData.signatureHash),
        amountU64,
        { [ContentType[contentType].toLowerCase()]: {} } // Convert enum to Anchor format
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: txData.payer,
        recipientPubkey: txData.recipient,
        creator: creatorPubkey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([creatorKeypair])
      .rpc();

    console.log('Receipt created successfully:', {
      receiptPda: receiptPda.toBase58(),
      signature: txData.signature,
      payer: txData.payer.toBase58(),
      recipient: txData.recipient.toBase58(),
      amount: txData.amount.toString(),
      txSignature,
    });

    return txSignature;
  }

  /**
   * Derive receipt PDA address
   */
  deriveReceiptPda(
    payer: PublicKey,
    recipient: PublicKey,
    signatureHash: number[]
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('tx_receipt'),
        payer.toBuffer(),
        recipient.toBuffer(),
        Buffer.from(signatureHash),
      ],
      this.program.programId
    );
  }

  /**
   * Check if receipt already exists
   */
  async receiptExists(receiptPda: PublicKey): Promise<boolean> {
    try {
      const account = await this.program.account.transactionReceipt.fetch(
        receiptPda
      );
      return account !== null;
    } catch (error: any) {
      // Account not found error means receipt doesn't exist
      if (error.message?.includes('Account does not exist')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Fetch receipt data
   */
  async getReceipt(receiptPda: PublicKey) {
    return await this.program.account.transactionReceipt.fetch(receiptPda);
  }

  /**
   * Find receipt for a specific transaction signature
   */
  async findReceiptBySignature(
    signature: string,
    payer: PublicKey,
    recipient: PublicKey
  ): Promise<PublicKey | null> {
    const { hashSignature } = await import('./transaction-parser');
    const signatureHash = hashSignature(signature);

    const [receiptPda] = this.deriveReceiptPda(payer, recipient, signatureHash);

    const exists = await this.receiptExists(receiptPda);
    return exists ? receiptPda : null;
  }
}

/**
 * Helper function to create ReceiptCreator instance
 */
export function createReceiptCreator(
  program: Program<VoteRegistry>,
  provider: AnchorProvider
): ReceiptCreator {
  return new ReceiptCreator(program, provider);
}
