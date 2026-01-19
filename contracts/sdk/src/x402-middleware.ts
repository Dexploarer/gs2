/**
 * x402 Express/Next.js Middleware
 * Automatically creates transaction receipts after x402 payments
 */

import { Request, Response, NextFunction } from 'express';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { parseX402Transaction } from './transaction-parser';
import { ReceiptCreator } from './receipt-creator';
import type { PaymentPayload, ContentType } from './x402-types';

/**
 * Middleware configuration
 */
export interface X402MiddlewareConfig {
  program: Program<any>;
  provider: AnchorProvider;
  sellerKeypair: Keypair; // Seller's keypair (recipient of payments)
  contentType: ContentType; // Default content type for receipts
  onReceiptCreated?: (receiptPda: PublicKey, txData: any) => void;
  onError?: (error: Error, req: Request) => void;
}

/**
 * Create x402 middleware that auto-creates receipts
 *
 * Usage with Express:
 * ```typescript
 * app.use('/api/protected', x402Middleware(config));
 * ```
 */
export function x402Middleware(config: X402MiddlewareConfig) {
  const receiptCreator = new ReceiptCreator(config.program, config.provider);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Extract payment payload from request
      // x402 protocol sends payment in X-PAYMENT header after 402 response
      const paymentHeader = req.headers['x-payment'] as string;

      if (!paymentHeader) {
        // No payment provided, return 402 Payment Required
        return res.status(402).json({
          error: 'Payment Required',
          message: 'This endpoint requires x402 payment',
        });
      }

      // 2. Parse payment payload
      let paymentPayload: PaymentPayload;
      try {
        paymentPayload = JSON.parse(
          Buffer.from(paymentHeader, 'base64').toString('utf-8')
        );
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid Payment',
          message: 'Could not parse X-PAYMENT header',
        });
      }

      // 3. Parse transaction from payload
      const txData = await parseX402Transaction(paymentPayload.payload);

      // 4. Validate seller is the recipient
      if (!txData.recipient.equals(config.sellerKeypair.publicKey)) {
        return res.status(400).json({
          error: 'Invalid Payment',
          message: 'Payment recipient does not match seller',
        });
      }

      // 5. Create receipt on-chain
      const txSignature = await receiptCreator.createReceipt(
        txData,
        config.contentType,
        config.sellerKeypair
      );

      // 6. Notify callback if provided
      if (config.onReceiptCreated && txSignature) {
        const [receiptPda] = receiptCreator.deriveReceiptPda(
          txData.payer,
          txData.recipient,
          txData.signatureHash
        );
        config.onReceiptCreated(receiptPda, txData);
      }

      // 7. Attach payment data to request for downstream handlers
      (req as any).x402Payment = {
        payer: txData.payer,
        amount: txData.amount,
        signature: txData.signature,
        receiptPda: receiptCreator.deriveReceiptPda(
          txData.payer,
          txData.recipient,
          txData.signatureHash
        )[0],
      };

      // 8. Continue to protected route
      next();
    } catch (error: any) {
      console.error('x402 middleware error:', error);

      if (config.onError) {
        config.onError(error, req);
      }

      return res.status(500).json({
        error: 'Payment Processing Error',
        message: error.message,
      });
    }
  };
}

/**
 * Next.js API route wrapper for x402 payments
 *
 * Usage:
 * ```typescript
 * export default withX402(config)(async (req, res) => {
 *   // Your protected API logic here
 *   res.json({ data: 'Protected content' });
 * });
 * ```
 */
export function withX402(config: X402MiddlewareConfig) {
  const receiptCreator = new ReceiptCreator(config.program, config.provider);

  return function (
    handler: (req: any, res: any) => Promise<void> | void
  ) {
    return async (req: any, res: any) => {
      try {
        // Same logic as Express middleware
        const paymentHeader = req.headers['x-payment'] as string;

        if (!paymentHeader) {
          return res.status(402).json({
            error: 'Payment Required',
            message: 'This endpoint requires x402 payment',
          });
        }

        const paymentPayload: PaymentPayload = JSON.parse(
          Buffer.from(paymentHeader, 'base64').toString('utf-8')
        );

        const txData = await parseX402Transaction(paymentPayload.payload);

        if (!txData.recipient.equals(config.sellerKeypair.publicKey)) {
          return res.status(400).json({
            error: 'Invalid Payment',
            message: 'Payment recipient does not match seller',
          });
        }

        const txSignature = await receiptCreator.createReceipt(
          txData,
          config.contentType,
          config.sellerKeypair
        );

        if (config.onReceiptCreated && txSignature) {
          const [receiptPda] = receiptCreator.deriveReceiptPda(
            txData.payer,
            txData.recipient,
            txData.signatureHash
          );
          config.onReceiptCreated(receiptPda, txData);
        }

        req.x402Payment = {
          payer: txData.payer,
          amount: txData.amount,
          signature: txData.signature,
          receiptPda: receiptCreator.deriveReceiptPda(
            txData.payer,
            txData.recipient,
            txData.signatureHash
          )[0],
        };

        // Call original handler
        return await handler(req, res);
      } catch (error: any) {
        console.error('x402 Next.js error:', error);

        if (config.onError) {
          config.onError(error, req);
        }

        return res.status(500).json({
          error: 'Payment Processing Error',
          message: error.message,
        });
      }
    };
  };
}

/**
 * Type augmentation for Express Request
 */
declare global {
  namespace Express {
    interface Request {
      x402Payment?: {
        payer: PublicKey;
        amount: bigint;
        signature: string;
        receiptPda: PublicKey;
      };
    }
  }
}
