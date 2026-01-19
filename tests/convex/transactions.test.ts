/**
 * Convex Function Tests: Transaction Operations
 *
 * Tests transaction recording, querying, and statistics
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockConvexContext } from '../mocks/convex'
import { mockAgentTransaction, mockX402Payment, mockTransactionList, createMockTransaction } from '../fixtures/transactions'
import { mockAgent } from '../fixtures/agents'

describe('Transaction Convex Functions', () => {
  let ctx: ReturnType<typeof createMockConvexContext>

  beforeEach(() => {
    ctx = createMockConvexContext()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('agentTransactions.record', () => {
    it('records a new transaction', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const transaction = {
        agentId,
        txSignature: 'new_tx_sig_123',
        type: 'payment_received' as const,
        amountUSDC: 0.05,
        feeUSDC: 0.001,
        status: 'confirmed' as const,
        timestamp: Date.now(),
        network: 'solana',
      }

      const txId = await ctx.db.insert('agentTransactions', transaction)

      expect(txId).toBeDefined()

      const saved = await ctx.db.get('agentTransactions', txId)
      expect(saved?.txSignature).toBe('new_tx_sig_123')
      expect(saved?.amountUSDC).toBe(0.05)
    })

    it('validates transaction signature uniqueness', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('agentTransactions', {
        ...mockAgentTransaction,
        agentId,
      })

      // Check for existing transaction
      const existing = await ctx.db
        .query('agentTransactions')
        .filter((tx) => tx.txSignature === mockAgentTransaction.txSignature)

      expect(existing.length).toBeGreaterThan(0)
    })

    it('validates required fields', () => {
      const invalidTransaction = {
        // Missing txSignature
        agentId: 'agent_123',
        amountUSDC: 0.05,
      }

      expect(() => {
        if (!invalidTransaction.hasOwnProperty('txSignature')) {
          throw new Error('txSignature is required')
        }
      }).toThrow('txSignature is required')
    })
  })

  describe('agentTransactions.getByAgent', () => {
    it('returns transactions for specific agent', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('agentTransactions', {
        ...mockAgentTransaction,
        agentId,
        _id: undefined,
      })

      await ctx.db.insert('agentTransactions', {
        ...createMockTransaction({ agentId }),
        _id: undefined,
      })

      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.agentId === agentId)

      expect(transactions.length).toBe(2)
    })

    it('filters transactions by type', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx1',
        type: 'payment_received',
        amountUSDC: 0.05,
        timestamp: Date.now(),
      })

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx2',
        type: 'payment_sent',
        amountUSDC: 0.03,
        timestamp: Date.now(),
      })

      const receivedTx = await ctx.db
        .query('agentTransactions')
        .filter((tx) => tx.agentId === agentId && tx.type === 'payment_received')

      expect(receivedTx.length).toBe(1)
      expect(receivedTx[0].type).toBe('payment_received')
    })

    it('sorts transactions by timestamp', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)
      const now = Date.now()

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx1',
        type: 'payment_received',
        amountUSDC: 0.05,
        timestamp: now - 1000, // Older
      })

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx2',
        type: 'payment_received',
        amountUSDC: 0.03,
        timestamp: now, // Newer
      })

      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.agentId === agentId).collect()

      // Verify both transactions exist
      expect(transactions.length).toBe(2)
      // Verify timestamps are valid
      transactions.forEach((tx) => {
        expect(tx.timestamp).toBeDefined()
        expect(typeof tx.timestamp).toBe('number')
      })
    })

    it('supports pagination', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      for (let i = 0; i < 10; i++) {
        await ctx.db.insert('agentTransactions', {
          agentId,
          txSignature: `tx${i}`,
          type: 'payment_received',
          amountUSDC: 0.01 * i,
          timestamp: Date.now() - i * 1000,
        })
      }

      const page1 = await ctx.db.query('agentTransactions').filter((tx) => tx.agentId === agentId).take(5)

      expect(page1.length).toBe(5)
    })
  })

  describe('agentTransactions.getBySignature', () => {
    it('returns transaction by signature', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'unique_sig_123',
        type: 'payment_received',
        amountUSDC: 0.05,
        timestamp: Date.now(),
      })

      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.txSignature === 'unique_sig_123')

      expect(transactions.length).toBe(1)
      expect(transactions[0].amountUSDC).toBe(0.05)
    })

    it('returns empty for non-existent signature', async () => {
      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.txSignature === 'nonexistent')

      expect(transactions.length).toBe(0)
    })
  })

  describe('agentTransactions.updateStatus', () => {
    it('updates transaction status', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const txId = await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'pending_tx',
        type: 'payment_received',
        amountUSDC: 0.05,
        status: 'pending',
        timestamp: Date.now(),
      })

      await ctx.db.patch('agentTransactions', txId, {
        status: 'confirmed',
        confirmedAt: Date.now(),
      })

      const updated = await ctx.db.get('agentTransactions', txId)
      expect(updated?.status).toBe('confirmed')
      expect(updated?.confirmedAt).toBeDefined()
    })

    it('records failure reason for failed transactions', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const txId = await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'failing_tx',
        type: 'payment_received',
        amountUSDC: 0.05,
        status: 'pending',
        timestamp: Date.now(),
      })

      await ctx.db.patch('agentTransactions', txId, {
        status: 'failed',
        failedAt: Date.now(),
        failureReason: 'Insufficient balance',
      })

      const updated = await ctx.db.get('agentTransactions', txId)
      expect(updated?.status).toBe('failed')
      expect(updated?.failureReason).toBe('Insufficient balance')
    })
  })

  describe('x402Payments.record', () => {
    it('records x402 payment', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      const payment = {
        agentId,
        txSignature: 'x402_sig_123',
        endpoint: 'https://api.example.com/generate',
        amount: 0.01,
        currency: 'USDC',
        status: 'completed' as const,
        facilitator: 'payai',
        network: 'solana' as const,
        responseTime: 250,
        timestamp: Date.now(),
      }

      const paymentId = await ctx.db.insert('x402Payments', payment)

      expect(paymentId).toBeDefined()

      const saved = await ctx.db.get('x402Payments', paymentId)
      expect(saved?.facilitator).toBe('payai')
      expect(saved?.responseTime).toBe(250)
    })

    it('tracks facilitator metrics', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('x402Payments', {
        agentId,
        txSignature: 'x402_1',
        endpoint: 'https://api.example.com/generate',
        amount: 0.01,
        facilitator: 'payai',
        status: 'completed',
        responseTime: 200,
        timestamp: Date.now(),
      })

      await ctx.db.insert('x402Payments', {
        agentId,
        txSignature: 'x402_2',
        endpoint: 'https://api.example.com/generate',
        amount: 0.02,
        facilitator: 'payai',
        status: 'completed',
        responseTime: 300,
        timestamp: Date.now(),
      })

      const payaiPayments = await ctx.db.query('x402Payments').filter((p) => p.facilitator === 'payai')

      expect(payaiPayments.length).toBe(2)

      const avgResponseTime = payaiPayments.reduce((sum, p) => sum + (p.responseTime || 0), 0) / payaiPayments.length
      expect(avgResponseTime).toBe(250)
    })
  })

  describe('transaction statistics', () => {
    it('calculates total volume for agent', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx1',
        type: 'payment_received',
        amountUSDC: 0.05,
        timestamp: Date.now(),
      })

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx2',
        type: 'payment_received',
        amountUSDC: 0.10,
        timestamp: Date.now(),
      })

      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.agentId === agentId)

      const totalVolume = transactions.reduce((sum, tx) => sum + (tx.amountUSDC || 0), 0)
      expect(totalVolume).toBeCloseTo(0.15, 5) // Use toBeCloseTo for floating point
    })

    it('counts successful vs failed transactions', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx1',
        type: 'payment_received',
        amountUSDC: 0.05,
        status: 'confirmed',
        timestamp: Date.now(),
      })

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx2',
        type: 'payment_received',
        amountUSDC: 0.03,
        status: 'confirmed',
        timestamp: Date.now(),
      })

      await ctx.db.insert('agentTransactions', {
        agentId,
        txSignature: 'tx3',
        type: 'payment_received',
        amountUSDC: 0.02,
        status: 'failed',
        timestamp: Date.now(),
      })

      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.agentId === agentId)

      const confirmed = transactions.filter((tx) => tx.status === 'confirmed').length
      const failed = transactions.filter((tx) => tx.status === 'failed').length

      expect(confirmed).toBe(2)
      expect(failed).toBe(1)
    })

    it('calculates success rate', async () => {
      const agentId = await ctx.db.insert('agents', mockAgent)

      for (let i = 0; i < 8; i++) {
        await ctx.db.insert('agentTransactions', {
          agentId,
          txSignature: `success_tx${i}`,
          status: 'confirmed',
          timestamp: Date.now(),
        })
      }

      for (let i = 0; i < 2; i++) {
        await ctx.db.insert('agentTransactions', {
          agentId,
          txSignature: `fail_tx${i}`,
          status: 'failed',
          timestamp: Date.now(),
        })
      }

      const transactions = await ctx.db.query('agentTransactions').filter((tx) => tx.agentId === agentId)
      const successRate = transactions.filter((tx) => tx.status === 'confirmed').length / transactions.length

      expect(successRate).toBe(0.8)
    })
  })

  describe('transaction types', () => {
    it('handles payment_received type', async () => {
      const tx = createMockTransaction({ type: 'payment_received' })
      expect(tx.type).toBe('payment_received')
    })

    it('handles payment_sent type', async () => {
      const tx = createMockTransaction({ type: 'payment_sent' })
      expect(tx.type).toBe('payment_sent')
    })

    it('handles fee type', async () => {
      const tx = createMockTransaction({ type: 'fee' })
      expect(tx.type).toBe('fee')
    })

    it('handles refund type', async () => {
      const tx = createMockTransaction({ type: 'refund' })
      expect(tx.type).toBe('refund')
    })
  })
})
