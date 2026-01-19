/**
 * Component Tests: PaymentCard
 *
 * Tests payment card rendering for different payment states
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { mockX402Payment, mockX402PaymentPending, mockX402PaymentFailed } from '../../fixtures/transactions'

// Mock component for testing
function PaymentCard({
  payment,
  onClick,
  showDetails = false,
}: {
  payment: typeof mockX402Payment
  onClick?: () => void
  showDetails?: boolean
}) {
  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  }

  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(4)} USDC`
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div
      data-testid="payment-card"
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-mono text-sm" data-testid="tx-signature">
            {payment.txSignature.slice(0, 12)}...
          </p>
          <p className="text-xs text-gray-500 mt-1" data-testid="endpoint">
            {payment.endpoint}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold" data-testid="amount">
            {formatAmount(payment.amount)}
          </p>
          <span
            data-testid="status-badge"
            className={`inline-block px-2 py-1 rounded text-xs ${statusColors[payment.status]}`}
          >
            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
          </span>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t" data-testid="details-section">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Facilitator:</span>
              <span className="ml-1" data-testid="facilitator">
                {payment.facilitator}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Network:</span>
              <span className="ml-1" data-testid="network">
                {payment.network}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Response Time:</span>
              <span className="ml-1" data-testid="response-time">
                {payment.responseTime}ms
              </span>
            </div>
            <div>
              <span className="text-gray-500">Time:</span>
              <span className="ml-1" data-testid="timestamp">
                {formatTimestamp(payment.timestamp)}
              </span>
            </div>
          </div>

          {'errorMessage' in payment && payment.errorMessage && (
            <div className="mt-2 p-2 bg-red-50 rounded" data-testid="error-message">
              <span className="text-red-600 text-sm">{payment.errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

describe('PaymentCard Component', () => {
  describe('basic rendering', () => {
    it('renders transaction signature', () => {
      render(<PaymentCard payment={mockX402Payment} />)

      expect(screen.getByTestId('tx-signature')).toHaveTextContent('x402sig123ab')
    })

    it('renders payment endpoint', () => {
      render(<PaymentCard payment={mockX402Payment} />)

      expect(screen.getByTestId('endpoint')).toHaveTextContent(mockX402Payment.endpoint)
    })

    it('renders formatted amount', () => {
      render(<PaymentCard payment={mockX402Payment} />)

      expect(screen.getByTestId('amount')).toHaveTextContent('$0.0100 USDC')
    })
  })

  describe('status display', () => {
    it('shows completed status with green styling', () => {
      render(<PaymentCard payment={mockX402Payment} />)

      const badge = screen.getByTestId('status-badge')
      expect(badge).toHaveTextContent('Completed')
      expect(badge).toHaveClass('bg-green-100')
    })

    it('shows pending status with yellow styling', () => {
      render(<PaymentCard payment={mockX402PaymentPending} />)

      const badge = screen.getByTestId('status-badge')
      expect(badge).toHaveTextContent('Pending')
      expect(badge).toHaveClass('bg-yellow-100')
    })

    it('shows failed status with red styling', () => {
      render(<PaymentCard payment={mockX402PaymentFailed} />)

      const badge = screen.getByTestId('status-badge')
      expect(badge).toHaveTextContent('Failed')
      expect(badge).toHaveClass('bg-red-100')
    })
  })

  describe('details section', () => {
    it('hides details by default', () => {
      render(<PaymentCard payment={mockX402Payment} />)

      expect(screen.queryByTestId('details-section')).not.toBeInTheDocument()
    })

    it('shows details when showDetails is true', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      expect(screen.getByTestId('details-section')).toBeInTheDocument()
    })

    it('displays facilitator name', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      expect(screen.getByTestId('facilitator')).toHaveTextContent('payai')
    })

    it('displays network', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      expect(screen.getByTestId('network')).toHaveTextContent('solana')
    })

    it('displays response time', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      expect(screen.getByTestId('response-time')).toHaveTextContent('250ms')
    })

    it('displays formatted timestamp', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      const timestamp = screen.getByTestId('timestamp')
      expect(timestamp).toBeInTheDocument()
      // Should contain date parts
      expect(timestamp.textContent).toMatch(/\d/)
    })
  })

  describe('error messages', () => {
    it('shows error message for failed payments', () => {
      render(<PaymentCard payment={mockX402PaymentFailed} showDetails={true} />)

      expect(screen.getByTestId('error-message')).toHaveTextContent('Insufficient balance')
    })

    it('does not show error message for successful payments', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<PaymentCard payment={mockX402Payment} onClick={handleClick} />)

      fireEvent.click(screen.getByTestId('payment-card'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('has button role when clickable', () => {
      const handleClick = vi.fn()
      render(<PaymentCard payment={mockX402Payment} onClick={handleClick} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('does not have button role when not clickable', () => {
      render(<PaymentCard payment={mockX402Payment} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('amount formatting', () => {
    it('formats small amounts correctly', () => {
      const smallPayment = { ...mockX402Payment, amount: 0.0001 }
      render(<PaymentCard payment={smallPayment} />)

      expect(screen.getByTestId('amount')).toHaveTextContent('$0.0001 USDC')
    })

    it('formats larger amounts correctly', () => {
      const largePayment = { ...mockX402Payment, amount: 100.5 }
      render(<PaymentCard payment={largePayment} />)

      expect(screen.getByTestId('amount')).toHaveTextContent('$100.5000 USDC')
    })
  })

  describe('accessibility', () => {
    it('has accessible content', () => {
      render(<PaymentCard payment={mockX402Payment} showDetails={true} />)

      expect(screen.getByText('Facilitator:')).toBeInTheDocument()
      expect(screen.getByText('Network:')).toBeInTheDocument()
      expect(screen.getByText('Response Time:')).toBeInTheDocument()
    })
  })
})
