/**
 * Test Fixtures: Transactions
 *
 * Provides consistent test data for transaction and payment-related tests
 */

export const mockTransaction = {
  _id: 'transactions_1_1234567890',
  signature: 'txsig123abc456def',
  agentId: 'agents_1_1234567890',
  amount: 0.05,
  currency: 'USDC',
  status: 'completed' as const,
  timestamp: Date.now() - 3600000,
}

export const mockAgentTransaction = {
  _id: 'agent_tx_1_1234567890',
  agentId: 'agents_1_1234567890',
  txSignature: 'txsig123abc456def',
  type: 'payment_received' as const,
  counterpartyAgentId: 'agents_2_1234567891',
  merchantId: 'merchants_1_1234567890',
  amountUSDC: 0.05,
  feeUSDC: 0.001,
  facilitatorId: 'facilitators_1_1234567890',
  network: 'solana',
  confirmationTime: 500,
  blockNumber: 12345678,
  endpointUrl: 'https://api.example.com/generate',
  serviceName: 'Text Generation',
  status: 'confirmed' as const,
  timestamp: Date.now() - 3600000,
}

export const mockX402Payment = {
  _id: 'x402_1_1234567890',
  txSignature: 'x402sig123abc',
  agentId: 'agents_1_1234567890',
  endpoint: 'https://api.example.com/v1/generate',
  amount: 0.01,
  currency: 'USDC',
  status: 'completed' as const,
  facilitator: 'payai',
  network: 'solana' as const,
  responseTime: 250,
  timestamp: Date.now() - 1800000,
}

export const mockX402PaymentPending = {
  ...mockX402Payment,
  _id: 'x402_2_1234567891',
  txSignature: 'x402sig456def',
  status: 'pending' as const,
}

export const mockX402PaymentFailed = {
  ...mockX402Payment,
  _id: 'x402_3_1234567892',
  txSignature: 'x402sig789ghi',
  status: 'failed' as const,
  errorMessage: 'Insufficient balance',
}

export const mockTransactionList = [
  mockAgentTransaction,
  {
    ...mockAgentTransaction,
    _id: 'agent_tx_2_1234567891',
    txSignature: 'txsig789ghi',
    type: 'payment_sent' as const,
    amountUSDC: 0.02,
    timestamp: Date.now() - 7200000,
  },
  {
    ...mockAgentTransaction,
    _id: 'agent_tx_3_1234567892',
    txSignature: 'txsig012jkl',
    type: 'fee' as const,
    amountUSDC: 0.001,
    timestamp: Date.now() - 10800000,
  },
]

// Helper to create transaction with custom properties
export function createMockTransaction(overrides: Partial<typeof mockAgentTransaction> = {}) {
  return {
    ...mockAgentTransaction,
    _id: `agent_tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    txSignature: `txsig_${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}
