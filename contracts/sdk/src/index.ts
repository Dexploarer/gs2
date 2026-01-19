/**
 * GhostSpeak x402 Integration SDK
 * Automatic transaction receipt creation for transaction-gated voting
 */

// Core types
export type {
  PaymentPayload,
  ExactSvmPayload,
  PaymentRequirements,
  ResourceInfo,
  ParsedX402Transaction,
  CreateReceiptParams,
} from './x402-types';

export { ContentType } from './x402-types';

// Transaction parsing
export {
  parseX402Transaction,
  hashSignature,
  isValidPublicKey,
} from './transaction-parser';

// Receipt creation
export {
  ReceiptCreator,
  createReceiptCreator,
} from './receipt-creator';

// Middleware
export {
  x402Middleware,
  withX402,
  type X402MiddlewareConfig,
} from './x402-middleware';
