/**
 * x402 Payment Proof Verification (2026 Standard)
 *
 * Cryptographically verify Solana SPL token transfers for x402 payments
 * Required for ERC-8004 reputation registry compliance
 */

import { rpc, toAddress, USDC_DECIMALS, type Address } from './config';
import type { Signature } from '@solana/keys';

// ============================================================================
// Types
// ============================================================================

interface PaymentProof {
  signature: string;
  payer: Address;
  recipient: Address;
  amount: bigint;
  tokenMint: Address;
  timestamp: number;
  blockNumber: number;
}

interface VerificationResult {
  isValid: boolean;
  proof?: PaymentProof;
  error?: string;
}

// ============================================================================
// Payment Verification
// ============================================================================

/**
 * Verify an x402 payment proof on Solana
 *
 * This is the CRITICAL function for ERC-8004 compliance:
 * - Fetches transaction from blockchain
 * - Verifies it's a valid SPL token transfer
 * - Confirms payer and recipient addresses
 * - Validates minimum amount was transferred
 *
 * @param txSignature - Transaction signature (base58)
 * @param expectedPayer - Expected payer address
 * @param expectedRecipient - Expected recipient address
 * @param minAmount - Minimum amount (in token's smallest unit, e.g. lamports for SOL)
 * @param tokenMint - Token mint address (e.g. USDC)
 * @returns Verification result with proof data
 */
export async function verifyX402PaymentProof(
  txSignature: string,
  expectedPayer: string,
  expectedRecipient: string,
  minAmount: bigint,
  tokenMint: string
): Promise<VerificationResult> {
  try {
    // 1. Convert addresses
    const payerAddr = toAddress(expectedPayer);
    const recipientAddr = toAddress(expectedRecipient);
    const mintAddr = toAddress(tokenMint);

    // 2. Fetch transaction with full details
    const tx = await rpc
      .getTransaction(txSignature as Signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
        encoding: 'jsonParsed', // Use parsed format for easier SPL token parsing
      })
      .send();

    if (!tx) {
      return {
        isValid: false,
        error: 'Transaction not found on blockchain'
      };
    }

    // 3. Check transaction succeeded
    if (tx.meta?.err) {
      return {
        isValid: false,
        error: `Transaction failed: ${JSON.stringify(tx.meta.err)}`
      };
    }

    // 4. Parse transaction for SPL token transfer
    // In jsonParsed format, SPL transfers appear in instructions
    const message = tx.transaction.message;

    // Look for SPL Token transfer instruction
    let transferFound = false;
    let actualAmount: bigint = 0n;
    let actualSource: string | null = null;
    let actualDestination: string | null = null;

    // Check both top-level instructions and inner instructions
    type ParsedInstruction = { parsed?: { type?: string; info?: Record<string, unknown> } };
    const innerInstructions = tx.meta?.innerInstructions || [];
    const flatInstructions: unknown[] = innerInstructions.flatMap((inner) => [...inner.instructions]);
    const allInstructions: unknown[] = [
      ...(message.instructions || []),
      ...flatInstructions,
    ];

    for (const instr of allInstructions) {
      const instruction = instr as ParsedInstruction;
      // Check for parsed SPL token transfer
      if (
        instruction.parsed &&
        typeof instruction.parsed === 'object' &&
        instruction.parsed.type &&
        (instruction.parsed.type === 'transfer' || instruction.parsed.type === 'transferChecked')
      ) {
        const info = instruction.parsed.info as Record<string, unknown>;

        // Verify token mint matches
        if (instruction.parsed.type === 'transferChecked' && info?.mint !== tokenMint) {
          continue;
        }

        actualAmount = BigInt(String(info?.amount || (info?.tokenAmount as Record<string, unknown>)?.amount || '0'));
        actualSource = info?.source as string | null;
        actualDestination = info?.destination as string | null;
        transferFound = true;
        break;
      }
    }

    if (!transferFound) {
      return {
        isValid: false,
        error: 'No SPL token transfer found in transaction'
      };
    }

    // 5. Get token account owners (payer and recipient)
    const [sourceInfo, destInfo] = await Promise.all([
      actualSource ? rpc.getAccountInfo(toAddress(actualSource), { encoding: 'jsonParsed' }).send() : null,
      actualDestination ? rpc.getAccountInfo(toAddress(actualDestination), { encoding: 'jsonParsed' }).send() : null,
    ]);

    // Extract owners from parsed token accounts
    const sourceOwner = sourceInfo?.value?.data && typeof sourceInfo.value.data === 'object' && 'parsed' in sourceInfo.value.data
      ? ((sourceInfo.value.data.parsed as { info?: { owner?: string } })?.info?.owner ?? null)
      : null;

    const destOwner = destInfo?.value?.data && typeof destInfo.value.data === 'object' && 'parsed' in destInfo.value.data
      ? ((destInfo.value.data.parsed as { info?: { owner?: string } })?.info?.owner ?? null)
      : null;

    // 6. Verify payer and recipient
    if (sourceOwner !== expectedPayer) {
      return {
        isValid: false,
        error: `Payer mismatch: expected ${expectedPayer}, got ${sourceOwner}`
      };
    }

    if (destOwner !== expectedRecipient) {
      return {
        isValid: false,
        error: `Recipient mismatch: expected ${expectedRecipient}, got ${destOwner}`
      };
    }

    // 7. Verify amount meets minimum
    if (actualAmount < minAmount) {
      return {
        isValid: false,
        error: `Amount too low: ${actualAmount} < ${minAmount}`
      };
    }

    // 8. Success - return proof
    return {
      isValid: true,
      proof: {
        signature: txSignature,
        payer: payerAddr,
        recipient: recipientAddr,
        amount: actualAmount,
        tokenMint: mintAddr,
        timestamp: Number(tx.blockTime || 0) * 1000, // Convert to milliseconds
        blockNumber: Number(tx.slot),
      }
    };

  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error during verification'
    };
  }
}

/**
 * Batch verify multiple payment proofs
 * Useful for verifying multiple reviews/attestations at once
 */
export async function batchVerifyPaymentProofs(
  proofs: Array<{
    signature: string;
    payer: string;
    recipient: string;
    minAmount: bigint;
    tokenMint: string;
  }>
): Promise<VerificationResult[]> {
  return Promise.all(
    proofs.map(p =>
      verifyX402PaymentProof(
        p.signature,
        p.payer,
        p.recipient,
        p.minAmount,
        p.tokenMint
      )
    )
  );
}

/**
 * Create a payment proof hash for Merkle tree
 * Used in on-chain reputation registry
 */
export async function hashPaymentProof(
  signature: string,
  amount: bigint
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${signature}:${amount.toString()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(hashBuffer);
}

/**
 * Generate Merkle root from multiple payment proof hashes
 * Used for on-chain reputation verification
 */
export async function generatePaymentProofMerkleRoot(
  proofs: Array<{ signature: string; amount: bigint }>
): Promise<Uint8Array> {
  if (proofs.length === 0) {
    return new Uint8Array(32).fill(0);
  }

  // Hash all proofs
  const hashes = await Promise.all(
    proofs.map(p => hashPaymentProof(p.signature, p.amount))
  );

  // Build Merkle tree (simple implementation)
  let currentLevel = hashes;

  while (currentLevel.length > 1) {
    const nextLevel: Uint8Array[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length
        ? currentLevel[i + 1]
        : left; // Duplicate last node if odd number

      const combined = new Uint8Array(64);
      combined.set(left, 0);
      combined.set(right, 32);

      const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
      nextLevel.push(new Uint8Array(hashBuffer));
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Verify a USDC payment for merchant review
 * Simplified wrapper for common use case
 */
export async function verifyUSDCPayment(
  signature: string,
  payer: string,
  merchant: string,
  usdcMint: string
): Promise<VerificationResult> {
  // Any amount > 0 is valid for reviews
  return verifyX402PaymentProof(signature, payer, merchant, 1n, usdcMint);
}

/**
 * Verify a payment meets a minimum dollar amount
 * Converts USD amount to token units
 */
export async function verifyMinimumPayment(
  signature: string,
  payer: string,
  recipient: string,
  minUSD: number,
  tokenMint: string,
  decimals: number = USDC_DECIMALS
): Promise<VerificationResult> {
  const minAmount = BigInt(Math.floor(minUSD * Math.pow(10, decimals)));
  return verifyX402PaymentProof(signature, payer, recipient, minAmount, tokenMint);
}
